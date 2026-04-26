import type { ReactNode } from "react";
import { getCurrentSession, hasRole, type Role } from "@/lib/rbac";

interface RoleGateProps {
  minimum: Role;
  fallback?: ReactNode;
  children: ReactNode;
}

// Async server component. Renders children only when the current user meets
// the minimum role; otherwise renders the fallback (or nothing). UI gating
// only — never trust this for security; always re-check in the server action.
export async function RoleGate({
  minimum,
  fallback = null,
  children,
}: RoleGateProps) {
  const session = await getCurrentSession();
  const role = (session?.user as { role?: string })?.role;
  if (!hasRole(role, minimum)) return <>{fallback}</>;
  return <>{children}</>;
}
