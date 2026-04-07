"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/types";

interface DealWithContact extends Deal {
  contact_name: string;
}

export function LockedDeals() {
  const [deals, setDeals] = useState<DealWithContact[]>([]);

  useEffect(() => {
    fetch("/api/deals?limit=50")
      .then((r) => r.json())
      .then((all: DealWithContact[]) => setDeals(all.filter((d) => d.created_by === "whatsapp")));

    const interval = setInterval(() => {
      fetch("/api/deals?limit=50")
        .then((r) => r.json())
        .then((all: DealWithContact[]) => setDeals(all.filter((d) => d.created_by === "whatsapp")));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (deals.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-2 animate-pulse rounded-full bg-emerald-400" />
        <h2 className="text-sm font-semibold text-white">WhatsApp Locked Deals</h2>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">{deals.length}</span>
      </div>
      <div className="space-y-2">
        {deals.map((d) => (
          <div key={d.id} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-emerald-500/20">
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {(d.contact_name || "?").charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-white">{d.contact_name || "Unknown"}</span>
                  <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">WA</span>
                  <span className="ml-auto shrink-0 text-xs font-medium text-amber-400">LOCKED</span>
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400 sm:grid-cols-3">
              <div>Metal: <span className="text-white capitalize">{d.metal}</span></div>
              <div>Qty: <span className="text-white">{d.quantity_grams.toLocaleString()}g</span></div>
              <div>Rate: <span className="text-white">${d.price_per_oz.toFixed(2)}/oz</span></div>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              Locked {new Date(d.date).toLocaleString()} — pending staff entry
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
