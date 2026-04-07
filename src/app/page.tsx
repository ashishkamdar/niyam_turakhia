"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { LockedDeals } from "@/components/locked-deals";
import type { Deal, Price, MetalSymbol } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
const METAL_MAP: Record<string, MetalSymbol> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };
const METAL_COLORS: Record<string, string> = { gold: "text-amber-400", silver: "text-gray-300", platinum: "text-blue-300", palladium: "text-purple-300" };

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

  // Realized P&L: for each sell, profit = sell price - avg buy price for that metal
  const allBuys = deals.filter((d) => d.direction === "buy");
  let realizedPnl = 0;
  for (const sell of todaySells) {
    const metalBuys = allBuys.filter((b) => b.metal === sell.metal);
    const totalBuyGramsForMetal = metalBuys.reduce((s, b) => s + b.pure_equivalent_grams, 0);
    const totalBuyCostForMetal = metalBuys.reduce((s, b) => s + (b.pure_equivalent_grams / GRAMS_PER_OZ) * b.price_per_oz, 0);
    const avgBuyCostPerOz = totalBuyGramsForMetal > 0 ? totalBuyCostForMetal / (totalBuyGramsForMetal / GRAMS_PER_OZ) : sell.price_per_oz;
    const sellRevenue = (sell.pure_equivalent_grams / GRAMS_PER_OZ) * sell.price_per_oz;
    const sellCost = (sell.pure_equivalent_grams / GRAMS_PER_OZ) * avgBuyCostPerOz;
    realizedPnl += sellRevenue - sellCost;
  }

  // Unrealized P&L: unsold stock at market price vs cost
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

  const todayProfit = realizedPnl + unrealizedPnl;
  const whatsappDeals = deals.filter((d) => d.created_by === "whatsapp");
  const todayWhatsapp = whatsappDeals.filter((d) => d.date.startsWith(today));

  return (
    <div className="space-y-5">
      {/* Hero profit card */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-5 outline outline-1 outline-white/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-emerald-400" />
              <p className="text-xs font-medium text-gray-400">Today&apos;s Profit</p>
            </div>
            <p className={`mt-2 text-4xl font-bold tracking-tight sm:text-5xl ${todayProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {todayProfit >= 0 ? "+" : "-"}{fmt(Math.abs(todayProfit))}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {todayDeals.length} deals today &mdash; {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          {todayWhatsapp.length > 0 && (
            <div className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{todayWhatsapp.length}</p>
              <p className="text-[9px] text-emerald-400/70">WhatsApp</p>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Today's Buys" value={fmt(totalBuyValue)} sublabel={`${todayBuys.length} deals | ${fmtG(totalBuyGrams)}`} />
        <StatCard label="Today's Sales" value={fmt(totalSellRevenue)} sublabel={`${todaySells.length} deals | ${fmtG(totalSellGrams)}`} />
        <StatCard label="Stock Value" value={fmt(stockValue)} sublabel={`${unsold.length} positions`} />
        <StatCard label="Unrealized P&L" value={fmt(unrealizedPnl)} change={unrealizedPnl >= 0 ? `+${fmt(unrealizedPnl)}` : fmt(unrealizedPnl)} changeType={unrealizedPnl >= 0 ? "positive" : "negative"} sublabel="vs avg cost" />
      </div>

      <LockedDeals />

      {/* Recent activity with metal colors */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Activity</h2>
        <div className="space-y-2">
          {deals.slice(0, 10).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-900 px-3 py-3 outline outline-1 outline-white/10">
              <div className="flex items-center gap-2.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{d.direction.toUpperCase()}</span>
                <span className={`text-sm font-medium capitalize ${METAL_COLORS[d.metal] ?? "text-white"}`}>{d.metal}</span>
                <span className="text-xs text-gray-500">{d.purity} | {d.quantity_grams.toFixed(0)}g</span>
              </div>
              <span className="text-sm font-medium text-gray-300">${d.price_per_oz.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
