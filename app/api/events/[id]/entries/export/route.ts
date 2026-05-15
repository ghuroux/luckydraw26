import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { db } from "@/lib/db";
import { listEntrantSummariesForEvent } from "@/lib/actions/entry";
import { displayEmail } from "@/lib/entrant-contact";
import { requireRole } from "@/lib/rbac";

// Excel export of the per-entrant entry summary for a single event. Mirrors
// the grouped view in the admin UI (one row per entrant) so the organiser
// can be handed a single spreadsheet of "who bought what" after the event.

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  await requireRole("STAFF");

  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const { entrants } = await listEntrantSummariesForEvent({ eventId: id });

  // Locked prizes → winning entrant. One entrant can win multiple prizes
  // (multiple winning entries), so accumulate into a per-entrant list.
  const lockedPrizes = await db.prize.findMany({
    where: { eventId: id, lockedAt: { not: null }, winningEntryId: { not: null } },
    orderBy: { order: "asc" },
    select: {
      name: true,
      winningEntry: { select: { entrantId: true } },
    },
  });
  const winnersByEntrant = new Map<string, string[]>();
  for (const p of lockedPrizes) {
    const entrantId = p.winningEntry?.entrantId;
    if (!entrantId) continue;
    const list = winnersByEntrant.get(entrantId) ?? [];
    list.push(p.name);
    winnersByEntrant.set(entrantId, list);
  }
  const hasAnyWinners = winnersByEntrant.size > 0;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lucky Draw";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Entrants");

  // Only include the Winner column when at least one prize has been locked
  // — otherwise it's an empty column that confuses the organiser.
  sheet.columns = [
    { header: "First name", key: "firstName", width: 18 },
    { header: "Last name", key: "lastName", width: 22 },
    { header: "Email", key: "email", width: 32 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Tickets", key: "tickets", width: 10 },
    { header: "Paid", key: "paid", width: 10 },
    { header: "Unpaid", key: "unpaid", width: 10 },
    { header: "Status", key: "status", width: 12 },
    { header: "Total spend", key: "total", width: 14 },
    { header: "Donation", key: "donation", width: 14 },
    ...(hasAnyWinners
      ? [{ header: "Winner", key: "winner", width: 32 }]
      : []),
  ];

  // Header row styling: bold + light fill + bottom border. Keeps the
  // organiser-facing file readable without needing post-edit.
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };
  headerRow.border = {
    bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
  };

  for (const e of entrants) {
    const status =
      e.unpaidCount === 0
        ? "All paid"
        : e.paidCount === 0
          ? "Unpaid"
          : "Partial";
    const winnerPrizes = winnersByEntrant.get(e.entrant.id);
    sheet.addRow({
      firstName: e.entrant.firstName,
      lastName: e.entrant.lastName,
      email: displayEmail(e.entrant) ?? "",
      phone: e.entrant.phone ?? "",
      tickets: e.ticketCount,
      paid: e.paidCount,
      unpaid: e.unpaidCount,
      status,
      total: e.totalSpend,
      donation: e.donationTotal,
      ...(hasAnyWinners
        ? { winner: winnerPrizes ? winnerPrizes.join("; ") : "" }
        : {}),
    });
  }

  // Currency formatting for the two money columns (ZAR).
  const moneyFormat = '"R" #,##0.00';
  sheet.getColumn("total").numFmt = moneyFormat;
  sheet.getColumn("donation").numFmt = moneyFormat;

  // Freeze the header row + first two name columns so the operator can
  // scroll a long list without losing context.
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
  const slug = event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `entries-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
