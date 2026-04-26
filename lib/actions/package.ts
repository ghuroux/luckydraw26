"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const decimalString = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Use a number with up to 2 decimals (e.g. 200 or 200.00)",
  );

const packageInputSchema = z.object({
  label: z.string().min(1, "Label is required.").max(200),
  quantity: z
    .string()
    .regex(/^[1-9]\d*$/, "Quantity must be a positive whole number."),
  cost: decimalString,
  isActive: z.boolean(),
});

export type PackageInput = z.infer<typeof packageInputSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function listPackages(eventId: string) {
  await requireRole("STAFF");
  return db.entryPackage.findMany({
    where: { eventId },
    orderBy: [{ isActive: "desc" }, { quantity: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { entries: true } } },
  });
}

export async function createPackage(
  eventId: string,
  input: PackageInput,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("ADMIN");

  const parsed = packageInputSchema.safeParse(input);
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
    return { ok: false, error: "Cannot add packages to a drawn event." };
  }

  const data = parsed.data;
  const created = await db.entryPackage.create({
    data: {
      eventId,
      label: data.label,
      quantity: Number(data.quantity),
      cost: data.cost,
      isActive: data.isActive,
    },
  });

  await logAudit({
    action: "PACKAGE_CREATED",
    entityType: "EntryPackage",
    entityId: created.id,
    metadata: { eventId, label: created.label, quantity: created.quantity },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/packages`);
  return { ok: true, data: { id: created.id } };
}

export async function updatePackage(
  packageId: string,
  input: PackageInput,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = packageInputSchema.safeParse(input);
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

  const existing = await db.entryPackage.findUnique({
    where: { id: packageId },
    include: { _count: { select: { entries: true } } },
  });
  if (!existing) return { ok: false, error: "Package not found." };

  const data = parsed.data;

  // If the package has already sold entries, block changes to quantity or cost
  // to preserve historical accuracy. Label and active state can still change.
  if (existing._count.entries > 0) {
    const quantityChanged = Number(data.quantity) !== existing.quantity;
    const costChanged = data.cost !== String(existing.cost);
    if (quantityChanged || costChanged) {
      return {
        ok: false,
        error:
          "Cannot change quantity or cost — entries have already been sold against this package.",
      };
    }
  }

  await db.entryPackage.update({
    where: { id: packageId },
    data: {
      label: data.label,
      quantity: Number(data.quantity),
      cost: data.cost,
      isActive: data.isActive,
    },
  });

  await logAudit({
    action: "PACKAGE_UPDATED",
    entityType: "EntryPackage",
    entityId: packageId,
    metadata: {
      before: { label: existing.label, isActive: existing.isActive },
      after: { label: data.label, isActive: data.isActive },
    },
  });

  revalidatePath(`/events/${existing.eventId}`);
  revalidatePath(`/events/${existing.eventId}/packages`);
  return { ok: true };
}

export async function deletePackage(
  packageId: string,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await db.entryPackage.findUnique({
    where: { id: packageId },
    include: { _count: { select: { entries: true } } },
  });
  if (!existing) return { ok: false, error: "Package not found." };
  if (existing._count.entries > 0) {
    return {
      ok: false,
      error:
        "Cannot delete a package that already has entries. Deactivate it instead so it stops appearing for new sales.",
    };
  }

  await db.entryPackage.delete({ where: { id: packageId } });

  await logAudit({
    action: "PACKAGE_DELETED",
    entityType: "EntryPackage",
    entityId: packageId,
    metadata: { eventId: existing.eventId, label: existing.label },
  });

  revalidatePath(`/events/${existing.eventId}`);
  revalidatePath(`/events/${existing.eventId}/packages`);
  return { ok: true };
}
