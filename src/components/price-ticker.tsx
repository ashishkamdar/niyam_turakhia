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
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 sm:px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/prismx-logo.png"
          alt="PrismX"
          className="h-5 w-auto sm:h-6 lg:hidden"
        />
        <div className="hidden items-center gap-2 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/prismx-logo.png" alt="PrismX" className="h-6 w-auto" />
          <span className="text-sm font-medium text-gray-500">· Live Prices</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="/settings" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-gray-400 hover:text-amber-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </a>
          <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-gray-400 hover:text-rose-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
        {prices.map((p) => {
          const isUp = p.change >= 0;
          return (
            <div key={p.metal} className="overflow-hidden bg-gray-900 px-2 py-2 sm:px-4 sm:py-3">
              <div className="flex items-baseline justify-between gap-x-1">
                <span className="text-[10px] font-medium text-gray-400 sm:text-xs">
                  {METAL_LABELS[p.metal] ?? p.metal}
                </span>
                <span className={`text-[10px] font-medium sm:text-xs ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                  {isUp ? "+" : ""}{p.change_pct.toFixed(2)}%
                </span>
              </div>
              <p className="mt-0.5 text-base font-semibold tracking-tight text-white sm:text-xl">
                ${p.price_usd.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </p>
              <p className="text-[9px] text-gray-500 sm:text-[10px]">
                {p.source === "demo" ? "Demo" : "Live LBMA"} USD/oz
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
