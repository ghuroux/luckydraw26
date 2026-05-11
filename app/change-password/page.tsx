import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await requireUser();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true, name: true, email: true },
  });
  if (!user) redirect("/login");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 70%), radial-gradient(40% 40% at 50% 100%, color-mix(in oklch, var(--celebration) 6%, transparent), transparent 70%)",
        }}
      />
      <div className="relative">
        <ChangePasswordForm
          required={user.mustChangePassword}
          userName={user.name}
        />
      </div>
    </main>
  );
}
