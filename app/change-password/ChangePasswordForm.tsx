"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/actions/user";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  required: boolean;
  userName: string;
}

export function ChangePasswordForm({ required, userName }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await changePassword(values);
    if (!result.ok) {
      setServerError(result.error);
      if (result.fieldErrors) {
        for (const [k, v] of Object.entries(result.fieldErrors)) {
          if (v && v[0] && k in values) {
            setError(k as keyof FormValues, { message: v[0] });
          }
        }
      }
      return;
    }
    toast.success("Password changed.");
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm space-y-8 animate-enter-page">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
          <span className="font-mono text-sm font-bold tracking-tighter">
            LD
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {required ? "Welcome, " + userName : "Account"}
          </p>
          <h1 className="text-display-xs font-semibold tracking-tight">
            {required ? "Set your password" : "Change password"}
          </h1>
          {required && (
            <p className="text-sm text-muted-foreground">
              Choose a new password before you continue.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-md ring-1 ring-foreground/8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              autoFocus
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
