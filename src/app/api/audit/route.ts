import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/audit
 *   ?from=ISO&to=ISO    — date range filter on timestamp
 *   ?actor=label         — filter by actor_label
 *   ?action=approve_deal — filter by action type
 *   ?target_id=xxx       — filter by target row id
 *   ?limit=100           — max rows (capped at 500)
 *
 * Returns audit_log rows newest-first with JSON fields parsed so
 * the client gets native objects for old_values / new_values / metadata.
 */
export async function GET(req: NextRequest) {
  const db = getDb();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const actor = req.nextUrl.searchParams.get("actor");
  const action = req.nextUrl.searchParams.get("action");
  const targetId = req.nextUrl.searchParams.get("target_id");
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
  const limit = Math.min(Math.max(limitRaw, 1), 500);

  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (from) { clauses.push("timestamp >= ?"); params.push(from); }
  if (to) { clauses.push("timestamp < ?"); params.push(to); }
  if (actor) { clauses.push("actor_label = ?"); params.push(actor); }
  if (action) { clauses.push("action = ?"); params.push(action); }
  if (targetId) { clauses.push("target_id = ?"); params.push(targetId); }

  params.push(limit);
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = db
    .prepare(`SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ?`)
    .all(...params) as Record<string, unknown>[];

  // Parse JSON blobs so the client gets native objects.
  const entries = rows.map((r) => ({
    ...r,
    old_values: tryParse(r.old_values as string | null),
    new_values: tryParse(r.new_values as string | null),
    metadata: tryParse(r.metadata as string | null),
  }));

  // Distinct actors for the filter dropdown on the UI.
  const actors = db
    .prepare("SELECT DISTINCT actor_label FROM audit_log WHERE actor_label IS NOT NULL ORDER BY actor_label")
    .all() as { actor_label: string }[];

  const actions = db
    .prepare("SELECT DISTINCT action FROM audit_log ORDER BY action")
    .all() as { action: string }[];

  return NextResponse.json({
    entries,
    count: entries.length,
    actors: actors.map((a) => a.actor_label),
    actions: actions.map((a) => a.action),
  });
}

function tryParse(json: string | null): unknown {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return json; }
}
