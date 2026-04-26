"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { DEFAULT_PAGE_SIZE, pageInfo } from "@/lib/pagination";

const entrantInputSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(100),
  lastName: z.string().min(1, "Last name is required.").max(100),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(50).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")), // YYYY-MM-DD
  sponsorShareOptIn: z.boolean(),
  smsOptIn: z.boolean(),
});

export type EntrantInput = z.infer<typeof entrantInputSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface ListEntrantsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listEntrants({
  search,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: ListEntrantsParams) {
  await requireRole("STAFF");

  const where: Prisma.EntrantWhereInput = {};
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [entrants, total] = await db.$transaction([
    db.entrant.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { entries: true } },
        entries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    db.entrant.count({ where }),
  ]);

  return {
    entrants,
    pagination: pageInfo(page, pageSize, total),
  };
}

export async function getEntrant(id: string) {
  await requireRole("STAFF");
  return db.entrant.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { createdAt: "desc" },
        include: {
          event: {
            select: { id: true, name: true, date: true, entryCost: true },
          },
          package: { select: { id: true, label: true, cost: true } },
        },
      },
    },
  });
}

export async function updateEntrant(
  id: string,
  input: EntrantInput,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = entrantInputSchema.safeParse(input);
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

  const existing = await db.entrant.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Entrant not found." };

  const data = parsed.data;
  try {
    await db.entrant.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        sponsorShareOptIn: data.sponsorShareOptIn,
        smsOptIn: data.smsOptIn,
      },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return {
        ok: false,
        error: "Another entrant already uses that email address.",
      };
    }
    throw err;
  }

  await logAudit({
    action: "ENTRANT_UPDATED",
    entityType: "Entrant",
    entityId: id,
    metadata: {
      before: { email: existing.email, name: `${existing.firstName} ${existing.lastName}` },
      after: { email: data.email, name: `${data.firstName} ${data.lastName}` },
    },
  });

  revalidatePath("/entrants");
  revalidatePath(`/entrants/${id}`);
  return { ok: true };
}

// Used by the entry-creation typeahead in Phase 1g.
export async function searchEntrants(q: string, limit = 10) {
  await requireRole("STAFF");
  if (!q.trim()) return [];
  const term = q.trim();
  return db.entrant.findMany({
    where: {
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });
}
