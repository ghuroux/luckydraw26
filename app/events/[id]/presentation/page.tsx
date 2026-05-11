import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PresentationStage } from "./PresentationStage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PresentationPage({ params }: PageProps) {
  await requireRole("STAFF");
  const { id } = await params;

  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      drawMode: true,
      prizes: {
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!event) notFound();

  const prizeNameById: Record<string, string> = Object.fromEntries(
    event.prizes.map((p) => [p.id, p.name]),
  );

  return (
    <div className="min-h-screen w-full overflow-hidden">
      <PresentationStage
        eventId={event.id}
        eventName={event.name}
        drawMode={event.drawMode}
        prizeNameById={prizeNameById}
      />
    </div>
  );
}
