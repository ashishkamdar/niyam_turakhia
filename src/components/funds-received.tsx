"use client";

import { useEffect, useState } from "react";

interface PaymentSummary {
  currency: string;
  total: number;
  count: number;
  mode: string;
}

const FX_RATES: Record<string, { rate: number; label: string }> = {
  HKD: { rate: 0.4697, label: "1 HKD = 0.4697 AED" },
  USD: { rate: 3.6725, label: "1 USD = 3.6725 AED" },
  USDT: { rate: 3.6700, label: "1 USDT = 3.6700 AED" },
};

const CURRENCY_CONFIG: Record<string, { color: string; bgColor: string; icon: string; label: string; source: string }> = {
  HKD: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
    label: "HK Dollars",
    source: "Individuals & Firms",
  },
  USD: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    icon: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
    label: "US Dollars",
    source: "Banks (SWIFT)",
  },
  USDT: {
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
    label: "USDT Crypto",
    source: "Crypto Exchanges",
  },
};

const fmt = (n: number, curr: string) => {
  const pre = curr === "HKD" ? "HK$" : curr === "USDT" ? "USDT " : curr === "AED" ? "AED " : "$";
  return pre + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtAed = (n: number) => "AED " + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function FundsReceived() {
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [remitted, setRemitted] = useState(false);
  const [remitting, setRemitting] = useState(false);
  const [totalAed, setTotalAed] = useState(0);

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

          // Calculate total AED
          let aed = 0;
          for (const p of result) {
            const fx = FX_RATES[p.currency];
            if (fx) aed += p.total * fx.rate;
          }
          setTotalAed(aed);
        })
        .catch(() => {});
    }
    fetchPayments();
    const poll = setInterval(fetchPayments, 3000);
    return () => clearInterval(poll);
  }, []);

  function handleRemit() {
    setRemitting(true);
    setTimeout(() => {
      setRemitting(false);
      setRemitted(true);
    }, 2000);
  }

  if (payments.length === 0) return null;

  const totalUsd = payments.reduce((s, p) => {
    if (p.currency === "HKD") return s + p.total / 7.82;
    return s + p.total;
  }, 0);

  // Bank receipt view after remit
  if (remitted) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-[#1a365d] via-[#1e3a5f] to-[#1a365d] p-5 outline outline-1 outline-blue-400/20">
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
                <p className="text-[10px] text-blue-300/70">Abu Dhabi Commercial Bank</p>
              </div>
            </div>
            <div className="rounded-full bg-emerald-500/20 px-2.5 py-1">
              <p className="text-[10px] font-bold text-emerald-400">RECEIVED</p>
            </div>
          </div>

          {/* Amount */}
          <div className="py-5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-blue-300/50">Amount Credited</p>
            <p className="mt-1 text-3xl font-bold text-white">{fmtAed(totalAed)}</p>
            <p className="mt-1 text-xs text-blue-300/70">~${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} equivalent</p>
          </div>

          {/* Conversion details */}
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

          {/* Footer */}
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-[10px] text-blue-300/50">
              <span>Ref: ADCB-{Date.now().toString(36).toUpperCase()}</span>
              <span>{new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p className="mt-1 text-[9px] text-blue-300/30">Account: Niyam Turakhia Trading LLC — ADCB Dubai</p>
          </div>
        </div>

        <button
          onClick={() => setRemitted(false)}
          className="w-full rounded-lg bg-gray-800 py-2 text-xs font-medium text-gray-400 hover:text-white"
        >
          Back to funds view
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 text-emerald-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
          <h2 className="text-sm font-semibold text-white">Funds Received from HK</h2>
        </div>
        <span className="text-xs text-gray-400">
          ~${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} total
        </span>
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

      {/* Remit button */}
      <button
        onClick={handleRemit}
        disabled={remitting}
        className="w-full rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 p-4 text-center shadow-lg shadow-blue-500/10 transition hover:from-blue-600 hover:to-blue-500 active:scale-[0.98] disabled:opacity-70"
      >
        {remitting ? (
          <div className="flex items-center justify-center gap-3">
            <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span className="text-sm font-semibold text-white">Transferring to ADCB Dubai...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-white">Transfer to Dubai Account</p>
              <p className="text-[10px] text-blue-200/70">{fmtAed(totalAed)} to ADCB Bank</p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
