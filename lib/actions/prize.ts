"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const prizeInputSchema = z.object({
  name: z.string().min(1, "Name is required.").max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.union([z.string().url("Must be a valid URL."), z.literal("")]).optional(),
  imageAlt: z.string().max(200).optional(),
});

export type PrizeInput = z.infer<typeof prizeInputSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function listPrizes(eventId: string) {
  await requireRole("STAFF");
  return db.prize.findMany({
    where: { eventId },
    orderBy: { order: "asc" },
  });
}

export async function createPrize(
  eventId: string,
  input: PrizeInput,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("ADMIN");

  const parsed = prizeInputSchema.safeParse(input);
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

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.status === "DRAWN") {
    return { ok: false, error: "Cannot add prizes to a drawn event." };
  }

  const last = await db.prize.findFirst({
    where: { eventId },
    orderBy: { order: "desc" },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  const data = parsed.data;
  const created = await db.prize.create({
    data: {
      eventId,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      imageAlt: data.imageAlt || null,
      order: nextOrder,
    },
  });

  await logAudit({
    action: "PRIZE_CREATED",
    entityType: "Prize",
    entityId: created.id,
    metadata: { eventId, name: created.name },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/prizes`);
  return { ok: true, data: { id: created.id } };
}

export async function updatePrize(
  prizeId: string,
  input: PrizeInput,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = prizeInputSchema.safeParse(input);
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

  const existing = await db.prize.findUnique({
    where: { id: prizeId },
    include: { event: true },
  });
  if (!existing) return { ok: false, error: "Prize not found." };
  if (existing.lockedAt) {
    return { ok: false, error: "Cannot edit a locked-in prize." };
  }

  const data = parsed.data;
  await db.prize.update({
    where: { id: prizeId },
    data: {
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      imageAlt: data.imageAlt || null,
    },
  });

  await logAudit({
    action: "PRIZE_UPDATED",
    entityType: "Prize",
    entityId: prizeId,
    metadata: { before: { name: existing.name }, after: { name: data.name } },
  });

  revalidatePath(`/events/${existing.eventId}`);
  revalidatePath(`/events/${existing.eventId}/prizes`);
  return { ok: true };
}

export async function deletePrize(prizeId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await db.prize.findUnique({ where: { id: prizeId } });
  if (!existing) return { ok: false, error: "Prize not found." };
  if (existing.winningEntryId) {
    return {
      ok: false,
      error: "Cannot delete a prize that has a recorded winner.",
    };
  }

  await db.prize.delete({ where: { id: prizeId } });

  await logAudit({
    action: "PRIZE_DELETED",
    entityType: "Prize",
    entityId: prizeId,
    metadata: { eventId: existing.eventId, name: existing.name },
  });

  revalidatePath(`/events/${existing.eventId}`);
  revalidatePath(`/events/${existing.eventId}/prizes`);
  return { ok: true };
}

// Swap order with the adjacent prize in the given direction. Tolerant of
// gaps in the order sequence — finds the nearest neighbour by order, not by
// arithmetic.
export async function movePrize(
  prizeId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const prize = await db.prize.findUnique({ where: { id: prizeId } });
  if (!prize) return { ok: false, error: "Prize not found." };

  const neighbour = await db.prize.findFirst({
    where: {
      eventId: prize.eventId,
      order: direction === "up" ? { lt: prize.order } : { gt: prize.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return { ok: true }; // already at the edge — no-op

  await db.$transaction([
    db.prize.update({
      where: { id: prize.id },
      data: { order: neighbour.order },
    }),
    db.prize.update({
      where: { id: neighbour.id },
      data: { order: prize.order },
    }),
  ]);

  revalidatePath(`/events/${prize.eventId}`);
  revalidatePath(`/events/${prize.eventId}/prizes`);
  return { ok: true };
}
