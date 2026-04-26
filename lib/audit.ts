import type { AuditAction, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/rbac";

interface LogAuditArgs {
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

// Records an audit-log entry for the current user (or null for system actions).
// Errors are caught and logged — auditing should never break the underlying
// operation. The cross-cutting Phase 7 sweep ensures coverage.
export async function logAudit({
  action,
  entityType,
  entityId,
  metadata,
}: LogAuditArgs) {
  try {
    const session = await getCurrentSession();
    await db.auditLog.create({
      data: {
        userId: session?.user.id ?? null,
        action,
        entityType,
        entityId,
        metadata: metadata ?? undefined,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
