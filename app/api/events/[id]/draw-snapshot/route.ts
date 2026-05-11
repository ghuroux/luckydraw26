import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { hasRole, type Role } from "@/lib/rbac";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const role = (session.user as { role?: Role }).role;
  if (!hasRole(role, "STAFF")) {
    return new Response("Forbidden", { status: 403 });
  }

  const [event, parkedEntries, allEntries] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        status: true,
        entryCost: true,
        showSupporterIntro: true,
        showSupporterNames: true,
        showSupporterTicketCounts: true,
        presentationStartedAt: true,
        prizes: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            order: true,
            lockedAt: true,
            winningEntry: {
              select: {
                id: true,
                ticketNumber: true,
                entrant: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
    db.entry.findMany({
      where: { eventId, wonAt: { not: null } },
      orderBy: { wonAt: "asc" },
      select: {
        id: true,
        ticketNumber: true,
        entrant: { select: { firstName: true, lastName: true } },
      },
    }),
    db.entry.findMany({
      where: { eventId },
      select: {
        entrantId: true,
        donationAmount: true,
        package: { select: { cost: true, quantity: true } },
      },
    }),
  ]);
  if (!event) {
    return new Response("Not Found", { status: 404 });
  }

  // Aggregate stats. Per-ticket cost: package entries pay the package's
  // prorated rate; non-package entries pay the event's entry cost. Donations
  // are stored per-entry (typically on row 0 of any batch). Number-precision
  // is acceptable for display — `formatMoney` rounds to 2dp.
  const supporterIds = new Set<string>();
  let totalRevenue = 0;
  for (const e of allEntries) {
    supporterIds.add(e.entrantId);
    if (e.package) {
      totalRevenue += Number(e.package.cost) / e.package.quantity;
    } else {
      totalRevenue += Number(event.entryCost);
    }
    if (e.donationAmount) {
      totalRevenue += Number(e.donationAmount);
    }
  }

  // All supporters — alphabetical, no ranking. Drives the scrolling
  // thank-you roll on the intro screen. Counts are included only when the
  // org opted in via showSupporterTicketCounts (transparency without
  // competition — order stays alphabetical). Skipped entirely when the
  // names toggle is off.
  let supporters: Array<{ name: string; ticketCount: number | null }> = [];
  if (event.showSupporterIntro && event.showSupporterNames) {
    const rows = await db.entrant.findMany({
      where: { entries: { some: { eventId } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    let countMap: Map<string, number> | null = null;
    if (event.showSupporterTicketCounts) {
      const grouped = await db.entry.groupBy({
        by: ["entrantId"],
        where: { eventId },
        _count: { _all: true },
      });
      countMap = new Map(grouped.map((g) => [g.entrantId, g._count._all]));
    }

    supporters = rows.map((s) => ({
      name: `${s.firstName} ${s.lastName}`,
      ticketCount: countMap?.get(s.id) ?? null,
    }));
  }

  return Response.json({
    eventId: event.id,
    eventName: event.name,
    status: event.status,
    entryCount: allEntries.length,
    supporterCount: supporterIds.size,
    totalRevenue,
    showSupporterIntro: event.showSupporterIntro,
    showSupporterNames: event.showSupporterNames,
    showSupporterTicketCounts: event.showSupporterTicketCounts,
    presentationStartedAt: event.presentationStartedAt?.toISOString() ?? null,
    supporters,
    parkedCount: parkedEntries.length,
    parkedWinners: parkedEntries.map((e) => ({
      entryId: e.id,
      ticketNumber: e.ticketNumber,
      displayName: `${e.entrant.firstName} ${e.entrant.lastName}`,
    })),
    prizes: event.prizes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      order: p.order,
      locked: Boolean(p.lockedAt),
      lockedAt: p.lockedAt?.toISOString() ?? null,
      winner: p.winningEntry
        ? {
            entryId: p.winningEntry.id,
            ticketNumber: p.winningEntry.ticketNumber,
            displayName: `${p.winningEntry.entrant.firstName} ${p.winningEntry.entrant.lastName}`,
          }
        : null,
    })),
  });
}
