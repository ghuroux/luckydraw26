import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { OrganisationSettingsForm } from "./SettingsForm";

export default async function OrganisationSettingsPage() {
  await requireRole("SUPERADMIN");

  const org = await db.organisation.findFirst();
  if (!org) {
    // Should never happen — seed:superadmin guarantees one row.
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Organisation
        </h1>
        <p className="mt-2 text-muted-foreground">
          Branding and contact details. Colours apply to the admin UI and the
          public portal.
        </p>
      </div>

      <OrganisationSettingsForm
        defaultValues={{
          name: org.name,
          contactEmail: org.contactEmail ?? "",
          logoUrl: org.logoUrl ?? "",
          primaryColor: org.primaryColor,
          accentColor: org.accentColor,
          bgPattern: org.bgPattern ?? "",
        }}
      />
    </div>
  );
}
