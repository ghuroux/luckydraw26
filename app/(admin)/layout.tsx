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
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight">
            Lucky Draw
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
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {session.user.email}
              {role ? ` · ${role}` : ""}
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
