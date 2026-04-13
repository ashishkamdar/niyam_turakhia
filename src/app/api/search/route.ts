import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/search?q=term&limit=20
 *
 * Searches across deals, parties, and audit entries. Returns grouped
 * results so the UI can render them in sections. The query is applied
 * as a case-insensitive LIKE on key text columns in each table.
 *
 * No auth check — the whole app is behind AuthGate. If data-level
 * role isolation is ever needed, add role checks here.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(Math.max(limitRaw, 1), 30);

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q ?? "" });
  }

  const db = getDb();
  const like = `%${q}%`;

  // Deals (approved pending_deals)
  const deals = db
    .prepare(
      `SELECT id, sender_name, party_alias, metal, direction, qty_grams,
              rate_usd_per_oz, deal_type, reviewed_at, status
         FROM pending_deals
         WHERE status = 'approved'
           AND (party_alias LIKE ? OR sender_name LIKE ? OR metal LIKE ?
                OR raw_message LIKE ? OR id LIKE ?)
         ORDER BY reviewed_at DESC
         LIMIT ?`
    )
    .all(like, like, like, like, like, limit) as Record<string, unknown>[];

  // Parties
  const parties = db
    .prepare(
      `SELECT id, name, short_code, type, location, sbs_party_code,
              orosoft_party_code, aliases
         FROM parties
         WHERE active = 1
           AND (name LIKE ? OR short_code LIKE ? OR aliases LIKE ?
                OR sbs_party_code LIKE ? OR orosoft_party_code LIKE ?)
         ORDER BY name ASC
         LIMIT ?`
    )
    .all(like, like, like, like, like, limit) as Record<string, unknown>[];

  // Audit trail
  const audit = db
    .prepare(
      `SELECT id, timestamp, actor_label, action, summary, target_id
         FROM audit_log
         WHERE summary LIKE ? OR actor_label LIKE ? OR action LIKE ?
         ORDER BY timestamp DESC
         LIMIT ?`
    )
    .all(like, like, like, limit) as Record<string, unknown>[];

  const results = [
    ...(deals.length > 0
      ? [{ group: "Deals", icon: "📋", items: deals.map((d) => ({
            id: d.id,
            title: `${(d.direction as string ?? "?").toUpperCase()} ${d.qty_grams ?? "?"}g ${(d.metal as string ?? "?").toUpperCase()}`,
            subtitle: `${d.party_alias ?? d.sender_name ?? "?"} · ${d.deal_type === "K" ? "Kachha" : "Pakka"}`,
            href: "/deals",
          }))}]
      : []),
    ...(parties.length > 0
      ? [{ group: "Parties", icon: "🏢", items: parties.map((p) => ({
            id: p.id,
            title: p.name as string,
            subtitle: `${p.short_code ?? ""} · SBS: ${p.sbs_party_code ?? "—"} · OroSoft: ${p.orosoft_party_code ?? "—"}`,
            href: "/parties",
          }))}]
      : []),
    ...(audit.length > 0
      ? [{ group: "Audit", icon: "📝", items: audit.map((a) => ({
            id: a.id,
            title: a.summary as string,
            subtitle: `${a.actor_label ?? "?"} · ${a.action}`,
            href: "/audit",
          }))}]
      : []),
  ];

  return NextResponse.json({
    results,
    query: q,
    total: deals.length + parties.length + audit.length,
  });
}
