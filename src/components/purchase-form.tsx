"use client";

import { useState, useMemo } from "react";
import type { Metal, Purity } from "@/lib/types";
import { YIELD_TABLE, PURE_PURITIES, GRAMS_PER_TROY_OZ } from "@/lib/types";

const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];
const PURITIES: Purity[] = ["18K", "20K", "22K", "24K", "995", "999"];

const AED_PER_USD = 3.6725;

const DEFAULT_REFINING_COSTS: Record<Metal, number> = {
  gold: 1.50,
  silver: 0.15,
  platinum: 3.00,
  palladium: 2.50,
};

const selectCls = "w-full appearance-none rounded-md bg-white/5 py-2 pr-8 pl-3 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";
const inputCls = "block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

export function PurchaseForm({ onCreated }: { onCreated?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [metal, setMetal] = useState<Metal>("gold");
  const [purity, setPurity] = useState<Purity>("18K");
  const [quantityGrams, setQuantityGrams] = useState("");
  const [pricePerOz, setPricePerOz] = useState("");
  const [refiningCost, setRefiningCost] = useState(DEFAULT_REFINING_COSTS.gold.toString());

  const isPure = PURE_PURITIES.includes(purity);
  const needsRefining = !isPure;
  const qty = parseFloat(quantityGrams) || 0;
  const price = parseFloat(pricePerOz) || 0;
  const refCost = parseFloat(refiningCost) || 0;
  const yieldFactor = YIELD_TABLE[purity];

  // Calculations
  const calc = useMemo(() => {
    const pureEquiv = qty * yieldFactor;
    const wastage = qty - pureEquiv;
    const purchaseCostUsd = (qty / GRAMS_PER_TROY_OZ) * price;
    const refiningTotalUsd = needsRefining ? qty * refCost : 0;
    const totalCostUsd = purchaseCostUsd + refiningTotalUsd;
    const effectiveCostPerOz = pureEquiv > 0 ? totalCostUsd / (pureEquiv / GRAMS_PER_TROY_OZ) : 0;
    const effectiveCostPerGram = pureEquiv > 0 ? totalCostUsd / pureEquiv : 0;

    const totalCostAed = totalCostUsd * AED_PER_USD;
    const purchaseCostAed = purchaseCostUsd * AED_PER_USD;
    const refiningTotalAed = refiningTotalUsd * AED_PER_USD;

    return { pureEquiv, wastage, purchaseCostUsd, purchaseCostAed, refiningTotalUsd, refiningTotalAed, totalCostUsd, totalCostAed, effectiveCostPerOz, effectiveCostPerGram };
  }, [qty, price, refCost, yieldFactor, needsRefining]);

  function handleMetalChange(m: Metal) {
    setMetal(m);
    setRefiningCost(DEFAULT_REFINING_COSTS[m].toString());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty <= 0 || price <= 0) return;
    setSaving(true);

    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metal,
        purity,
        quantity_grams: qty,
        price_per_oz: price,
        direction: "buy",
        location: "uae",
        refining_cost_per_gram: needsRefining ? refCost : 0,
        total_cost_usd: calc.totalCostUsd,
      }),
    });

    setSaving(false);
    setQuantityGrams("");
    setPricePerOz("");
    onCreated?.();
  }

  const fmtUsd = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtAed = (n: number) => "AED " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Section 1: Purchase Details */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400">Purchase Details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Metal</label>
            <select value={metal} onChange={(e) => handleMetalChange(e.target.value as Metal)} className={`mt-1 ${selectCls}`}>
              {METALS.map((m) => <option key={m} value={m} className="bg-gray-800">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Purity</label>
            <select value={purity} onChange={(e) => setPurity(e.target.value as Purity)} className={`mt-1 ${selectCls}`}>
              {PURITIES.map((p) => <option key={p} value={p} className="bg-gray-800">{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Quantity (grams)</label>
            <input type="number" step="0.01" value={quantityGrams} onChange={(e) => setQuantityGrams(e.target.value)} placeholder="1000.00" className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Rate (USD/oz)</label>
            <input type="number" step="0.0001" value={pricePerOz} onChange={(e) => setPricePerOz(e.target.value)} placeholder="2341.5678" className={`mt-1 ${inputCls}`} />
          </div>
        </div>
      </div>

      {/* Section 2: Refining (only if impure) */}
      {needsRefining && (
        <div className="rounded-lg bg-orange-500/5 p-4 outline outline-1 outline-orange-500/20">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
            </svg>
            Refining Required
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400">Refining Cost ($/gram)</label>
              <input type="number" step="0.01" value={refiningCost} onChange={(e) => setRefiningCost(e.target.value)} className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">Yield</label>
              <p className="mt-1 rounded-md bg-white/5 px-3 py-2 text-base text-white">{(yieldFactor * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
            <div>Wastage loss: <span className="text-orange-300">{calc.wastage.toFixed(2)}g</span></div>
            <div>Refining: <span className="text-orange-300">{fmtAed(calc.refiningTotalAed)}</span></div>
          </div>
        </div>
      )}

      {isPure && qty > 0 && (
        <div className="rounded-lg bg-emerald-500/5 p-3 outline outline-1 outline-emerald-500/20">
          <p className="text-xs text-emerald-400">24K/999/995 — no refining needed. Pure metal, zero wastage.</p>
        </div>
      )}

      {/* Section 3: Summary */}
      {qty > 0 && price > 0 && (
        <div className="rounded-lg bg-white/5 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-300">Final Calculation</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Purchase ({qty.toFixed(0)}g {purity})</span>
              <span className="text-white">{fmtAed(calc.purchaseCostAed)}</span>
            </div>
            {needsRefining && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Refining ({qty.toFixed(0)}g x ${refCost}/g)</span>
                <span className="text-orange-300">{fmtAed(calc.refiningTotalAed)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-white">Total Cost (AED)</span>
                <span className="text-amber-400">{fmtAed(calc.totalCostAed)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">Equivalent USD</span>
                <span className="text-gray-400">{fmtUsd(calc.totalCostUsd)}</span>
              </div>
            </div>
            <div className="border-t border-white/10 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Pure {metal} received</span>
                <span className="text-emerald-400 font-medium">{calc.pureEquiv.toFixed(2)}g</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-400">Effective cost per oz (pure)</span>
                <span className="text-amber-400 font-medium">{fmtUsd(calc.effectiveCostPerOz)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-400">Effective cost per gram (pure)</span>
                <span className="text-amber-400 font-medium">{fmtAed(calc.effectiveCostPerGram * AED_PER_USD)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button type="submit" disabled={saving || qty <= 0 || price <= 0} className="w-full rounded-md bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50">
        {saving ? "Saving..." : "Record Purchase"}
      </button>
    </form>
  );
}
