"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser } from "@/lib/actions/user";

const schema = z.object({
  email: z.string().email("Invalid email."),
  name: z.string().min(1, "Name is required.").max(100),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["STAFF", "ADMIN", "SUPERADMIN"]),
});

type FormValues = z.infer<typeof schema>;

interface CreatedUser {
  email: string;
  password: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Confused-letter-free alphabet (no I/l/0/O/1) — these passwords get read out
// loud or copied by hand sometimes.
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword(length = 14) {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

export function CreateUserDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", name: "", password: "", role: "STAFF" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    setError,
    control,
  } = form;

  function handleClose(next: boolean) {
    if (!next) {
      reset();
      setCreated(null);
      setServerError(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await createUser(values);
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
    setCreated({
      email: values.email,
      password: values.password,
      name: values.name,
    });
    router.refresh();
  }

  async function copyCredentials() {
    if (!created) return;
    const text = `Email: ${created.email}\nPassword: ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credentials copied.");
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "User created" : "Add user"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Send these credentials to the user privately. They'll be prompted to change the password on first sign in. The password is only shown once."
              : "Create a new account. The user will be required to change their password on first sign in."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">Name</div>
                <span className="text-sm font-medium">{created.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">Email</div>
                <code className="text-sm">{created.email}</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">Password</div>
                <code className="font-mono text-sm">{created.password}</code>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copyCredentials}>
                Copy
              </Button>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoFocus {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? "STAFF")}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAFF">Staff</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="SUPERADMIN">Super admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setValue("password", generatePassword(), {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  Generate
                </Button>
              </div>
              <Input
                id="password"
                type="text"
                {...register("password")}
                className="font-mono"
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Min 8 characters. Shown in plaintext after creation so you can
                copy and send.
              </p>
            </div>

            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
