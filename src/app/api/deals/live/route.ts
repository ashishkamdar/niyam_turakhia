import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/deals/live
 *
 * Query parameters:
 *   from  — ISO date (inclusive) lower bound on reviewed_at. Optional.
 *   to    — ISO date (exclusive) upper bound on reviewed_at. Optional.
 *   limit — max rows, capped at 2000. Default 500.
 *
 * Returns every approved WhatsApp lock code that's been reviewed in
 * the given window, newest first. This is what the /deals page's
 * "Live" tab renders as a big scrollable table — Niyam's staff wants
 * to scan hundreds of trades at a glance, so we intentionally return
 * a flat, lightweight shape with computed amounts.
 *
 * Unlike /api/review which is tab-aware (pending/approved/rejected),
 * this endpoint is purpose-built for the "all approved trades" view:
 * it always filters status='approved' and adds the derived amount_usd
 * the client would otherwise have to compute per row.
 */

const GRAMS_PER_TROY_OZ = 31.1034768;

type Row = {
  id: string;
  sender_name: string;
  received_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  deal_type: "K" | "P" | null;
  direction: "buy" | "sell" | null;
  metal: string | null;
  purity: string | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  premium_type: "absolute" | "percent" | null;
  premium_value: number | null;
  party_alias: string | null;
  dispatched_at: string | null;
  dispatched_to: string | null;
};

/**
 * Gross grams → fine grams using a purity factor. Mirrors the same
 * parser in /api/dispatch/export so amount computations match across
 * both surfaces.
 */
function purityFactor(purity: string | null): number {
  if (!purity) return 1;
  const t = purity.trim().toUpperCase();
  if (t.endsWith("K")) {
    const k = parseFloat(t);
    if (!Number.isNaN(k)) return k / 24;
  }
  const n = parseFloat(t);
  if (!Number.isNaN(n)) return n >= 1 ? n / 1000 : n;
  return 1;
}

function computeAmount(row: Row): number {
  if (!row.qty_grams || !row.rate_usd_per_oz) return 0;
  const fineGrams = row.qty_grams * purityFactor(row.purity);
  const fineOz = fineGrams / GRAMS_PER_TROY_OZ;
  return fineOz * row.rate_usd_per_oz;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") ?? "500", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 2000) : 500;

  // Filter on reviewed_at (when the deal was approved) rather than
  // received_at — the question "how many trades today?" usually means
  // "how many trades were finalized today", not "how many raw messages
  // arrived". For pending deals with NULL reviewed_at, fall back to
  // received_at so they still sort sensibly if anything ever slips in.
  const clauses: string[] = ["status = 'approved'"];
  const params: (string | number)[] = [];
  if (from) {
    clauses.push("COALESCE(reviewed_at, received_at) >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("COALESCE(reviewed_at, received_at) < ?");
    params.push(to);
  }
  params.push(limit);

  const rows = db
    .prepare(
      `SELECT id, sender_name, received_at, reviewed_at, reviewed_by,
              deal_type, direction, metal, purity, qty_grams, rate_usd_per_oz,
              premium_type, premium_value, party_alias,
              dispatched_at, dispatched_to
         FROM pending_deals
         WHERE ${clauses.join(" AND ")}
         ORDER BY COALESCE(reviewed_at, received_at) DESC
         LIMIT ?`
    )
    .all(...params) as Row[];

  const deals = rows.map((r) => ({
    ...r,
    amount_usd: computeAmount(r),
  }));

  // Aggregate totals so the UI can render summary stat cards without
  // re-iterating the list. Totals respect the same filter window.
  const totals = deals.reduce(
    (acc, d) => {
      if (d.direction === "buy") {
        acc.buy_count += 1;
        acc.buy_usd += d.amount_usd;
      } else if (d.direction === "sell") {
        acc.sell_count += 1;
        acc.sell_usd += d.amount_usd;
      }
      return acc;
    },
    { buy_count: 0, sell_count: 0, buy_usd: 0, sell_usd: 0 }
  );

  return NextResponse.json({
    deals,
    count: deals.length,
    totals,
    generated_at: new Date().toISOString(),
  });
}
