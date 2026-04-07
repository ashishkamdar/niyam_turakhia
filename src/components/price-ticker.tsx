"use client";

import { useEffect, useState } from "react";
import type { Price } from "@/lib/types";

const METAL_LABELS: Record<string, string> = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  XPD: "Palladium",
};

export function PriceTicker() {
  const [prices, setPrices] = useState<Price[]>([]);

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then(setPrices)
      .catch(() => {});
  }, []);

  if (prices.length === 0) {
    return (
      <div className="border-b border-white/10 bg-gray-900 px-4 py-2">
        <p className="text-sm text-gray-500">Loading prices...</p>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-gray-900/95 backdrop-blur">
      <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
        {prices.map((p) => {
          const isUp = p.change >= 0;
          return (
            <div key={p.metal} className="bg-gray-900 px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex items-baseline justify-between gap-x-2">
                <span className="text-xs font-medium text-gray-400">
                  {METAL_LABELS[p.metal] ?? p.metal}
                </span>
                <span className={`text-xs font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                  {isUp ? "+" : ""}{p.change_pct.toFixed(2)}%
                </span>
              </div>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
                ${p.price_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-gray-500">
                {p.source === "demo" ? "Demo" : "Live LBMA"} USD/oz
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
