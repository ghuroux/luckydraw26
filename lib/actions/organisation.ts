"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex colour like #1f2937");

const updateOrganisationSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
  logoUrl: z.union([z.string().url(), z.literal("")]).optional(),
  primaryColor: hexColor,
  accentColor: hexColor,
  bgPattern: z.union([z.string().url(), z.literal("")]).optional(),
});

export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateOrganisation(
  input: UpdateOrganisationInput,
): Promise<ActionResult> {
  await requireRole("SUPERADMIN");

  const parsed = updateOrganisationSchema.safeParse(input);
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
    return { ok: false, error: "No organisation found. Run npm run seed:superadmin." };
  }

  const data = parsed.data;
  const updated = await db.organisation.update({
    where: { id: org.id },
    data: {
      name: data.name,
      contactEmail: data.contactEmail || null,
      logoUrl: data.logoUrl || null,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      bgPattern: data.bgPattern || null,
    },
  });

  await logAudit({
    action: "ORG_UPDATED",
    entityType: "Organisation",
    entityId: updated.id,
    metadata: {
      before: {
        name: org.name,
        primaryColor: org.primaryColor,
        accentColor: org.accentColor,
      },
      after: {
        name: updated.name,
        primaryColor: updated.primaryColor,
        accentColor: updated.accentColor,
      },
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
