import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { enforceAccountAccess, requireRole } from "@/lib/rbac";
import { TabletFlow } from "./TabletFlow";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TabletCapturePage({ params }: PageProps) {
  const session = await requireRole("STAFF");
  await enforceAccountAccess(session.user.id);
  const { id } = await params;

  const [event, packages, allEntries] = await Promise.all([
    db.event.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        entryCost: true,
        showSupporterNames: true,
        showSupporterTicketCounts: true,
        prizes: {
          orderBy: { order: "asc" },
          select: { name: true },
          take: 4,
        },
        _count: { select: { entries: true, prizes: true } },
      },
    }),
    db.entryPackage.findMany({
      where: { eventId: id, isActive: true },
      orderBy: [{ quantity: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, quantity: true, cost: true },
    }),
    db.entry.findMany({
      where: { eventId: id },
      select: {
        entrantId: true,
        donationAmount: true,
        package: { select: { cost: true, quantity: true } },
      },
    }),
  ]);

  if (!event) notFound();

  // Aggregate stats. Same math as the presentation snapshot — per-ticket cost
  // (package prorated where applicable) + donations.
  const supporterIds = new Set<string>();
  let totalRevenue = 0;
  for (const e of allEntries) {
    supporterIds.add(e.entrantId);
    totalRevenue += e.package
      ? Number(e.package.cost) / e.package.quantity
      : Number(event.entryCost);
    if (e.donationAmount) totalRevenue += Number(e.donationAmount);
  }
  const supporterCount = supporterIds.size;

  // Supporters list — alphabetical, optionally with ticket counts. Gated by
  // the same toggles as the presentation; this keeps privacy decisions
  // consistent across audience-visible surfaces.
  let supporters: Array<{ name: string; ticketCount: number | null }> = [];
  if (event.showSupporterNames) {
    const rows = await db.entrant.findMany({
      where: { entries: { some: { eventId: id } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    });
    let countMap: Map<string, number> | null = null;
    if (event.showSupporterTicketCounts) {
      const grouped = await db.entry.groupBy({
        by: ["entrantId"],
        where: { eventId: id },
        _count: { _all: true },
      });
      countMap = new Map(grouped.map((g) => [g.entrantId, g._count._all]));
    }
    supporters = rows.map((s) => ({
      name: `${s.firstName} ${s.lastName}`,
      ticketCount: countMap?.get(s.id) ?? null,
    }));
  }

  const idleMinutes = parseIdleMinutes(process.env.TABLET_IDLE_LOGOUT_MINUTES);

  return (
    <TabletFlow
      event={{
        id: event.id,
        name: event.name,
        status: event.status,
        entryCost: event.entryCost.toString(),
        soldCount: event._count.entries,
        prizeCount: event._count.prizes,
        prizePreview: event.prizes.map((p) => p.name),
      }}
      landing={{
        supporterCount,
        totalRevenue,
        showSupporterNames: event.showSupporterNames,
        supporters,
      }}
      packages={packages.map((p) => ({
        id: p.id,
        label: p.label,
        quantity: p.quantity,
        cost: p.cost.toString(),
      }))}
      idleMinutes={idleMinutes}
    />
  );
}

function parseIdleMinutes(raw: string | undefined): number {
  if (!raw) return 15;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 15;
}
