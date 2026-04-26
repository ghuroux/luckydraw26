"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  updateOrganisation,
  type UpdateOrganisationInput,
} from "@/lib/actions/organisation";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex like #1f2937");

const schema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  contactEmail: z.union([z.string().email("Invalid email."), z.literal("")]),
  logoUrl: z.union([z.string().url("Must be a valid URL."), z.literal("")]),
  primaryColor: hexColor,
  accentColor: hexColor,
  bgPattern: z.union([z.string().url("Must be a valid URL."), z.literal("")]),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  defaultValues: FormValues;
}

export function OrganisationSettingsForm({ defaultValues }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await updateOrganisation(values as UpdateOrganisationInput);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSavedAt(new Date());
    reset(values);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Public-facing organisation info.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="info@example.com"
              {...register("contactEmail")}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">
                {errors.contactEmail.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              placeholder="https://… (file upload comes later)"
              {...register("logoUrl")}
            />
            {errors.logoUrl && (
              <p className="text-sm text-destructive">
                {errors.logoUrl.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Colours apply across the admin UI and the public portal. Pick
            shades that contrast well with white text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColorField
            id="primaryColor"
            label="Primary"
            description="Main action / brand colour. Used for primary buttons and highlights."
            control={control}
            name="primaryColor"
            error={errors.primaryColor?.message}
          />
          <ColorField
            id="accentColor"
            label="Accent"
            description="Reserved for celebratory moments (winner reveals, completed states)."
            control={control}
            name="accentColor"
            error={errors.accentColor?.message}
          />

          <div className="space-y-2">
            <Label htmlFor="bgPattern">Background pattern URL</Label>
            <Input
              id="bgPattern"
              placeholder="Optional repeating image (e.g. golf-pattern.png)"
              {...register("bgPattern")}
            />
            {errors.bgPattern && (
              <p className="text-sm text-destructive">
                {errors.bgPattern.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        {savedAt && !isDirty && (
          <p className="text-sm text-muted-foreground">
            Saved {savedAt.toLocaleTimeString()}.
          </p>
        )}
        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}
      </div>
    </form>
  );
}

interface ColorFieldProps {
  id: string;
  label: string;
  description?: string;
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: "primaryColor" | "accentColor";
  error?: string;
}

function ColorField({
  id,
  label,
  description,
  control,
  name,
  error,
}: ColorFieldProps) {
  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border bg-background"
              aria-label={`${label} colour swatch`}
            />
            <Input
              id={id}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="font-mono uppercase"
              maxLength={7}
            />
          </div>
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
