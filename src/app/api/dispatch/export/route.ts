import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/dispatch/export?batch=<id>&target=sbs
 *
 * Returns a CSV file shaped like the SBS Bullion Sales Order import
 * template: 14 columns spanning entry metadata, product, weights, rate,
 * and amount. Excel opens CSV files natively so Niyam's staff can either
 * import this directly or paste the rows into the existing template.
 *
 * If `batch` is provided, only deals from that batch are exported.
 * Otherwise every Kachha deal dispatched in the last 24h is included
 * (useful for end-of-day "download today's batch" workflow).
 *
 * We intentionally skip a real .xlsx writer for now because the template
 * column schema isn't finalized (see project_excel_template.md — 9 open
 * blockers on things like party master IDs and RATE_TYPE enum). CSV is
 * the safe default until those are settled.
 */

const GRAMS_PER_TROY_OZ = 31.1034768;

// The 14 canonical OroSoft Neo import columns. Column names roughly mirror
// the template we have from Niyam; exact casing will need a pass once the
// real template is locked. Using a const array makes it easy to diff
// against the real template when it arrives.
const COLUMNS = [
  "Entry Date",
  "Bill Type",
  "Buyer Party",
  "Product",
  "Stock Unit",
  "Gross Weight (g)",
  "Purity",
  "Fine Weight (g)",
  "Rate Type",
  "Rate (USD/oz)",
  "Premium",
  "Amount (USD)",
  "Currency",
  "Remarks",
];

type Row = {
  id: string;
  sender_name: string;
  reviewed_at: string | null;
  dispatched_at: string | null;
  deal_type: string | null;
  direction: string | null;
  metal: string | null;
  purity: string | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  premium_type: string | null;
  premium_value: number | null;
  party_alias: string | null;
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
  // Purity is usually "999", "995", "750", "24K" etc. Try to turn it
  // into a 0..1 factor so fine weight can be computed. Falls back to 1
  // for unknowns — better to under-report fine weight than to crash.
  if (!purity) return 1;
  const trimmed = purity.trim().toUpperCase();
  if (trimmed.endsWith("K")) {
    const k = parseFloat(trimmed);
    if (!Number.isNaN(k)) return k / 24;
  }
  const n = parseFloat(trimmed);
  if (!Number.isNaN(n)) {
    // "999" → 0.999, "750" → 0.750
    if (n >= 1) return n / 1000;
    return n;
  }
  return 1;
}

function formatPremium(type: string | null, value: number | null): string {
  if (value === null || value === undefined) return "";
  if (type === "percent") return `${value}%`;
  if (type === "absolute") return `${value}`;
  return String(value);
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const batch = req.nextUrl.searchParams.get("batch");
  const target = req.nextUrl.searchParams.get("target") ?? "sbs";
  const expectedType = target === "orosoft" ? "P" : "K";

  let rows: Row[];
  if (batch) {
    rows = db
      .prepare(
        `SELECT id, sender_name, reviewed_at, dispatched_at, deal_type,
                direction, metal, purity, qty_grams, rate_usd_per_oz,
                premium_type, premium_value, party_alias
           FROM pending_deals
          WHERE dispatch_batch_id = ?
          ORDER BY reviewed_at ASC`
      )
      .all(batch) as Row[];
  } else {
    // Last 24h fallback. Gives staff a "download today's dispatches"
    // escape hatch if they've lost the batch id.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    rows = db
      .prepare(
        `SELECT id, sender_name, reviewed_at, dispatched_at, deal_type,
                direction, metal, purity, qty_grams, rate_usd_per_oz,
                premium_type, premium_value, party_alias
           FROM pending_deals
          WHERE deal_type = ?
            AND dispatched_at IS NOT NULL
            AND dispatched_at >= ?
          ORDER BY dispatched_at ASC`
      )
      .all(expectedType, cutoff) as Row[];
  }

  // Build CSV. Each row maps a pending_deal to the 14 template columns.
  const lines: string[] = [];
  lines.push(COLUMNS.map(csvEscape).join(","));
  for (const r of rows) {
    const grossWeight = r.qty_grams ?? 0;
    const factor = purityFactor(r.purity);
    const fineWeight = grossWeight * factor;
    const fineOz = fineWeight / GRAMS_PER_TROY_OZ;
    const amountUsd = fineOz * (r.rate_usd_per_oz ?? 0);
    const entryDate = r.dispatched_at
      ? new Date(r.dispatched_at).toISOString().slice(0, 10)
      : "";
    const billType = r.direction === "sell" ? "SALES" : "PURCHASE";

    const row = [
      entryDate,
      billType,
      r.party_alias ?? r.sender_name ?? "",
      (r.metal ?? "").toUpperCase(),
      "GM",
      grossWeight.toFixed(3),
      r.purity ?? "",
      fineWeight.toFixed(3),
      "FIXED",
      (r.rate_usd_per_oz ?? 0).toFixed(2),
      formatPremium(r.premium_type, r.premium_value),
      amountUsd.toFixed(2),
      "USD",
      // Remarks column: tag the row with its PrismX id so we can reconcile
      // back if SBS ever queries us about a specific line.
      `PrismX #${r.id.slice(0, 8).toUpperCase()}`,
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  const body = lines.join("\r\n") + "\r\n";
  const filename = batch
    ? `prismx-sbs-batch-${batch.slice(0, 8)}.csv`
    : `prismx-sbs-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
