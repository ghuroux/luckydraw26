// THROWAWAY — seeds 6 test entrants + 6 entries on the most recent OPEN
// event so Phase 2b verification has data to draw against.
// Pass `--clean` to remove them again (deletes entries belonging to seeded
// test entrants by email pattern, then deletes the entrants).

import { db } from "@/lib/db";

const TEST_ENTRANTS = [
  { firstName: "Sarah", lastName: "Chen", email: "test+sarah@luckydraw.local" },
  { firstName: "Marcus", lastName: "Williams", email: "test+marcus@luckydraw.local" },
  { firstName: "Priya", lastName: "Patel", email: "test+priya@luckydraw.local" },
  { firstName: "James", lastName: "O'Brien", email: "test+james@luckydraw.local" },
  { firstName: "Aisha", lastName: "Mohammed", email: "test+aisha@luckydraw.local" },
  { firstName: "Robert", lastName: "Johnson", email: "test+robert@luckydraw.local" },
];

async function main() {
  const clean = process.argv.includes("--clean");

  if (clean) {
    const seeded = await db.entrant.findMany({
      where: { email: { startsWith: "test+", endsWith: "@luckydraw.local" } },
      select: { id: true, email: true },
    });
    if (seeded.length === 0) {
      console.log("No seeded test entrants found.");
      return;
    }
    const ids = seeded.map((e) => e.id);
    const entryDel = await db.entry.deleteMany({ where: { entrantId: { in: ids } } });
    const entrantDel = await db.entrant.deleteMany({ where: { id: { in: ids } } });
    console.log(`Cleaned ${entryDel.count} entries + ${entrantDel.count} entrants.`);
    return;
  }

  const event = await db.event.findFirst({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (!event) {
    console.error("No OPEN event found. Open an event first.");
    process.exit(1);
  }
  console.log(`Seeding into event: ${event.name} (${event.id})`);

  const lastEntry = await db.entry.findFirst({
    where: { eventId: event.id },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });
  let nextTicket = (lastEntry?.ticketNumber ?? 0) + 1;

  for (const spec of TEST_ENTRANTS) {
    const entrant = await db.entrant.upsert({
      where: { email: spec.email },
      create: spec,
      update: {},
    });
    await db.entry.create({
      data: {
        eventId: event.id,
        entrantId: entrant.id,
        ticketNumber: nextTicket++,
        source: "ADMIN",
      },
    });
    console.log(`  + ${spec.firstName} ${spec.lastName} → ticket ${nextTicket - 1}`);
  }

  console.log("\nDone. Run `npx tsx --env-file=.env scripts/check-draw.ts list` to confirm.");
}

main()
  .then(async () => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
