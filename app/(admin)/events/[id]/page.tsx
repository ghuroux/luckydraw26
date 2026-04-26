import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/actions/event";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Entries"
          value={event._count.entries}
          href={`/events/${event.id}/entries`}
        />
        <StatCard
          label="Prizes"
          value={event._count.prizes}
          href={`/events/${event.id}/prizes`}
        />
        <StatCard
          label="Packages"
          value={event._count.packages}
          href={`/events/${event.id}/packages`}
        />
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
