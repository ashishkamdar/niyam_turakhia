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

  function handleLogout() {
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).then(() => window.location.reload());
  }

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-gray-900/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 sm:px-4">
        <span className="text-xs font-bold text-amber-400 lg:hidden">NT Metals</span>
        <span className="hidden text-xs text-gray-500 lg:inline">Live Prices</span>
        <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 hover:text-rose-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
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
                ${p.price_usd.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
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
