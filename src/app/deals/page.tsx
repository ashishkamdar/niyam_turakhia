"use client";

import { useEffect, useState, useCallback } from "react";
import { PurchaseForm } from "@/components/purchase-form";
import { SaleForm } from "@/components/sale-form";
import { LockedDeals } from "@/components/locked-deals";
import type { Deal } from "@/lib/types";

const METAL_COLORS: Record<string, string> = { gold: "text-amber-400", silver: "text-gray-300", platinum: "text-blue-300", palladium: "text-purple-300" };

type Tab = "purchase" | "sale";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<Tab>("purchase");
  const loadDeals = useCallback(() => { fetch("/api/deals?limit=200").then((r) => r.json()).then(setDeals); }, []);
  useEffect(() => { loadDeals(); }, [loadDeals]);

  const buys = deals.filter((d) => d.direction === "buy");
  const sells = deals.filter((d) => d.direction === "sell");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Purchase & Sales</h1>
        <p className="mt-1 text-xs text-gray-400">Record purchases (with refining) and sales of precious metals.</p>
      </div>

      <LockedDeals />

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("purchase")} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${tab === "purchase" ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400"}`}>
          Purchase
        </button>
        <button onClick={() => setTab("sale")} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${tab === "sale" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400"}`}>
          Sale
        </button>
      </div>

      {/* Form */}
      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
        {tab === "purchase" ? (
          <PurchaseForm onCreated={loadDeals} />
        ) : (
          <SaleForm onCreated={loadDeals} />
        )}
      </div>

      {/* Recent Purchases */}
      {buys.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Recent Purchases ({buys.length})</h2>
          <div className="space-y-2">
            {buys.slice(0, 15).map((d) => (
              <div key={d.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium capitalize ${METAL_COLORS[d.metal] ?? "text-white"}`}>{d.metal}</span>
                    <span className="text-xs text-gray-500">{d.purity}</span>
                    {!d.is_pure && <span className="rounded bg-orange-400/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">REFINED</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.date).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-gray-400">
                  <div>Bought: <span className="text-white">{d.quantity_grams.toFixed(0)}g</span></div>
                  <div>Pure: <span className="text-emerald-400">{d.pure_equivalent_grams.toFixed(0)}g</span></div>
                  <div>Rate: <span className="text-white">${d.price_per_oz.toFixed(2)}/oz</span></div>
                </div>
                {d.refining_cost_per_gram > 0 && (
                  <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-gray-500">
                    <div>Refining: <span className="text-orange-300">${d.refining_cost_per_gram}/g</span></div>
                    <div>Wastage: <span className="text-orange-300">{(d.quantity_grams - d.pure_equivalent_grams).toFixed(0)}g</span></div>
                    <div>Total: <span className="text-white">${d.total_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sales */}
      {sells.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Recent Sales ({sells.length})</h2>
          <div className="space-y-2">
            {sells.slice(0, 15).map((d) => (
              <div key={d.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium capitalize ${METAL_COLORS[d.metal] ?? "text-white"}`}>{d.metal}</span>
                    <span className="text-xs text-gray-500">24K</span>
                    {d.contact_name && <span className="text-xs text-gray-400">to {d.contact_name}</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.date).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
                  <div>Qty: <span className="text-white">{d.quantity_grams.toFixed(0)}g</span></div>
                  <div>Rate: <span className="text-emerald-400">${d.price_per_oz.toFixed(2)}/oz</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
