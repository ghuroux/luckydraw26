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

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      prizes: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
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
  });
  if (!event) {
    return new Response("Not Found", { status: 404 });
  }

  return Response.json({
    eventId: event.id,
    eventName: event.name,
    status: event.status,
    prizes: event.prizes.map((p) => ({
      id: p.id,
      name: p.name,
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
