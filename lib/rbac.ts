import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type Role = "SUPERADMIN" | "ADMIN" | "STAFF";

const HIERARCHY: Record<Role, number> = {
  STAFF: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

// React cache: deduplicates session lookups within a single request so a
// page + its layout don't both hit the auth handler.
export const getCurrentSession = cache(async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
});

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(minimum: Role) {
  const session = await requireUser();
  const role = (session.user as { role?: Role }).role;
  if (!role || HIERARCHY[role] < HIERARCHY[minimum]) {
    // For now: hard fail. We'll route to a /forbidden page in a later phase.
    throw new Error(`Forbidden: requires ${minimum}, have ${role ?? "none"}`);
  }
  return session;
}

export function hasRole(userRole: string | undefined, minimum: Role): boolean {
  if (!userRole || !(userRole in HIERARCHY)) return false;
  return HIERARCHY[userRole as Role] >= HIERARCHY[minimum];
}

// Gates the rest of the app on two account states:
//   1. Deactivated → redirect to /login?inactive=1 (sessions are nuked at
//      deactivation time, so the cookie is already stale on next request).
//   2. mustChangePassword → redirect to /change-password.
// Order matters: a deactivated user with mustChangePassword=true must NOT
// loop to /change-password — they have no business being in the app at all.
// The /change-password page and the changePassword server action MUST NOT
// call this helper (the page would infinite-loop, and the action runs while
// mustChangePassword is still true).
export async function enforceAccountAccess(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { deactivatedAt: true, mustChangePassword: true },
  });
  if (user?.deactivatedAt) {
    redirect("/login?inactive=1");
  }
  if (user?.mustChangePassword) {
    redirect("/change-password");
  }
}
