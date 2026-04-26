import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-muted/30 bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold">
            Lucky Draw
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="hover:text-primary">
              Dashboard
            </Link>
            <Link href="/events" className="hover:text-primary">
              Events
            </Link>
            <Link href="/entrants" className="hover:text-primary">
              Entrants
            </Link>
            <Link href="/settings/organisation" className="hover:text-primary">
              Settings
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted">
              {session.user.email}
              {role ? ` · ${role}` : ""}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
