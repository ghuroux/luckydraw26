"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/shell";
import {
  createEvent,
  type CreateEventInput,
} from "@/lib/actions/event";
import { DrawModeField, type DrawMode } from "@/components/events/DrawModeField";

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
  drawMode: z.enum(["PRIZE_DRAW", "WINNER_DRAW"]),
});

type FormValues = z.infer<typeof schema>;

export function CreateEventForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      date: "",
      drawTime: "",
      entryCost: "0",
      prizePool: "",
      drawMode: "PRIZE_DRAW",
    },
  });

  const drawMode = watch("drawMode");

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await createEvent(values as CreateEventInput);
    if (result && !result.ok) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section
        title="Basics"
        description="Internal details. The public portal page is configured separately."
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="e.g. October Charity Golf Day"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Internal notes about this event"
            {...register("description")}
          />
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
            {errors.date && (
              <p className="text-sm text-destructive">
                {errors.date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawTime">Draw time</Label>
            <Input id="drawTime" type="time" {...register("drawTime")} />
            {errors.drawTime && (
              <p className="text-sm text-destructive">
                {errors.drawTime.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="entryCost">Entry cost</Label>
            <Input
              id="entryCost"
              inputMode="decimal"
              placeholder="50.00"
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
              placeholder="10000.00"
              {...register("prizePool")}
            />
            {errors.prizePool && (
              <p className="text-sm text-destructive">
                {errors.prizePool.message}
              </p>
            )}
          </div>
        </div>

        <DrawModeField
          value={drawMode as DrawMode}
          onChange={(v) =>
            setValue("drawMode", v, { shouldDirty: true, shouldValidate: true })
          }
        />
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create event"}
        </Button>
        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}
      </div>
    </form>
  );
}
