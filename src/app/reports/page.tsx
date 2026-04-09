"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { useDemo } from "@/components/demo-engine";
import type { Deal, Metal } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
type Period = "daily" | "weekly" | "quarterly" | "yearly";

function getDateRange(period: Period) {
  const now = new Date();
  const end = now.toISOString();
  let start: Date, label: string;
  switch (period) {
    case "daily": start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); label = "Today"; break;
    case "weekly": start = new Date(now); start.setDate(start.getDate() - 7); label = "Last 7 days"; break;
    case "quarterly": start = new Date(now); start.setMonth(start.getMonth() - 3); label = "Last 3 months"; break;
    case "yearly": start = new Date(now); start.setFullYear(start.getFullYear() - 1); label = "Last 12 months"; break;
  }
  return { start: start.toISOString(), end, label };
}

export default function ReportsPage() {
  const { dealTick } = useDemo();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [period, setPeriod] = useState<Period>("daily");
  useEffect(() => {
    function fetchDeals() { fetch("/api/deals?limit=2000").then((r) => r.json()).then(setDeals).catch(() => {}); }
    fetchDeals();
    const poll = setInterval(fetchDeals, 3000);
    return () => clearInterval(poll);
  }, [dealTick]);

  const { start, end, label } = getDateRange(period);
  const filtered = deals.filter((d) => d.date >= start && d.date <= end);
  const buys = filtered.filter((d) => d.direction === "buy");
  const sells = filtered.filter((d) => d.direction === "sell");
  const totalBought = buys.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
  const totalSold = sells.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
  const realizedPnl = totalSold - totalBought;

  const metals: Metal[] = ["gold", "silver", "platinum", "palladium"];
  const byMetal = metals.map((m) => {
    const mB = buys.filter((d) => d.metal === m);
    const mS = sells.filter((d) => d.metal === m);
    const bought = mB.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
    const sold = mS.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
    return { metal: m, bought, sold, pnl: sold - bought, buyGrams: mB.reduce((s, d) => s + d.quantity_grams, 0), sellGrams: mS.reduce((s, d) => s + d.quantity_grams, 0) };
  });

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const periods: Period[] = ["daily", "weekly", "quarterly", "yearly"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Reports</h1>
        <p className="text-sm text-gray-400">{label} &mdash; P&L summary</p>
      </div>
      <div className="flex gap-2">
        {periods.map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${period === p ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Bought" value={fmt(totalBought)} sublabel={`${buys.length} deals`} />
        <StatCard label="Total Sold" value={fmt(totalSold)} sublabel={`${sells.length} deals`} />
        <StatCard label="Realized P&L" value={fmt(realizedPnl)} changeType={realizedPnl >= 0 ? "positive" : "negative"} change={realizedPnl >= 0 ? `+${fmt(realizedPnl)}` : fmt(realizedPnl)} />
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">By Metal</h2>
        <div className="space-y-2">
          {byMetal.map((m) => (
            <div key={m.metal} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize text-white">{m.metal}</span>
                <span className={`text-sm font-semibold ${m.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{m.pnl >= 0 ? "+" : ""}{fmt(m.pnl)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-gray-400">
                <div>Bought: <span className="text-gray-200">{fmt(m.bought)} ({m.buyGrams.toFixed(0)}g)</span></div>
                <div>Sold: <span className="text-gray-200">{fmt(m.sold)} ({m.sellGrams.toFixed(0)}g)</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
