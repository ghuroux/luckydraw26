import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { TabletFlow } from "./TabletFlow";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TabletCapturePage({ params }: PageProps) {
  await requireRole("STAFF");
  const { id } = await params;

  const [event, packages] = await Promise.all([
    db.event.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        entryCost: true,
        _count: { select: { entries: true } },
      },
    }),
    db.entryPackage.findMany({
      where: { eventId: id, isActive: true },
      orderBy: [{ quantity: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, quantity: true, cost: true },
    }),
  ]);

  if (!event) notFound();

  const idleMinutes = parseIdleMinutes(process.env.TABLET_IDLE_LOGOUT_MINUTES);

  return (
    <TabletFlow
      event={{
        id: event.id,
        name: event.name,
        status: event.status,
        entryCost: event.entryCost.toString(),
        soldCount: event._count.entries,
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
