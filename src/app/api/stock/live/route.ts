import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/stock/live
 *
 * Aggregates every approved WhatsApp lock code into a per-metal
 * "stock in hand" register:
 *
 *   net_fine_grams = sum(buys fine grams) - sum(sells fine grams)
 *
 * Purity is folded into the gross-to-fine conversion via the same
 * factor parser used by /api/dispatch/export and /api/deals/live. All
 * rates and valuations are in USD/troy-oz, same unit the price ticker
 * and existing /stock page use.
 *
 * Market price for each metal is pulled from the prices table so the
 * unrealized P&L is computed on the backend — keeps the client a pure
 * render path and guarantees the number matches whatever /api/prices
 * returned last. If a metal has no approved deals it's still returned
 * with zeros so the client can show "no holdings" consistently.
 */

const GRAMS_PER_TROY_OZ = 31.1034768;

// Symbol → metal slug, used to resolve the prices table (which stores
// MetalSymbol keys). Anything not in this map is treated as "other"
// and doesn't participate in market valuation.
const SYMBOL_FOR_METAL: Record<string, string> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

type DealRow = {
  metal: string | null;
  direction: "buy" | "sell" | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  purity: string | null;
};

type PriceRow = {
  metal: string;
  price_usd: number;
};

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

export async function GET(_req: NextRequest) {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT metal, direction, qty_grams, rate_usd_per_oz, purity
         FROM pending_deals
         WHERE status = 'approved'
           AND qty_grams IS NOT NULL
           AND rate_usd_per_oz IS NOT NULL`
    )
    .all() as DealRow[];

  const priceRows = db
    .prepare("SELECT metal, price_usd FROM prices")
    .all() as PriceRow[];
  const priceBySymbol = new Map(priceRows.map((p) => [p.metal, p.price_usd]));

  // Bucket every deal by its metal slug (lowercased + normalized). We
  // accumulate weighted cost basis (fine oz × rate) so avg rate can be
  // computed at the end as totalCost / totalFineOz without re-scanning.
  type Bucket = {
    metal: string;
    bought_fine_grams: number;
    sold_fine_grams: number;
    buy_count: number;
    sell_count: number;
    bought_cost_usd: number; // sum(fineOz × rate) for buys
    sold_revenue_usd: number; // sum(fineOz × rate) for sells
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

  // Make sure the four "canonical" metals always appear in the output,
  // even if they have no approved trades yet — the client can then show
  // a "no holdings" zero row instead of needing an empty-state fallback.
  for (const canonical of ["gold", "silver", "platinum", "palladium"]) {
    bucketFor(canonical);
  }

  const metals = Array.from(buckets.values())
    .map((b) => {
      // Clamp net at zero: you can't actually hold negative stock.
      // If approved sells exceed approved buys (common when the demo
      // deals table has matched-sell entries without matching buys),
      // report the position as flat rather than emit a misleading
      // negative number. Matches the Math.max(0, ...) clamp in the
      // Demo /stock page so both views behave identically.
      const netFineGrams = Math.max(0, b.bought_fine_grams - b.sold_fine_grams);
      const netFineOz = netFineGrams / GRAMS_PER_TROY_OZ;
      // Cost basis of the REMAINING stock: scale the total bought cost
      // by (net / bought) so partial sells reduce the cost basis
      // proportionally. With the clamp above, costRatio is always in
      // [0, 1] so scaledCost can never go negative.
      const costRatio =
        b.bought_fine_grams > 0 ? netFineGrams / b.bought_fine_grams : 0;
      const scaledCostUsd = b.bought_cost_usd * costRatio;
      const avgBuyRateUsdPerOz =
        b.bought_fine_grams > 0
          ? b.bought_cost_usd / (b.bought_fine_grams / GRAMS_PER_TROY_OZ)
          : 0;
      const avgSellRateUsdPerOz =
        b.sold_fine_grams > 0
          ? b.sold_revenue_usd / (b.sold_fine_grams / GRAMS_PER_TROY_OZ)
          : 0;
      const symbol = SYMBOL_FOR_METAL[b.metal];
      const marketRateUsdPerOz = symbol ? priceBySymbol.get(symbol) ?? 0 : 0;
      const marketValueUsd = netFineOz * marketRateUsdPerOz;
      const unrealizedPnlUsd = marketValueUsd - scaledCostUsd;
      return {
        metal: b.metal,
        bought_fine_grams: b.bought_fine_grams,
        sold_fine_grams: b.sold_fine_grams,
        net_fine_grams: netFineGrams,
        buy_count: b.buy_count,
        sell_count: b.sell_count,
        avg_buy_rate_usd_per_oz: avgBuyRateUsdPerOz,
        avg_sell_rate_usd_per_oz: avgSellRateUsdPerOz,
        scaled_cost_usd: scaledCostUsd,
        market_rate_usd_per_oz: marketRateUsdPerOz,
        market_value_usd: marketValueUsd,
        unrealized_pnl_usd: unrealizedPnlUsd,
      };
    })
    // Sort canonical metals in a stable order, others alphabetically.
    .sort((a, b) => {
      const order: Record<string, number> = {
        gold: 0,
        silver: 1,
        platinum: 2,
        palladium: 3,
      };
      const aOrder = order[a.metal] ?? 100;
      const bOrder = order[b.metal] ?? 100;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.metal.localeCompare(b.metal);
    });

  const totals = metals.reduce(
    (acc, m) => {
      acc.total_market_value_usd += m.market_value_usd;
      acc.total_cost_usd += m.scaled_cost_usd;
      acc.total_unrealized_pnl_usd += m.unrealized_pnl_usd;
      acc.total_net_fine_grams += m.net_fine_grams;
      return acc;
    },
    {
      total_market_value_usd: 0,
      total_cost_usd: 0,
      total_unrealized_pnl_usd: 0,
      total_net_fine_grams: 0,
    }
  );

  return NextResponse.json({
    metals,
    totals,
    generated_at: new Date().toISOString(),
  });
}
