"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EventStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { DEFAULT_PAGE_SIZE, pageInfo } from "@/lib/pagination";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Use a number with up to 2 decimals (e.g. 50 or 50.00)");

const createEventSchema = z.object({
  name: z.string().min(1, "Name is required.").max(200),
  description: z.string().max(2000).optional().nullable(),
  date: z.string().optional().nullable(), // YYYY-MM-DD from <input type="date">
  drawTime: z.string().optional().nullable(), // HH:mm from <input type="time">
  entryCost: decimalString,
  prizePool: z.union([decimalString, z.literal("")]).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createEvent(
  input: CreateEventInput,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("ADMIN");

  const parsed = createEventSchema.safeParse(input);
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

  const org = await db.organisation.findFirst();
  if (!org) {
    return {
      ok: false,
      error: "No organisation found. Run npm run seed:superadmin.",
    };
  }

  const data = parsed.data;
  const created = await db.event.create({
    data: {
      organisationId: org.id,
      name: data.name,
      description: data.description || null,
      date: data.date ? new Date(data.date) : null,
      drawTime: data.drawTime || null,
      entryCost: data.entryCost,
      prizePool: data.prizePool ? data.prizePool : null,
    },
  });

  await logAudit({
    action: "EVENT_CREATED",
    entityType: "Event",
    entityId: created.id,
    metadata: { name: created.name },
  });

  revalidatePath("/events");
  // Phase 1c will switch this to redirect to /events/[id] once the detail
  // page exists. For now, list view shows the new row.
  redirect("/events");
}

interface ListEventsParams {
  status?: EventStatus | "ALL";
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listEvents({
  status,
  search,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: ListEventsParams) {
  await requireRole("STAFF");

  const where: Prisma.EventWhereInput = {};
  if (status && status !== "ALL") where.status = status;
  if (search && search.trim()) {
    where.name = { contains: search.trim(), mode: "insensitive" };
  }

  const [events, total] = await db.$transaction([
    db.event.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { entries: true, prizes: true } },
      },
    }),
    db.event.count({ where }),
  ]);

  return {
    events,
    pagination: pageInfo(page, pageSize, total),
  };
}
