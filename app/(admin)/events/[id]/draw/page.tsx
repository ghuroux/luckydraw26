import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { buttonVariants } from "@/components/ui/button";
import { DrawManager } from "./DrawManager";
import { StartShowButton } from "./StartShowButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DrawPage({ params }: PageProps) {
  await requireRole("STAFF");
  const { id } = await params;

  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      drawMode: true,
      showSupporterIntro: true,
      presentationStartedAt: true,
      prizes: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          lockedAt: true,
          winningEntry: {
            select: {
              id: true,
              ticketNumber: true,
              entrant: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      },
      _count: { select: { entries: true } },
    },
  });
  if (!event) notFound();

  const parkedEntries =
    event.drawMode === "WINNER_DRAW"
      ? await db.entry.findMany({
          where: { eventId: event.id, wonAt: { not: null } },
          select: {
            id: true,
            ticketNumber: true,
            wonAt: true,
            entrant: { select: { firstName: true, lastName: true } },
          },
          orderBy: { wonAt: "asc" },
        })
      : [];

  const parkedWinners = parkedEntries.map((e) => ({
    entryId: e.id,
    ticketNumber: e.ticketNumber,
    entrantDisplayName: `${e.entrant.firstName} ${e.entrant.lastName}`,
    wonAt: e.wonAt!,
  }));

  const drawable = event.status === "OPEN" || event.status === "CLOSED";
  const hasPrizes = event.prizes.length > 0;
  const hasEntries = event._count.entries > 0;
  const canDraw = drawable && hasEntries;

  return (
    <div className="space-y-4">
      {!drawable && (
        <Banner>
          {event.status === "DRAFT"
            ? "Open the event before running draws."
            : "This event is fully drawn — all winners are locked in."}
        </Banner>
      )}
      {drawable && !hasPrizes && (
        <Banner>
          No prizes yet.{" "}
          <Link
            href={`/events/${event.id}/prizes`}
            className="underline underline-offset-2"
          >
            Add prizes
          </Link>{" "}
          before running draws.
        </Banner>
      )}
      {drawable && hasPrizes && !hasEntries && (
        <Banner>
          No entries yet.{" "}
          <Link
            href={`/events/${event.id}/entries`}
            className="underline underline-offset-2"
          >
            Add entries
          </Link>{" "}
          before running draws.
        </Banner>
      )}

      {hasPrizes && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Open the presentation view on a second screen before starting the
              first draw.
            </p>
            <Link
              href={`/events/${event.id}/presentation`}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open presentation
              <ExternalLink data-icon="inline-end" />
            </Link>
          </div>

          {event.showSupporterIntro && !event.presentationStartedAt && (
            <StartShowButton eventId={event.id} />
          )}

          <DrawManager
            eventId={event.id}
            drawMode={event.drawMode}
            prizes={event.prizes}
            parkedWinners={parkedWinners}
            canDraw={canDraw}
          />
        </>
      )}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4 text-sm">{children}</div>
  );
}
