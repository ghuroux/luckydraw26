"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { closeEvent, openEvent } from "@/lib/actions/event";

interface Props {
  eventId: string;
  status: EventStatus;
  prizeCount: number;
  drawnAt: Date | string | null;
}

export function EventActions({ eventId, status, prizeCount, drawnAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  if (drawnAt || status === "DRAWN") {
    return (
      <p className="text-sm text-muted-foreground">
        Drawn — no further actions.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {status === "DRAFT" && (
          <Button
            size="sm"
            disabled={isPending || prizeCount === 0}
            onClick={() => run(() => openEvent(eventId))}
            title={
              prizeCount === 0
                ? "Add at least one prize before opening"
                : undefined
            }
          >
            {isPending ? "Opening…" : "Open event"}
          </Button>
        )}
        {status === "OPEN" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => closeEvent(eventId))}
          >
            {isPending ? "Closing…" : "Close event"}
          </Button>
        )}
        {status === "CLOSED" && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(() => openEvent(eventId))}
          >
            {isPending ? "Reopening…" : "Reopen event"}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {status === "DRAFT" && prizeCount === 0 && (
        <p className="text-xs text-muted-foreground">
          Add a prize before opening (Phase 1d).
        </p>
      )}
    </div>
  );
}
