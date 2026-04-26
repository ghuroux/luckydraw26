import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

// CSV-quote a single field per RFC 4180: wrap in double quotes if it contains
// a comma, double-quote, newline, or starts/ends with whitespace; escape
// existing double quotes by doubling them.
function csvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  await requireRole("ADMIN");

  const entrants = await db.entrant.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  const header = [
    "First name",
    "Last name",
    "Email",
    "Phone",
    "Date of birth",
    "Sponsor share opt-in",
    "SMS opt-in",
    "Total entries",
    "Created",
  ];

  const rows = entrants.map((e) =>
    [
      csvField(e.firstName),
      csvField(e.lastName),
      csvField(e.email),
      csvField(e.phone),
      csvField(
        e.dateOfBirth ? new Date(e.dateOfBirth).toISOString().slice(0, 10) : "",
      ),
      e.sponsorShareOptIn ? "yes" : "no",
      e.smsOptIn ? "yes" : "no",
      String(e._count.entries),
      new Date(e.createdAt).toISOString(),
    ].join(","),
  );

  const csv = [header.join(","), ...rows].join("\n") + "\n";
  const filename = `entrants-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
