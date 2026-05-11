import Link from "next/link";
import { CalendarPlus } from "lucide-react";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader, StatCard } from "@/components/shell";
import { formatMoney } from "@/lib/money";
import { NeedsAttentionPanel } from "./NeedsAttentionPanel";
import { OpenEventCard } from "./OpenEventCard";

export default async function DashboardPage() {
  const session = await requireUser();

  // All the data the dashboard needs, in parallel. Aggregations stay simple
  // for now — single-table scans on entries (acceptable at expected volume).
  const [
    eventsTotal,
    openEvents,
    entrantsTotal,
    allEntries,
    parkedWinners,
    draftsReady,
  ] = await Promise.all([
    db.event.count(),
    db.event.findMany({
      where: { status: "OPEN" },
      orderBy: [{ date: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        date: true,
        drawTime: true,
        entryCost: true,
        _count: { select: { entries: true, prizes: true } },
      },
    }),
    db.entrant.count(),
    db.entry.findMany({
      select: {
        eventId: true,
        donationAmount: true,
        package: { select: { cost: true, quantity: true } },
        event: { select: { entryCost: true } },
      },
    }),
    // Parked winners across all events — drawn but awaiting prize assignment.
    db.entry.findMany({
      where: { wonAt: { not: null } },
      orderBy: { wonAt: "desc" },
      take: 20,
      select: {
        id: true,
        ticketNumber: true,
        wonAt: true,
        entrant: { select: { firstName: true, lastName: true } },
        event: { select: { id: true, name: true } },
      },
    }),
    // DRAFT events that already have prizes — ready to be opened.
    db.event.findMany({
      where: { status: "DRAFT", prizes: { some: {} } },
      orderBy: [{ date: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        date: true,
        _count: { select: { prizes: true, entries: true } },
      },
    }),
  ]);

  // Per-event revenue + lifetime totals. Per-ticket cost = package prorated
  // when present, else event entryCost; donations always added.
  const revenueByEvent = new Map<string, number>();
  let lifetimeRevenue = 0;
  for (const e of allEntries) {
    const perTicket = e.package
      ? Number(e.package.cost) / e.package.quantity
      : Number(e.event.entryCost);
    const donation = e.donationAmount ? Number(e.donationAmount) : 0;
    const contribution = perTicket + donation;
    revenueByEvent.set(
      e.eventId,
      (revenueByEvent.get(e.eventId) ?? 0) + contribution,
    );
    lifetimeRevenue += contribution;
  }
  const lifetimeTickets = allEntries.length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back"
        description={
          <>
            Signed in as{" "}
            <span className="font-mono text-foreground">
              {session.user.email}
            </span>
            .
          </>
        }
      />

      {/* Stat row — 5 across on lg, 3 on sm, 2 on mobile. Lifetime tickets
          and revenue are the motivating "running totals" of the platform. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Events" value={eventsTotal} href="/events" />
        <StatCard
          label="Open events"
          value={openEvents.length}
          hint={
            openEvents.length === 0 ? "no live events" : "accepting entries"
          }
        />
        <StatCard label="Entrants" value={entrantsTotal} href="/entrants" />
        <StatCard
          label="Tickets sold"
          value={lifetimeTickets.toLocaleString()}
          hint="lifetime"
        />
        <StatCard
          label="Raised"
          value={formatMoney(lifetimeRevenue)}
          hint="lifetime"
        />
      </div>

      {/* Open events — the dashboard centerpiece during a live event. */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-display-2xs font-semibold tracking-tight">
            Open events
          </h2>
          {openEvents.length > 0 && (
            <Link
              href="/events?status=OPEN"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          )}
        </div>

        {openEvents.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus />}
            title="No events are open right now."
            description="When you open an event for entries, it'll appear here with quick actions for tablet capture, presentation, and the draw."
            action={
              <Link
                href="/events/new"
                className={buttonVariants({ size: "sm" })}
              >
                Create an event
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {openEvents.map((e) => (
              <OpenEventCard
                key={e.id}
                id={e.id}
                name={e.name}
                date={e.date}
                drawTime={e.drawTime}
                ticketCount={e._count.entries}
                revenue={revenueByEvent.get(e.id) ?? 0}
                prizeCount={e._count.prizes}
              />
            ))}
          </div>
        )}
      </section>

      {/* Needs attention — actionable items, self-hiding when there are none.
          Sits at the bottom so urgent items still get attention but don't
          dominate the dashboard when the day is quiet. */}
      <NeedsAttentionPanel
        parkedWinners={parkedWinners.map((p) => ({
          entryId: p.id,
          ticketNumber: p.ticketNumber,
          entrantName: `${p.entrant.firstName} ${p.entrant.lastName}`,
          wonAt: p.wonAt!,
          eventId: p.event.id,
          eventName: p.event.name,
        }))}
        draftsReady={draftsReady.map((d) => ({
          id: d.id,
          name: d.name,
          date: d.date,
          prizeCount: d._count.prizes,
          entryCount: d._count.entries,
        }))}
      />
    </div>
  );
}
