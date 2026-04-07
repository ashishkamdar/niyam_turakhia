"use client";

import { useState } from "react";
import type { Metal, Purity, DealDirection, Location } from "@/lib/types";

const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];
const PURITIES: Purity[] = ["18K", "20K", "22K", "24K", "995", "999"];
const DIRECTIONS: DealDirection[] = ["buy", "sell"];
const LOCATIONS: Location[] = ["uae", "hong_kong"];

const selectCls = "col-start-1 row-start-1 w-full appearance-none rounded-md bg-white/5 py-1.5 pr-8 pl-3 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";
const inputCls = "block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

export function DealForm({ onDealCreated }: { onDealCreated?: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metal: form.get("metal"),
        purity: form.get("purity"),
        quantity_grams: parseFloat(form.get("quantity_grams") as string),
        price_per_oz: parseFloat(form.get("price_per_oz") as string),
        direction: form.get("direction"),
        location: form.get("location"),
      }),
    });
    setSaving(false);
    (e.target as HTMLFormElement).reset();
    onDealCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-400">Metal</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="metal" required className={selectCls}>
              {METALS.map((m) => <option key={m} value={m} className="bg-gray-800">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Purity</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="purity" required className={selectCls}>
              {PURITIES.map((p) => <option key={p} value={p} className="bg-gray-800">{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Direction</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="direction" required className={selectCls}>
              {DIRECTIONS.map((d) => <option key={d} value={d} className="bg-gray-800">{d.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Quantity (grams)</label>
          <input name="quantity_grams" type="number" step="0.01" required placeholder="500.00" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Rate (USD/oz)</label>
          <input name="price_per_oz" type="number" step="0.0001" required placeholder="2341.5678" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Location</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="location" required className={selectCls}>
              {LOCATIONS.map((l) => <option key={l} value={l} className="bg-gray-800">{l === "uae" ? "UAE" : "Hong Kong"}</option>)}
            </select>
          </div>
        </div>
      </div>
      <button type="submit" disabled={saving} className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50 sm:w-auto">
        {saving ? "Saving..." : "Lock Deal"}
      </button>
    </form>
  );
}
