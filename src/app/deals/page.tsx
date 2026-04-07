"use client";

import { useEffect, useState, useCallback } from "react";
import { DealForm } from "@/components/deal-form";
import { LockedDeals } from "@/components/locked-deals";
import type { Deal } from "@/lib/types";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const loadDeals = useCallback(() => { fetch("/api/deals").then((r) => r.json()).then(setDeals); }, []);
  useEffect(() => { loadDeals(); }, [loadDeals]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">Deals</h1>
        <p className="mt-1 text-sm text-gray-400">Enter new deals or view recent transactions.</p>
      </div>

      <LockedDeals />

      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">New Deal</h2>
        <DealForm onDealCreated={loadDeals} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Deals</h2>
        {/* Mobile: stacked cards */}
        <div className="space-y-3 lg:hidden">
          {deals.map((d) => (
            <div key={d.id} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white capitalize">{d.metal}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>
                  {d.direction.toUpperCase()}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div>Purity: <span className="text-white">{d.purity}</span></div>
                <div>Qty: <span className="text-white">{d.quantity_grams.toFixed(2)}g</span></div>
                <div>Rate: <span className="text-white">${d.price_per_oz.toFixed(4)}/oz</span></div>
                <div>Loc: <span className="text-white">{d.location === "uae" ? "UAE" : "HK"}</span></div>
              </div>
              <p className="mt-2 text-[10px] text-gray-500">{new Date(d.date).toLocaleString()}</p>
            </div>
          ))}
          {deals.length === 0 && <p className="text-sm text-gray-500">No deals yet.</p>}
        </div>
        {/* Desktop: table */}
        <div className="hidden lg:block">
          <div className="overflow-hidden rounded-lg outline outline-1 outline-white/10">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Metal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Dir</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Purity</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Qty (g)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Pure (g)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Rate ($/oz)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deals.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm text-white capitalize">{d.metal}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{d.direction.toUpperCase()}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-300">{d.purity}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">{d.quantity_grams.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">{d.pure_equivalent_grams.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">${d.price_per_oz.toFixed(4)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{d.location === "uae" ? "UAE" : "HK"}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{d.status}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
