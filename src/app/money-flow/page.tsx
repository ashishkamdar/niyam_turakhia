"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import type { Payment, Currency } from "@/lib/types";

const CURRENCIES: Currency[] = ["USD", "HKD", "AED", "USDT"];
const COLORS: Record<Currency, string> = { USD: "text-emerald-400", HKD: "text-blue-400", AED: "text-amber-400", USDT: "text-cyan-400" };

export default function MoneyFlowPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  useEffect(() => { fetch("/api/payments?limit=500").then((r) => r.json()).then(setPayments); }, []);

  const byCurrency = (curr: Currency) => {
    const sent = payments.filter((p) => p.currency === curr && p.direction === "sent").reduce((s, p) => s + p.amount, 0);
    const received = payments.filter((p) => p.currency === curr && p.direction === "received").reduce((s, p) => s + p.amount, 0);
    return { sent, received, net: received - sent };
  };

  const fmt = (n: number, curr: string) => {
    const pre = curr === "USD" ? "$" : curr === "HKD" ? "HK$" : curr === "AED" ? "AED " : "USDT ";
    return pre + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalSent = payments.filter((p) => p.direction === "sent").reduce((s, p) => s + p.amount, 0);
  const totalReceived = payments.filter((p) => p.direction === "received").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Money Flow</h1>
        <p className="text-sm text-gray-400">Multi-currency settlement overview.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Total Sent" value={`$${totalSent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} changeType="negative" />
        <StatCard label="Total Received" value={`$${totalReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} changeType="positive" />
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">By Currency</h2>
        {CURRENCIES.map((curr) => {
          const data = byCurrency(curr);
          if (data.sent === 0 && data.received === 0) return null;
          return (
            <div key={curr} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className={`text-base font-semibold ${COLORS[curr]}`}>{curr}</span>
                <span className={`text-sm font-semibold ${data.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  Net: {data.net >= 0 ? "+" : "-"}{fmt(data.net, curr)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-gray-500">Sent</span><p className="font-medium text-rose-300">{fmt(data.sent, curr)}</p></div>
                <div><span className="text-gray-500">Received</span><p className="font-medium text-emerald-300">{fmt(data.received, curr)}</p></div>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Payments</h2>
        <div className="space-y-2">
          {payments.slice(0, 15).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-900 px-4 py-3 outline outline-1 outline-white/10">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.direction === "received" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{p.direction === "received" ? "IN" : "OUT"}</span>
                <span className={`text-sm font-medium ${COLORS[p.currency as Currency] ?? "text-white"}`}>{p.currency}</span>
                <span className="text-xs text-gray-400">{p.mode.replace(/_/g, " ")}</span>
              </div>
              <span className="text-sm font-medium text-gray-300">{fmt(p.amount, p.currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
