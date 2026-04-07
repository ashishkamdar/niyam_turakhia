"use client";

import { useState, useEffect, useMemo } from "react";
import type { Metal, Deal } from "@/lib/types";
import { GRAMS_PER_TROY_OZ } from "@/lib/types";

const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];

const selectCls = "w-full appearance-none rounded-md bg-white/5 py-2 pr-8 pl-3 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";
const inputCls = "block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

export function SaleForm({ onCreated }: { onCreated?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [metal, setMetal] = useState<Metal>("gold");
  const [quantityGrams, setQuantityGrams] = useState("");
  const [pricePerOz, setPricePerOz] = useState("");
  const [buyer, setBuyer] = useState("");
  const [buys, setBuys] = useState<Deal[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  // Fetch buy deals to calculate avg cost
  useEffect(() => {
    fetch("/api/deals?direction=buy&limit=500")
      .then((r) => r.json())
      .then(setBuys)
      .catch(() => {});
  }, []);

  const qty = parseFloat(quantityGrams) || 0;
  const price = parseFloat(pricePerOz) || 0;
  const revenueUsd = (qty / GRAMS_PER_TROY_OZ) * price;

  // Average buy cost for selected metal (weighted by pure grams)
  const avgBuyCost = useMemo(() => {
    const metalBuys = buys.filter((d) => d.metal === metal);
    const totalPureGrams = metalBuys.reduce((s, d) => s + d.pure_equivalent_grams, 0);
    if (totalPureGrams === 0) return 0;
    // Use total_cost_usd if available (includes refining), else fallback to price calc
    const totalCost = metalBuys.reduce((s, d) => {
      if (d.total_cost_usd > 0) return s + d.total_cost_usd;
      return s + (d.pure_equivalent_grams / GRAMS_PER_TROY_OZ) * d.price_per_oz;
    }, 0);
    return totalCost / (totalPureGrams / GRAMS_PER_TROY_OZ);
  }, [buys, metal]);

  const isAtLoss = price > 0 && avgBuyCost > 0 && price <= avgBuyCost;
  const isBreakEven = price > 0 && avgBuyCost > 0 && Math.abs(price - avgBuyCost) < 0.5;
  const lossPct = avgBuyCost > 0 ? ((price - avgBuyCost) / avgBuyCost) * 100 : 0;
  const profitPerOz = price - avgBuyCost;
  const totalProfit = (qty / GRAMS_PER_TROY_OZ) * profitPerOz;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty <= 0 || price <= 0) return;

    // Require confirmation if selling at or below cost
    if (isAtLoss && !confirmed) {
      setConfirmed(true);
      return;
    }

    setSaving(true);
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metal,
        purity: "24K",
        quantity_grams: qty,
        price_per_oz: price,
        direction: "sell",
        location: "hong_kong",
        contact_name: buyer,
        refining_cost_per_gram: 0,
        total_cost_usd: 0,
      }),
    });

    setSaving(false);
    setConfirmed(false);
    setQuantityGrams("");
    setPricePerOz("");
    setBuyer("");
    onCreated?.();
  }

  // Reset confirmation when price changes
  useEffect(() => { setConfirmed(false); }, [price, metal]);

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400">Metal</label>
          <select value={metal} onChange={(e) => setMetal(e.target.value as Metal)} className={`mt-1 ${selectCls}`}>
            {METALS.map((m) => <option key={m} value={m} className="bg-gray-800">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Quantity (grams)</label>
          <input type="number" step="0.01" value={quantityGrams} onChange={(e) => setQuantityGrams(e.target.value)} placeholder="500.00" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Rate (USD/oz)</label>
          <input type="number" step="0.0001" value={pricePerOz} onChange={(e) => setPricePerOz(e.target.value)} placeholder="2345.0000" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Buyer</label>
          <input type="text" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Mr. Chang" className={`mt-1 ${inputCls}`} />
        </div>
      </div>

      {/* Avg cost reference */}
      {avgBuyCost > 0 && (
        <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-400">
          Avg purchase cost for {metal}: <span className="font-medium text-white">{fmt(avgBuyCost)}/oz</span> (incl. refining)
        </div>
      )}

      {/* Revenue + profit/loss breakdown */}
      {qty > 0 && price > 0 && (
        <div className="rounded-lg bg-white/5 p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Sale Revenue ({qty.toFixed(0)}g 24K {metal})</span>
            <span className="text-emerald-400 font-semibold">{fmt(revenueUsd)}</span>
          </div>
          {avgBuyCost > 0 && (
            <div className="flex justify-between text-xs border-t border-white/5 pt-2">
              <span className="text-gray-400">Profit/Loss on this sale</span>
              <span className={`font-semibold ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalProfit >= 0 ? "+" : ""}{fmt(totalProfit)} ({lossPct >= 0 ? "+" : ""}{lossPct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Warning: selling at or below cost */}
      {isAtLoss && qty > 0 && (
        <div className="rounded-lg bg-rose-500/10 p-4 outline outline-1 outline-rose-500/30">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 size-5 shrink-0 text-rose-400">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-rose-400">
                {isBreakEven ? "Selling at break-even" : "Selling below purchase cost"}
              </p>
              <p className="mt-1 text-xs text-rose-300/80">
                Your avg cost is {fmt(avgBuyCost)}/oz. Selling at {fmt(price)}/oz is{" "}
                <span className="font-semibold">{fmt(Math.abs(profitPerOz))}/oz {price < avgBuyCost ? "loss" : "break-even"}</span>.
                {qty > 0 && ` Total impact: ${fmt(Math.abs(totalProfit))}.`}
              </p>
              {!confirmed && (
                <p className="mt-2 text-xs text-rose-400 font-medium">Click &quot;Confirm Sale at Loss&quot; to proceed anyway.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving || qty <= 0 || price <= 0}
        className={`w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${
          isAtLoss && !confirmed
            ? "bg-rose-600 hover:bg-rose-500"
            : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {saving
          ? "Saving..."
          : isAtLoss && !confirmed
            ? "Confirm Sale at Loss"
            : "Record Sale"}
      </button>
    </form>
  );
}
