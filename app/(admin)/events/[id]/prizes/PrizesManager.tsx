"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Prize } from "@prisma/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, StatusBadge } from "@/components/shell";
import {
  createPrize,
  updatePrize,
  deletePrize,
  movePrize,
  type PrizeInput,
} from "@/lib/actions/prize";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name is required.").max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.union([z.string().url("Must be a valid URL."), z.literal("")]).optional(),
  imageAlt: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  eventId: string;
  initialPrizes: Prize[];
  canEdit: boolean;
}

export function PrizesManager({ eventId, initialPrizes, canEdit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setRowError(null);
    setDialogOpen(true);
  }

  function openEdit(prize: Prize) {
    setEditing(prize);
    setRowError(null);
    setDialogOpen(true);
  }

  function rowAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setRowError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setRowError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex items-center justify-between">
          <Button onClick={openCreate}>Add prize</Button>
          {rowError && (
            <p className="text-sm text-destructive">{rowError}</p>
          )}
        </div>
      )}

      {initialPrizes.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="No prizes yet."
          description="Add the prize for the 1st place draw to start."
        />
      ) : (
        <ul className="space-y-3">
          {initialPrizes.map((prize, index) => (
            <PrizeRow
              key={prize.id}
              prize={prize}
              index={index}
              isFirst={index === 0}
              isLast={index === initialPrizes.length - 1}
              canEdit={canEdit}
              isPending={isPending}
              onEdit={() => openEdit(prize)}
              onDelete={() => rowAction(() => deletePrize(prize.id))}
              onMoveUp={() => rowAction(() => movePrize(prize.id, "up"))}
              onMoveDown={() => rowAction(() => movePrize(prize.id, "down"))}
            />
          ))}
        </ul>
      )}

      <PrizeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={eventId}
        editing={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

interface PrizeRowProps {
  prize: Prize;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function PrizeRow({
  prize,
  index,
  isFirst,
  isLast,
  canEdit,
  isPending,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PrizeRowProps) {
  const locked = !!prize.lockedAt;
  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/8 transition-colors",
        locked && "bg-celebration-soft/30 ring-celebration/25"
      )}
    >
      <div className="flex w-10 shrink-0 items-center justify-center">
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          #{index + 1}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{prize.name}</p>
          {locked && (
            <StatusBadge tone="success" dot>
              Winner locked in
            </StatusBadge>
          )}
        </div>
        {prize.description && (
          <p className="truncate text-sm text-muted-foreground">
            {prize.description}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={isFirst || isPending}
            onClick={onMoveUp}
            aria-label="Move up"
          >
            <ArrowUp />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={isLast || isPending}
            onClick={onMoveDown}
            aria-label="Move down"
          >
            <ArrowDown />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || locked}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending || !!prize.winningEntryId}
            onClick={onDelete}
            title={
              prize.winningEntryId
                ? "Cannot delete a prize with a recorded winner"
                : undefined
            }
          >
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}

interface PrizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  editing: Prize | null;
  onSaved: () => void;
}

function PrizeDialog({
  open,
  onOpenChange,
  eventId,
  editing,
  onSaved,
}: PrizeDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: editing?.name ?? "",
      description: editing?.description ?? "",
      imageUrl: editing?.imageUrl ?? "",
      imageAlt: editing?.imageAlt ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = editing
      ? await updatePrize(editing.id, values as PrizeInput)
      : await createPrize(eventId, values as PrizeInput);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onSaved();
    onOpenChange(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit prize" : "Add prize"}</DialogTitle>
          <DialogDescription>
            Image upload comes in Phase 5; for now paste a URL if you have one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Weekend at Sun City"
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
              placeholder="What the winner gets"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              placeholder="https://…"
              {...register("imageUrl")}
            />
            {errors.imageUrl && (
              <p className="text-sm text-destructive">
                {errors.imageUrl.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageAlt">Image alt text (optional)</Label>
            <Input
              id="imageAlt"
              placeholder="For screen readers"
              {...register("imageAlt")}
            />
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
              {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add prize"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
