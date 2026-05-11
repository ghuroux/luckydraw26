"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Section } from "@/components/shell";
import {
  updateEntrant,
  type EntrantInput,
} from "@/lib/actions/entrant";
import { displayEmail, isPlaceholderEmail } from "@/lib/entrant-contact";

const schema = z.object({
  firstName: z.string().min(1, "First name is required.").max(100),
  lastName: z.string().min(1, "Last name is required.").max(100),
  // Allow blank so an entrant with no real email yet (placeholder in DB)
  // can have other fields edited without forcing the operator to invent one.
  // On submit we restore the existing placeholder if blank.
  email: z
    .string()
    .email("Invalid email address.")
    .or(z.literal("")),
  phone: z.string().max(50).optional(),
  dateOfBirth: z.string().optional(),
  sponsorShareOptIn: z.boolean(),
  smsOptIn: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  entrant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    sponsorShareOptIn: boolean;
    smsOptIn: boolean;
  };
}

export function EntrantProfile({ entrant }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Section
        title="Contact"
        actions={
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Edit
          </Button>
        }
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field
            label="Email"
            value={displayEmail(entrant) ?? "—"}
            mono={!isPlaceholderEmail(entrant.email)}
            muted={isPlaceholderEmail(entrant.email)}
          />
          <Field label="Phone" value={entrant.phone || "—"} mono />
          <Field
            label="Date of birth"
            value={
              entrant.dateOfBirth
                ? new Date(entrant.dateOfBirth).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"
            }
          />
          <Field
            label="Consents"
            value={
              [
                entrant.sponsorShareOptIn ? "Sponsor share" : null,
                entrant.smsOptIn ? "SMS" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "None"
            }
          />
        </dl>
      </Section>

      <EditDialog open={open} onOpenChange={setOpen} entrant={entrant} />
    </>
  );
}

function Field({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1${mono ? " font-mono" : ""}${
          muted ? " text-muted-foreground italic" : " text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entrant: Props["entrant"];
}

function EditDialog({ open, onOpenChange, entrant }: EditDialogProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      firstName: entrant.firstName,
      lastName: entrant.lastName,
      email: isPlaceholderEmail(entrant.email) ? "" : entrant.email,
      phone: entrant.phone,
      dateOfBirth: entrant.dateOfBirth,
      sponsorShareOptIn: entrant.sponsorShareOptIn,
      smsOptIn: entrant.smsOptIn,
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    // Empty email means "leave it alone" — keep the existing (possibly
    // placeholder) address rather than rejecting the form.
    const payload: EntrantInput = {
      ...values,
      email: values.email.trim() || entrant.email,
    } as EntrantInput;
    const result = await updateEntrant(entrant.id, payload);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
    reset(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit entrant</DialogTitle>
          <DialogDescription>
            Contact details and consent preferences.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-sm text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-sm text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Consents</p>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register("sponsorShareOptIn")}
                  className="mt-0.5 size-4 rounded border-border"
                />
                <span>
                  Share contact details with event sponsors
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register("smsOptIn")}
                  className="mt-0.5 size-4 rounded border-border"
                />
                <span>Receive SMS messages from us</span>
              </label>
            </div>
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
