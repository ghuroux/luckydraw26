"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EntrySource, Prisma } from "@prisma/client";
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
    // Either individual entries (with quantity) or a package selection.
    selection: z.discriminatedUnion("mode", [
      z.object({
        mode: z.literal("individual"),
        quantity: z.string().regex(/^[1-9]\d*$/, "Must be at least 1."),
      }),
      z.object({ mode: z.literal("package"), packageId: z.string().min(1) }),
    ]),
    donationAmount: z.union([decimalString, z.literal("")]).optional(),
    paymentRef: z.string().max(200).optional().or(z.literal("")),
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
  if (event.status === "DRAWN") {
    return { ok: false, error: "Cannot add entries to a drawn event." };
  }
  if (event.status === "CLOSED") {
    return { ok: false, error: "Event is closed for entries." };
  }

  // Resolve package + quantity.
  let quantity: number;
  let packageId: string | null = null;
  if (data.selection.mode === "package") {
    const pkg = await db.entryPackage.findUnique({
      where: { id: data.selection.packageId },
    });
    if (!pkg || pkg.eventId !== eventId) {
      return { ok: false, error: "Package not found." };
    }
    if (!pkg.isActive) {
      return { ok: false, error: "That package is no longer active." };
    }
    quantity = pkg.quantity;
    packageId = pkg.id;
  } else {
    quantity = Number(data.selection.quantity);
    if (quantity > 100) {
      return { ok: false, error: "Maximum 100 entries per transaction." };
    }
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

  const paidAt = data.paymentRef && data.paymentRef.trim() ? new Date() : null;
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
          { length: quantity },
          (_, i) => start + i,
        );

        const created = await Promise.all(
          ticketNumbers.map((ticketNumber, i) =>
            tx.entry.create({
              data: {
                eventId,
                entrantId,
                ticketNumber,
                packageId,
                packageEntryNum: packageId ? i + 1 : null,
                donationAmount: i === 0 ? donation : null, // donation only on first row
                paymentRef: data.paymentRef?.trim() || null,
                paidAt,
                source: "ADMIN",
              },
              select: { id: true },
            }),
          ),
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
      quantity,
      packageId,
      paid: paidAt !== null,
    },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/entries`);
  revalidatePath("/entrants");
  revalidatePath(`/entrants/${entrantId}`);

  return { ok: true, data: result };
}
