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
import { Section } from "@/components/shell";
import {
  updateEvent,
  type UpdateEventInput,
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
  showSupporterIntro: z.boolean(),
  showSupporterNames: z.boolean(),
  showSupporterTicketCounts: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  eventId: string;
  defaultValues: FormValues;
  drawModeLocked: boolean;
}

export function EditEventForm({ eventId, defaultValues, drawModeLocked }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const drawMode = watch("drawMode");
  const showSupporterIntro = watch("showSupporterIntro");
  const showSupporterNames = watch("showSupporterNames");

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
      <Section
        title="Basics"
        description="Internal details. The public portal page is configured separately."
      >
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

        <DrawModeField
          value={drawMode as DrawMode}
          onChange={(v) =>
            setValue("drawMode", v, { shouldDirty: true, shouldValidate: true })
          }
          disabled={drawModeLocked}
          disabledReason="Locked once a prize has been drawn — clear all winners on the prizes tab to change modes."
        />
      </Section>

      <Section
        title="Presentation"
        description="What the audience sees on the projector before draws begin."
      >
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            {...register("showSupporterIntro")}
            className="mt-1 size-4 rounded border-border"
          />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Show supporter intro</p>
            <p className="text-xs text-muted-foreground">
              Opens the presentation with a thank-you screen showing aggregate
              stats (tickets, supporters, raised). The operator clicks
              &ldquo;Start the show&rdquo; on the draw page to advance to the
              prize teaser.
            </p>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 ${!showSupporterIntro ? "opacity-50" : ""}`}
        >
          <input
            type="checkbox"
            disabled={!showSupporterIntro}
            {...register("showSupporterNames")}
            className="mt-1 size-4 rounded border-border"
          />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Show supporter names</p>
            <p className="text-xs text-muted-foreground">
              Slowly scrolls every supporter&apos;s name on the intro screen
              as a thank-you roll. Alphabetical, no rankings — just
              acknowledgment.
            </p>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 ${!showSupporterIntro || !showSupporterNames ? "opacity-50" : ""}`}
        >
          <input
            type="checkbox"
            disabled={!showSupporterIntro || !showSupporterNames}
            {...register("showSupporterTicketCounts")}
            className="mt-1 size-4 rounded border-border"
          />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Show ticket counts</p>
            <p className="text-xs text-muted-foreground">
              Adds each supporter&apos;s ticket count alongside their name.
              Order stays alphabetical so the list isn&apos;t a leaderboard —
              transparency without competition.
            </p>
          </div>
        </label>
      </Section>

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
