import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { DrawManager } from "./DrawManager";

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
      prizes: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
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

      {hasPrizes && <DrawManager prizes={event.prizes} canDraw={canDraw} />}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4 text-sm">{children}</div>
  );
}
