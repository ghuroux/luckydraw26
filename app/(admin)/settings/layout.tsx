import { requireRole } from "@/lib/rbac";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("SUPERADMIN");

  return (
    <div className="space-y-8">
      <SettingsTabs />
      <div className="animate-enter-page">{children}</div>
    </div>
  );
}
