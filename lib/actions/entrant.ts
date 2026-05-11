"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { DEFAULT_PAGE_SIZE, pageInfo } from "@/lib/pagination";

const entrantInputSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(100),
  lastName: z.string().min(1, "Last name is required.").max(100),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(50).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")), // YYYY-MM-DD
  sponsorShareOptIn: z.boolean(),
  smsOptIn: z.boolean(),
});

export type EntrantInput = z.infer<typeof entrantInputSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface ListEntrantsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listEntrants({
  search,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: ListEntrantsParams) {
  await requireRole("STAFF");

  const where: Prisma.EntrantWhereInput = {};
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [entrants, total] = await db.$transaction([
    db.entrant.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { entries: true } },
        entries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    db.entrant.count({ where }),
  ]);

  return {
    entrants,
    pagination: pageInfo(page, pageSize, total),
  };
}

export async function getEntrant(id: string) {
  await requireRole("STAFF");
  return db.entrant.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { createdAt: "desc" },
        include: {
          event: {
            select: { id: true, name: true, date: true, entryCost: true },
          },
          package: { select: { id: true, label: true, cost: true } },
        },
      },
    },
  });
}

export async function updateEntrant(
  id: string,
  input: EntrantInput,
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = entrantInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const existing = await db.entrant.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Entrant not found." };

  const data = parsed.data;
  try {
    await db.entrant.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        sponsorShareOptIn: data.sponsorShareOptIn,
        smsOptIn: data.smsOptIn,
      },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return {
        ok: false,
        error: "Another entrant already uses that email address.",
      };
    }
    throw err;
  }

  await logAudit({
    action: "ENTRANT_UPDATED",
    entityType: "Entrant",
    entityId: id,
    metadata: {
      before: { email: existing.email, name: `${existing.firstName} ${existing.lastName}` },
      after: { email: data.email, name: `${data.firstName} ${data.lastName}` },
    },
  });

  revalidatePath("/entrants");
  revalidatePath(`/entrants/${id}`);
  return { ok: true };
}

export async function createEntrant(
  input: EntrantInput,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("STAFF");

  const parsed = entrantInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = parsed.data;
  let created;
  try {
    created = await db.entrant.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        sponsorShareOptIn: data.sponsorShareOptIn,
        smsOptIn: data.smsOptIn,
      },
      select: { id: true },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return {
        ok: false,
        error: "Another entrant already uses that email address.",
        fieldErrors: {
          email: ["Another entrant already uses that email address."],
        },
      };
    }
    throw err;
  }

  await logAudit({
    action: "ENTRANT_CREATED",
    entityType: "Entrant",
    entityId: created.id,
    metadata: {
      email: data.email,
      name: `${data.firstName} ${data.lastName}`,
    },
  });

  revalidatePath("/entrants");
  return { ok: true, data: { id: created.id } };
}

// Lightweight contact capture used by the tablet flow when an entrant
// imported from a tee-sheet has only a placeholder email. STAFF role (not
// ADMIN) so it works from the tablet seat. At least one of email/phone
// must be provided. If only one is captured, the other is left untouched.
const captureContactSchema = z
  .object({
    email: z
      .union([z.string().email("Enter a valid email."), z.literal("")])
      .optional(),
    phone: z.string().trim().max(50).optional(),
  })
  .refine(
    (d) => (d.email?.trim() ?? "") !== "" || (d.phone?.trim() ?? "") !== "",
    { message: "Provide at least an email or a phone number." },
  );

export async function captureEntrantContact(
  id: string,
  input: { email?: string; phone?: string },
): Promise<ActionResult> {
  await requireRole("STAFF");
  const parsed = captureContactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Provide a valid email or phone number.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const existing = await db.entrant.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Entrant not found." };

  const data = parsed.data;
  const emailTrimmed = data.email?.trim() ?? "";
  const phoneTrimmed = data.phone?.trim() ?? "";

  try {
    await db.entrant.update({
      where: { id },
      data: {
        email: emailTrimmed !== "" ? emailTrimmed : existing.email,
        phone: phoneTrimmed !== "" ? phoneTrimmed : existing.phone,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return {
        ok: false,
        error: "Another entrant already uses that email address.",
        fieldErrors: {
          email: ["Another entrant already uses that email address."],
        },
      };
    }
    throw err;
  }

  await logAudit({
    action: "ENTRANT_CONTACT_CAPTURED",
    entityType: "Entrant",
    entityId: id,
    metadata: {
      capturedEmail: emailTrimmed !== "",
      capturedPhone: phoneTrimmed !== "",
      previousEmail: existing.email,
      previousPhone: existing.phone,
    },
  });

  revalidatePath("/entrants");
  revalidatePath(`/entrants/${id}`);
  return { ok: true };
}

// ───────────────── CSV import ─────────────────
//
// Minimal CSV parser that handles the common spreadsheet-export cases:
// double-quote escaping, CRLF/LF newlines, BOM at start. Sufficient for
// name/email/phone columns. Not a general-purpose CSV library — if users
// hit edge cases (commas inside fields, etc.) consider papaparse.
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const flushField = () => {
    row.push(field);
    field = "";
  };
  const flushRow = () => {
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") flushField();
    else if (ch === "\n") {
      flushField();
      flushRow();
    } else if (ch === "\r") {
      // handled by following \n
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    flushField();
    flushRow();
  }

  const headers = rows.shift() ?? [];
  return { headers, rows };
}

function detectColumn(headers: string[], synonyms: string[]): number {
  const normalised = headers.map((h) =>
    h.replace(/[^a-z0-9]/gi, "").toLowerCase(),
  );
  for (const s of synonyms) {
    const idx = normalised.indexOf(s);
    if (idx !== -1) return idx;
  }
  return -1;
}

// CSV import is a two-stage flow:
//   1. analyzeEntrantImport — parses the CSV, classifies each row as
//      clean / potential-duplicate / error. NO DB WRITES. Returns the
//      classification so the operator can review.
//   2. commitEntrantImport — takes the rows the operator confirmed and
//      writes them. Decisions live on the client between the two calls.
//
// "Potential duplicate" = name match against an existing entrant AND the
// import row has no real email to distinguish them. When the row has a
// real email that matches existing data, it's a hard error (skip) — that
// case isn't a judgement call.

export interface ImportParsedRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string | null; // null when blank or invalid
  phone: string | null;
}

export interface ImportExistingMatch {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  entryCount: number;
  lastSeenAt: string | null;
}

export interface ImportAnalysisResult {
  clean: ImportParsedRow[];
  duplicates: Array<{
    row: ImportParsedRow;
    existing: ImportExistingMatch[];
  }>;
  errors: Array<{ row: number; reason: string }>;
}

export async function analyzeEntrantImport(
  formData: FormData,
): Promise<ActionResult<ImportAnalysisResult>> {
  await requireRole("STAFF");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a CSV file to upload." };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Couldn't read the file." };
  }

  const { headers, rows } = parseCsv(text);
  if (headers.length === 0 || rows.length === 0) {
    return { ok: false, error: "CSV is empty or has no data rows." };
  }

  const firstNameIdx = detectColumn(headers, [
    "firstname",
    "first",
    "givenname",
    "name",
  ]);
  const lastNameIdx = detectColumn(headers, [
    "lastname",
    "surname",
    "last",
    "familyname",
  ]);
  const emailIdx = detectColumn(headers, ["email", "emailaddress", "mail"]);
  const phoneIdx = detectColumn(headers, [
    "phone",
    "mobile",
    "cell",
    "phonenumber",
    "mobilenumber",
    "cellnumber",
    "contact",
  ]);

  if (firstNameIdx === -1 || lastNameIdx === -1) {
    return {
      ok: false,
      error:
        "CSV must include First Name and Last Name columns (Surname also accepted).",
    };
  }

  // Single full-table scan for the dedup index. Acceptable up to tens of
  // thousands of entrants; if this becomes a bottleneck later we'd add a
  // (lower(firstName), lower(lastName)) index and query per-row.
  const existing = await db.entrant.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      _count: { select: { entries: true } },
      entries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const nameKey = (f: string, l: string) =>
    `${f.trim().toLowerCase()} ${l.trim().toLowerCase()}`;
  const byName = new Map<string, typeof existing>();
  for (const e of existing) {
    const key = nameKey(e.firstName, e.lastName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(e);
  }
  const byEmail = new Map<string, (typeof existing)[number]>();
  for (const e of existing) {
    if (!e.email.endsWith(".placeholder")) {
      byEmail.set(e.email.toLowerCase(), e);
    }
  }

  const clean: ImportParsedRow[] = [];
  const duplicates: ImportAnalysisResult["duplicates"] = [];
  const errors: ImportAnalysisResult["errors"] = [];
  const seenNamesInFile = new Set<string>();
  const seenEmailsInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 2;
    const firstName = (row[firstNameIdx] ?? "").trim();
    const lastName = (row[lastNameIdx] ?? "").trim();

    if (!firstName || !lastName) {
      errors.push({ row: rowNumber, reason: "Missing first or last name" });
      continue;
    }

    let rawEmail =
      emailIdx >= 0 ? (row[emailIdx] ?? "").trim().toLowerCase() : "";
    if (rawEmail && !/^\S+@\S+\.\S+$/.test(rawEmail)) rawEmail = "";

    const phone =
      phoneIdx >= 0 && (row[phoneIdx] ?? "").trim() !== ""
        ? row[phoneIdx]!.trim()
        : null;

    const parsed: ImportParsedRow = {
      rowNumber,
      firstName,
      lastName,
      email: rawEmail || null,
      phone,
    };

    // Real email collision against the DB — unambiguous, hard skip.
    if (rawEmail && byEmail.has(rawEmail)) {
      errors.push({
        row: rowNumber,
        reason: `Email already exists in the database: ${rawEmail}`,
      });
      continue;
    }

    // Real email duplicated within this file.
    if (rawEmail && seenEmailsInFile.has(rawEmail)) {
      errors.push({
        row: rowNumber,
        reason: `Duplicate email in file: ${rawEmail}`,
      });
      continue;
    }
    if (rawEmail) seenEmailsInFile.add(rawEmail);

    // No real email → check name against DB and within the file.
    if (!rawEmail) {
      const key = nameKey(firstName, lastName);
      if (seenNamesInFile.has(key)) {
        errors.push({
          row: rowNumber,
          reason: `Duplicate name in file: ${firstName} ${lastName}`,
        });
        continue;
      }
      seenNamesInFile.add(key);

      const matches = byName.get(key);
      if (matches && matches.length > 0) {
        duplicates.push({
          row: parsed,
          existing: matches.map((m) => ({
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.email,
            phone: m.phone,
            entryCount: m._count.entries,
            lastSeenAt: m.entries[0]?.createdAt.toISOString() ?? null,
          })),
        });
        continue;
      }
    }

    clean.push(parsed);
  }

  return { ok: true, data: { clean, duplicates, errors } };
}

export interface CommitImportResult {
  created: number;
  failed: Array<{ row: number; reason: string }>;
}

export async function commitEntrantImport(
  rows: ImportParsedRow[],
): Promise<ActionResult<CommitImportResult>> {
  await requireRole("STAFF");

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: true, data: { created: 0, failed: [] } };
  }

  const batchTag = `csv-${Date.now().toString(36)}`;
  const usedEmails = new Set<string>();
  const failed: CommitImportResult["failed"] = [];
  let createdCount = 0;

  for (const row of rows) {
    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();
    if (!firstName || !lastName) {
      failed.push({
        row: row.rowNumber,
        reason: "Missing first or last name",
      });
      continue;
    }

    let email: string;
    if (row.email && /^\S+@\S+\.\S+$/.test(row.email)) {
      email = row.email.toLowerCase();
    } else {
      const slug = `${firstName}.${lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "");
      let candidate = `${slug}@${batchTag}.placeholder`;
      let n = 1;
      while (usedEmails.has(candidate)) {
        n++;
        candidate = `${slug}.${n}@${batchTag}.placeholder`;
      }
      email = candidate;
    }

    if (usedEmails.has(email)) {
      failed.push({
        row: row.rowNumber,
        reason: `Duplicate email in batch: ${email}`,
      });
      continue;
    }
    usedEmails.add(email);

    try {
      await db.entrant.create({
        data: {
          firstName,
          lastName,
          email,
          phone: row.phone?.trim() || null,
          sponsorShareOptIn: false,
          smsOptIn: false,
        },
        select: { id: true },
      });
      createdCount++;
    } catch (err) {
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        failed.push({
          row: row.rowNumber,
          reason: `Email already exists: ${email}`,
        });
        continue;
      }
      throw err;
    }
  }

  if (createdCount > 0) {
    await logAudit({
      action: "ENTRANT_CREATED",
      entityType: "Entrant",
      entityId: batchTag,
      metadata: {
        source: "csv_import",
        batchTag,
        created: createdCount,
        failed: failed.length,
      },
    });
  }

  revalidatePath("/entrants");
  return { ok: true, data: { created: createdCount, failed } };
}

// Used by the entry-creation typeahead in Phase 1g and the tablet-capture
// entrant step in Phase 3b.
export async function searchEntrants(q: string, limit = 10) {
  await requireRole("STAFF");
  if (!q.trim()) return [];
  const term = q.trim();
  return db.entrant.findMany({
    where: {
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });
}
