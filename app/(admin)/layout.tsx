import Link from "next/link";
import type { CSSProperties } from "react";
import { db } from "@/lib/db";
import { enforceAccountAccess, requireUser } from "@/lib/rbac";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  await enforceAccountAccess(session.user.id);
  const role = (session.user as { role?: string }).role;
  const org = await db.organisation.findFirst();

  const themeStyle: CSSProperties = {};
  if (org?.primaryColor) {
    (themeStyle as Record<string, string>)["--primary"] = org.primaryColor;
    (themeStyle as Record<string, string>)["--ring"] = org.primaryColor;
    (themeStyle as Record<string, string>)["--sidebar-primary"] =
      org.primaryColor;
  }
  if (org?.accentColor) {
    (themeStyle as Record<string, string>)["--accent"] = org.accentColor;
  }

  return (
    <div className="flex min-h-screen flex-col" style={themeStyle}>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-tight text-foreground"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
                <span className="font-mono text-[10px] font-bold tracking-tighter">LD</span>
              </span>
              {org?.name ?? "Lucky Draw"}
            </Link>
            <AdminNav isSuperadmin={role === "SUPERADMIN"} />
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <span
                className="truncate text-sm text-muted-foreground"
                title={role ? `${session.user.email} · ${role}` : session.user.email}
              >
                {session.user.email}
              </span>
              {role ? (
                <span className="hidden rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
                  {role.toLowerCase()}
                </span>
              ) : null}
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
