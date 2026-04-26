import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

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
