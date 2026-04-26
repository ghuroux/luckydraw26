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
  redirect(`/events/${created.id}`);
}

export async function getEvent(id: string) {
  await requireRole("STAFF");
  return db.event.findUnique({
    where: { id },
    include: {
      _count: { select: { entries: true, prizes: true, packages: true } },
    },
  });
}

const updateEventSchema = createEventSchema;

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export async function updateEvent(
  id: string,
  input: UpdateEventInput,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = updateEventSchema.safeParse(input);
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

  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Event not found." };
  }
  if (existing.status === "DRAWN") {
    return {
      ok: false,
      error: "Cannot edit a drawn event — winners are already recorded.",
    };
  }

  const data = parsed.data;
  const updated = await db.event.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      date: data.date ? new Date(data.date) : null,
      drawTime: data.drawTime || null,
      entryCost: data.entryCost,
      prizePool: data.prizePool ? data.prizePool : null,
    },
  });

  await logAudit({
    action: "EVENT_UPDATED",
    entityType: "Event",
    entityId: id,
    metadata: {
      before: { name: existing.name, entryCost: String(existing.entryCost) },
      after: { name: updated.name, entryCost: String(updated.entryCost) },
    },
  });

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  return { ok: true };
}

// Transition: DRAFT|CLOSED → OPEN. Requires at least one prize and the
// event must not be drawn. Audit-logs as EVENT_OPENED on first open or
// EVENT_REOPENED when transitioning back from CLOSED.
export async function openEvent(id: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const event = await db.event.findUnique({
    where: { id },
    include: { _count: { select: { prizes: true } } },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.status === "OPEN") {
    return { ok: false, error: "Event is already open." };
  }
  if (event.status === "DRAWN" || event.drawnAt) {
    return { ok: false, error: "Cannot reopen a drawn event." };
  }
  if (event._count.prizes === 0) {
    return {
      ok: false,
      error: "Add at least one prize before opening the event.",
    };
  }

  const wasReopen = event.status === "CLOSED";

  await db.event.update({
    where: { id },
    data: { status: "OPEN" },
  });

  await logAudit({
    action: wasReopen ? "EVENT_REOPENED" : "EVENT_OPENED",
    entityType: "Event",
    entityId: id,
  });

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  return { ok: true };
}

// Transition: OPEN → CLOSED. No further entries accepted; draw can run.
export async function closeEvent(id: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const event = await db.event.findUnique({ where: { id } });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.status !== "OPEN") {
    return {
      ok: false,
      error: `Cannot close event in ${event.status} status.`,
    };
  }

  await db.event.update({
    where: { id },
    data: { status: "CLOSED" },
  });

  await logAudit({
    action: "EVENT_CLOSED",
    entityType: "Event",
    entityId: id,
  });

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  return { ok: true };
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
