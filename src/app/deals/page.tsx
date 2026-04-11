"use client";

/**
 * /deals — two modes toggled by a pill at the top:
 *
 *   • Demo:  the original purchase/sale entry forms + recent-deals
 *            cards populated by the Home "Start Demo" button. Used
 *            to show how manual deal entry feels, and to quickly
 *            seed the dashboard with fake activity during demos.
 *
 *   • Live:  a wide tabular view of every approved WhatsApp deal in
 *            a date window (Today / Monthly / Quarterly / Yearly /
 *            Custom From-To). This is Niyam's "real" trades register
 *            — exportable to CSV, printable with the PrismX letter-
 *            head, and shareable via the native share sheet.
 */

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PurchaseForm } from "@/components/purchase-form";
import { SaleForm } from "@/components/sale-form";
import { LockedDeals } from "@/components/locked-deals";
import { ReportLetterhead } from "@/components/report-letterhead";
import { useDemo } from "@/components/demo-engine";
import { useFy } from "@/components/fy-provider";
import { intersectFy } from "@/lib/financial-year";
import type { Deal } from "@/lib/types";

const METAL_COLORS: Record<string, string> = {
  gold: "text-amber-400",
  silver: "text-gray-300",
  platinum: "text-blue-300",
  palladium: "text-purple-300",
};

type Tab = "purchase" | "sale";
type Mode = "demo" | "live";
type Period = "today" | "monthly" | "quarterly" | "yearly" | "custom";
type TypeFilter = "all" | "K" | "P";

// ─── Date range helper ─────────────────────────────────────────────────
//
// Returns the [fromIso, toIso) half-open window for a given period.
// Custom ranges are passed through untouched. Periods pivot around
// "now" so the window always slides forward with real time.
function periodRange(period: Period, customFrom: string, customTo: string): {
  from: string | null;
  to: string | null;
  label: string;
} {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString(), to: null, label: "Today" };
  }
  if (period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to: null, label: "This Month" };
  }
  if (period === "quarterly") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    return { from: start.toISOString(), to: null, label: "This Quarter" };
  }
  if (period === "yearly") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: start.toISOString(), to: null, label: "This Year" };
  }
  // custom — only apply if both dates are set. Both are yyyy-mm-dd
  // strings from <input type="date">, so we turn them into full ISO
  // timestamps at the day boundaries.
  const from = customFrom ? new Date(customFrom + "T00:00:00").toISOString() : null;
  const to = customTo ? new Date(customTo + "T23:59:59.999").toISOString() : null;
  const label =
    customFrom && customTo
      ? `${customFrom} → ${customTo}`
      : customFrom
      ? `Since ${customFrom}`
      : customTo
      ? `Until ${customTo}`
      : "Custom";
  return { from, to, label };
}

// ─── Live deal shape (mirrors /api/deals/live response) ────────────────

type LiveDeal = {
  id: string;
  sender_name: string;
  received_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  deal_type: "K" | "P" | null;
  direction: "buy" | "sell" | null;
  metal: string | null;
  purity: string | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  premium_type: "absolute" | "percent" | null;
  premium_value: number | null;
  party_alias: string | null;
  dispatched_at: string | null;
  dispatched_to: string | null;
  amount_usd: number;
};

type LiveResponse = {
  deals: LiveDeal[];
  count: number;
  totals: { buy_count: number; sell_count: number; buy_usd: number; sell_usd: number };
  generated_at: string;
};

function formatUsd(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Page root ─────────────────────────────────────────────────────────

export default function DealsPage() {
  const [mode, setMode] = useState<Mode>("demo");

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      {/* Mode toggle — always visible, print:hidden because the Live
          view has its own letterhead for paper output. */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-white">
            {mode === "demo" ? "Purchase & Sales" : "Live Trades"}
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            {mode === "demo"
              ? "Record purchases (with refining) and sales of precious metals."
              : "Every approved WhatsApp trade, straight from the maker-checker queue."}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "demo" ? <DemoView /> : <LiveView />}
    </div>
  );
}

// ─── Mode toggle pill ──────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-gray-900 p-1">
      <button
        onClick={() => onChange("demo")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          mode === "demo" ? "bg-amber-600 text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        <span className={`size-1.5 rounded-full ${mode === "demo" ? "bg-white" : "bg-gray-500"}`} />
        Demo
      </button>
      <button
        onClick={() => onChange("live")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          mode === "live" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        <span className={`size-1.5 rounded-full ${mode === "live" ? "animate-pulse bg-white" : "bg-gray-500"}`} />
        Live
      </button>
    </div>
  );
}

// ─── Demo view (unchanged behaviour from the old /deals page) ──────────

function DemoView() {
  const { dealTick } = useDemo();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<Tab>("purchase");
  const loadDeals = useCallback(() => {
    fetch("/api/deals?limit=200")
      .then((r) => r.json())
      .then(setDeals)
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadDeals();
    const poll = setInterval(loadDeals, 3000);
    return () => clearInterval(poll);
  }, [loadDeals, dealTick]);

  const buys = deals.filter((d) => d.direction === "buy");
  const sells = deals.filter((d) => d.direction === "sell");

  return (
    <div className="space-y-6">
      <LockedDeals />

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("purchase")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === "purchase" ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400"
          }`}
        >
          Purchase
        </button>
        <button
          onClick={() => setTab("sale")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === "sale" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400"
          }`}
        >
          Sale
        </button>
      </div>

      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
        {tab === "purchase" ? <PurchaseForm onCreated={loadDeals} /> : <SaleForm onCreated={loadDeals} />}
      </div>

      {buys.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Recent Purchases ({buys.length})</h2>
          <div className="space-y-2">
            {buys.slice(0, 15).map((d) => (
              <div key={d.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium capitalize ${METAL_COLORS[d.metal] ?? "text-white"}`}>{d.metal}</span>
                    <span className="text-xs text-gray-500">{d.purity}</span>
                    {!d.is_pure && <span className="rounded bg-orange-400/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">REFINED</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.date).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-gray-400">
                  <div>Bought: <span className="text-white">{d.quantity_grams.toFixed(0)}g</span></div>
                  <div>Pure: <span className="text-emerald-400">{d.pure_equivalent_grams.toFixed(0)}g</span></div>
                  <div>Rate: <span className="text-white">${d.price_per_oz.toFixed(2)}/oz</span></div>
                </div>
                {d.refining_cost_per_gram > 0 && (
                  <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-gray-500">
                    <div>Refining: <span className="text-orange-300">${d.refining_cost_per_gram}/g</span></div>
                    <div>Wastage: <span className="text-orange-300">{(d.quantity_grams - d.pure_equivalent_grams).toFixed(0)}g</span></div>
                    <div>Total: <span className="text-white">${d.total_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sells.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Recent Sales ({sells.length})</h2>
          <div className="space-y-2">
            {sells.slice(0, 15).map((d) => (
              <div key={d.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium capitalize ${METAL_COLORS[d.metal] ?? "text-white"}`}>{d.metal}</span>
                    <span className="text-xs text-gray-500">24K</span>
                    {d.contact_name && <span className="text-xs text-gray-400">to {d.contact_name}</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.date).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
                  <div>Qty: <span className="text-white">{d.quantity_grams.toFixed(0)}g</span></div>
                  <div>Rate: <span className="text-emerald-400">${d.price_per_oz.toFixed(2)}/oz</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Live view (approved WhatsApp deals register) ──────────────────────

function LiveView() {
  const { fy } = useFy();
  const [period, setPeriod] = useState<Period>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [data, setData] = useState<LiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  // The period pills produce a raw [from, to] window. We intersect
  // it with the selected FY so no query can ever return deals outside
  // the FY the user picked. When the FY and period point at totally
  // disjoint windows (e.g. "Today" while viewing a past FY), intersect
  // returns an empty window and the table legitimately shows zero rows.
  const rawRange = useMemo(
    () => periodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );
  const range = useMemo(() => {
    const clamped = intersectFy(fy, rawRange.from, rawRange.to);
    return { from: clamped.from, to: clamped.to, label: rawRange.label };
  }, [fy, rawRange]);

  // Type filter is applied client-side: the server already returned
  // every approved deal in the window, so filtering by deal_type is a
  // trivial array.filter that avoids a second round-trip on every pill
  // click. Totals are recomputed so the stat cards always match what
  // the table is showing.
  const { visibleDeals, visibleTotals } = useMemo(() => {
    const all = data?.deals ?? [];
    const filtered =
      typeFilter === "all" ? all : all.filter((d) => d.deal_type === typeFilter);
    const totals = filtered.reduce(
      (acc, d) => {
        if (d.direction === "buy") {
          acc.buy_count += 1;
          acc.buy_usd += d.amount_usd;
        } else if (d.direction === "sell") {
          acc.sell_count += 1;
          acc.sell_usd += d.amount_usd;
        }
        return acc;
      },
      { buy_count: 0, sell_count: 0, buy_usd: 0, sell_usd: 0 }
    );
    return { visibleDeals: filtered, visibleTotals: totals };
  }, [data, typeFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    try {
      const res = await fetch(`/api/deals/live?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch {
      // Keep stale data on network error.
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
    // Live view auto-refreshes every 10 seconds so long-running demos
    // show newly-approved deals without a manual reload. Slower than
    // /review (3s) because this query is heavier and the user won't
    // be tracking a specific single deal — just the overall register.
    const poll = setInterval(load, 10_000);
    return () => clearInterval(poll);
  }, [load]);

  function exportUrl(): string {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    params.set("label", typeFilter === "all" ? period : `${period}-${typeFilter.toLowerCase()}`);
    if (typeFilter !== "all") params.set("type", typeFilter);
    return `/api/deals/live/export?${params.toString()}`;
  }

  async function handleShare() {
    if (!data) return;
    const typeLabel =
      typeFilter === "K" ? " · Kachha only" : typeFilter === "P" ? " · Pakka only" : "";
    const text = [
      `PrismX — Live Trades`,
      `${fy.label} · ${range.label}${typeLabel} · ${visibleDeals.length} deal${visibleDeals.length === 1 ? "" : "s"}`,
      `Bought: ${visibleTotals.buy_count} · ${formatUsd(visibleTotals.buy_usd)}`,
      `Sold: ${visibleTotals.sell_count} · ${formatUsd(visibleTotals.sell_usd)}`,
      `Net P&L: ${formatUsd(visibleTotals.sell_usd - visibleTotals.buy_usd)}`,
    ].join("\n");
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "PrismX Live Trades", text });
        setShareFeedback("Shared");
        setTimeout(() => setShareFeedback(""), 2000);
        return;
      } catch {
        // User cancelled — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback("Copied");
      setTimeout(() => setShareFeedback(""), 2000);
    } catch {
      setShareFeedback("Unable to share");
      setTimeout(() => setShareFeedback(""), 2000);
    }
  }

  return (
    <div className="space-y-4">
      {/* Letterhead — visible on screen AND in print. */}
      <ReportLetterhead
        title="Live Trades"
        subtitle={`${fy.label} · ${range.label}${
          typeFilter === "K" ? " · Kachha" : typeFilter === "P" ? " · Pakka" : ""
        } · ${visibleDeals.length} deal${visibleDeals.length === 1 ? "" : "s"}`}
      />

      {/* Filter bar — hidden in print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period pills */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-gray-900 p-1">
            {(["today", "monthly", "quarterly", "yearly", "custom"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  period === p ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Kachha / Pakka filter — separate group so it reads as a
              distinct axis, not another period. Colour-coded to match
              the type pills in the table body (sky=Kachha, emerald=Pakka). */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-gray-900 p-1">
            <button
              onClick={() => setTypeFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                typeFilter === "all" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter("K")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                typeFilter === "K" ? "bg-sky-600 text-white" : "text-sky-300/70 hover:text-sky-200"
              }`}
            >
              Kachha
            </button>
            <button
              onClick={() => setTypeFilter("P")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                typeFilter === "P" ? "bg-emerald-600 text-white" : "text-emerald-300/70 hover:text-emerald-200"
              }`}
            >
              Pakka
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shareFeedback && (
            <span className="text-xs text-emerald-400">{shareFeedback}</span>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Share
          </button>
          <a
            href={exportUrl()}
            className="flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Custom-date inputs — only shown when Custom is selected */}
      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-gray-900 p-3 print:hidden">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              From
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded border border-white/10 bg-gray-950 px-2 py-1.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              To
            </label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded border border-white/10 bg-gray-950 px-2 py-1.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          {(customFrom || customTo) && (
            <button
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
              }}
              className="rounded border border-white/10 bg-gray-950 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Summary stat cards — derived from the filtered set so they
          always match what the table is showing. */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Deals" value={visibleDeals.length.toString()} />
          <StatCard
            label="Bought"
            value={formatUsd(visibleTotals.buy_usd)}
            sublabel={`${visibleTotals.buy_count} deals`}
            tone="amber"
          />
          <StatCard
            label="Sold"
            value={formatUsd(visibleTotals.sell_usd)}
            sublabel={`${visibleTotals.sell_count} deals`}
            tone="emerald"
          />
          <StatCard
            label="Net"
            value={formatUsd(visibleTotals.sell_usd - visibleTotals.buy_usd)}
            tone={
              visibleTotals.sell_usd - visibleTotals.buy_usd >= 0 ? "emerald" : "rose"
            }
          />
        </div>
      )}

      {/* The table itself */}
      <div className="overflow-x-auto rounded-lg border border-white/5 bg-gray-900 print:border-gray-300 print:bg-gray-50">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-gray-400 print:bg-gray-100 print:text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Approved</th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Dir</th>
              <th className="px-3 py-2 text-left font-semibold">Party</th>
              <th className="px-3 py-2 text-left font-semibold">Metal</th>
              <th className="px-3 py-2 text-right font-semibold">Qty (g)</th>
              <th className="px-3 py-2 text-right font-semibold">Rate $/oz</th>
              <th className="px-3 py-2 text-left font-semibold">Premium</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="px-3 py-2 text-left font-semibold">Dispatch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono text-gray-300 print:divide-gray-200">
            {loading && !data && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && visibleDeals.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                  {typeFilter === "all"
                    ? "No approved deals in this range."
                    : `No ${typeFilter === "K" ? "Kachha" : "Pakka"} deals in this range.`}
                </td>
              </tr>
            )}
            {visibleDeals.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2 text-gray-400 print:text-gray-600">
                  {formatDateTime(d.reviewed_at)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      d.deal_type === "P"
                        ? "bg-emerald-500/10 text-emerald-300 print:bg-emerald-100 print:text-emerald-800"
                        : d.deal_type === "K"
                        ? "bg-sky-500/10 text-sky-300 print:bg-sky-100 print:text-sky-800"
                        : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {d.deal_type === "P" ? "PAKKA" : d.deal_type === "K" ? "KACHHA" : "?"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`font-bold ${
                      d.direction === "sell"
                        ? "text-emerald-400 print:text-emerald-700"
                        : d.direction === "buy"
                        ? "text-rose-400 print:text-rose-700"
                        : "text-gray-400"
                    }`}
                  >
                    {(d.direction ?? "—").toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2 text-white print:text-black">
                  {d.party_alias ?? d.sender_name}
                </td>
                <td className="px-3 py-2">
                  <span className={`capitalize ${METAL_COLORS[d.metal ?? ""] ?? "text-gray-300"} print:text-black`}>
                    {d.metal ?? "—"}
                  </span>
                  {d.purity && (
                    <span className="ml-1 text-[10px] text-gray-500 print:text-gray-600">
                      {d.purity}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-white print:text-black">
                  {d.qty_grams?.toFixed(0) ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-white print:text-black">
                  {d.rate_usd_per_oz?.toFixed(2) ?? "—"}
                </td>
                <td className="px-3 py-2 text-[11px] text-gray-400 print:text-gray-600">
                  {d.premium_value !== null && d.premium_value !== undefined
                    ? d.premium_type === "percent"
                      ? `${d.premium_value}%`
                      : `${d.premium_value}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-white print:text-black">
                  {formatUsd(d.amount_usd)}
                </td>
                <td className="px-3 py-2">
                  {d.dispatched_at ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 print:bg-emerald-100 print:text-emerald-800">
                      {d.dispatched_to === "orosoft" ? "OROSOFT" : "SBS"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300 print:bg-amber-100 print:text-amber-800">
                      PENDING
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Print-only footer */}
      <div className="hidden border-t border-amber-700 pt-2 text-center text-[10px] uppercase tracking-wider text-gray-600 print:block">
        PrismX · Live Trades Register · Confidential
      </div>
    </div>
  );
}

// ─── Local stat card (so we don't have to touch the print-tuned one) ───

function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "default" | "amber" | "emerald" | "rose";
}) {
  const toneClasses =
    tone === "amber"
      ? "text-amber-300"
      : tone === "emerald"
      ? "text-emerald-300"
      : tone === "rose"
      ? "text-rose-300"
      : "text-white";
  return (
    <div className="rounded-lg bg-gray-900 px-4 py-3 outline outline-1 outline-white/10 print:bg-gray-50 print:outline-gray-300">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 print:text-gray-600">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneClasses} print:text-black`}>
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] text-gray-500 print:text-gray-600">{sublabel}</div>
      )}
    </div>
  );
}
