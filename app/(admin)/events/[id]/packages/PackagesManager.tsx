"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package } from "lucide-react";

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
import { EmptyState, StatusBadge } from "@/components/shell";
import {
  createPackage,
  updatePackage,
  deletePackage,
  type PackageInput,
} from "@/lib/actions/package";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const decimalString = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Use a number with up to 2 decimals (e.g. 200 or 200.00)",
  );

const schema = z.object({
  label: z.string().min(1, "Label is required.").max(200),
  quantity: z
    .string()
    .regex(/^[1-9]\d*$/, "Quantity must be a positive whole number."),
  cost: decimalString,
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface PackageRow {
  id: string;
  label: string;
  quantity: number;
  cost: string;
  isActive: boolean;
  entryCount: number;
}

interface Props {
  eventId: string;
  initialPackages: PackageRow[];
  canEdit: boolean;
}

export function PackagesManager({
  eventId,
  initialPackages,
  canEdit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setRowError(null);
    setDialogOpen(true);
  }

  function openEdit(pkg: PackageRow) {
    setEditing(pkg);
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

  async function toggleActive(pkg: PackageRow) {
    rowAction(() =>
      updatePackage(pkg.id, {
        label: pkg.label,
        quantity: String(pkg.quantity),
        cost: pkg.cost,
        isActive: !pkg.isActive,
      }),
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex items-center justify-between">
          <Button onClick={openCreate}>Add package</Button>
          {rowError && (
            <p className="text-sm text-destructive">{rowError}</p>
          )}
        </div>
      )}

      {initialPackages.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="No packages yet."
          description="Optional. Single entries can still be sold at the event's entry cost."
        />
      ) : (
        <ul className="space-y-3">
          {initialPackages.map((pkg) => (
            <PackageRowCard
              key={pkg.id}
              pkg={pkg}
              canEdit={canEdit}
              isPending={isPending}
              onEdit={() => openEdit(pkg)}
              onDelete={() => rowAction(() => deletePackage(pkg.id))}
              onToggleActive={() => toggleActive(pkg)}
            />
          ))}
        </ul>
      )}

      <PackageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={eventId}
        editing={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

interface PackageRowCardProps {
  pkg: PackageRow;
  canEdit: boolean;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

function PackageRowCard({
  pkg,
  canEdit,
  isPending,
  onEdit,
  onDelete,
  onToggleActive,
}: PackageRowCardProps) {
  const sold = pkg.entryCount > 0;

  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/8",
        !pkg.isActive && "opacity-70"
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{pkg.label}</p>
          {!pkg.isActive && <StatusBadge tone="muted">Inactive</StatusBadge>}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{pkg.quantity}</span>{" "}
          entries for{" "}
          <span className="font-mono tabular-nums">{formatMoney(pkg.cost)}</span>
          {sold && (
            <>
              {" · "}
              <span className="font-mono tabular-nums">{pkg.entryCount}</span> sold
            </>
          )}
        </p>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={onToggleActive}
          >
            {pkg.isActive ? "Deactivate" : "Reactivate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending || sold}
            onClick={onDelete}
            title={
              sold
                ? "Cannot delete a package with sold entries — deactivate instead"
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

interface PackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  editing: PackageRow | null;
  onSaved: () => void;
}

function PackageDialog({
  open,
  onOpenChange,
  eventId,
  editing,
  onSaved,
}: PackageDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      label: editing?.label ?? "",
      quantity: editing ? String(editing.quantity) : "",
      cost: editing?.cost ?? "",
      isActive: editing ? editing.isActive : true,
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = editing
      ? await updatePackage(editing.id, values as PackageInput)
      : await createPackage(eventId, values as PackageInput);
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
          <DialogTitle>
            {editing ? "Edit package" : "Add package"}
          </DialogTitle>
          <DialogDescription>
            Bulk deal shown to entrants alongside single entries.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              placeholder="e.g. 5 entries for 200"
              {...register("label")}
            />
            {errors.label && (
              <p className="text-sm text-destructive">{errors.label.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Entries</Label>
              <Input
                id="quantity"
                inputMode="numeric"
                placeholder="5"
                {...register("quantity")}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">
                  {errors.quantity.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost</Label>
              <Input
                id="cost"
                inputMode="decimal"
                placeholder="200.00"
                {...register("cost")}
              />
              {errors.cost && (
                <p className="text-sm text-destructive">{errors.cost.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              {...register("isActive")}
              className="size-4 rounded border-border"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active (offered for sale)
            </Label>
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
              {isSubmitting
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Add package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
