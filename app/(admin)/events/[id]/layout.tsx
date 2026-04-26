import Link from "next/link";
import { notFound } from "next/navigation";
import type { EventStatus } from "@prisma/client";
import { getEvent } from "@/lib/actions/event";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventActions } from "./EventActions";
import { EventTabs } from "./EventTabs";

const STATUS_VARIANT: Record<
  EventStatus,
  "default" | "secondary" | "outline"
> = {
  DRAFT: "outline",
  OPEN: "default",
  CLOSED: "secondary",
  DRAWN: "secondary",
};

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function EventLayout({ children, params }: LayoutProps) {
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

      <EventTabs eventId={event.id} />

      <div>{children}</div>
    </div>
  );
}
