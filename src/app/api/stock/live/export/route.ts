import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/stock/live/export?filter=all|gold|silver|platinum|palladium|other
 *
 * CSV shaped for Niyam's accountants: one row per metal with buy/sell
 * counts, gross-to-fine weights, cost basis, market valuation, and
 * unrealized P&L. Mirrors the shape of /api/stock/live but flattened
 * for spreadsheet import.
 *
 * The math (purity factor, cost-basis scaling, weighted avg rate) is
 * duplicated here rather than imported from the live route so both
 * endpoints can be changed independently if the demo story evolves —
 * the cost to keep them in sync is one function + one constant block.
 */

const GRAMS_PER_TROY_OZ = 31.1034768;

const SYMBOL_FOR_METAL: Record<string, string> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

const COLUMNS = [
  "Metal",
  "Buy Deals",
  "Sell Deals",
  "Bought Fine (g)",
  "Sold Fine (g)",
  "Net In Hand (g)",
  "Net In Hand (kg)",
  "Avg Buy Rate (USD/oz)",
  "Avg Sell Rate (USD/oz)",
  "Cost Basis (USD)",
  "Market Rate (USD/oz)",
  "Market Value (USD)",
  "Unrealized P&L (USD)",
];

type DealRow = {
  metal: string | null;
  direction: "buy" | "sell" | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  purity: string | null;
};

type PriceRow = { metal: string; price_usd: number };

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

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Decide whether a metal passes the current filter. Kept in sync with
 * the client-side pill group on /stock: the four canonical metals are
 * exact matches, "other" is anything not in the canonical set, and
 * "all" (or any unknown filter) accepts everything.
 */
function passesFilter(metal: string, filter: string): boolean {
  if (filter === "all" || !filter) return true;
  const canonical = new Set(["gold", "silver", "platinum", "palladium"]);
  if (filter === "other") return !canonical.has(metal);
  return metal === filter;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const filter = (req.nextUrl.searchParams.get("filter") ?? "all").toLowerCase();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  // Same window semantics as /api/stock/live — ensures the downloaded
  // CSV matches whatever the on-screen table is showing.
  const clauses: string[] = [
    "status = 'approved'",
    "qty_grams IS NOT NULL",
    "rate_usd_per_oz IS NOT NULL",
  ];
  const params: (string | number)[] = [];
  if (from) {
    clauses.push("COALESCE(reviewed_at, received_at) >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("COALESCE(reviewed_at, received_at) < ?");
    params.push(to);
  }

  const rows = db
    .prepare(
      `SELECT metal, direction, qty_grams, rate_usd_per_oz, purity
         FROM pending_deals
         WHERE ${clauses.join(" AND ")}`
    )
    .all(...params) as DealRow[];

  const priceRows = db
    .prepare("SELECT metal, price_usd FROM prices")
    .all() as PriceRow[];
  const priceBySymbol = new Map(priceRows.map((p) => [p.metal, p.price_usd]));

  type Bucket = {
    metal: string;
    bought_fine_grams: number;
    sold_fine_grams: number;
    buy_count: number;
    sell_count: number;
    bought_cost_usd: number;
    sold_revenue_usd: number;
  };
  const buckets = new Map<string, Bucket>();

  function bucketFor(metal: string): Bucket {
    let b = buckets.get(metal);
    if (!b) {
      b = {
        metal,
        bought_fine_grams: 0,
        sold_fine_grams: 0,
        buy_count: 0,
        sell_count: 0,
        bought_cost_usd: 0,
        sold_revenue_usd: 0,
      };
      buckets.set(metal, b);
    }
    return b;
  }

  for (const r of rows) {
    const metal = (r.metal ?? "unknown").toLowerCase().trim() || "unknown";
    const grossGrams = r.qty_grams ?? 0;
    const fineGrams = grossGrams * purityFactor(r.purity);
    const fineOz = fineGrams / GRAMS_PER_TROY_OZ;
    const value = fineOz * (r.rate_usd_per_oz ?? 0);
    const b = bucketFor(metal);
    if (r.direction === "buy") {
      b.bought_fine_grams += fineGrams;
      b.bought_cost_usd += value;
      b.buy_count += 1;
    } else if (r.direction === "sell") {
      b.sold_fine_grams += fineGrams;
      b.sold_revenue_usd += value;
      b.sell_count += 1;
    }
  }

  // Always include the four canonical metals in the report.
  for (const canonical of ["gold", "silver", "platinum", "palladium"]) {
    bucketFor(canonical);
  }

  const lines: string[] = [];
  lines.push(COLUMNS.map(csvEscape).join(","));

  const sorted = Array.from(buckets.values()).sort((a, b) => {
    const order: Record<string, number> = {
      gold: 0,
      silver: 1,
      platinum: 2,
      palladium: 3,
    };
    const ao = order[a.metal] ?? 100;
    const bo = order[b.metal] ?? 100;
    if (ao !== bo) return ao - bo;
    return a.metal.localeCompare(b.metal);
  });

  for (const b of sorted) {
    if (!passesFilter(b.metal, filter)) continue;
    // Clamp net at zero — matches /api/stock/live so the CSV and the
    // on-screen table never disagree. See the comment there for why.
    const netFineGrams = Math.max(0, b.bought_fine_grams - b.sold_fine_grams);
    const netFineOz = netFineGrams / GRAMS_PER_TROY_OZ;
    const costRatio =
      b.bought_fine_grams > 0 ? netFineGrams / b.bought_fine_grams : 0;
    const scaledCostUsd = b.bought_cost_usd * costRatio;
    const avgBuyRate =
      b.bought_fine_grams > 0
        ? b.bought_cost_usd / (b.bought_fine_grams / GRAMS_PER_TROY_OZ)
        : 0;
    const avgSellRate =
      b.sold_fine_grams > 0
        ? b.sold_revenue_usd / (b.sold_fine_grams / GRAMS_PER_TROY_OZ)
        : 0;
    const symbol = SYMBOL_FOR_METAL[b.metal];
    const marketRate = symbol ? priceBySymbol.get(symbol) ?? 0 : 0;
    const marketValue = netFineOz * marketRate;
    const unrealizedPnl = marketValue - scaledCostUsd;

    const row = [
      b.metal.charAt(0).toUpperCase() + b.metal.slice(1),
      b.buy_count,
      b.sell_count,
      b.bought_fine_grams.toFixed(2),
      b.sold_fine_grams.toFixed(2),
      netFineGrams.toFixed(2),
      (netFineGrams / 1000).toFixed(3),
      avgBuyRate.toFixed(2),
      avgSellRate.toFixed(2),
      scaledCostUsd.toFixed(2),
      marketRate.toFixed(2),
      marketValue.toFixed(2),
      unrealizedPnl.toFixed(2),
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  const body = lines.join("\r\n") + "\r\n";
  const safeFilter = filter.replace(/[^a-z]/g, "").slice(0, 16) || "all";
  const filename = `prismx-stock-live-${safeFilter}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
