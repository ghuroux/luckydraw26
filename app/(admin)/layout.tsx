import Link from "next/link";
import type { CSSProperties } from "react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;
  const org = await db.organisation.findFirst();

  // Override theme tokens with the active organisation's colours. The CSS
  // variables cascade to all admin UI; outside this layout (login, public
  // portal) the global defaults from globals.css apply.
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
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <Link
            href="/dashboard"
            className="whitespace-nowrap text-base font-semibold tracking-tight"
          >
            {org?.name ?? "Lucky Draw"}
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/dashboard" className="transition hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/events" className="transition hover:text-foreground">
              Events
            </Link>
            <Link href="/entrants" className="transition hover:text-foreground">
              Entrants
            </Link>
            <Link
              href="/settings/organisation"
              className="transition hover:text-foreground"
            >
              Settings
            </Link>
          </nav>
          <div className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
            <span
              className="truncate"
              title={role ? `${session.user.email} · ${role}` : session.user.email}
            >
              {session.user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
