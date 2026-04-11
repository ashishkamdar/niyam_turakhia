"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { useDemo } from "@/components/demo-engine";
import { ReportLetterhead } from "@/components/report-letterhead";
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
      {/* Branded letterhead — visible on screen AND in print. Flips from
          dark-theme to white-paper via print: variants. */}
      <ReportLetterhead
        title="Trading P&L Report"
        subtitle={`${label} · ${filtered.length} deal${filtered.length === 1 ? "" : "s"}`}
      />

      {/* Period selector + Print button — hidden in print view */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-2">
          {periods.map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${period === p ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Print
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Bought" value={fmt(totalBought)} sublabel={`${buys.length} deals`} />
        <StatCard label="Total Sold" value={fmt(totalSold)} sublabel={`${sells.length} deals`} />
        <StatCard label="Realized P&L" value={fmt(realizedPnl)} changeType={realizedPnl >= 0 ? "positive" : "negative"} change={realizedPnl >= 0 ? `+${fmt(realizedPnl)}` : fmt(realizedPnl)} />
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white print:text-black">By Metal</h2>
        <div className="space-y-2">
          {byMetal.map((m) => (
            <div key={m.metal} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 print:outline-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize text-white print:text-black">{m.metal}</span>
                <span className={`text-sm font-semibold ${m.pnl >= 0 ? "text-emerald-400 print:text-emerald-700" : "text-rose-400 print:text-rose-700"}`}>{m.pnl >= 0 ? "+" : ""}{fmt(m.pnl)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-gray-400 print:text-gray-600">
                <div>Bought: <span className="text-gray-200 print:text-black">{fmt(m.bought)} ({m.buyGrams.toFixed(0)}g)</span></div>
                <div>Sold: <span className="text-gray-200 print:text-black">{fmt(m.sold)} ({m.sellGrams.toFixed(0)}g)</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Print-only footer — hidden on screen */}
      <div className="hidden border-t border-amber-700 pt-2 text-center text-[10px] uppercase tracking-wider text-gray-600 print:block">
        PrismX · Bullion Management Reports · Confidential
      </div>
    </div>
  );
}
