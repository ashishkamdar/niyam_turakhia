import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/deals/live/export?from=&to=&label=
 *
 * Downloads the same approved-deals window as /api/deals/live as a
 * 13-column CSV. The `label` param lets the client name the file after
 * the active filter (e.g. "today", "monthly") so a stack of downloaded
 * CSVs stays self-describing.
 *
 * Kept separate from /api/dispatch/export because the columns differ:
 * /api/dispatch/export mirrors the SBS Bullion Sales Order template
 * (import format for their ERP), whereas this endpoint is PrismX's own
 * audit trail — party alias first, includes the reviewer + dispatch
 * status, skipped the FineWeight/RateType/Currency columns that only
 * matter to SBS.
 */

const GRAMS_PER_TROY_OZ = 31.1034768;

const COLUMNS = [
  "Approved At",
  "Received At",
  "Type",
  "Direction",
  "Party",
  "Metal",
  "Purity",
  "Qty (g)",
  "Rate (USD/oz)",
  "Premium",
  "Amount (USD)",
  "Reviewer",
  "Dispatched To",
];

type Row = {
  id: string;
  sender_name: string;
  received_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  deal_type: string | null;
  direction: string | null;
  metal: string | null;
  purity: string | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  premium_type: string | null;
  premium_value: number | null;
  party_alias: string | null;
  dispatched_at: string | null;
  dispatched_to: string | null;
};

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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

function formatPremium(type: string | null, value: number | null): string {
  if (value === null || value === undefined) return "";
  if (type === "percent") return `${value}%`;
  return `${value}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  // Use YYYY-MM-DD HH:mm — Excel auto-recognizes this as a datetime.
  return iso.slice(0, 16).replace("T", " ");
}

function dealTypeLabel(t: string | null): string {
  if (t === "K") return "Kachha";
  if (t === "P") return "Pakka";
  return "";
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const label = req.nextUrl.searchParams.get("label") ?? "range";

  const type = req.nextUrl.searchParams.get("type");
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
  // Optional Kachha/Pakka filter — mirrors the client-side pill group.
  // Anything other than exactly 'K' or 'P' is treated as "no filter"
  // so a stale URL with ?type=foo doesn't silently return zero rows.
  if (type === "K" || type === "P") {
    clauses.push("deal_type = ?");
    params.push(type);
  }

  const rows = db
    .prepare(
      `SELECT id, sender_name, received_at, reviewed_at, reviewed_by,
              deal_type, direction, metal, purity, qty_grams, rate_usd_per_oz,
              premium_type, premium_value, party_alias,
              dispatched_at, dispatched_to
         FROM pending_deals
         WHERE ${clauses.join(" AND ")}
         ORDER BY COALESCE(reviewed_at, received_at) DESC`
    )
    .all(...params) as Row[];

  const lines: string[] = [];
  lines.push(COLUMNS.map(csvEscape).join(","));
  for (const r of rows) {
    const grossGrams = r.qty_grams ?? 0;
    const fineGrams = grossGrams * purityFactor(r.purity);
    const fineOz = fineGrams / GRAMS_PER_TROY_OZ;
    const amount = fineOz * (r.rate_usd_per_oz ?? 0);
    const row = [
      formatDateTime(r.reviewed_at),
      formatDateTime(r.received_at),
      dealTypeLabel(r.deal_type),
      (r.direction ?? "").toUpperCase(),
      r.party_alias ?? r.sender_name ?? "",
      (r.metal ?? "").toUpperCase(),
      r.purity ?? "",
      grossGrams.toFixed(2),
      (r.rate_usd_per_oz ?? 0).toFixed(2),
      formatPremium(r.premium_type, r.premium_value),
      amount.toFixed(2),
      r.reviewed_by ?? "",
      r.dispatched_to
        ? `${r.dispatched_to}${r.dispatched_at ? " @ " + formatDateTime(r.dispatched_at) : ""}`
        : "pending",
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  const body = lines.join("\r\n") + "\r\n";
  const safeLabel = label.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "range";
  const filename = `prismx-live-deals-${safeLabel}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
