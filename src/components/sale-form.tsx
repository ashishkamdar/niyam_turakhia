"use client";

import { useState } from "react";
import type { Metal } from "@/lib/types";
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

  const qty = parseFloat(quantityGrams) || 0;
  const price = parseFloat(pricePerOz) || 0;
  const revenueUsd = (qty / GRAMS_PER_TROY_OZ) * price;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty <= 0 || price <= 0) return;
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
    setQuantityGrams("");
    setPricePerOz("");
    setBuyer("");
    onCreated?.();
  }

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

      {qty > 0 && price > 0 && (
        <div className="rounded-lg bg-white/5 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Sale Revenue ({qty.toFixed(0)}g 24K {metal})</span>
            <span className="text-emerald-400 font-semibold">{fmt(revenueUsd)}</span>
          </div>
        </div>
      )}

      <button type="submit" disabled={saving || qty <= 0 || price <= 0} className="w-full rounded-md bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
        {saving ? "Saving..." : "Record Sale"}
      </button>
    </form>
  );
}
