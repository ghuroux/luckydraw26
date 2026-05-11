/**
 * One-off import for the Gift of Sight Invitational (14 May 2026).
 * - Reads /tmp/gos-entrants.json (produced by the xlsx parser)
 * - Creates the Event + Entrants
 * - Idempotent: entrants upserted by email; event created only if a same-named
 *   one doesn't already exist for the org.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/import-gos-2026.ts          # dry run
 *   npx tsx --env-file=.env scripts/import-gos-2026.ts --write  # apply
 */

import { readFileSync } from "node:fs";
import { db } from "../lib/db";

const WRITE = process.argv.includes("--write");
const ENTRANTS_JSON = "/tmp/gos-entrants.json";

const EVENT = {
  name: "Gift of Sight Invitational 2026",
  description:
    "Charity golf day at De Zalze Golf Club, Stellenbosch. 36 teams / 148 golfers / scramble drive. Lucky draw + auction at the Möet & Chandon prize-giving function. Proceeds to The Gift of Sight Trust.",
  date: new Date("2026-05-14"),
  drawTime: "18:30",
  entryCost: "100",
  prizePool: "100000",
  drawMode: "WINNER_DRAW" as const,
};

interface Entrant {
  firstName: string;
  lastName: string;
  email: string;
}

async function main() {
  const raw = readFileSync(ENTRANTS_JSON, "utf-8");
  const { entrants } = JSON.parse(raw) as { entrants: Entrant[] };

  console.log("─".repeat(60));
  console.log(`MODE: ${WRITE ? "WRITE" : "DRY RUN (no DB writes)"}`);
  console.log("─".repeat(60));
  console.log("Event:");
  console.log(`  name        ${EVENT.name}`);
  console.log(`  date        ${EVENT.date.toDateString()}`);
  console.log(`  drawTime    ${EVENT.drawTime}`);
  console.log(`  entryCost   R${EVENT.entryCost}`);
  console.log(`  prizePool   R${EVENT.prizePool}`);
  console.log(`  drawMode    ${EVENT.drawMode}`);
  console.log(`  status      DRAFT (operator opens via UI after adding prizes)`);
  console.log();
  console.log(`Entrants: ${entrants.length}`);

  if (!WRITE) {
    console.log();
    console.log("Re-run with --write to apply.");
    return;
  }

  const org = await db.organisation.findFirst();
  if (!org) {
    console.error(
      "No organisation found. Run `npm run seed:superadmin` first.",
    );
    process.exit(1);
  }

  // Event: create only if no same-named event exists for the org.
  const existing = await db.event.findFirst({
    where: { organisationId: org.id, name: EVENT.name },
  });
  let event;
  if (existing) {
    event = existing;
    console.log(`Event already exists (id=${event.id}). Skipping creation.`);
  } else {
    event = await db.event.create({
      data: {
        organisationId: org.id,
        name: EVENT.name,
        description: EVENT.description,
        date: EVENT.date,
        drawTime: EVENT.drawTime,
        entryCost: EVENT.entryCost,
        prizePool: EVENT.prizePool,
        drawMode: EVENT.drawMode,
      },
    });
    console.log(`Created event id=${event.id}`);
  }

  // Entrants: upsert by email. Don't overwrite existing first/last name in case
  // the operator has cleaned them up since.
  let created = 0;
  let skipped = 0;
  for (const e of entrants) {
    const existing = await db.entrant.findUnique({ where: { email: e.email } });
    if (existing) {
      skipped++;
      continue;
    }
    await db.entrant.create({
      data: {
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
      },
    });
    created++;
  }
  console.log(`Entrants: ${created} created, ${skipped} already existed.`);
  console.log();
  console.log("Done. Open the event in the admin UI to add prizes + open it.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
