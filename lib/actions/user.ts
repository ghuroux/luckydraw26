"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole, requireUser, type Role } from "@/lib/rbac";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
}

export async function listUsers(): Promise<UserListItem[]> {
  await requireRole("SUPERADMIN");
  return await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mustChangePassword: true,
      deactivatedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

const createUserSchema = z.object({
  email: z.string().email("Invalid email."),
  name: z.string().min(1, "Name is required.").max(100),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters."),
  role: z.enum(["STAFF", "ADMIN", "SUPERADMIN"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export async function createUser(
  input: CreateUserInput,
): Promise<ActionResult<{ userId: string }>> {
  await requireRole("SUPERADMIN");

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const { name, password, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      error: "A user with this email already exists.",
      fieldErrors: { email: ["A user with this email already exists."] },
    };
  }

  // Bypass the disabled signup endpoint by going through better-auth's
  // lower-level context: same hash + create + link sequence used by
  // sign-up.mjs, just without the disableSignUp gate.
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const created = await ctx.internalAdapter.createUser({
    email,
    name,
    emailVerified: false,
  });
  if (!created) {
    return { ok: false, error: "Failed to create user." };
  }

  try {
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: hash,
    });
  } catch (err) {
    // Roll back the orphan User row so a retry can reuse the email.
    await db.user.delete({ where: { id: created.id } }).catch(() => {});
    throw err;
  }

  await db.user.update({
    where: { id: created.id },
    data: { role, mustChangePassword: true },
  });

  await logAudit({
    action: "USER_INVITED",
    entityType: "User",
    entityId: created.id,
    metadata: { role, email },
  });

  revalidatePath("/settings/users");
  return { ok: true, data: { userId: created.id } };
}

const updateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["STAFF", "ADMIN", "SUPERADMIN"]),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export async function updateUserRole(
  input: UpdateUserRoleInput,
): Promise<ActionResult<{ before: Role; after: Role }>> {
  const session = await requireRole("SUPERADMIN");

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { userId, role: nextRole } = parsed.data;

  if (userId === session.user.id) {
    return {
      ok: false,
      error: "You can't change your own role. Have another SUPERADMIN do it.",
    };
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target) return { ok: false, error: "User not found." };

  if (target.role === nextRole) {
    return { ok: true, data: { before: target.role, after: nextRole } };
  }

  // Last-active-SUPERADMIN guard: blocks demoting the only remaining
  // *active* SUPERADMIN, which would lock the org out of user management.
  // Belt-and-braces — the self-change block above already prevents the
  // common path to this state, but the guard protects against future
  // refactors that might relax the self-block.
  if (target.role === "SUPERADMIN" && nextRole !== "SUPERADMIN") {
    const otherActiveSuperadmins = await db.user.count({
      where: {
        role: "SUPERADMIN",
        deactivatedAt: null,
        NOT: { id: userId },
      },
    });
    if (otherActiveSuperadmins === 0) {
      return {
        ok: false,
        error:
          "Can't demote the last active SUPERADMIN. Promote another user first, then try again.",
      };
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { role: nextRole },
  });

  await logAudit({
    action: "USER_ROLE_CHANGED",
    entityType: "User",
    entityId: userId,
    metadata: { before: target.role, after: nextRole },
  });

  revalidatePath("/settings/users");
  return { ok: true, data: { before: target.role, after: nextRole } };
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(128, "New password must be at most 128 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Pick a password that's different from your current one.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export async function changePassword(
  input: ChangePasswordInput,
): Promise<ActionResult<{ wasFirstLogin: boolean }>> {
  const session = await requireUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const userId = session.user.id;
  const ctx = await auth.$context;

  const account = await db.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true, password: true },
  });
  if (!account?.password) {
    return {
      ok: false,
      error: "No password is set on this account.",
    };
  }

  const valid = await ctx.password.verify({
    hash: account.password,
    password: parsed.data.currentPassword,
  });
  if (!valid) {
    return {
      ok: false,
      error: "Current password is incorrect.",
      fieldErrors: {
        currentPassword: ["Current password is incorrect."],
      },
    };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mustChangePassword: true },
  });
  const wasFirstLogin = user?.mustChangePassword === true;

  const newHash = await ctx.password.hash(parsed.data.newPassword);
  await db.account.update({
    where: { id: account.id },
    data: { password: newHash },
  });
  await db.user.update({
    where: { id: userId },
    data: { mustChangePassword: false },
  });

  await logAudit({
    action: "USER_PASSWORD_CHANGED",
    entityType: "User",
    entityId: userId,
    metadata: { wasFirstLogin },
  });

  return { ok: true, data: { wasFirstLogin } };
}

const userIdSchema = z.object({ userId: z.string().min(1) });

export async function deactivateUser(
  input: z.infer<typeof userIdSchema>,
): Promise<ActionResult> {
  const session = await requireRole("SUPERADMIN");

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { userId } = parsed.data;

  if (userId === session.user.id) {
    return {
      ok: false,
      error: "You can't deactivate your own account.",
    };
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, deactivatedAt: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.deactivatedAt) {
    return { ok: true };
  }

  // Last-active-SUPERADMIN guard (same shape as updateUserRole). Self-block
  // above already covers the obvious path; this is defense-in-depth.
  if (target.role === "SUPERADMIN") {
    const otherActiveSuperadmins = await db.user.count({
      where: {
        role: "SUPERADMIN",
        deactivatedAt: null,
        NOT: { id: userId },
      },
    });
    if (otherActiveSuperadmins === 0) {
      return {
        ok: false,
        error:
          "Can't deactivate the last active SUPERADMIN. Promote another user first, then try again.",
      };
    }
  }

  const deactivatedAt = new Date();
  await db.user.update({
    where: { id: userId },
    data: { deactivatedAt },
  });

  // Kill every active session for this user so an existing cookie can't be
  // reused. Next request from that browser will fail session lookup and bounce
  // through /login, where enforceAccountAccess catches the deactivated state.
  await db.session.deleteMany({ where: { userId } });

  await logAudit({
    action: "USER_DEACTIVATED",
    entityType: "User",
    entityId: userId,
    metadata: { deactivatedAt: deactivatedAt.toISOString() },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function reactivateUser(
  input: z.infer<typeof userIdSchema>,
): Promise<ActionResult> {
  await requireRole("SUPERADMIN");

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { userId } = parsed.data;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { deactivatedAt: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (!target.deactivatedAt) {
    return { ok: true };
  }

  await db.user.update({
    where: { id: userId },
    data: { deactivatedAt: null },
  });

  await logAudit({
    action: "USER_REACTIVATED",
    entityType: "User",
    entityId: userId,
    metadata: {},
  });

  revalidatePath("/settings/users");
  return { ok: true };
}
