"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { publish } from "@/lib/sse";
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
  pool: string[];
  eligibilityReset: boolean;
}

interface SelectionContext {
  eventId: string;
  prizeId: string;
  selection: DrawSelection;
  winner: EntryForSelection;
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

  const entries = await db.entry.findMany({
    where: { eventId: prize.eventId },
    select: {
      id: true,
      entrantId: true,
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
  }));

  const lockedSiblings = await db.prize.findMany({
    where: {
      eventId: prize.eventId,
      lockedAt: { not: null },
      NOT: { id: prizeId },
    },
    select: { winningEntry: { select: { entrantId: true } } },
  });
  const alreadyWonEntrantIds = new Set(
    lockedSiblings
      .map((p) => p.winningEntry?.entrantId)
      .filter((x): x is string => Boolean(x)),
  );

  const { eligible, reset: eligibilityReset } = filterEligible(
    entriesForSelection,
    alreadyWonEntrantIds,
  );
  const winner = pickWinner(eligible);
  const pool = samplePool(winner, entriesForSelection);

  return {
    ok: true,
    data: {
      eventId: prize.eventId,
      prizeId: prize.id,
      winner,
      selection: {
        winnerEntryId: winner.id,
        winnerEntrantId: winner.entrantId,
        winnerDisplayName: winner.entrantDisplayName,
        pool,
        eligibilityReset,
      },
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

  publish(prize.eventId, "winner_locked", {
    prizeId,
    entryId,
    lockedAt: lockedAt.toISOString(),
  });

  revalidatePath(`/events/${prize.eventId}`);
  revalidatePath(`/events/${prize.eventId}/draw`);
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
