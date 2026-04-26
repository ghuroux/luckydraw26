import Link from "next/link";
import { notFound } from "next/navigation";
import type { EventStatus } from "@prisma/client";
import { getEvent } from "@/lib/actions/event";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EventActions } from "./EventActions";

const STATUS_VARIANT: Record<EventStatus, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  OPEN: "default",
  CLOSED: "secondary",
  DRAWN: "secondary",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/events"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Events
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {event.name}
              </h1>
              <Badge variant={STATUS_VARIANT[event.status]}>
                {event.status}
              </Badge>
            </div>
            {event.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {event.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/events/${event.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit basics
            </Link>
            <EventActions
              eventId={event.id}
              status={event.status}
              prizeCount={event._count.prizes}
              drawnAt={event.drawnAt}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Entries" value={event._count.entries} />
        <StatCard
          label="Prizes"
          value={event._count.prizes}
          href={`/events/${event.id}/prizes`}
        />
        <StatCard label="Packages" value={event._count.packages} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label="Date"
              value={
                event.date
                  ? new Date(event.date).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"
              }
            />
            <DetailRow label="Draw time" value={event.drawTime ?? "—"} />
            {event.drawnAt && (
              <DetailRow
                label="Drawn at"
                value={new Date(event.drawnAt).toLocaleString()}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label="Entry cost"
              value={String(event.entryCost)}
              mono
            />
            <DetailRow
              label="Prize pool"
              value={event.prizePool ? String(event.prizePool) : "—"}
              mono
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What's next</CardTitle>
          <CardDescription>
            Prize and package management land in Phase 1d/1e. Tabs for entries,
            draw, presentation, and the public portal will appear here as
            phases ship.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <CardContent className="pt-6">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </CardContent>
  );

  if (href) {
    return (
      <Card className="transition hover:border-foreground/20">
        <Link href={href} className="block">
          {inner}
        </Link>
      </Card>
    );
  }
  return <Card>{inner}</Card>;
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono tabular-nums" : ""}>{value}</span>
    </div>
  );
}
