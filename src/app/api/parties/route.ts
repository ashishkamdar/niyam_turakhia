import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-context";

type PartyRow = {
  id: string;
  name: string;
  short_code: string | null;
  aliases: string | null;
  type: string;
  location: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  sbs_party_code: string | null;
  orosoft_party_code: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
};

/**
 * GET /api/parties
 *   ?search=term     — free-text search across name, short_code, aliases, sbs/orosoft codes
 *   ?type=buyer|seller|both
 *   ?active=1|0      — default 1 (only active)
 *   ?limit=500
 */
export async function GET(req: NextRequest) {
  const db = getDb();
  const search = req.nextUrl.searchParams.get("search");
  const type = req.nextUrl.searchParams.get("type");
  const activeParam = req.nextUrl.searchParams.get("active") ?? "1";
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") ?? "500", 10);
  const limit = Math.min(Math.max(limitRaw, 1), 2000);

  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (activeParam === "1" || activeParam === "0") {
    clauses.push("active = ?");
    params.push(parseInt(activeParam, 10));
  }
  if (type === "buyer" || type === "seller" || type === "both") {
    clauses.push("(type = ? OR type = 'both')");
    params.push(type);
  }
  if (search) {
    clauses.push(
      "(name LIKE ? OR short_code LIKE ? OR aliases LIKE ? OR sbs_party_code LIKE ? OR orosoft_party_code LIKE ?)"
    );
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }
  params.push(limit);

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM parties ${where} ORDER BY name ASC LIMIT ?`)
    .all(...params) as PartyRow[];

  // Parse aliases JSON so the client gets a native array.
  const parties = rows.map((r) => ({
    ...r,
    active: r.active === 1,
    aliases: parseAliases(r.aliases),
  }));

  return NextResponse.json({ parties, count: parties.length });
}

/**
 * POST /api/parties — create one party.
 * Body: { name, short_code?, aliases?, type?, location?, contact_phone?,
 *         contact_email?, sbs_party_code?, orosoft_party_code?, notes? }
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const actor = getCurrentUser(req);

  const name = (body.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const aliases = Array.isArray(body.aliases)
    ? JSON.stringify(body.aliases)
    : typeof body.aliases === "string" && body.aliases.trim()
    ? JSON.stringify(body.aliases.split(",").map((a: string) => a.trim()).filter(Boolean))
    : null;

  db.prepare(
    `INSERT INTO parties
       (id, name, short_code, aliases, type, location, contact_phone, contact_email,
        sbs_party_code, orosoft_party_code, notes, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    id,
    name,
    body.short_code?.trim() || null,
    aliases,
    body.type === "buyer" || body.type === "seller" ? body.type : "both",
    body.location?.trim() || null,
    body.contact_phone?.trim() || null,
    body.contact_email?.trim() || null,
    body.sbs_party_code?.trim() || null,
    body.orosoft_party_code?.trim() || null,
    body.notes?.trim() || null,
    now,
    now
  );

  logAudit(db, {
    actor: actor ? { label: actor.label, pinId: actor.pin_id } : null,
    action: "party_create",
    targetTable: "parties",
    targetId: id,
    summary: `Created party "${name}" (${body.short_code || "no code"})`,
    newValues: { name, short_code: body.short_code, sbs_party_code: body.sbs_party_code, orosoft_party_code: body.orosoft_party_code },
  });

  return NextResponse.json({ ok: true, id });
}

/**
 * PUT /api/parties — update one party.
 * Body: { id, ...fields }
 */
export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const actor = getCurrentUser(req);
  const { id } = body as { id?: string };

  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const existing = db.prepare("SELECT * FROM parties WHERE id = ?").get(id) as PartyRow | undefined;
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Party not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  const oldVals: Record<string, unknown> = {};
  const newVals: Record<string, unknown> = {};

  function maybeUpdate(field: string, val: unknown, transform?: (v: string) => string | null) {
    if (val !== undefined) {
      const finalVal = typeof val === "string" ? (transform ? transform(val) : val.trim()) : val;
      updates.push(`${field} = ?`);
      params.push(finalVal as string | number | null);
      oldVals[field] = (existing as Record<string, unknown>)[field];
      newVals[field] = finalVal;
    }
  }

  maybeUpdate("name", body.name);
  maybeUpdate("short_code", body.short_code);
  maybeUpdate("type", body.type);
  maybeUpdate("location", body.location);
  maybeUpdate("contact_phone", body.contact_phone);
  maybeUpdate("contact_email", body.contact_email);
  maybeUpdate("sbs_party_code", body.sbs_party_code);
  maybeUpdate("orosoft_party_code", body.orosoft_party_code);
  maybeUpdate("notes", body.notes);

  if (body.aliases !== undefined) {
    const aliases = Array.isArray(body.aliases)
      ? JSON.stringify(body.aliases)
      : typeof body.aliases === "string"
      ? JSON.stringify(body.aliases.split(",").map((a: string) => a.trim()).filter(Boolean))
      : null;
    updates.push("aliases = ?");
    params.push(aliases);
    oldVals.aliases = existing.aliases;
    newVals.aliases = aliases;
  }
  if (body.active !== undefined) {
    updates.push("active = ?");
    params.push(body.active ? 1 : 0);
    oldVals.active = existing.active;
    newVals.active = body.active ? 1 : 0;
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true });
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);
  db.prepare(`UPDATE parties SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  logAudit(db, {
    actor: actor ? { label: actor.label, pinId: actor.pin_id } : null,
    action: "party_update",
    targetTable: "parties",
    targetId: id,
    summary: `Updated party "${existing.name}" — changed ${Object.keys(newVals).join(", ")}`,
    oldValues: oldVals,
    newValues: newVals,
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/parties?id=xxx — soft-delete (set active=0).
 */
export async function DELETE(req: NextRequest) {
  const db = getDb();
  const actor = getCurrentUser(req);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const existing = db.prepare("SELECT name FROM parties WHERE id = ?").get(id) as { name: string } | undefined;
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Party not found" }, { status: 404 });
  }

  db.prepare("UPDATE parties SET active = 0, updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    id
  );

  logAudit(db, {
    actor: actor ? { label: actor.label, pinId: actor.pin_id } : null,
    action: "party_deactivate",
    targetTable: "parties",
    targetId: id,
    summary: `Deactivated party "${existing.name}"`,
  });

  return NextResponse.json({ ok: true });
}

function parseAliases(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}
