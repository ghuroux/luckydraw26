"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { advancePresentation } from "@/lib/actions/event";

interface Props {
  eventId: string;
}

/**
 * CTA shown above the DrawManager when the event has a supporter intro
 * configured and it hasn't yet been advanced. Flipping it triggers a server
 * action that sets presentationStartedAt + publishes a presentation_advance
 * SSE event. On success, router.refresh() removes this banner from the page.
 */
export function StartShowButton({ eventId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await advancePresentation(eventId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Moved to the prize teaser.");
      router.refresh();
    });
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4 ring-1 ring-inset"
      style={{
        backgroundColor:
          "color-mix(in oklch, var(--celebration-soft) 50%, transparent)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklch, var(--celebration) 22%, transparent)",
      }}
    >
      <div className="flex items-start gap-3">
        <Sparkles
          className="mt-0.5 size-5 shrink-0"
          style={{ color: "var(--celebration)" }}
        />
        <div>
          <p
            className="text-xs font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--celebration-foreground)" }}
          >
            Supporter intro is showing
          </p>
          <p className="mt-1 text-sm">
            The audience is on the &ldquo;Thank you&rdquo; screen. Click when
            the room has settled and you&apos;re ready to move on to the
            prizes.
          </p>
        </div>
      </div>
      <Button onClick={handleClick} disabled={pending} size="lg">
        {pending ? "Advancing…" : "Audience is ready"}
      </Button>
    </div>
  );
}
