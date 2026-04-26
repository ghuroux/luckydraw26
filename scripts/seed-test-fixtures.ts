// Seeds three test events with full data — prizes, packages, entrants, entries.
// One OPEN with rich data, one DRAFT empty, one DRAWN with locked winners.
//
// Usage:
//   npx tsx --env-file=.env scripts/seed-test-fixtures.ts
//   npx tsx --env-file=.env scripts/seed-test-fixtures.ts --clean
//
// Idempotent: re-running upserts entrants and skips events whose name already
// exists. --clean removes only fixture-tagged data (events by name match,
// entrants by email domain).

import { db } from "@/lib/db";
import type { EntrySource, EventStatus } from "@prisma/client";

const FIXTURE_EMAIL_DOMAIN = "fixtures.luckydraw.local";

interface EntrantSpec {
  firstName: string;
  lastName: string;
}

const ENTRANTS: EntrantSpec[] = [
  { firstName: "Alice", lastName: "Smith" },
  { firstName: "Bongani", lastName: "Khumalo" },
  { firstName: "Catherine", lastName: "Davies" },
  { firstName: "Dineo", lastName: "Mokoena" },
  { firstName: "Edward", lastName: "Pietersen" },
  { firstName: "Fatima", lastName: "Adams" },
  { firstName: "Gareth", lastName: "Hughes" },
  { firstName: "Hlengiwe", lastName: "Ndlovu" },
  { firstName: "Iain", lastName: "MacDonald" },
  { firstName: "Jasmine", lastName: "Naidoo" },
  { firstName: "Kabelo", lastName: "Sithole" },
  { firstName: "Lorraine", lastName: "Visser" },
  { firstName: "Mark", lastName: "Thompson" },
  { firstName: "Nontle", lastName: "Jacobs" },
  { firstName: "Oluwaseun", lastName: "Okafor" },
  { firstName: "Penelope", lastName: "Roux" },
  { firstName: "Quinton", lastName: "Carter" },
  { firstName: "Refilwe", lastName: "Mahlangu" },
  { firstName: "Sipho", lastName: "Zulu" },
  { firstName: "Tasneem", lastName: "Ismail" },
  { firstName: "Umar", lastName: "Patel" },
  { firstName: "Veronica", lastName: "Botha" },
  { firstName: "Warren", lastName: "Steyn" },
  { firstName: "Xolani", lastName: "Dlamini" },
  { firstName: "Yvonne", lastName: "Govender" },
];

const emailFor = (e: EntrantSpec) =>
  `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase().replace(/[^a-z]/g, "")}@${FIXTURE_EMAIL_DOMAIN}`;

const phoneFor = (i: number) =>
  `+278${String(20000000 + i).padStart(8, "0")}`;

interface PrizeSpec {
  name: string;
  description?: string;
}

interface PackageSpec {
  label: string;
  quantity: number;
  cost: number;
}

// One row per (entrant, optional package). For singles, set packageLabel = null.
interface EntryBatch {
  entrantIndex: number;
  packageLabel: string | null;
  count: number;
  source: EntrySource;
  paid: boolean;
}

interface EventSpec {
  name: string;
  description: string;
  date: Date;
  drawTime: string;
  entryCost: number;
  prizePool: number;
  status: EventStatus;
  prizes: PrizeSpec[];
  packages: PackageSpec[];
  entries: EntryBatch[];
  // For DRAWN events — list of entrant indices that win each prize, in order.
  // Length must equal prizes.length. Indices must be unique (one win per entrant).
  drawnWinners?: number[];
}

const EVENTS: EventSpec[] = [
  // ── OPEN — the workhorse for testing draws ──────────────────────────────
  {
    name: "Spring Charity Gala 2026",
    description:
      "Annual fundraiser for the children's hospital wing. Live entertainment, three-course dinner, raffle and silent auction.",
    date: new Date("2026-05-15T18:00:00Z"),
    drawTime: "21:30",
    entryCost: 50,
    prizePool: 50000,
    status: "OPEN",
    prizes: [
      { name: "Weekend at Sun City", description: "2 nights, all-inclusive" },
      { name: "Wine Tasting for Six", description: "At Boschendal Estate" },
      { name: "Dinner at La Belle Époque" },
      { name: "Spa Day for Two" },
      { name: "R5,000 Travel Voucher" },
    ],
    packages: [
      { label: "Solo", quantity: 5, cost: 200 },
      { label: "Pair", quantity: 12, cost: 450 },
      { label: "Group", quantity: 30, cost: 1000 },
    ],
    entries: [
      { entrantIndex: 0, packageLabel: "Solo", count: 5, source: "ADMIN", paid: true },
      { entrantIndex: 1, packageLabel: "Pair", count: 12, source: "TABLET", paid: true },
      { entrantIndex: 2, packageLabel: null, count: 1, source: "ADMIN", paid: true },
      { entrantIndex: 3, packageLabel: "Solo", count: 5, source: "TABLET", paid: true },
      { entrantIndex: 4, packageLabel: "Pair", count: 12, source: "PUBLIC", paid: true },
      { entrantIndex: 5, packageLabel: null, count: 3, source: "ADMIN", paid: true },
      { entrantIndex: 6, packageLabel: "Solo", count: 5, source: "TABLET", paid: false },
      { entrantIndex: 7, packageLabel: null, count: 2, source: "ADMIN", paid: true },
      { entrantIndex: 8, packageLabel: "Group", count: 30, source: "PUBLIC", paid: true },
      { entrantIndex: 9, packageLabel: null, count: 1, source: "TABLET", paid: true },
      { entrantIndex: 10, packageLabel: "Solo", count: 5, source: "ADMIN", paid: true },
      { entrantIndex: 11, packageLabel: "Pair", count: 12, source: "PUBLIC", paid: true },
      { entrantIndex: 12, packageLabel: null, count: 1, source: "ADMIN", paid: false },
      { entrantIndex: 13, packageLabel: null, count: 4, source: "TABLET", paid: true },
      { entrantIndex: 14, packageLabel: "Solo", count: 5, source: "ADMIN", paid: true },
    ],
  },

  // ── DRAFT — bare event, no entries yet ─────────────────────────────────
  {
    name: "Summer Garden Party 2026",
    description:
      "Family-friendly afternoon at the cricket club. Bring the kids — face-painting, jumping castle, BBQ.",
    date: new Date("2026-08-22T14:00:00Z"),
    drawTime: "17:00",
    entryCost: 25,
    prizePool: 15000,
    status: "DRAFT",
    prizes: [
      { name: "Family Photo Shoot" },
      { name: "Hamper from Woolworths" },
      { name: "R1,500 Game Store Voucher" },
    ],
    packages: [
      { label: "Single", quantity: 3, cost: 60 },
      { label: "Family", quantity: 10, cost: 200 },
    ],
    entries: [],
  },

  // ── DRAWN — fully drawn historical event ───────────────────────────────
  {
    name: "Year-End Showcase 2025",
    description:
      "Final fundraiser of the year. Black-tie. The big one — keynote, auction, and the gala draw.",
    date: new Date("2025-12-12T19:00:00Z"),
    drawTime: "22:00",
    entryCost: 75,
    prizePool: 80000,
    status: "DRAWN",
    prizes: [
      { name: "10 Nights Mauritius — Beachfront", description: "Sponsored by SunHouse Travel" },
      { name: "Apple MacBook Pro 14\"" },
      { name: "Three-Course Dinner for 8 — Le Quartier" },
      { name: "R10,000 Cash" },
    ],
    packages: [
      { label: "Standard", quantity: 8, cost: 500 },
      { label: "Premium", quantity: 20, cost: 1200 },
    ],
    entries: [
      { entrantIndex: 0, packageLabel: "Premium", count: 20, source: "ADMIN", paid: true },
      { entrantIndex: 4, packageLabel: "Standard", count: 8, source: "TABLET", paid: true },
      { entrantIndex: 6, packageLabel: null, count: 2, source: "ADMIN", paid: true },
      { entrantIndex: 8, packageLabel: "Premium", count: 20, source: "TABLET", paid: true },
      { entrantIndex: 11, packageLabel: "Standard", count: 8, source: "ADMIN", paid: true },
      { entrantIndex: 12, packageLabel: null, count: 1, source: "TABLET", paid: true },
      { entrantIndex: 15, packageLabel: "Standard", count: 8, source: "ADMIN", paid: true },
      { entrantIndex: 16, packageLabel: null, count: 3, source: "ADMIN", paid: true },
      { entrantIndex: 17, packageLabel: "Premium", count: 20, source: "TABLET", paid: true },
      { entrantIndex: 19, packageLabel: null, count: 5, source: "ADMIN", paid: true },
      { entrantIndex: 20, packageLabel: "Standard", count: 8, source: "TABLET", paid: true },
      { entrantIndex: 22, packageLabel: null, count: 1, source: "ADMIN", paid: true },
    ],
    // 4 prizes → 4 unique winning entrants. Indices reference ENTRANTS array.
    // Each entrant must have at least one entry in this event.
    drawnWinners: [8, 17, 6, 19],
  },
];

async function getOrgId(): Promise<string> {
  const org = await db.organisation.findFirst();
  if (!org) {
    throw new Error("No Organisation found. Run `npm run seed:superadmin` first.");
  }
  return org.id;
}

async function upsertEntrants() {
  const ids: string[] = [];
  for (let i = 0; i < ENTRANTS.length; i++) {
    const spec = ENTRANTS[i]!;
    const entrant = await db.entrant.upsert({
      where: { email: emailFor(spec) },
      create: {
        firstName: spec.firstName,
        lastName: spec.lastName,
        email: emailFor(spec),
        phone: phoneFor(i),
      },
      update: {},
    });
    ids.push(entrant.id);
  }
  return ids;
}

async function seedEvent(
  spec: EventSpec,
  organisationId: string,
  entrantIds: string[],
) {
  const existing = await db.event.findFirst({ where: { name: spec.name } });
  if (existing) {
    console.log(`  - skipping (already exists): ${spec.name}`);
    return;
  }

  const event = await db.event.create({
    data: {
      organisationId,
      name: spec.name,
      description: spec.description,
      date: spec.date,
      drawTime: spec.drawTime,
      entryCost: spec.entryCost,
      prizePool: spec.prizePool,
      status: spec.status,
      drawnAt: spec.status === "DRAWN" ? spec.date : null,
    },
  });

  // Prizes — keep IDs by index for winner assignment later
  const prizeIds: string[] = [];
  for (let i = 0; i < spec.prizes.length; i++) {
    const p = spec.prizes[i]!;
    const prize = await db.prize.create({
      data: {
        eventId: event.id,
        name: p.name,
        description: p.description ?? null,
        order: i,
      },
    });
    prizeIds.push(prize.id);
  }

  // Packages — keep IDs by label for entry assignment
  const packageIdByLabel: Record<string, string> = {};
  for (const pkg of spec.packages) {
    const created = await db.entryPackage.create({
      data: {
        eventId: event.id,
        label: pkg.label,
        quantity: pkg.quantity,
        cost: pkg.cost,
      },
    });
    packageIdByLabel[pkg.label] = created.id;
  }

  // Entries — sequential ticket numbers across all batches
  let nextTicket = 1;
  const createdEntries: { id: string; entrantId: string }[] = [];
  for (const batch of spec.entries) {
    const packageId = batch.packageLabel ? packageIdByLabel[batch.packageLabel]! : null;
    for (let n = 1; n <= batch.count; n++) {
      const entry = await db.entry.create({
        data: {
          eventId: event.id,
          entrantId: entrantIds[batch.entrantIndex]!,
          ticketNumber: nextTicket++,
          packageId,
          packageEntryNum: packageId ? n : null,
          paidAt: batch.paid ? new Date() : null,
          paymentRef: batch.paid ? paymentRefFor(batch.source) : null,
          source: batch.source,
        },
      });
      createdEntries.push({ id: entry.id, entrantId: entry.entrantId });
    }
  }

  // Lock winners on DRAWN events
  if (spec.status === "DRAWN" && spec.drawnWinners) {
    if (spec.drawnWinners.length !== spec.prizes.length) {
      throw new Error(
        `[${spec.name}] drawnWinners.length (${spec.drawnWinners.length}) != prizes.length (${spec.prizes.length})`,
      );
    }
    const used = new Set<string>();
    for (let i = 0; i < spec.drawnWinners.length; i++) {
      const entrantId = entrantIds[spec.drawnWinners[i]!]!;
      if (used.has(entrantId)) {
        throw new Error(
          `[${spec.name}] entrant ${entrantId} would win twice — drawnWinners must be unique entrants`,
        );
      }
      used.add(entrantId);
      const winningEntry = createdEntries.find((e) => e.entrantId === entrantId);
      if (!winningEntry) {
        throw new Error(
          `[${spec.name}] entrant index ${spec.drawnWinners[i]} has no entry`,
        );
      }
      await db.prize.update({
        where: { id: prizeIds[i]! },
        data: {
          winningEntryId: winningEntry.id,
          lockedAt: spec.date,
        },
      });
    }
  }

  console.log(
    `  + created: ${spec.name} [${spec.status}] · ${spec.prizes.length} prizes · ${spec.packages.length} packages · ${spec.entries.reduce((n, b) => n + b.count, 0)} entries${spec.drawnWinners ? ` · ${spec.drawnWinners.length} winners locked` : ""}`,
  );
}

function paymentRefFor(source: EntrySource): string {
  if (source === "TABLET") return "CASH";
  if (source === "PUBLIC") return `EFT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  return `CARD-XX${Math.floor(1000 + Math.random() * 9000)}`;
}

async function clean() {
  const eventNames = EVENTS.map((e) => e.name);

  const events = await db.event.findMany({
    where: { name: { in: eventNames } },
    select: { id: true, name: true },
  });

  if (events.length > 0) {
    // Cascade: deleting events removes their prizes, packages, entries.
    const deleted = await db.event.deleteMany({
      where: { id: { in: events.map((e) => e.id) } },
    });
    console.log(`Deleted ${deleted.count} fixture events (cascade removes prizes/packages/entries).`);
  } else {
    console.log("No fixture events found.");
  }

  // Entrants only deletable if no remaining entries reference them.
  const entrantsToCheck = await db.entrant.findMany({
    where: { email: { endsWith: `@${FIXTURE_EMAIL_DOMAIN}` } },
    select: { id: true, email: true, _count: { select: { entries: true } } },
  });
  const safeToDelete = entrantsToCheck.filter((e) => e._count.entries === 0);
  if (safeToDelete.length > 0) {
    const del = await db.entrant.deleteMany({
      where: { id: { in: safeToDelete.map((e) => e.id) } },
    });
    console.log(`Deleted ${del.count} fixture entrants.`);
  }
  const stillReferenced = entrantsToCheck.length - safeToDelete.length;
  if (stillReferenced > 0) {
    console.log(
      `${stillReferenced} fixture entrants still referenced by non-fixture entries — left alone.`,
    );
  }
}

async function main() {
  if (process.argv.includes("--clean")) {
    await clean();
    return;
  }

  const orgId = await getOrgId();
  console.log("Upserting entrants…");
  const entrantIds = await upsertEntrants();
  console.log(`  ${entrantIds.length} entrants ready.`);
  console.log("\nSeeding events…");
  for (const spec of EVENTS) {
    await seedEvent(spec, orgId, entrantIds);
  }
  console.log("\nDone.");
}

main()
  .then(async () => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
