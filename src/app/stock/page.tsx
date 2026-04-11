"use client";

/**
 * /stock — two modes toggled by a pill at the top:
 *
 *   • Demo:  the original per-metal cards with lot breakdowns, fed by
 *            the Home "Start Demo" button (deals table).
 *   • Live:  a tabular register of stock in hand computed from every
 *            approved WhatsApp lock code. Filterable by metal, with
 *            export / share / print — same treatment as the Deals
 *            Live view.
 */

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StockDetail } from "@/components/stock-detail";
import { ReportLetterhead } from "@/components/report-letterhead";
import { useDemo } from "@/components/demo-engine";
import { useFy } from "@/components/fy-provider";
import type { Deal, Price, Metal, MetalSymbol } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
const METAL_SYMBOLS: Record<string, MetalSymbol> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

type Mode = "demo" | "live";
type MetalFilter = "all" | "gold" | "silver" | "platinum" | "palladium" | "other";

// ─── Page root ────────────────────────────────────────────────────────

export default function StockPage() {
  // Default to Live — the Live register (Opening + Stock In Hand +
  // all-time table) is the production surface Niyam will actually use.
  // Demo mode is a fallback for the Home "Start Demo" button flow.
  const [mode, setMode] = useState<Mode>("live");

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      {/* Header with mode toggle — hidden in print because the Live
          view has its own letterhead at the top of the printout. */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-white">Stock In Hand</h1>
          <p className="mt-1 text-xs text-gray-400">
            {mode === "demo"
              ? "Current positions from demo trades. Tap a row to see individual lots."
              : "Current holdings computed from every approved WhatsApp trade."}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "demo" ? <DemoView /> : <LiveView />}
    </div>
  );
}

// ─── Mode toggle pill ─────────────────────────────────────────────────

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

// ─── Demo view (the original per-metal cards) ──────────────────────────

function DemoView() {
  const { dealTick } = useDemo();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [selectedMetal, setSelectedMetal] = useState<Metal | null>(null);

  useEffect(() => {
    function fetchAll() {
      fetch("/api/deals?limit=1000").then((r) => r.json()).then(setDeals).catch(() => {});
      fetch("/api/prices").then((r) => r.json()).then(setPrices).catch(() => {});
    }
    fetchAll();
    const poll = setInterval(fetchAll, 3000);
    return () => clearInterval(poll);
  }, [dealTick]);

  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));
  const allBuys = deals.filter((d) => d.direction === "buy");
  const allSells = deals.filter((d) => d.direction === "sell");
  const metals: Metal[] = ["gold", "silver", "platinum", "palladium"];

  const stockData = metals.map((metal) => {
    const lots = allBuys.filter((d) => d.metal === metal);
    const soldGrams = allSells
      .filter((d) => d.metal === metal)
      .reduce((s, d) => s + d.pure_equivalent_grams, 0);
    const boughtGrams = lots.reduce((s, d) => s + d.pure_equivalent_grams, 0);
    const totalGrams = Math.max(0, boughtGrams - soldGrams);
    let totalCost = 0;
    for (const d of lots) totalCost += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
    const costRatio = boughtGrams > 0 ? totalGrams / boughtGrams : 0;
    const scaledCost = totalCost * costRatio;
    const avgCostPerOz = totalGrams > 0 ? scaledCost / (totalGrams / GRAMS_PER_OZ) : 0;
    const marketPrice = priceMap.get(METAL_SYMBOLS[metal]) ?? 0;
    const marketValue = (totalGrams / GRAMS_PER_OZ) * marketPrice;
    const unrealizedPnl = marketValue - scaledCost;
    const byStatus = (s: string) =>
      lots.filter((d) => d.status === s).reduce((sum, d) => sum + d.pure_equivalent_grams, 0);

    return {
      metal,
      totalGrams,
      avgCostPerOz,
      marketPrice,
      marketValue,
      unrealizedPnl,
      inUae: byStatus("locked") + byStatus("pending"),
      inRefinery: byStatus("in_refinery"),
      inTransit: byStatus("in_transit"),
      inHk: byStatus("in_hk"),
      lots,
    };
  });

  const fmt = (n: number) =>
    "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (selectedMetal) {
    const data = stockData.find((s) => s.metal === selectedMetal);
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold capitalize text-white">
          {selectedMetal} &mdash; Lot Details
        </h2>
        <StockDetail deals={data?.lots ?? []} onClose={() => setSelectedMetal(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stockData
        .filter((s) => s.totalGrams > 0)
        .map((s) => {
          const isLow = s.totalGrams < 5000;
          return (
            <button
              key={s.metal}
              onClick={() => setSelectedMetal(s.metal)}
              className={`w-full rounded-lg bg-gray-900 p-4 text-left outline outline-1 transition hover:bg-gray-800/80 ${
                isLow ? "outline-rose-500/30" : "outline-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold capitalize text-white">{s.metal}</span>
                  {isLow && (
                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">
                      LOW STOCK
                    </span>
                  )}
                </div>
                <span
                  className={`text-sm font-semibold ${
                    s.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {s.unrealizedPnl >= 0 ? "+" : ""}
                  {fmt(s.unrealizedPnl)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-gray-500">Total</span>
                  <p className={`font-medium ${isLow ? "text-rose-300" : "text-gray-200"}`}>
                    {s.totalGrams >= 1000
                      ? (s.totalGrams / 1000).toFixed(2) + "kg"
                      : s.totalGrams.toFixed(0) + "g"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Avg Cost</span>
                  <p className="font-medium text-gray-200">${s.avgCostPerOz.toFixed(2)}/oz</p>
                </div>
                <div>
                  <span className="text-gray-500">Market</span>
                  <p className="font-medium text-gray-200">${s.marketPrice.toFixed(2)}/oz</p>
                </div>
                <div>
                  <span className="text-gray-500">Value</span>
                  <p className="font-medium text-gray-200">{fmt(s.marketValue)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {s.inUae > 0 && (
                  <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
                    UAE {s.inUae.toFixed(0)}g
                  </span>
                )}
                {s.inRefinery > 0 && (
                  <span className="rounded-full bg-orange-400/10 px-2 py-0.5 text-[10px] text-orange-400">
                    Refinery {s.inRefinery.toFixed(0)}g
                  </span>
                )}
                {s.inTransit > 0 && (
                  <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-400">
                    Transit {s.inTransit.toFixed(0)}g
                  </span>
                )}
                {s.inHk > 0 && (
                  <span className="rounded-full bg-blue-400/10 px-2 py-0.5 text-[10px] text-blue-400">
                    HK {s.inHk.toFixed(0)}g
                  </span>
                )}
              </div>
            </button>
          );
        })}
    </div>
  );
}

// ─── Live view — tabular stock-in-hand register ────────────────────────

type LiveMetal = {
  metal: string;
  bought_fine_grams: number;
  sold_fine_grams: number;
  net_fine_grams: number;
  buy_count: number;
  sell_count: number;
  avg_buy_rate_usd_per_oz: number;
  avg_sell_rate_usd_per_oz: number;
  scaled_cost_usd: number;
  market_rate_usd_per_oz: number;
  market_value_usd: number;
  unrealized_pnl_usd: number;
};

type LiveResponse = {
  metals: LiveMetal[];
  totals: {
    total_market_value_usd: number;
    total_cost_usd: number;
    total_unrealized_pnl_usd: number;
    total_net_fine_grams: number;
  };
  generated_at: string;
};

type OpeningMetal = {
  metal: string;
  opening_grams: number;
  bought_grams: number;
  sold_grams: number;
  in_hand_grams: number;
  delta_grams: number;
  market_rate_usd_per_oz: number;
  opening_value_usd: number;
  in_hand_value_usd: number;
  delta_value_usd: number;
};

type OpeningResponse = {
  date: string;
  auto_rolled: boolean;
  set_by: string | null;
  set_at: string | null;
  metals: OpeningMetal[];
  totals: {
    opening_value_usd: number;
    in_hand_value_usd: number;
    delta_value_usd: number;
  };
  generated_at: string;
};

function formatUsd(n: number): string {
  return (
    "$" +
    n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function formatGrams(g: number): string {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g.toFixed(0)} g`;
}

const CANONICAL_METALS = new Set(["gold", "silver", "platinum", "palladium"]);

function passesFilter(metal: string, filter: MetalFilter): boolean {
  if (filter === "all") return true;
  if (filter === "other") return !CANONICAL_METALS.has(metal);
  return metal === filter;
}

function LiveView() {
  const { fy } = useFy();
  const [metalFilter, setMetalFilter] = useState<MetalFilter>("all");
  const [data, setData] = useState<LiveResponse | null>(null);
  const [opening, setOpening] = useState<OpeningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both endpoints in parallel. The opening-stock endpoint
      // drives the top bar (today's opening + today's activity — FY
      // doesn't apply, today is always in the current FY window), the
      // live-stock endpoint drives the all-time register below and
      // IS FY-filtered so past-FY views show that year's register.
      const liveParams = new URLSearchParams({
        from: fy.fromIso,
        to: fy.toIso,
      });
      const [liveRes, openingRes] = await Promise.all([
        fetch(`/api/stock/live?${liveParams.toString()}`),
        fetch("/api/stock/opening"),
      ]);
      const [liveJson, openingJson] = await Promise.all([
        liveRes.json(),
        openingRes.json(),
      ]);
      setData(liveJson);
      setOpening(openingJson);
    } catch {
      // Keep stale data on network error.
    } finally {
      setLoading(false);
    }
  }, [fy.fromIso, fy.toIso]);

  useEffect(() => {
    load();
    // 10s poll — same cadence as /deals Live. Stock changes only when
    // a new deal is approved or the market price moves, so more frequent
    // polling would just be noise.
    const poll = setInterval(load, 10_000);
    return () => clearInterval(poll);
  }, [load]);

  // Apply the metal filter client-side so toggling a pill is instant
  // and the totals reshape without a network round-trip.
  const { visibleMetals, visibleTotals } = useMemo(() => {
    const all = data?.metals ?? [];
    const filtered = all.filter((m) => passesFilter(m.metal, metalFilter));
    const totals = filtered.reduce(
      (acc, m) => {
        acc.total_market_value_usd += m.market_value_usd;
        acc.total_cost_usd += m.scaled_cost_usd;
        acc.total_unrealized_pnl_usd += m.unrealized_pnl_usd;
        acc.total_net_fine_grams += m.net_fine_grams;
        return acc;
      },
      {
        total_market_value_usd: 0,
        total_cost_usd: 0,
        total_unrealized_pnl_usd: 0,
        total_net_fine_grams: 0,
      }
    );
    return { visibleMetals: filtered, visibleTotals: totals };
  }, [data, metalFilter]);

  const filterLabel =
    metalFilter === "all"
      ? "All metals"
      : metalFilter === "other"
      ? "Other metals"
      : metalFilter.charAt(0).toUpperCase() + metalFilter.slice(1);

  function exportUrl(): string {
    const params = new URLSearchParams({
      filter: metalFilter,
      from: fy.fromIso,
      to: fy.toIso,
    });
    return `/api/stock/live/export?${params.toString()}`;
  }

  async function handleShare() {
    if (!data) return;
    const lines = [
      `PrismX — Stock In Hand`,
      `${filterLabel} · ${visibleMetals.length} metal${visibleMetals.length === 1 ? "" : "s"}`,
      `Market Value: ${formatUsd(visibleTotals.total_market_value_usd)}`,
      `Cost Basis: ${formatUsd(visibleTotals.total_cost_usd)}`,
      `Unrealized P&L: ${formatUsd(visibleTotals.total_unrealized_pnl_usd)}`,
      "",
      ...visibleMetals
        .filter((m) => m.net_fine_grams > 0)
        .map(
          (m) =>
            `• ${m.metal.charAt(0).toUpperCase() + m.metal.slice(1)}: ${formatGrams(m.net_fine_grams)} · ${formatUsd(m.market_value_usd)} (${m.unrealized_pnl_usd >= 0 ? "+" : ""}${formatUsd(m.unrealized_pnl_usd)})`
        ),
    ];
    const text = lines.join("\n");
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "PrismX Stock", text });
        setShareFeedback("Shared");
        setTimeout(() => setShareFeedback(""), 2000);
        return;
      } catch {
        // fall through
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
      <ReportLetterhead
        title="Stock In Hand — Live"
        subtitle={`${fy.label} · ${filterLabel} · as of ${data ? new Date(data.generated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "now"}`}
      />

      {/* ── Daily register: Opening editor + Stock In Hand bar ────────
          This block answers "where did we start today and where are we
          right now?" Sits above the all-time filter pills and register
          table so Niyam's eye lands on it first. */}
      {opening && (
        <>
          <OpeningStockPanel opening={opening} onSaved={load} />
          <StockInHandBar opening={opening} />
        </>
      )}

      {/* Filter + action bar — hidden in print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-gray-900 p-1">
          {(["all", "gold", "silver", "platinum", "palladium", "other"] as MetalFilter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setMetalFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  metalFilter === f
                    ? "bg-emerald-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {f === "other" ? "Other" : f}
              </button>
            )
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shareFeedback && <span className="text-xs text-emerald-400">{shareFeedback}</span>}
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

      {/* Summary stat cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Net In Hand"
            value={formatGrams(visibleTotals.total_net_fine_grams)}
            sublabel={`${visibleMetals.filter((m) => m.net_fine_grams > 0).length} metal${
              visibleMetals.filter((m) => m.net_fine_grams > 0).length === 1 ? "" : "s"
            }`}
          />
          <StatCard
            label="Market Value"
            value={formatUsd(visibleTotals.total_market_value_usd)}
            tone="emerald"
          />
          <StatCard
            label="Cost Basis"
            value={formatUsd(visibleTotals.total_cost_usd)}
            tone="amber"
          />
          <StatCard
            label="Unrealized P&L"
            value={formatUsd(visibleTotals.total_unrealized_pnl_usd)}
            tone={visibleTotals.total_unrealized_pnl_usd >= 0 ? "emerald" : "rose"}
          />
        </div>
      )}

      {/* The table */}
      <div className="overflow-x-auto rounded-lg border border-white/5 bg-gray-900 print:border-gray-300 print:bg-gray-50">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-gray-400 print:bg-gray-100 print:text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Metal</th>
              <th className="px-3 py-2 text-right font-semibold">Buys</th>
              <th className="px-3 py-2 text-right font-semibold">Sells</th>
              <th className="px-3 py-2 text-right font-semibold">Bought (g)</th>
              <th className="px-3 py-2 text-right font-semibold">Sold (g)</th>
              <th className="px-3 py-2 text-right font-semibold">Net In Hand</th>
              <th className="px-3 py-2 text-right font-semibold">Avg Cost $/oz</th>
              <th className="px-3 py-2 text-right font-semibold">Market $/oz</th>
              <th className="px-3 py-2 text-right font-semibold">Market Value</th>
              <th className="px-3 py-2 text-right font-semibold">Unrealized P&amp;L</th>
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
            {!loading && visibleMetals.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                  No holdings in this filter.
                </td>
              </tr>
            )}
            {visibleMetals.map((m) => {
              const isEmpty = m.net_fine_grams <= 0.01;
              const pnlPositive = m.unrealized_pnl_usd >= 0;
              return (
                <tr key={m.metal} className={isEmpty ? "opacity-60" : ""}>
                  <td className="px-3 py-2">
                    <span
                      className={`font-semibold capitalize print:text-black ${
                        m.metal === "gold"
                          ? "text-amber-300"
                          : m.metal === "silver"
                          ? "text-gray-200"
                          : m.metal === "platinum"
                          ? "text-blue-300"
                          : m.metal === "palladium"
                          ? "text-purple-300"
                          : "text-white"
                      }`}
                    >
                      {m.metal}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400 print:text-gray-600">
                    {m.buy_count}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400 print:text-gray-600">
                    {m.sell_count}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300 print:text-gray-700">
                    {m.bought_fine_grams.toFixed(0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300 print:text-gray-700">
                    {m.sold_fine_grams.toFixed(0)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums print:text-black ${
                      isEmpty ? "text-gray-500" : "text-white"
                    }`}
                  >
                    {formatGrams(m.net_fine_grams)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300 print:text-gray-700">
                    {m.avg_buy_rate_usd_per_oz > 0
                      ? m.avg_buy_rate_usd_per_oz.toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300 print:text-gray-700">
                    {m.market_rate_usd_per_oz > 0
                      ? m.market_rate_usd_per_oz.toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white print:text-black">
                    {formatUsd(m.market_value_usd)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      isEmpty
                        ? "text-gray-500"
                        : pnlPositive
                        ? "text-emerald-400 print:text-emerald-700"
                        : "text-rose-400 print:text-rose-700"
                    }`}
                  >
                    {isEmpty
                      ? "—"
                      : `${pnlPositive ? "+" : ""}${formatUsd(m.unrealized_pnl_usd)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Print-only footer */}
      <div className="hidden border-t border-amber-700 pt-2 text-center text-[10px] uppercase tracking-wider text-gray-600 print:block">
        PrismX · Stock In Hand Register · Confidential
      </div>
    </div>
  );
}

// ─── Stock In Hand bar ─────────────────────────────────────────────────
//
// Horizontal strip of per-metal cards always visible above the filter
// pills. Each card shows the current in-hand grams + delta from the
// morning's opening + current market value. At end of day this entire
// row becomes the closing stock that rolls forward to tomorrow's opening.

const METAL_COLORS: Record<string, string> = {
  gold: "text-amber-300",
  silver: "text-gray-200",
  platinum: "text-blue-300",
  palladium: "text-purple-300",
};

function formatGramsCompact(g: number): string {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  if (Math.abs(g) < 0.01) return "0 g";
  return `${g.toFixed(0)} g`;
}

function formatDeltaGrams(g: number): string {
  const sign = g > 0 ? "+" : g < 0 ? "−" : "±";
  const abs = Math.abs(g);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)} kg`;
  if (abs < 0.01) return "±0 g";
  return `${sign}${abs.toFixed(0)} g`;
}

function StockInHandBar({ opening }: { opening: OpeningResponse }) {
  // Only show canonical metals in the bar — they fit comfortably on
  // one line across most desktop widths. Non-canonical metals still
  // show in the all-time table below if they exist.
  const displayMetals = opening.metals.filter((m) =>
    ["gold", "silver", "platinum", "palladium"].includes(m.metal)
  );

  return (
    <section className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 animate-pulse rounded-full bg-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
            Stock In Hand
          </h2>
          <span className="text-[10px] text-gray-500">
            live · becomes today&apos;s closing at EOD
          </span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500">
          Total Value:{" "}
          <span className="font-mono text-sm font-semibold text-white">
            {formatUsd(opening.totals.in_hand_value_usd)}
          </span>
          {opening.totals.delta_value_usd !== 0 && (
            <span
              className={`ml-2 font-mono text-xs ${
                opening.totals.delta_value_usd >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {opening.totals.delta_value_usd >= 0 ? "+" : ""}
              {formatUsd(opening.totals.delta_value_usd)}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {displayMetals.map((m) => {
          const deltaUp = m.delta_grams > 0.01;
          const deltaDown = m.delta_grams < -0.01;
          return (
            <div
              key={m.metal}
              className="rounded-lg border border-white/5 bg-gray-950/60 px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    METAL_COLORS[m.metal] ?? "text-gray-300"
                  }`}
                >
                  {m.metal}
                </span>
                {deltaUp && (
                  <span className="text-[9px] font-bold uppercase text-emerald-400">
                    ↑
                  </span>
                )}
                {deltaDown && (
                  <span className="text-[9px] font-bold uppercase text-rose-400">
                    ↓
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-white">
                {formatGramsCompact(m.in_hand_grams)}
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-1">
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    deltaUp
                      ? "text-emerald-400"
                      : deltaDown
                      ? "text-rose-400"
                      : "text-gray-500"
                  }`}
                >
                  {formatDeltaGrams(m.delta_grams)}
                </span>
                <span className="text-[10px] text-gray-500">
                  {m.market_rate_usd_per_oz > 0
                    ? formatUsd(m.in_hand_value_usd)
                    : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Opening Stock editor (collapsible) ────────────────────────────────
//
// Starts collapsed because most days the user just wants the
// auto-rolled opening. Expanded it shows one input per canonical metal
// pre-filled with the current opening grams, and a "Save" button that
// POSTs the whole form back to /api/stock/opening.

function OpeningStockPanel({
  opening,
  onSaved,
}: {
  opening: OpeningResponse;
  onSaved: () => void;
}) {
  // Auto-expand on first load ONLY if today's opening was auto-rolled,
  // so Niyam is prompted to verify the rolled-forward numbers before
  // trusting them. Once the user manually saves, subsequent loads
  // stay collapsed.
  const [expanded, setExpanded] = useState(opening.auto_rolled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Draft state keyed by metal slug so the <input> is uncontrolled per
  // row. Seeded from the current opening on mount; reset whenever the
  // underlying opening response changes (e.g. after a successful save
  // reloads the parent's state).
  const canonical = useMemo(
    () =>
      opening.metals.filter((m) =>
        ["gold", "silver", "platinum", "palladium"].includes(m.metal)
      ),
    [opening.metals]
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(canonical.map((m) => [m.metal, m.opening_grams.toString()]))
  );

  // If the parent re-fetches and the opening changes (e.g. after
  // save), re-seed the draft so the inputs reflect the canonical
  // server value. The deps use opening_grams directly so we don't
  // stomp on in-flight user edits unless the numbers actually moved.
  useEffect(() => {
    setDrafts(
      Object.fromEntries(canonical.map((m) => [m.metal, m.opening_grams.toString()]))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening.date, canonical.map((m) => m.opening_grams).join("|")]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const metals = canonical.map((m) => {
        const raw = drafts[m.metal] ?? "0";
        const grams = parseFloat(raw);
        return { metal: m.metal, grams: Number.isFinite(grams) ? grams : 0 };
      });
      const res = await fetch("/api/stock/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metals }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Failed to save opening stock");
        return;
      }
      onSaved();
      setExpanded(false);
    } finally {
      setBusy(false);
    }
  }

  const setAtLabel = opening.set_at
    ? new Date(opening.set_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <section className="rounded-xl border border-white/10 bg-gray-900 print:hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-3 text-left transition hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="size-5 text-amber-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75"
            />
          </svg>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              Opening Stock
              <span className="font-mono text-[10px] text-gray-500">
                {opening.date}
              </span>
              {opening.auto_rolled ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                  Auto-rolled · verify
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                  Confirmed
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              {opening.set_by
                ? `Set by ${opening.set_by}${setAtLabel ? " at " + setAtLabel : ""}`
                : "Carried forward from yesterday's closing — click to edit"}
            </div>
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`size-4 text-gray-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-4">
          <div className="mb-3 text-[11px] text-gray-500">
            Enter today&apos;s opening stock in <span className="font-mono">fine grams</span>{" "}
            (pure equivalent). Every approved trade updates the Stock In Hand bar
            above in real-time. At end of day this rolls forward as tomorrow&apos;s
            opening automatically.
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {canonical.map((m) => (
              <div
                key={m.metal}
                className="rounded-lg border border-white/5 bg-gray-950 p-3"
              >
                <label className="mb-1 flex items-baseline justify-between">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      METAL_COLORS[m.metal] ?? "text-gray-300"
                    }`}
                  >
                    {m.metal}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-gray-600">
                    fine grams
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={drafts[m.metal] ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [m.metal]: e.target.value }))
                  }
                  className="w-full rounded border border-white/10 bg-gray-900 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-500/50 focus:outline-none"
                />
                <div className="mt-1 text-[10px] text-gray-500">
                  ≈ {(parseFloat(drafts[m.metal] ?? "0") / 1000).toFixed(3)} kg
                </div>
              </div>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save Opening Stock"}
            </button>
            <button
              onClick={() => {
                setDrafts(
                  Object.fromEntries(
                    canonical.map((m) => [m.metal, m.opening_grams.toString()])
                  )
                );
                setExpanded(false);
              }}
              disabled={busy}
              className="rounded-md border border-white/10 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Local stat card ───────────────────────────────────────────────────

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
