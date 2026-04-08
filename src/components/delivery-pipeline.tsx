"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/types";

const METAL_COLORS: Record<string, string> = { gold: "text-amber-400", silver: "text-gray-300", platinum: "text-blue-300", palladium: "text-purple-300" };
const AED_PER_USD = 3.6725;

interface ShipmentInfo {
  metal: string;
  grams: number;
  buyer: string;
  status: string;
}

interface SellerPaymentInfo {
  name: string;
  metal: string;
  amount_aed: number;
}

const fmtAed = (n: number) => "AED " + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function DeliveryPipeline() {
  const [shipments, setShipments] = useState<ShipmentInfo[]>([]);
  const [sellerPayments, setSellerPayments] = useState<SellerPaymentInfo[]>([]);

  useEffect(() => {
    function fetchData() {
      // Get sell deals = shipments to HK
      fetch("/api/deals?direction=sell&limit=50")
        .then((r) => r.json())
        .then((deals: (Deal & { contact_name: string })[]) => {
          const today = new Date().toISOString().split("T")[0];
          const todaySells = deals.filter((d) => d.date.startsWith(today) && d.contact_name);
          setShipments(todaySells.map((d) => ({
            metal: d.metal,
            grams: d.quantity_grams,
            buyer: d.contact_name,
            status: d.status,
          })));
        })
        .catch(() => {});

      // Get buy deals = seller payments
      fetch("/api/deals?direction=buy&limit=50")
        .then((r) => r.json())
        .then((deals: (Deal & { contact_name: string })[]) => {
          const today = new Date().toISOString().split("T")[0];
          const todayBuys = deals.filter((d) => d.date.startsWith(today) && d.contact_name);
          const sellerMap = new Map<string, { metal: string; amount: number }>();
          for (const d of todayBuys) {
            const existing = sellerMap.get(d.contact_name) ?? { metal: d.metal, amount: 0 };
            existing.amount += (d.pure_equivalent_grams / 31.1035) * d.price_per_oz * AED_PER_USD;
            sellerMap.set(d.contact_name, existing);
          }
          setSellerPayments(
            Array.from(sellerMap.entries())
              .map(([name, data]) => ({ name, metal: data.metal, amount_aed: data.amount }))
              .sort((a, b) => b.amount_aed - a.amount_aed)
          );
        })
        .catch(() => {});
    }
    fetchData();
    const poll = setInterval(fetchData, 3000);
    return () => clearInterval(poll);
  }, []);

  if (shipments.length === 0 && sellerPayments.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* ─── DELIVERY: UAE → Air → HK ─── */}
      {shipments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 text-sky-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
            <h2 className="text-sm font-semibold text-white">Deliveries</h2>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">{shipments.length} shipments</span>
          </div>

          {/* Visual route */}
          <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-sky-500/20">
            {/* UAE → Plane → HK header */}
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/20">
                  <span className="text-lg">🇦🇪</span>
                </div>
                <p className="mt-1 text-[9px] font-medium text-amber-400">Dubai</p>
              </div>

              <div className="relative flex-1 mx-3">
                <div className="h-px bg-gradient-to-r from-amber-500/50 via-sky-400/50 to-blue-500/50" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 animate-bounce">
                  <div className="flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5">
                    <span className="text-sm">✈️</span>
                    <span className="text-[9px] font-medium text-sky-400">Air Freight</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/20">
                  <span className="text-lg">🇭🇰</span>
                </div>
                <p className="mt-1 text-[9px] font-medium text-blue-400">Hong Kong</p>
              </div>
            </div>

            {/* Shipment cards */}
            <div className="mt-4 space-y-1.5">
              {shipments.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">📦</span>
                    <span className={`text-xs font-medium capitalize ${METAL_COLORS[s.metal] ?? "text-white"}`}>{s.metal}</span>
                    <span className="text-xs text-gray-400">{s.grams >= 1000 ? `${(s.grams / 1000).toFixed(1)}kg` : `${s.grams.toFixed(0)}g`}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400">{s.buyer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENTS TO LOCAL SELLERS ─── */}
      {sellerPayments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 text-amber-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <h2 className="text-sm font-semibold text-white">Payments to Sellers</h2>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">{sellerPayments.length} sellers</span>
          </div>

          <div className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-amber-500/20">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10">
                <span className="text-[10px]">🇦🇪</span>
              </div>
              <p className="text-[10px] text-amber-400/70">Cash payments to UAE local sellers (Dirhams)</p>
            </div>
            <div className="space-y-1.5">
              {sellerPayments.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-400">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{s.name}</p>
                      <p className="text-[9px] capitalize text-gray-500">{s.metal} &middot; Cash (AED)</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400">{fmtAed(s.amount_aed)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-white/5 pt-2 flex justify-between text-xs">
              <span className="text-gray-500">Total payable</span>
              <span className="font-semibold text-amber-400">{fmtAed(sellerPayments.reduce((s, p) => s + p.amount_aed, 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
