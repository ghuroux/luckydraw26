"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const inactive = searchParams.get("inactive") === "1";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(error.message ?? "Invalid email or password.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm space-y-8 animate-enter-page">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
          <span className="font-mono text-sm font-bold tracking-tighter">LD</span>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Lucky Draw
          </p>
          <h1 className="text-display-xs font-semibold tracking-tight">
            Sign in
          </h1>
        </div>
      </div>

      {inactive && (
        <p className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          Your account has been deactivated. Contact your organisation if you think this is a mistake.
        </p>
      )}

      <div className="rounded-2xl bg-card p-6 shadow-md ring-1 ring-foreground/8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Admin access only. Contact your organisation if you need an account.
      </p>
    </div>
  );
}

export default function LoginPage() {
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
      <Suspense
        fallback={<div className="text-muted-foreground">Loading…</div>}
      >
        <div className="relative">
          <LoginForm />
        </div>
      </Suspense>
    </main>
  );
}
