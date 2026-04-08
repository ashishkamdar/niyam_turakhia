"use client";

import { useEffect, useState } from "react";
import { StockDetail } from "@/components/stock-detail";
import type { Deal, Price, Metal, MetalSymbol } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
const METAL_SYMBOLS: Record<string, MetalSymbol> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };

export default function StockPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [selectedMetal, setSelectedMetal] = useState<Metal | null>(null);

  useEffect(() => {
    function fetchAll() {
      fetch("/api/deals?limit=1000").then((r) => r.json()).then(setDeals).catch(() => {});
      fetch("/api/prices").then((r) => r.json()).then(setPrices).catch(() => {});
    }
    fetchAll();
    const poll = setInterval(fetchAll, 3000);
    return () => clearInterval(poll);
  }, []);

  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));
  const allBuys = deals.filter((d) => d.direction === "buy");
  const allSells = deals.filter((d) => d.direction === "sell");
  const metals: Metal[] = ["gold", "silver", "platinum", "palladium"];

  const stockData = metals.map((metal) => {
    const lots = allBuys.filter((d) => d.metal === metal);
    const soldGrams = allSells.filter((d) => d.metal === metal).reduce((s, d) => s + d.pure_equivalent_grams, 0);
    const boughtGrams = lots.reduce((s, d) => s + d.pure_equivalent_grams, 0);
    const totalGrams = Math.max(0, boughtGrams - soldGrams);
    let totalCost = 0;
    for (const d of lots) totalCost += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
    const costRatio = boughtGrams > 0 ? totalGrams / boughtGrams : 0;
    const scaledCost = totalCost * costRatio;
    const avgCostPerOz = totalGrams > 0 ? scaledCost / (totalGrams / GRAMS_PER_OZ) : 0;
    const marketPrice = priceMap.get(METAL_SYMBOLS[metal]) ?? 0;
    const marketValue = (totalGrams / GRAMS_PER_OZ) * marketPrice;
    const unrealizedPnl = marketValue - scaledCost;
    const byStatus = (s: string) => lots.filter((d) => d.status === s).reduce((sum, d) => sum + d.pure_equivalent_grams, 0);

    return { metal, totalGrams, avgCostPerOz, marketPrice, marketValue, unrealizedPnl, inUae: byStatus("locked") + byStatus("pending"), inRefinery: byStatus("in_refinery"), inTransit: byStatus("in_transit"), inHk: byStatus("in_hk"), lots };
  });

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (selectedMetal) {
    const data = stockData.find((s) => s.metal === selectedMetal);
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold capitalize text-white">{selectedMetal} &mdash; Lot Details</h1>
        <StockDetail deals={data?.lots ?? []} onClose={() => setSelectedMetal(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Stock In Hand</h1>
        <p className="text-sm text-gray-400">Current positions. Tap a row to see individual lots.</p>
      </div>
      <div className="space-y-3">
        {stockData.map((s) => (
          <button key={s.metal} onClick={() => setSelectedMetal(s.metal)} className="w-full rounded-lg bg-gray-900 p-4 text-left outline outline-1 outline-white/10 transition hover:bg-gray-800/80">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold capitalize text-white">{s.metal}</span>
              <span className={`text-sm font-semibold ${s.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {s.unrealizedPnl >= 0 ? "+" : ""}{fmt(s.unrealizedPnl)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <div><span className="text-gray-500">Total</span><p className="font-medium text-gray-200">{s.totalGrams.toFixed(0)}g</p></div>
              <div><span className="text-gray-500">Avg Cost</span><p className="font-medium text-gray-200">${s.avgCostPerOz.toFixed(2)}/oz</p></div>
              <div><span className="text-gray-500">Market</span><p className="font-medium text-gray-200">${s.marketPrice.toFixed(2)}/oz</p></div>
              <div><span className="text-gray-500">Value</span><p className="font-medium text-gray-200">{fmt(s.marketValue)}</p></div>
            </div>
            <div className="mt-3 flex gap-2">
              {s.inUae > 0 && <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">UAE {s.inUae.toFixed(0)}g</span>}
              {s.inRefinery > 0 && <span className="rounded-full bg-orange-400/10 px-2 py-0.5 text-[10px] text-orange-400">Refinery {s.inRefinery.toFixed(0)}g</span>}
              {s.inTransit > 0 && <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-400">Transit {s.inTransit.toFixed(0)}g</span>}
              {s.inHk > 0 && <span className="rounded-full bg-blue-400/10 px-2 py-0.5 text-[10px] text-blue-400">HK {s.inHk.toFixed(0)}g</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
