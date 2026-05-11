// Creates a demo event for the supporter-intro feature: WINNER_DRAW mode,
// both showSupporterIntro + showSupporterNames toggles ON, 5 prizes, ~120
// entries spread across 18 entrants with varying ticket counts so the
// top-supporters list is meaningful.
//
// Status is CLOSED so you can immediately run draws without further setup.
//
// Usage:
//   npx tsx --env-file=.env scripts/seed-supporter-intro-demo.ts

import { db } from "@/lib/db";

const EVENT_NAME = "Demo: Supporter Intro Showcase";
const EMAIL_DOMAIN = "fixtures.luckydraw.local";

// Skewed ticket distribution → meaningful top-supporters list. Total = 120.
const ENTRANTS: Array<{
  firstName: string;
  lastName: string;
  tickets: number;
}> = [
  { firstName: "Lorraine", lastName: "Visser", tickets: 18 },
  { firstName: "Iain", lastName: "MacDonald", tickets: 15 },
  { firstName: "Fatima", lastName: "Adams", tickets: 12 },
  { firstName: "Bongani", lastName: "Khumalo", tickets: 10 },
  { firstName: "Hlengiwe", lastName: "Ndlovu", tickets: 9 },
  { firstName: "Gareth", lastName: "Hughes", tickets: 8 },
  { firstName: "Catherine", lastName: "Davies", tickets: 7 },
  { firstName: "Mark", lastName: "Thompson", tickets: 6 },
  { firstName: "Nontle", lastName: "Jacobs", tickets: 5 },
  { firstName: "Veronica", lastName: "Botha", tickets: 5 },
  { firstName: "Sipho", lastName: "Zulu", tickets: 4 },
  { firstName: "Penelope", lastName: "Roux", tickets: 4 },
  { firstName: "Refilwe", lastName: "Mahlangu", tickets: 4 },
  { firstName: "Kabelo", lastName: "Sithole", tickets: 3 },
  { firstName: "Tasneem", lastName: "Ismail", tickets: 3 },
  { firstName: "Edward", lastName: "Pietersen", tickets: 3 },
  { firstName: "Alice", lastName: "Smith", tickets: 2 },
  { firstName: "Warren", lastName: "Steyn", tickets: 2 },
];

const PRIZES = [
  {
    name: "Weekend at Sun City",
    description: "2 nights, all-inclusive for two",
  },
  {
    name: "Wine Tasting for Six",
    description: "At Boschendal Estate",
  },
  {
    name: "Dinner at La Belle Époque",
    description: "Tasting menu with paired wines",
  },
  { name: "Spa Day for Two", description: "Full-day package at Saxon Spa" },
  { name: "R5,000 Travel Voucher", description: "Use anywhere on Travelstart" },
];

async function main() {
  const org = await db.organisation.findFirst();
  if (!org) {
    throw new Error(
      "No organisation found. Run npm run seed:superadmin first.",
    );
  }

  // Bail if the event already exists (re-runs should be no-ops).
  const existing = await db.event.findFirst({ where: { name: EVENT_NAME } });
  if (existing) {
    console.log(
      `Event "${EVENT_NAME}" already exists (id=${existing.id}). Skipping.`,
    );
    console.log(
      `Visit /events/${existing.id}/draw to test, or delete it first to re-seed.`,
    );
    return;
  }

  // Upsert entrants by email so we can re-use any from prior fixture seeds.
  const entrants = await Promise.all(
    ENTRANTS.map(async (e) => {
      const email = `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@${EMAIL_DOMAIN}`;
      return db.entrant.upsert({
        where: { email },
        create: {
          firstName: e.firstName,
          lastName: e.lastName,
          email,
        },
        update: {},
      });
    }),
  );

  const event = await db.event.create({
    data: {
      organisationId: org.id,
      name: EVENT_NAME,
      description:
        "Demo event for the supporter-intro pre-show. Both Show supporter intro + Name top supporters are ON.",
      date: new Date(),
      drawTime: "19:30",
      entryCost: "50.00",
      prizePool: "10000.00",
      status: "CLOSED",
      drawMode: "WINNER_DRAW",
      showSupporterIntro: true,
      showSupporterNames: true,
    },
  });

  // Prizes — order by array index so they appear top-down in the manager.
  for (let i = 0; i < PRIZES.length; i++) {
    await db.prize.create({
      data: {
        eventId: event.id,
        name: PRIZES[i]!.name,
        description: PRIZES[i]!.description,
        order: i,
      },
    });
  }

  // Entries — sequential ticket numbers, ADMIN source, all paid (so the
  // aggregate revenue is meaningful and there's no UNPAID confusion).
  let ticketNumber = 1;
  const now = new Date();
  for (const [idxEntrant, spec] of ENTRANTS.entries()) {
    const entrant = entrants[idxEntrant]!;
    for (let i = 0; i < spec.tickets; i++) {
      await db.entry.create({
        data: {
          eventId: event.id,
          entrantId: entrant.id,
          ticketNumber: ticketNumber++,
          source: "ADMIN",
          paidAt: now,
          paymentMethod: "CARD",
        },
      });
    }
  }

  const totalTickets = ticketNumber - 1;
  console.log("\n✓ Demo event created.");
  console.log(`  id:           ${event.id}`);
  console.log(`  name:         ${event.name}`);
  console.log(`  status:       CLOSED · WINNER_DRAW`);
  console.log(`  prizes:       ${PRIZES.length}`);
  console.log(`  entrants:     ${ENTRANTS.length}`);
  console.log(`  tickets:      ${totalTickets}`);
  console.log(
    `  revenue:      R ${(totalTickets * 50).toLocaleString()} (50/ticket)`,
  );
  console.log(`\nNext steps:`);
  console.log(`  • Open the admin draw page:  /events/${event.id}/draw`);
  console.log(`  • Open the presentation:     /events/${event.id}/presentation`);
  console.log(`  • You should see the supporter intro on presentation, and`);
  console.log(`    the "Start the show" button on the admin draw page.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
