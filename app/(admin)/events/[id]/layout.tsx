import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getEvent } from "@/lib/actions/event";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/shell";
import { eventStatusLabel, eventStatusTone } from "@/lib/event-status";
import { EventActions } from "./EventActions";
import { EventTabs } from "./EventTabs";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function EventLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Events
        </Link>

        <PageHeader
          title={
            <span className="inline-flex items-center gap-3">
              {event.name}
              <StatusBadge
                tone={eventStatusTone(event.status)}
                dot={event.status === "OPEN"}
              >
                {eventStatusLabel(event.status)}
              </StatusBadge>
            </span>
          }
          description={event.description ?? undefined}
          actions={
            <>
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
            </>
          }
        />
      </div>

      <EventTabs eventId={event.id} />

      <div className="animate-enter-page">{children}</div>
    </div>
  );
}
