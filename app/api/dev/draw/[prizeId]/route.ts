// THROWAWAY — Phase 2b verification only. Delete in 2d when the real admin
// draw page exists. Refuses in production but should not ship at all.
import { type NextRequest } from "next/server";
import {
  startDraw,
  testDraw,
  lockWinner,
  clearWinner,
} from "@/lib/actions/draw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ prizeId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }

  const { prizeId } = await params;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const entryId = url.searchParams.get("entryId");

  try {
    switch (action) {
      case "start":
        return Response.json(await startDraw(prizeId));
      case "test":
        return Response.json(await testDraw(prizeId));
      case "lock":
        if (!entryId) {
          return Response.json(
            { ok: false, error: "lock requires ?entryId=..." },
            { status: 400 },
          );
        }
        return Response.json(await lockWinner(prizeId, entryId));
      case "clear":
        return Response.json(await clearWinner(prizeId));
      default:
        return Response.json(
          { ok: false, error: "action must be one of: start, test, lock, clear" },
          { status: 400 },
        );
    }
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
