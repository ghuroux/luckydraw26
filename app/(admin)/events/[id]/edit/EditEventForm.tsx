"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  updateEvent,
  type UpdateEventInput,
} from "@/lib/actions/event";

const decimalString = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Use a number with up to 2 decimals (e.g. 50 or 50.00)",
  );

const schema = z.object({
  name: z.string().min(1, "Name is required.").max(200),
  description: z.string().max(2000).optional(),
  date: z.string().optional(),
  drawTime: z.string().optional(),
  entryCost: decimalString,
  prizePool: z.union([decimalString, z.literal("")]).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  eventId: string;
  defaultValues: FormValues;
}

export function EditEventForm({ eventId, defaultValues }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await updateEvent(eventId, values as UpdateEventInput);
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
          <CardTitle>Basics</CardTitle>
          <CardDescription>
            Internal details. The public portal page is configured separately.
          </CardDescription>
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
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawTime">Draw time</Label>
              <Input id="drawTime" type="time" {...register("drawTime")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entryCost">Entry cost</Label>
              <Input
                id="entryCost"
                inputMode="decimal"
                {...register("entryCost")}
              />
              {errors.entryCost && (
                <p className="text-sm text-destructive">
                  {errors.entryCost.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="prizePool">Prize pool (optional)</Label>
              <Input
                id="prizePool"
                inputMode="decimal"
                {...register("prizePool")}
              />
              {errors.prizePool && (
                <p className="text-sm text-destructive">
                  {errors.prizePool.message}
                </p>
              )}
            </div>
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
