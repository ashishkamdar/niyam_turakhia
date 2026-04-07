import { getDb } from "./db";
import type { Deal, Price, Metal } from "./types";
import { GRAMS_PER_TROY_OZ as OZ_GRAMS, METAL_SYMBOLS } from "./types";

export function getStockSummary(prices: Price[]) {
  const db = getDb();
  const metals: Metal[] = ["gold", "silver", "platinum", "palladium"];
  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));

  return metals.map((metal) => {
    const symbol = METAL_SYMBOLS[metal];
    const currentPrice = priceMap.get(symbol) ?? 0;
    const buys = db.prepare("SELECT * FROM deals WHERE metal = ? AND direction = 'buy' AND status != 'sold'").all(metal) as Deal[];
    const totalGrams = buys.reduce((sum, d) => sum + d.pure_equivalent_grams, 0);

    let totalCost = 0;
    for (const d of buys) {
      totalCost += (d.pure_equivalent_grams / OZ_GRAMS) * d.price_per_oz;
    }
    const avgCostPerOz = totalGrams > 0 ? totalCost / (totalGrams / OZ_GRAMS) : 0;
    const marketValueUsd = (totalGrams / OZ_GRAMS) * currentPrice;
    const unrealizedPnl = marketValueUsd - totalCost;

    const byStatus = (status: string) => buys.filter((d) => d.status === status).reduce((s, d) => s + d.pure_equivalent_grams, 0);

    return {
      metal, total_grams: totalGrams, avg_cost_per_oz: avgCostPerOz,
      market_value_usd: marketValueUsd, unrealized_pnl: unrealizedPnl,
      in_uae: byStatus("locked") + byStatus("pending"),
      in_refinery: byStatus("in_refinery"),
      in_transit: byStatus("in_transit"),
      in_hk: byStatus("in_hk"),
    };
  });
}

export function getDailyPnl(date?: string) {
  const db = getDb();
  const targetDate = date ?? new Date().toISOString().split("T")[0];
  const sells = db.prepare("SELECT * FROM deals WHERE direction = 'sell' AND date LIKE ?").all(`${targetDate}%`) as Deal[];
  const byMetal: Record<string, number> = {};
  let realized = 0;

  for (const sell of sells) {
    const avgBuyCost = getAvgBuyCost(sell.metal);
    const revenue = (sell.pure_equivalent_grams / OZ_GRAMS) * sell.price_per_oz;
    const cost = (sell.pure_equivalent_grams / OZ_GRAMS) * avgBuyCost;
    const pnl = revenue - cost;
    realized += pnl;
    byMetal[sell.metal] = (byMetal[sell.metal] ?? 0) + pnl;
  }
  return { realized, unrealized: 0, byMetal: byMetal as Record<Metal, number> };
}

function getAvgBuyCost(metal: string): number {
  const db = getDb();
  const result = db.prepare("SELECT SUM(pure_equivalent_grams) as total_grams, SUM((pure_equivalent_grams / 31.1035) * price_per_oz) as total_cost FROM deals WHERE metal = ? AND direction = 'buy'").get(metal) as { total_grams: number; total_cost: number } | undefined;
  if (!result || result.total_grams === 0) return 0;
  return result.total_cost / (result.total_grams / OZ_GRAMS);
}
