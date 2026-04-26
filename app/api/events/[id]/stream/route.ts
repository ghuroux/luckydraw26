import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { hasRole, type Role } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  subscribe,
  replayAfter,
  encodeSse,
  HEARTBEAT_FRAME,
  HEARTBEAT_MS,
} from "@/lib/sse";

// Auth happens in-route, not at the edge: Prisma can't run on the edge
// runtime, and better-auth's session lookup needs DB access.
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
    select: { id: true },
  });
  if (!event) {
    return new Response("Not Found", { status: 404 });
  }

  const lastEventId = req.headers.get("Last-Event-ID");
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          // Stream closed; subsequent attempts after abort are expected.
        }
      };

      // Replay any events the client missed before the live subscription kicks in.
      for (const payload of replayAfter(eventId, lastEventId)) {
        safeEnqueue(encoder.encode(encodeSse(payload)));
      }

      // Initial comment forces the browser to commit the connection as
      // event-stream and starts processing immediately even if no events
      // arrive for a while.
      safeEnqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribe(eventId, (payload) => {
        safeEnqueue(encoder.encode(encodeSse(payload)));
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(HEARTBEAT_FRAME));
      }, HEARTBEAT_MS);

      const onAbort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable response buffering on nginx — without this, SSE frames are
      // held back until the buffer fills, killing the live feel.
      "X-Accel-Buffering": "no",
    },
  });
}
