// THROWAWAY — Phase 2b verification only. Pairs with app/api/dev/draw.
// Delete both in 2d when the real admin draw page exists.
//
// Setup:
//   npm run dev                                       (separate terminal)
//   export LD_SESSION_COOKIE='<paste full Cookie header from DevTools>'
//
// Commands:
//   npx tsx --env-file=.env scripts/check-draw.ts list
//   npx tsx --env-file=.env scripts/check-draw.ts start <PRIZE_ID>
//   npx tsx --env-file=.env scripts/check-draw.ts test  <PRIZE_ID>
//   npx tsx --env-file=.env scripts/check-draw.ts lock  <PRIZE_ID> <ENTRY_ID>
//   npx tsx --env-file=.env scripts/check-draw.ts clear <PRIZE_ID>

import { db } from "@/lib/db";

const COOKIE = process.env.LD_SESSION_COOKIE ?? "";
const BASE = process.env.LD_BASE_URL ?? "http://localhost:3000";

function usage() {
  console.log(
    `\nUsage:\n` +
      `  npx tsx --env-file=.env scripts/check-draw.ts list\n` +
      `  npx tsx --env-file=.env scripts/check-draw.ts start <PRIZE_ID>\n` +
      `  npx tsx --env-file=.env scripts/check-draw.ts test  <PRIZE_ID>\n` +
      `  npx tsx --env-file=.env scripts/check-draw.ts lock  <PRIZE_ID> <ENTRY_ID>\n` +
      `  npx tsx --env-file=.env scripts/check-draw.ts clear <PRIZE_ID>\n` +
      `\nRequires LD_SESSION_COOKIE env var for everything except 'list'.\n`,
  );
}

async function list() {
  const events = await db.event.findMany({
    where: { status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      prizes: {
        orderBy: { order: "asc" },
        include: {
          winningEntry: { include: { entrant: true } },
        },
      },
      _count: { select: { entries: true } },
    },
  });

  if (events.length === 0) {
    console.log(
      "No OPEN or CLOSED events found. Open an event in the admin UI first.",
    );
    return;
  }

  for (const e of events) {
    const uniqueEntrants = await db.entry.findMany({
      where: { eventId: e.id },
      distinct: ["entrantId"],
      select: { entrantId: true },
    });

    console.log(`\nEvent: ${e.name} (${e.id}) [${e.status}]`);
    console.log(`  ${e._count.entries} entries from ${uniqueEntrants.length} unique entrants`);
    console.log("  Prizes:");
    if (e.prizes.length === 0) {
      console.log("    (none)");
    }
    for (const p of e.prizes) {
      const tag = p.lockedAt ? "[LOCKED]   " : "[unlocked] ";
      const winnerSuffix = p.winningEntry
        ? `  → ${p.winningEntry.entrant.firstName} ${p.winningEntry.entrant.lastName} (entry ${p.winningEntry.id})`
        : "";
      console.log(`    ${tag}${p.id}  ${p.name}${winnerSuffix}`);
    }
    console.log("");
    const cookieHint = COOKIE || "<paste cookie>";
    console.log(`  Subscribe SSE: curl -N -H 'Cookie: ${cookieHint}' ${BASE}/api/events/${e.id}/stream`);
    console.log(`  Snapshot:      curl    -H 'Cookie: ${cookieHint}' ${BASE}/api/events/${e.id}/draw-snapshot`);
  }
}

async function callDevRoute(prizeId: string, params: Record<string, string>) {
  if (!COOKIE) {
    console.error("LD_SESSION_COOKIE env var is required.");
    process.exit(1);
  }
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/api/dev/draw/${prizeId}?${qs}`, {
    method: "POST",
    headers: { Cookie: COOKIE },
  });
  const text = await res.text();
  let pretty = text;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // Not JSON — print raw.
  }
  console.log(`HTTP ${res.status}\n${pretty}`);
}

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  switch (cmd) {
    case "list":
      await list();
      break;
    case "start":
      if (!arg1) return usage();
      await callDevRoute(arg1, { action: "start" });
      break;
    case "test":
      if (!arg1) return usage();
      await callDevRoute(arg1, { action: "test" });
      break;
    case "lock":
      if (!arg1 || !arg2) return usage();
      await callDevRoute(arg1, { action: "lock", entryId: arg2 });
      break;
    case "clear":
      if (!arg1) return usage();
      await callDevRoute(arg1, { action: "clear" });
      break;
    default:
      usage();
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
