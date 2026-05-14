"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EntrySource, PaymentMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { DEFAULT_PAGE_SIZE, pageInfo } from "@/lib/pagination";

const decimalString = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Use a number with up to 2 decimals.",
  );

const newEntrantSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(50).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  sponsorShareOptIn: z.boolean(),
  smsOptIn: z.boolean(),
});

const createEntrySchema = z
  .object({
    // Either an existing entrant or new entrant fields. Validated as a discriminated union.
    entrant: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("existing"), id: z.string().min(1) }),
      z.object({ mode: z.literal("new"), data: newEntrantSchema }),
    ]),
    // A package, individual entries, or both. At least one must be set.
    selection: z
      .object({
        packageId: z.string().min(1).optional(),
        individualQty: z.number().int().min(0).optional(),
      })
      .refine((s) => !!s.packageId || (s.individualQty ?? 0) > 0, {
        message: "Pick a package or set a quantity.",
      }),
    donationAmount: z.union([decimalString, z.literal("")]).optional(),
    paymentRef: z.string().max(200).optional().or(z.literal("")),
    paymentMethod: z.enum(["CASH", "CARD"]).optional(),
    source: z.enum(["ADMIN", "TABLET"]).optional(),
  })
  .strict();

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface ListEntriesParams {
  eventId: string;
  paidFilter?: "ALL" | "PAID" | "UNPAID";
  source?: EntrySource | "ALL";
  page?: number;
  pageSize?: number;
}

export async function listEntries({
  eventId,
  paidFilter = "ALL",
  source = "ALL",
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: ListEntriesParams) {
  await requireRole("STAFF");

  const where: Prisma.EntryWhereInput = { eventId };
  if (paidFilter === "PAID") where.paidAt = { not: null };
  if (paidFilter === "UNPAID") where.paidAt = null;
  if (source && source !== "ALL") where.source = source;

  const [entries, total] = await db.$transaction([
    db.entry.findMany({
      where,
      orderBy: { ticketNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        entrant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        package: { select: { id: true, label: true, cost: true } },
      },
    }),
    db.entry.count({ where }),
  ]);

  return {
    entries,
    pagination: pageInfo(page, pageSize, total),
  };
}

// ───────────────── Per-entrant grouped view ─────────────────
// The flat per-ticket view is good for auditing a specific ticket #, but
// useless for reconciliation — a 50-pack produces 50 nearly-identical rows.
// Operators reconcile per-person ("did Andrew pay his bill?"), so this view
// rolls the per-ticket rows up into one row per entrant per event with
// paid/unpaid breakdown + total spend.

export interface EntrantEntryRow {
  id: string;
  ticketNumber: number;
  source: EntrySource;
  packageId: string | null;
  packageLabel: string | null;
  packageEntryNum: number | null;
  paidAt: Date | null;
  paymentMethod: PaymentMethod | null;
  paymentRef: string | null;
  donationAmount: string | null;
  perTicketCost: number;
}

export interface EntrantSummaryForEvent {
  entrant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  ticketCount: number;
  paidCount: number;
  unpaidCount: number;
  totalSpend: number;
  donationTotal: number;
  entries: EntrantEntryRow[];
}

export async function listEntrantSummariesForEvent({
  eventId,
  paidFilter = "ALL",
  source = "ALL",
}: {
  eventId: string;
  paidFilter?: "ALL" | "PAID" | "UNPAID";
  source?: EntrySource | "ALL";
}): Promise<{ entrants: EntrantSummaryForEvent[]; total: number }> {
  await requireRole("STAFF");

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { entryCost: true },
  });
  if (!event) return { entrants: [], total: 0 };
  const eventEntryCost = Number(event.entryCost);

  // Fetch every entry for the event with the data we need to compute
  // per-ticket cost. Group in JS — clearer than a Postgres-side aggregation
  // for the mixed package/individual pricing rules.
  const rows = await db.entry.findMany({
    where: { eventId },
    orderBy: { ticketNumber: "asc" },
    include: {
      entrant: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
      package: { select: { id: true, label: true, cost: true, quantity: true } },
    },
  });

  const byEntrant = new Map<string, EntrantSummaryForEvent>();
  for (const e of rows) {
    const perTicketCost = e.package
      ? Number(e.package.cost) / e.package.quantity
      : eventEntryCost;
    const donation = e.donationAmount ? Number(e.donationAmount) : 0;

    let bucket = byEntrant.get(e.entrant.id);
    if (!bucket) {
      bucket = {
        entrant: e.entrant,
        ticketCount: 0,
        paidCount: 0,
        unpaidCount: 0,
        totalSpend: 0,
        donationTotal: 0,
        entries: [],
      };
      byEntrant.set(e.entrant.id, bucket);
    }

    bucket.ticketCount += 1;
    if (e.paidAt) bucket.paidCount += 1;
    else bucket.unpaidCount += 1;
    bucket.totalSpend += perTicketCost + donation;
    bucket.donationTotal += donation;
    bucket.entries.push({
      id: e.id,
      ticketNumber: e.ticketNumber,
      source: e.source,
      packageId: e.packageId,
      packageLabel: e.package?.label ?? null,
      packageEntryNum: e.packageEntryNum,
      paidAt: e.paidAt,
      paymentMethod: e.paymentMethod,
      paymentRef: e.paymentRef,
      donationAmount: e.donationAmount ? e.donationAmount.toString() : null,
      perTicketCost,
    });
  }

  // Filter at the entrant level: an entrant is shown if any of their entries
  // matches the filter. The drill-down still shows ALL of their entries for
  // this event regardless — full picture beats partial.
  const matches = (row: EntrantEntryRow) => {
    if (paidFilter === "PAID" && !row.paidAt) return false;
    if (paidFilter === "UNPAID" && row.paidAt) return false;
    if (source !== "ALL" && row.source !== source) return false;
    return true;
  };

  const entrants = Array.from(byEntrant.values())
    .filter((b) =>
      paidFilter === "ALL" && source === "ALL"
        ? true
        : b.entries.some(matches),
    )
    .sort((a, b) => {
      const ln = a.entrant.lastName.localeCompare(b.entrant.lastName);
      if (ln !== 0) return ln;
      return a.entrant.firstName.localeCompare(b.entrant.firstName);
    });

  return { entrants, total: entrants.length };
}

export async function markEntrantEntriesPaidForEvent(
  eventId: string,
  entrantId: string,
  paymentRef?: string,
): Promise<ActionResult<{ markedCount: number }>> {
  await requireRole("STAFF");

  const trimmedRef = paymentRef?.trim() || null;
  const now = new Date();

  // Touch only unpaid rows. paymentRef is overlaid only when the operator
  // supplied one — don't clobber an existing ref with null.
  const updateData: Prisma.EntryUpdateManyMutationInput = { paidAt: now };
  if (trimmedRef) updateData.paymentRef = trimmedRef;

  const result = await db.entry.updateMany({
    where: { eventId, entrantId, paidAt: null },
    data: updateData,
  });

  if (result.count > 0) {
    await logAudit({
      action: "ENTRY_RECONCILED",
      entityType: "Entrant",
      entityId: entrantId,
      metadata: {
        eventId,
        entryCount: result.count,
        paymentRef: trimmedRef ?? undefined,
      },
    });
  }

  revalidatePath(`/events/${eventId}/entries`);
  revalidatePath(`/entrants/${entrantId}`);

  return { ok: true, data: { markedCount: result.count } };
}

export async function createEntry(
  eventId: string,
  input: CreateEntryInput,
): Promise<ActionResult<{ entryIds: string[]; ticketNumbers: number[] }>> {
  await requireRole("STAFF");

  const parsed = createEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  const data = parsed.data;

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.status !== "OPEN") {
    const reason = {
      DRAFT: "Event is still in setup — open it before adding entries.",
      CLOSED: "Event is closed for entries.",
      DRAWN: "Cannot add entries to a drawn event.",
    }[event.status];
    return { ok: false, error: reason };
  }

  // Resolve package + total quantity. The transaction may carry a package
  // (pkg.quantity entries with packageEntryNum 1..n) and/or individual
  // entries on top.
  const individualQty = data.selection.individualQty ?? 0;
  let pkg: { id: string; quantity: number } | null = null;
  if (data.selection.packageId) {
    const found = await db.entryPackage.findUnique({
      where: { id: data.selection.packageId },
    });
    if (!found || found.eventId !== eventId) {
      return { ok: false, error: "Package not found." };
    }
    if (!found.isActive) {
      return { ok: false, error: "That package is no longer active." };
    }
    pkg = { id: found.id, quantity: found.quantity };
  }
  const pkgQty = pkg?.quantity ?? 0;
  const totalQty = pkgQty + individualQty;
  if (totalQty < 1) {
    return { ok: false, error: "Pick a package or set a quantity." };
  }

  // Resolve entrant: lookup existing or create new.
  let entrantId: string;
  if (data.entrant.mode === "existing") {
    const existing = await db.entrant.findUnique({
      where: { id: data.entrant.id },
    });
    if (!existing) return { ok: false, error: "Entrant not found." };
    entrantId = existing.id;
  } else {
    try {
      const newEntrant = await db.entrant.create({
        data: {
          firstName: data.entrant.data.firstName,
          lastName: data.entrant.data.lastName,
          email: data.entrant.data.email,
          phone: data.entrant.data.phone || null,
          dateOfBirth: data.entrant.data.dateOfBirth
            ? new Date(data.entrant.data.dateOfBirth)
            : null,
          sponsorShareOptIn: data.entrant.data.sponsorShareOptIn,
          smsOptIn: data.entrant.data.smsOptIn,
        },
      });
      entrantId = newEntrant.id;
    } catch (err) {
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        return {
          ok: false,
          error:
            "An entrant with that email already exists — pick them from search instead.",
        };
      }
      throw err;
    }
  }

  const source: EntrySource = data.source ?? "ADMIN";
  const paymentMethod: PaymentMethod | null = data.paymentMethod ?? null;
  if (source === "TABLET" && !paymentMethod) {
    return { ok: false, error: "Payment method is required for tablet sales." };
  }
  const trimmedRef = data.paymentRef?.trim() || null;
  // TABLET sales are always paid at submit (operator just collected it);
  // ADMIN entries default to paid only when a reference is captured.
  const paidAt =
    source === "TABLET" ? new Date() : trimmedRef ? new Date() : null;
  const donation = data.donationAmount && data.donationAmount.trim()
    ? data.donationAmount.trim()
    : null;

  // Allocate sequential ticketNumbers in a transaction. Retry on
  // unique-constraint conflict (concurrent insert race).
  let result: { entryIds: string[]; ticketNumbers: number[] } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await db.$transaction(async (tx) => {
        const last = await tx.entry.findFirst({
          where: { eventId },
          orderBy: { ticketNumber: "desc" },
          select: { ticketNumber: true },
        });
        const start = (last?.ticketNumber ?? 0) + 1;
        const ticketNumbers = Array.from(
          { length: totalQty },
          (_, i) => start + i,
        );

        // Package entries are allocated first (rows 0..pkgQty-1), individuals
        // after (rows pkgQty..totalQty-1). Donation rides on the first row.
        const created = await Promise.all(
          ticketNumbers.map((ticketNumber, i) => {
            const isPkg = i < pkgQty;
            return tx.entry.create({
              data: {
                eventId,
                entrantId,
                ticketNumber,
                packageId: isPkg ? pkg!.id : null,
                packageEntryNum: isPkg ? i + 1 : null,
                donationAmount: i === 0 ? donation : null,
                paymentRef: trimmedRef,
                paymentMethod,
                paidAt,
                source,
              },
              select: { id: true },
            });
          }),
        );

        return {
          entryIds: created.map((c) => c.id),
          ticketNumbers,
        };
      });
      break;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Unique constraint") &&
        attempt < 2
      ) {
        continue;
      }
      throw err;
    }
  }

  if (!result) {
    return {
      ok: false,
      error:
        "Could not allocate ticket numbers after several tries — please try again.",
    };
  }

  await logAudit({
    action: "ENTRY_CREATED",
    entityType: "Entry",
    entityId: result.entryIds[0],
    metadata: {
      eventId,
      entrantId,
      ticketNumbers: result.ticketNumbers,
      packageId: pkg?.id ?? null,
      pkgQty,
      individualQty,
      totalQty,
      paid: paidAt !== null,
      source,
      paymentMethod,
    },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/entries`);
  revalidatePath("/entrants");
  revalidatePath(`/entrants/${entrantId}`);

  return { ok: true, data: result };
}
