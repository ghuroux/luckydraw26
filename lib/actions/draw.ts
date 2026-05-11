"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { publish } from "@/lib/sse";
import { sendTemplateEmail } from "@/lib/email/send";
import {
  filterEligible,
  pickWinner,
  samplePool,
  type EntryForSelection,
} from "@/lib/rng";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface DrawSelection {
  winnerEntryId: string;
  winnerEntrantId: string;
  winnerDisplayName: string;
  winnerTicketNumber: number;
  pool: string[];
  eligibilityReset: boolean;
}

interface SelectionContext {
  eventId: string;
  prizeId: string;
  selection: DrawSelection;
  winner: EntryForSelection;
}

async function selectEligibleWinner(
  eventId: string,
  opts: { excludePrizeId?: string } = {},
): Promise<
  | { ok: true; selection: DrawSelection; winner: EntryForSelection }
  | { ok: false; error: string }
> {
  const entries = await db.entry.findMany({
    where: { eventId },
    select: {
      id: true,
      entrantId: true,
      ticketNumber: true,
      entrant: { select: { firstName: true, lastName: true } },
    },
  });
  if (entries.length === 0) {
    return { ok: false, error: "No entries to draw from." };
  }

  const entriesForSelection: EntryForSelection[] = entries.map((e) => ({
    id: e.id,
    entrantId: e.entrantId,
    entrantDisplayName: `${e.entrant.firstName} ${e.entrant.lastName}`,
    ticketNumber: e.ticketNumber,
  }));

  const lockedSiblings = await db.prize.findMany({
    where: {
      eventId,
      lockedAt: { not: null },
      ...(opts.excludePrizeId ? { NOT: { id: opts.excludePrizeId } } : {}),
    },
    select: { winningEntry: { select: { entrantId: true } } },
  });
  const parkedEntries = await db.entry.findMany({
    where: { eventId, wonAt: { not: null } },
    select: { entrantId: true },
  });
  const alreadyWonEntrantIds = new Set<string>();
  for (const p of lockedSiblings) {
    if (p.winningEntry?.entrantId) {
      alreadyWonEntrantIds.add(p.winningEntry.entrantId);
    }
  }
  for (const e of parkedEntries) {
    alreadyWonEntrantIds.add(e.entrantId);
  }

  const { eligible, reset: eligibilityReset } = filterEligible(
    entriesForSelection,
    alreadyWonEntrantIds,
  );
  const winner = pickWinner(eligible);
  const pool = samplePool(winner, entriesForSelection);

  return {
    ok: true,
    winner,
    selection: {
      winnerEntryId: winner.id,
      winnerEntrantId: winner.entrantId,
      winnerDisplayName: winner.entrantDisplayName,
      winnerTicketNumber: winner.ticketNumber,
      pool,
      eligibilityReset,
    },
  };
}

async function runSelection(
  prizeId: string,
): Promise<{ ok: true; data: SelectionContext } | { ok: false; error: string }> {
  const prize = await db.prize.findUnique({
    where: { id: prizeId },
    include: { event: { select: { id: true, status: true } } },
  });
  if (!prize) return { ok: false, error: "Prize not found." };
  if (prize.event.status !== "OPEN" && prize.event.status !== "CLOSED") {
    return {
      ok: false,
      error: "Draws can only run on open or closed events.",
    };
  }
  if (prize.lockedAt) {
    return { ok: false, error: "This prize is already locked in." };
  }

  const result = await selectEligibleWinner(prize.eventId, {
    excludePrizeId: prizeId,
  });
  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      eventId: prize.eventId,
      prizeId: prize.id,
      winner: result.winner,
      selection: result.selection,
    },
  };
}

export async function startDraw(
  prizeId: string,
): Promise<ActionResult<DrawSelection>> {
  await requireRole("STAFF");

  const result = await runSelection(prizeId);
  if (!result.ok) return result;
  const { eventId, selection, winner } = result.data;

  await logAudit({
    action: "PRIZE_DRAWN",
    entityType: "Prize",
    entityId: prizeId,
    metadata: {
      eventId,
      entryId: winner.id,
      entrantId: winner.entrantId,
      eligibilityReset: selection.eligibilityReset,
    },
  });

  publish(eventId, "draw_started", { prizeId });
  publish(eventId, "draw_winner_revealed", { prizeId, ...selection });

  return { ok: true, data: selection };
}

export async function testDraw(
  prizeId: string,
): Promise<ActionResult<DrawSelection>> {
  await requireRole("STAFF");

  const result = await runSelection(prizeId);
  if (!result.ok) return result;
  const { eventId, selection, winner } = result.data;

  await logAudit({
    action: "PRIZE_TEST_DRAWN",
    entityType: "Prize",
    entityId: prizeId,
    metadata: {
      eventId,
      entryId: winner.id,
      entrantId: winner.entrantId,
      eligibilityReset: selection.eligibilityReset,
    },
  });

  publish(eventId, "draw_test_started", { prizeId });
  publish(eventId, "draw_test_winner_revealed", { prizeId, ...selection });

  return { ok: true, data: selection };
}

export async function lockWinner(
  prizeId: string,
  entryId: string,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const prize = await db.prize.findUnique({
    where: { id: prizeId },
    select: {
      eventId: true,
      lockedAt: true,
      event: { select: { status: true } },
    },
  });
  if (!prize) return { ok: false, error: "Prize not found." };
  if (prize.event.status !== "OPEN" && prize.event.status !== "CLOSED") {
    return {
      ok: false,
      error: "Lock-in is only allowed on open or closed events.",
    };
  }
  if (prize.lockedAt) {
    return { ok: false, error: "This prize is already locked in." };
  }

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: { eventId: true },
  });
  if (!entry || entry.eventId !== prize.eventId) {
    return { ok: false, error: "Entry does not belong to this event." };
  }

  const lockedAt = new Date();
  try {
    // updateMany + lockedAt:null guard makes this atomic against a parallel
    // lock-in attempt for the same prize. The @unique on winningEntryId
    // additionally prevents the same entry winning two prizes.
    const result = await db.prize.updateMany({
      where: { id: prizeId, lockedAt: null },
      data: { winningEntryId: entryId, lockedAt },
    });
    if (result.count === 0) {
      return {
        ok: false,
        error: "This prize was just locked in by another admin.",
      };
    }
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "This entry is already a winner of another prize.",
      };
    }
    throw e;
  }

  await logAudit({
    action: "WINNER_LOCKED",
    entityType: "Prize",
    entityId: prizeId,
    metadata: { eventId: prize.eventId, entryId },
  });

  // Fire winner-notification fire-and-forget so the operator's "Lock in"
  // → "next prize" loop isn't gated on SMTP latency. Email failures are
  // recorded in EmailLog (operator can retry from /settings/email-log)
  // and the WINNER_NOTIFIED audit row carries the emailLogId regardless
  // of success or failure.
  notifyWinner(prizeId, entryId).catch((err) => {
    console.error("[notifyWinner] unhandled error", err);
  });

  publish(prize.eventId, "winner_locked", {
    prizeId,
    entryId,
    lockedAt: lockedAt.toISOString(),
  });

  revalidatePath(`/events/${prize.eventId}`);
  revalidatePath(`/events/${prize.eventId}/draw`);
  return { ok: true };
}

// Sends winner-notification + writes WINNER_NOTIFIED audit. Used by both
// lockWinner (auto, fire-and-forget) and sendWinnerEmail (manual). Errors
// are recorded — never thrown — so a failed send doesn't block the lock.
async function notifyWinner(
  prizeId: string,
  entryId: string,
): Promise<{ ok: boolean; error?: string; emailLogId?: string }> {
  const prize = await db.prize.findUnique({
    where: { id: prizeId },
    select: {
      id: true,
      name: true,
      description: true,
      eventId: true,
      event: {
        select: {
          name: true,
          organisation: {
            select: {
              name: true,
              logoUrl: true,
              primaryColor: true,
              contactEmail: true,
            },
          },
        },
      },
    },
  });
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: {
      ticketNumber: true,
      entrant: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });
  if (!prize || !entry) {
    return { ok: false, error: "Winner data missing." };
  }

  const result = await sendTemplateEmail({
    to: entry.entrant.email,
    template: "winner-notification",
    context: {
      organisation: prize.event.organisation,
      recipient: {
        firstName: entry.entrant.firstName,
        lastName: entry.entrant.lastName,
      },
      event: { name: prize.event.name },
      prize: { name: prize.name, description: prize.description },
      ticketNumbers: [entry.ticketNumber],
    },
  });

  await logAudit({
    action: "WINNER_NOTIFIED",
    entityType: "Prize",
    entityId: prizeId,
    metadata: {
      eventId: prize.eventId,
      entryId,
      emailLogId: result.emailLogId,
      ok: result.ok,
    },
  });

  return result.ok
    ? { ok: true, emailLogId: result.emailLogId }
    : { ok: false, error: result.error, emailLogId: result.emailLogId };
}

export async function sendWinnerEmail(
  prizeId: string,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const prize = await db.prize.findUnique({
    where: { id: prizeId },
    select: { winningEntryId: true, lockedAt: true },
  });
  if (!prize) return { ok: false, error: "Prize not found." };
  if (!prize.lockedAt || !prize.winningEntryId) {
    return {
      ok: false,
      error: "Lock the winner first before sending the email.",
    };
  }

  const result = await notifyWinner(prizeId, prize.winningEntryId);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Email send failed.",
    };
  }
  return { ok: true };
}

export async function clearWinner(prizeId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const prize = await db.prize.findUnique({
    where: { id: prizeId },
    select: { eventId: true, lockedAt: true },
  });
  if (!prize) return { ok: false, error: "Prize not found." };
  if (!prize.lockedAt) {
    return { ok: false, error: "This prize is not locked in." };
  }

  const result = await db.prize.updateMany({
    where: { id: prizeId, lockedAt: { not: null } },
    data: { winningEntryId: null, lockedAt: null },
  });
  if (result.count === 0) {
    return { ok: false, error: "This prize is no longer locked in." };
  }

  await logAudit({
    action: "WINNER_CLEARED",
    entityType: "Prize",
    entityId: prizeId,
    metadata: { eventId: prize.eventId },
  });

  publish(prize.eventId, "winner_cleared", { prizeId });

  revalidatePath(`/events/${prize.eventId}`);
  revalidatePath(`/events/${prize.eventId}/draw`);
  return { ok: true };
}

// ─────────── WINNER_DRAW flow ───────────

const drawNextWinnerSchema = z.object({
  eventId: z.string().min(1),
});

export async function drawNextWinner(
  input: z.infer<typeof drawNextWinnerSchema>,
): Promise<ActionResult<DrawSelection>> {
  await requireRole("STAFF");

  const parsed = drawNextWinnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { eventId } = parsed.data;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, drawMode: true },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.drawMode !== "WINNER_DRAW") {
    return { ok: false, error: "This event is not in winner-draw mode." };
  }
  if (event.status !== "OPEN" && event.status !== "CLOSED") {
    return {
      ok: false,
      error: "Draws can only run on open or closed events.",
    };
  }

  const result = await selectEligibleWinner(eventId);
  if (!result.ok) return result;

  publish(eventId, "draw_started", {});
  publish(eventId, "draw_winner_revealed", result.selection);

  return { ok: true, data: result.selection };
}

const selectPrizeForWinnerSchema = z.object({
  eventId: z.string().min(1),
  prizeId: z.string().min(1),
  entryId: z.string().min(1),
});

export async function selectPrizeForWinner(
  input: z.infer<typeof selectPrizeForWinnerSchema>,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = selectPrizeForWinnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { eventId, prizeId, entryId } = parsed.data;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { drawMode: true },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.drawMode !== "WINNER_DRAW") {
    return { ok: false, error: "This event is not in winner-draw mode." };
  }

  // Reuse the existing lock path so the DB write, audit log, and winner_locked
  // SSE event stay in one place. The WINNER_DRAW-specific signal is the
  // additional prize_selected event published below.
  const lockResult = await lockWinner(prizeId, entryId);
  if (!lockResult.ok) return lockResult;

  // Clear the parked-winner marker if this is a deferred assignment.
  // No-op for entries that were never parked.
  await db.entry.updateMany({
    where: { id: entryId, wonAt: { not: null } },
    data: { wonAt: null },
  });

  const prize = await db.prize.findUnique({
    where: { id: prizeId },
    select: { name: true },
  });

  publish(eventId, "prize_selected", {
    entryId,
    prizeId,
    prizeName: prize?.name ?? "",
  });

  return { ok: true };
}

const parkPendingWinnerSchema = z.object({
  eventId: z.string().min(1),
  entryId: z.string().min(1),
});

export async function parkPendingWinner(
  input: z.infer<typeof parkPendingWinnerSchema>,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parkPendingWinnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { eventId, entryId } = parsed.data;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { drawMode: true, status: true },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.drawMode !== "WINNER_DRAW") {
    return { ok: false, error: "This event is not in winner-draw mode." };
  }
  if (event.status !== "OPEN" && event.status !== "CLOSED") {
    return {
      ok: false,
      error: "Parking is only allowed on open or closed events.",
    };
  }

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: {
      eventId: true,
      wonAt: true,
      entrant: { select: { firstName: true, lastName: true } },
    },
  });
  if (!entry || entry.eventId !== eventId) {
    return { ok: false, error: "Entry does not belong to this event." };
  }
  if (entry.wonAt) {
    return { ok: false, error: "This entrant is already parked." };
  }

  const parkedAt = new Date();
  await db.entry.update({
    where: { id: entryId },
    data: { wonAt: parkedAt },
  });

  await logAudit({
    action: "WINNER_PARKED",
    entityType: "Entry",
    entityId: entryId,
    metadata: { eventId, parkedAt: parkedAt.toISOString() },
  });

  publish(eventId, "winner_parked", {
    entryId,
    entrantDisplayName: `${entry.entrant.firstName} ${entry.entrant.lastName}`,
  });

  revalidatePath(`/events/${eventId}/draw`);
  return { ok: true };
}

const abortPendingDrawSchema = z.object({
  eventId: z.string().min(1),
  abortedEntryId: z.string().min(1),
});

export async function abortPendingDraw(
  input: z.infer<typeof abortPendingDrawSchema>,
): Promise<ActionResult> {
  await requireRole("STAFF");

  const parsed = abortPendingDrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { eventId, abortedEntryId } = parsed.data;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { drawMode: true },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.drawMode !== "WINNER_DRAW") {
    return { ok: false, error: "This event is not in winner-draw mode." };
  }

  const entry = await db.entry.findUnique({
    where: { id: abortedEntryId },
    select: { entrantId: true, eventId: true },
  });
  if (!entry || entry.eventId !== eventId) {
    return { ok: false, error: "Entry does not belong to this event." };
  }

  await logAudit({
    action: "DRAW_ABORTED",
    entityType: "Event",
    entityId: eventId,
    metadata: {
      abortedEntryId,
      abortedEntrantId: entry.entrantId,
    },
  });

  publish(eventId, "draw_aborted", { abortedEntryId });

  return { ok: true };
}
