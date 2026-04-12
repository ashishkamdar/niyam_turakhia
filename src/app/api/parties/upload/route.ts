import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-context";

/**
 * POST /api/parties/upload
 *
 * Accepts a CSV body (Content-Type text/csv or multipart form with a
 * "file" field) and upserts parties. The first row MUST be a header
 * matching the template from GET /api/parties/template. Matching is
 * by `short_code` — if a row's short_code matches an existing party,
 * it's updated; otherwise it's inserted.
 *
 * Returns { ok, inserted, updated, errors: [{row, reason}] }.
 */

const EXPECTED_HEADERS = [
  "name",
  "short_code",
  "type",
  "location",
  "sbs_party_code",
  "orosoft_party_code",
  "aliases",
  "phone",
  "email",
  "notes",
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const actor = getCurrentUser(req);

  // Accept either raw CSV body or multipart form with a "file" field.
  let csvText: string;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }
    csvText = await (file as Blob).text();
  } else {
    csvText = await req.text();
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return NextResponse.json(
      { ok: false, error: "CSV must have a header row + at least one data row" },
      { status: 400 }
    );
  }

  // Validate header — case-insensitive, order-insensitive.
  const headerCells = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ""));
  const colIndex = new Map<string, number>();
  for (const expected of EXPECTED_HEADERS) {
    const idx = headerCells.indexOf(expected);
    if (idx >= 0) colIndex.set(expected, idx);
  }
  if (!colIndex.has("name")) {
    return NextResponse.json(
      { ok: false, error: "CSV header must include at least a 'Name' column" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  const errors: { row: number; reason: string }[] = [];

  const upsert = db.prepare(
    `INSERT INTO parties
       (id, name, short_code, aliases, type, location, contact_phone, contact_email,
        sbs_party_code, orosoft_party_code, notes, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       short_code = excluded.short_code,
       aliases = excluded.aliases,
       type = excluded.type,
       location = excluded.location,
       contact_phone = excluded.contact_phone,
       contact_email = excluded.contact_email,
       sbs_party_code = excluded.sbs_party_code,
       orosoft_party_code = excluded.orosoft_party_code,
       notes = excluded.notes,
       updated_at = excluded.updated_at`
  );

  const findByCode = db.prepare("SELECT id FROM parties WHERE short_code = ? LIMIT 1");

  const txn = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const get = (col: string): string => {
        const idx = colIndex.get(col);
        return idx !== undefined && idx < cells.length ? cells[idx].trim() : "";
      };

      const name = get("name");
      if (!name) {
        errors.push({ row: i + 1, reason: "Empty name" });
        continue;
      }

      const shortCode = get("short_code") || null;
      const aliasesRaw = get("aliases");
      const aliases = aliasesRaw
        ? JSON.stringify(aliasesRaw.split(";").map((a) => a.trim()).filter(Boolean))
        : null;
      const type = get("type") || "both";
      const location = get("location") || null;
      const sbsCode = get("sbs_party_code") || null;
      const orosoftCode = get("orosoft_party_code") || null;
      const phone = get("phone") || null;
      const email = get("email") || null;
      const notes = get("notes") || null;

      // Match by short_code for upsert.
      let existingId: string | null = null;
      if (shortCode) {
        const match = findByCode.get(shortCode) as { id: string } | undefined;
        if (match) existingId = match.id;
      }

      const id = existingId ?? randomUUID();
      try {
        upsert.run(id, name, shortCode, aliases, type, location, phone, email, sbsCode, orosoftCode, notes, now, now);
        if (existingId) updated++;
        else inserted++;
      } catch (err) {
        errors.push({ row: i + 1, reason: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  });
  txn();

  logAudit(db, {
    actor: actor ? { label: actor.label, pinId: actor.pin_id } : null,
    action: "party_bulk_upload",
    targetTable: "parties",
    targetId: undefined,
    summary: `Bulk upload: ${inserted} inserted, ${updated} updated, ${errors.length} errors`,
    metadata: { inserted, updated, error_count: errors.length },
  });

  return NextResponse.json({ ok: true, inserted, updated, errors });
}
