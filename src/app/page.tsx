"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { LockedDeals } from "@/components/locked-deals";
import type { Deal, Price, MetalSymbol } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
const METAL_MAP: Record<string, MetalSymbol> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };

export default function DashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);

  useEffect(() => {
    fetch("/api/deals?limit=500").then((r) => r.json()).then(setDeals);
    fetch("/api/prices").then((r) => r.json()).then(setPrices);
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const todayDeals = deals.filter((d) => d.date.startsWith(today));
  const todayBuys = todayDeals.filter((d) => d.direction === "buy");
  const todaySells = todayDeals.filter((d) => d.direction === "sell");
  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));

  let totalBuyValue = 0, totalSellRevenue = 0;
  for (const d of todayBuys) totalBuyValue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
  for (const d of todaySells) totalSellRevenue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;

  const unsold = deals.filter((d) => d.direction === "buy" && d.status !== "sold");
  let stockValue = 0, stockCost = 0;
  for (const d of unsold) {
    const mkt = priceMap.get(METAL_MAP[d.metal]) ?? d.price_per_oz;
    stockValue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * mkt;
    stockCost += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
  }
  const unrealizedPnl = stockValue - stockCost;
  const totalBuyGrams = todayBuys.reduce((s, d) => s + d.quantity_grams, 0);
  const totalSellGrams = todaySells.reduce((s, d) => s + d.quantity_grams, 0);

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtG = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + "g";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400">Today&apos;s MIS overview &mdash; {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Buys" value={fmt(totalBuyValue)} sublabel={`${todayBuys.length} deals | ${fmtG(totalBuyGrams)}`} />
        <StatCard label="Today's Sales" value={fmt(totalSellRevenue)} sublabel={`${todaySells.length} deals | ${fmtG(totalSellGrams)}`} />
        <StatCard label="Stock Value" value={fmt(stockValue)} sublabel={`${unsold.length} positions`} />
        <StatCard label="Unrealized P&L" value={fmt(unrealizedPnl)} change={unrealizedPnl >= 0 ? `+${fmt(unrealizedPnl)}` : fmt(unrealizedPnl)} changeType={unrealizedPnl >= 0 ? "positive" : "negative"} sublabel="vs avg cost" />
      </div>
      <LockedDeals />
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Activity</h2>
        <div className="space-y-2">
          {deals.slice(0, 10).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-900 px-4 py-3 outline outline-1 outline-white/10">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{d.direction.toUpperCase()}</span>
                <span className="text-sm text-white capitalize">{d.metal}</span>
                <span className="text-xs text-gray-400">{d.purity} | {d.quantity_grams.toFixed(0)}g</span>
              </div>
              <span className="text-sm font-medium text-gray-300">${d.price_per_oz.toFixed(2)}/oz</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
