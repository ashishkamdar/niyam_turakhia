"use client";

import { useEffect, useState } from "react";
import type { Deal, WhatsAppContact } from "@/lib/types";

const METAL_COLORS: Record<string, string> = { gold: "text-amber-400", silver: "text-gray-300", platinum: "text-blue-300", palladium: "text-purple-300" };

interface DealWithContact extends Deal {
  contact_name: string;
}

export function LockedDeals() {
  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [activeChats, setActiveChats] = useState(0);

  useEffect(() => {
    function fetchData() {
      fetch("/api/deals?limit=50")
        .then((r) => r.json())
        .then((all: DealWithContact[]) => setDeals(all.filter((d) => d.created_by === "whatsapp")))
        .catch(() => {});
      fetch("/api/whatsapp")
        .then((r) => r.json())
        .then((contacts: WhatsAppContact[]) => {
          const active = contacts.filter((c) => c.lock_count === 0 || c.msgs_after_last_lock > 0);
          setActiveChats(active.length);
        })
        .catch(() => {});
    }
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (deals.length === 0 && activeChats === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 animate-pulse rounded-full bg-emerald-400" />
          <h2 className="text-sm font-semibold text-white">WhatsApp Deals</h2>
        </div>
        <div className="flex items-center gap-3">
          {activeChats > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-400">
              <span className="size-1.5 animate-pulse rounded-full bg-blue-400" />
              {activeChats} negotiating
            </span>
          )}
          {deals.length > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400">
              {deals.length} locked
            </span>
          )}
        </div>
      </div>

      {deals.length > 0 && (
        <div className="space-y-2">
          {deals.map((d) => (
            <div key={d.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-emerald-500/20">
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
              <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-gray-400">
                <div><span className={`font-medium capitalize ${METAL_COLORS[d.metal] ?? "text-white"}`}>{d.metal}</span></div>
                <div>{d.quantity_grams.toLocaleString()}g</div>
                <div>${d.price_per_oz.toFixed(2)}/oz</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
