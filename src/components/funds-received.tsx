"use client";

import { useEffect, useState, useRef } from "react";
import type { Deal } from "@/lib/types";

interface PaymentSummary {
  currency: string;
  total: number;
  count: number;
  mode: string;
}

interface SellerPayment {
  contact_name: string;
  metal: string;
  amount_aed: number;
  paid: boolean;
}

const AED_PER_USD = 3.6725;

const FX_RATES: Record<string, { rate: number; label: string }> = {
  HKD: { rate: 0.4697, label: "1 HKD = 0.4697 AED" },
  USD: { rate: 3.6725, label: "1 USD = 3.6725 AED" },
  USDT: { rate: 3.6700, label: "1 USDT = 3.6700 AED" },
};

const CURRENCY_CONFIG: Record<string, { color: string; bgColor: string; icon: string; label: string; source: string }> = {
  HKD: { color: "text-blue-400", bgColor: "bg-blue-500/10", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z", label: "HK Dollars", source: "Individuals & Firms" },
  USD: { color: "text-emerald-400", bgColor: "bg-emerald-500/10", icon: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418", label: "US Dollars", source: "Banks (SWIFT)" },
  USDT: { color: "text-cyan-400", bgColor: "bg-cyan-500/10", icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244", label: "USDT Crypto", source: "Crypto Exchanges" },
};

const fmt = (n: number, curr: string) => {
  const pre = curr === "HKD" ? "HK$" : curr === "USDT" ? "USDT " : curr === "AED" ? "AED " : "$";
  return pre + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtAed = (n: number) => "AED " + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type ViewState = "funds" | "remitting" | "bank" | "paying" | "complete";

export function FundsReceived() {
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [view, setView] = useState<ViewState>("funds");
  const [totalAed, setTotalAed] = useState(0);
  const [totalUsd, setTotalUsd] = useState(0);
  const [sellers, setSellers] = useState<SellerPayment[]>([]);
  const [bankBalance, setBankBalance] = useState(0);
  const [currentSellerIdx, setCurrentSellerIdx] = useState(-1);
  const payTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function fetchPayments() {
      fetch("/api/payments?limit=500")
        .then((r) => r.json())
        .then((all: { currency: string; direction: string; amount: number; mode: string }[]) => {
          const received = all.filter((p) => p.direction === "received");
          const byCurrency = new Map<string, { total: number; count: number; mode: string }>();
          for (const p of received) {
            const existing = byCurrency.get(p.currency) ?? { total: 0, count: 0, mode: p.mode };
            existing.total += p.amount;
            existing.count += 1;
            byCurrency.set(p.currency, existing);
          }
          const result = Array.from(byCurrency.entries())
            .map(([currency, data]) => ({ currency, ...data }))
            .filter((p) => ["HKD", "USD", "USDT"].includes(p.currency))
            .sort((a, b) => b.total - a.total);
          setPayments(result);
          let aed = 0, usd = 0;
          for (const p of result) {
            const fx = FX_RATES[p.currency];
            if (fx) aed += p.total * fx.rate;
            usd += p.currency === "HKD" ? p.total / 7.82 : p.total;
          }
          setTotalAed(aed);
          setTotalUsd(usd);
        })
        .catch(() => {});
    }
    fetchPayments();
    const poll = setInterval(fetchPayments, 3000);
    return () => clearInterval(poll);
  }, []);

  function handleRemit() {
    setView("remitting");
    setTimeout(() => setView("bank"), 2000);
  }

  async function handlePayOff() {
    setView("paying");
    setBankBalance(totalAed);
    setCurrentSellerIdx(-1);

    // Fetch sellers and wait for data before starting animation
    try {
      const res = await fetch("/api/deals?direction=buy&limit=200");
      const deals: (Deal & { contact_name: string })[] = await res.json();
      const whatsappBuys = deals.filter((d) => d.created_by === "whatsapp" || d.created_by === "simulator");
      const sellerMap = new Map<string, { metal: string; amount: number }>();
      for (const d of whatsappBuys) {
        const name = d.contact_name || "Opening Stock";
        const existing = sellerMap.get(name) ?? { metal: d.metal, amount: 0 };
        const costUsd = (d.pure_equivalent_grams / 31.1035) * d.price_per_oz;
        existing.amount += costUsd * AED_PER_USD;
        if (d.metal !== existing.metal) existing.metal = "multiple";
        sellerMap.set(name, existing);
      }
      const list: SellerPayment[] = Array.from(sellerMap.entries())
        .map(([contact_name, data]) => ({ contact_name, metal: data.metal, amount_aed: data.amount, paid: false }))
        .filter((s) => s.contact_name !== "Opening Stock")
        .sort((a, b) => b.amount_aed - a.amount_aed);
      setSellers(list);

      // Start animation after sellers are loaded
      setTimeout(() => payNextSeller(0, list), 1000);
    } catch {
      setView("bank");
    }
  }

  function payNextSeller(idx: number, sellerList?: SellerPayment[]) {
    setSellers((prev) => {
      const list = sellerList ?? prev;
      if (idx >= list.length) {
        setTimeout(() => setView("complete"), 500);
        return list;
      }
      const updated = [...list];
      // Mark all up to idx as paid (in case sellerList was passed fresh)
      for (let i = 0; i <= idx; i++) {
        updated[i] = { ...updated[i], paid: true };
      }
      setBankBalance((bal) => {
        const newBal = bal - updated[idx].amount_aed;
        return newBal;
      });
      setCurrentSellerIdx(idx);
      payTimerRef.current = setTimeout(() => payNextSeller(idx + 1), 1200);
      return updated;
    });
  }

  useEffect(() => {
    return () => { if (payTimerRef.current) clearTimeout(payTimerRef.current); };
  }, []);

  if (payments.length === 0) return null;

  const totalSellerPayments = sellers.reduce((s, p) => s + p.amount_aed, 0);
  const profit = totalAed - totalSellerPayments;

  // ─── COMPLETE: Show profit ───
  if (view === "complete") {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900/40 via-emerald-900/20 to-gray-900 p-5 outline outline-1 outline-emerald-500/30">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500/20">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-8 text-emerald-400">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">All Sellers Paid — Net Profit</p>
            <p className="mt-2 text-4xl font-bold text-emerald-400">{fmtAed(profit)}</p>
            <p className="mt-1 text-xs text-gray-400">
              Received {fmtAed(totalAed)} — Paid {fmtAed(totalSellerPayments)} to {sellers.length} sellers
            </p>
          </div>

          <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
            {sellers.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-emerald-400">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-300">{s.contact_name}</span>
                </div>
                <span className="text-gray-400">{fmtAed(s.amount_aed)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-gray-800/50 p-3 text-center">
            <p className="text-[10px] text-gray-400">ADCB Balance Remaining</p>
            <p className="text-xl font-bold text-emerald-400">{fmtAed(profit)}</p>
            <p className="text-[9px] text-emerald-400/50">This is your profit</p>
          </div>
        </div>
        <button onClick={() => setView("funds")} className="w-full rounded-lg bg-gray-800 py-2 text-xs font-medium text-gray-400 hover:text-white">
          Back to funds view
        </button>
      </div>
    );
  }

  // ─── PAYING: Animated payoff ───
  if (view === "paying") {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-[#1a365d] via-[#1e3a5f] to-[#1a365d] p-5 outline outline-1 outline-amber-500/20">
          {/* Bank header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 text-blue-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">ADCB</p>
                <p className="text-[10px] text-amber-300/70">Paying Local Sellers</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-blue-300/50">Balance</p>
              <p className={`text-lg font-bold transition-all duration-500 ${bankBalance < profit ? "text-amber-400" : "text-white"}`}>
                {fmtAed(bankBalance)}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {sellers.map((s, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg p-2.5 transition-all duration-500 ${
                  s.paid
                    ? "bg-emerald-500/10"
                    : i === currentSellerIdx + 1
                      ? "bg-amber-500/10 animate-pulse"
                      : "bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {s.paid ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 text-emerald-400">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <div className="flex size-5 items-center justify-center rounded-full bg-gray-600 text-[9px] font-bold text-gray-300">
                      {i + 1}
                    </div>
                  )}
                  <div>
                    <p className={`text-xs font-medium ${s.paid ? "text-emerald-300" : "text-white"}`}>{s.contact_name}</p>
                    <p className="text-[9px] text-gray-500 capitalize">{s.metal} &middot; Cash (AED)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${s.paid ? "text-emerald-400" : "text-gray-300"}`}>{fmtAed(s.amount_aed)}</p>
                  <p className="text-[9px] text-gray-500">{s.paid ? "PAID" : "pending"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── BANK: ADCB receipt + Pay Off button ───
  if (view === "bank") {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-[#1a365d] via-[#1e3a5f] to-[#1a365d] p-5 outline outline-1 outline-blue-400/20">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 text-blue-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">ADCB</p>
                <p className="text-[10px] text-blue-300/70">Abu Dhabi Commercial Bank</p>
              </div>
            </div>
            <div className="rounded-full bg-emerald-500/20 px-2.5 py-1">
              <p className="text-[10px] font-bold text-emerald-400">RECEIVED</p>
            </div>
          </div>
          <div className="py-5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-blue-300/50">Amount Credited</p>
            <p className="mt-1 text-3xl font-bold text-white">{fmtAed(totalAed)}</p>
            <p className="mt-1 text-xs text-blue-300/70">~${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} equivalent</p>
          </div>
          <div className="space-y-2 border-t border-white/10 pt-3">
            <p className="text-[9px] font-medium uppercase tracking-wider text-blue-300/50">Conversion Details</p>
            {payments.map((p) => {
              const fx = FX_RATES[p.currency];
              if (!fx) return null;
              const aed = p.total * fx.rate;
              return (
                <div key={p.currency} className="flex items-center justify-between text-xs">
                  <span className="text-blue-200/70">{fmt(p.total, p.currency)}</span>
                  <span className="text-[10px] text-blue-300/40">{fx.label}</span>
                  <span className="font-medium text-white">{fmtAed(aed)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-[10px] text-blue-300/50">
              <span>Ref: ADCB-{Date.now().toString(36).toUpperCase()}</span>
              <span>{new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p className="mt-1 text-[9px] text-blue-300/30">Account: Niyam Turakhia Trading LLC — ADCB Dubai</p>
          </div>
        </div>

        {/* Pay Off Local Sellers button */}
        <button
          onClick={handlePayOff}
          className="w-full rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 p-4 text-center shadow-lg shadow-amber-500/10 transition hover:from-amber-600 hover:to-amber-500 active:scale-[0.98]"
        >
          <div className="flex items-center justify-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-white">Pay Off Local Sellers</p>
              <p className="text-[10px] text-amber-200/70">Pay UAE suppliers in Cash (AED)</p>
            </div>
          </div>
        </button>

        <button onClick={() => setView("funds")} className="w-full rounded-lg bg-gray-800 py-2 text-xs font-medium text-gray-400 hover:text-white">
          Back to funds view
        </button>
      </div>
    );
  }

  // ─── REMITTING: Spinner ───
  if (view === "remitting") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-gray-900 py-12 outline outline-1 outline-white/10">
        <div className="size-10 animate-spin rounded-full border-3 border-blue-400 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-white">Transferring to ADCB Dubai...</p>
        <p className="mt-1 text-xs text-gray-400">{fmtAed(totalAed)}</p>
      </div>
    );
  }

  // ─── FUNDS: Default view ───
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 text-emerald-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
          <h2 className="text-sm font-semibold text-white">Funds Received from HK</h2>
        </div>
        <span className="text-xs text-gray-400">~${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} total</span>
      </div>
      <p className="text-[10px] text-gray-500">Payments received from Hong Kong buyers — ready to transfer to UAE</p>

      <div className="space-y-2">
        {payments.map((p) => {
          const config = CURRENCY_CONFIG[p.currency];
          const fx = FX_RATES[p.currency];
          if (!config || !fx) return null;
          const aed = p.total * fx.rate;
          return (
            <div key={p.currency} className={`rounded-lg ${config.bgColor} p-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`flex size-8 items-center justify-center rounded-full ${config.bgColor}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={`size-4 ${config.color}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
                    <p className="text-[10px] text-gray-400">{config.source} &middot; {p.count} payments</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-bold ${config.color}`}>{fmt(p.total, p.currency)}</p>
                  <p className="text-[9px] text-gray-500">{fmtAed(aed)} &middot; {fx.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleRemit}
        className="w-full rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 p-4 text-center shadow-lg shadow-blue-500/10 transition hover:from-blue-600 hover:to-blue-500 active:scale-[0.98]"
      >
        <div className="flex items-center justify-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-white">Transfer to Dubai Account</p>
            <p className="text-[10px] text-blue-200/70">{fmtAed(totalAed)} to ADCB Bank</p>
          </div>
        </div>
      </button>
    </div>
  );
}
