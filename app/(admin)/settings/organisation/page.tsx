import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/shell";
import { OrganisationSettingsForm } from "./SettingsForm";

export default async function OrganisationSettingsPage() {
  await requireRole("SUPERADMIN");

  const org = await db.organisation.findFirst();
  if (!org) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Organisation"
        description="Branding and contact details. Colours apply to the admin UI and the public portal."
      />

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
