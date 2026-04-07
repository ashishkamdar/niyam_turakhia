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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {(d.contact_name || "?").charAt(0)}
                </div>
                <div>
                  <span className="text-sm font-medium text-white">{d.contact_name || "Unknown"}</span>
                  <span className="ml-2 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">WhatsApp</span>
                </div>
              </div>
              <span className="text-xs text-amber-400 font-medium">LOCKED</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-400">
              <div>Metal: <span className="text-white capitalize">{d.metal}</span></div>
              <div>Qty: <span className="text-white">{d.quantity_grams.toLocaleString()}g</span></div>
              <div>Rate: <span className="text-white">${d.price_per_oz.toFixed(4)}/oz</span></div>
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
