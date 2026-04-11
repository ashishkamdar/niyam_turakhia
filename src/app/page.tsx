"use client";

// Force dynamic so this page is never prerendered — the Live view
// depends on session-scoped data that changes every few seconds.
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState, useMemo } from "react";
import { StatCard } from "@/components/stat-card";
import { LockedDeals } from "@/components/locked-deals";
import { DemoMode } from "@/components/demo-mode";
import { FundsReceived } from "@/components/funds-received";
import { DeliveryPipeline } from "@/components/delivery-pipeline";
import { useDemo } from "@/components/demo-engine";
import { useFy } from "@/components/fy-provider";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import type { Deal, Price, MetalSymbol, Delivery, Settlement } from "@/lib/types";
import { initialsFromLabel, roleLabel } from "@/lib/user-display";

const GRAMS_PER_OZ = 31.1035;
const AED_PER_USD = 3.6725;
const METAL_MAP: Record<string, MetalSymbol> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };
const METAL_COLORS: Record<string, string> = { gold: "text-amber-400", silver: "text-gray-300", platinum: "text-blue-300", palladium: "text-purple-300" };

type Mode = "demo" | "live";

export default function DashboardPage() {
  // Live is the default — the live dashboard is the real operational
  // surface. Demo is kept as a toggle option for the Home "Start Demo"
  // flow, same pattern as /deals and /stock.
  const [mode, setMode] = useState<Mode>("live");

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">
            {mode === "demo" ? "Dashboard · Demo" : "Dashboard · Live"}
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            {mode === "demo"
              ? "Seeded demo data — use the Start Demo button to run the 25-chat simulator."
              : "Real-time snapshot of PrismX operations, staffed + financial metrics."}
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

// ─── Demo view (the original dashboard, unchanged) ────────────────────

function DemoView() {
  const { dealTick } = useDemo();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  // Refetch immediately when dealTick changes (deal locked) + poll every 3s
  useEffect(() => {
    function fetchAll() {
      fetch("/api/deals?limit=2000").then((r) => r.json()).then(setDeals).catch(() => {});
      fetch("/api/prices").then((r) => r.json()).then(setPrices).catch(() => {});
      fetch("/api/deliveries?limit=100").then((r) => r.json()).then(setDeliveries).catch(() => {});
      fetch("/api/settlements?limit=100").then((r) => r.json()).then(setSettlements).catch(() => {});
    }
    fetchAll();
    const poll = setInterval(fetchAll, 3000);
    return () => clearInterval(poll);
  }, [dealTick]); // re-run immediately when a deal locks

  const today = new Date().toISOString().split("T")[0];
  const todayDeals = deals.filter((d) => d.date.startsWith(today));
  const todayBuys = todayDeals.filter((d) => d.direction === "buy");
  const todaySells = todayDeals.filter((d) => d.direction === "sell");
  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));

  let totalBuyValue = 0, totalSellRevenue = 0;
  for (const d of todayBuys) totalBuyValue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
  for (const d of todaySells) totalSellRevenue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;

  // Realized P&L
  const allBuys = deals.filter((d) => d.direction === "buy");
  let realizedPnl = 0;
  for (const sell of todaySells) {
    const metalBuys = allBuys.filter((b) => b.metal === sell.metal);
    const totalBuyGramsForMetal = metalBuys.reduce((s, b) => s + b.pure_equivalent_grams, 0);
    const totalBuyCostForMetal = metalBuys.reduce((s, b) => s + (b.pure_equivalent_grams / GRAMS_PER_OZ) * b.price_per_oz, 0);
    const avgBuyCostPerOz = totalBuyGramsForMetal > 0 ? totalBuyCostForMetal / (totalBuyGramsForMetal / GRAMS_PER_OZ) : sell.price_per_oz;
    realizedPnl += ((sell.pure_equivalent_grams / GRAMS_PER_OZ) * sell.price_per_oz) - ((sell.pure_equivalent_grams / GRAMS_PER_OZ) * avgBuyCostPerOz);
  }

  // Stock = total bought grams - total sold grams per metal
  const allSells = deals.filter((d) => d.direction === "sell");
  const allBuyDeals = deals.filter((d) => d.direction === "buy");
  const netStockByMetal = new Map<string, { grams: number; cost: number }>();
  for (const d of allBuyDeals) {
    const existing = netStockByMetal.get(d.metal) ?? { grams: 0, cost: 0 };
    existing.grams += d.pure_equivalent_grams;
    existing.cost += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
    netStockByMetal.set(d.metal, existing);
  }
  for (const d of allSells) {
    const existing = netStockByMetal.get(d.metal) ?? { grams: 0, cost: 0 };
    existing.grams -= d.pure_equivalent_grams;
    netStockByMetal.set(d.metal, existing);
  }

  let stockValue = 0, stockCost = 0;
  for (const [metal, data] of netStockByMetal) {
    if (data.grams <= 0) continue;
    const mkt = priceMap.get(METAL_MAP[metal]) ?? 0;
    stockValue += (data.grams / GRAMS_PER_OZ) * mkt;
    // Scale cost proportionally to remaining stock
    const totalBoughtGrams = allBuyDeals.filter((d) => d.metal === metal).reduce((s, d) => s + d.pure_equivalent_grams, 0);
    const costRatio = totalBoughtGrams > 0 ? data.grams / totalBoughtGrams : 0;
    stockCost += data.cost * costRatio;
  }
  const unrealizedPnl = stockValue - stockCost;
  const unsold = allBuyDeals; // For position count display
  const totalBuyGrams = todayBuys.reduce((s, d) => s + d.quantity_grams, 0);
  const totalSellGrams = todaySells.reduce((s, d) => s + d.quantity_grams, 0);

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtAed = (n: number) => "AED " + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtG = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + "g";
  const fmtKg = (n: number) => (n / 1000).toFixed(2) + "kg";

  const todayProfit = realizedPnl; // Only today's realized — unrealized shown separately in stat cards
  const whatsappDeals = deals.filter((d) => d.created_by === "whatsapp");
  const todayWhatsapp = whatsappDeals.filter((d) => d.date.startsWith(today));

  const inTransit = deliveries.filter((d) => d.status === "in_transit").length;
  const preparing = deliveries.filter((d) => d.status === "preparing").length;
  const pendingSettlements = settlements.filter((s) => s.status === "pending").length;
  const unsettledAmount = settlements.filter((s) => s.status === "pending").reduce((s, d) => s + d.amount_received, 0);

  // Portfolio totals per metal (net: buys - sells)
  const metalHoldings: { metal: string; grams: number; color: string }[] = [];
  for (const m of ["gold", "silver", "platinum", "palladium"] as const) {
    const netGrams = netStockByMetal.get(m)?.grams ?? 0;
    if (netGrams > 0) metalHoldings.push({ metal: m, grams: netGrams, color: METAL_COLORS[m] });
  }
  const portfolioAed = stockValue * AED_PER_USD;
  const netPositionCount = metalHoldings.length;

  // Last 7 days P&L chart
  const weeklyData = useMemo(() => {
    const days: { day: string; label: string; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-GB", { weekday: "short" });

      const daySells = deals.filter((deal) => deal.direction === "sell" && deal.date.startsWith(dateStr));
      let dayProfit = 0;
      for (const sell of daySells) {
        const metalBuys = allBuys.filter((b) => b.metal === sell.metal);
        const totalG = metalBuys.reduce((s, b) => s + b.pure_equivalent_grams, 0);
        const totalC = metalBuys.reduce((s, b) => s + (b.pure_equivalent_grams / GRAMS_PER_OZ) * b.price_per_oz, 0);
        const avg = totalG > 0 ? totalC / (totalG / GRAMS_PER_OZ) : sell.price_per_oz;
        dayProfit += ((sell.pure_equivalent_grams / GRAMS_PER_OZ) * sell.price_per_oz) - ((sell.pure_equivalent_grams / GRAMS_PER_OZ) * avg);
      }
      days.push({ day: dateStr, label, profit: dayProfit });
    }
    return days;
  }, [deals, allBuys]);

  return (
    <div className="space-y-4">
      {/* Portfolio summary bar */}
      <div className="rounded-lg bg-gradient-to-r from-amber-900/20 to-amber-800/10 px-4 py-3 outline outline-1 outline-amber-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400/70">Total Portfolio</p>
            <p className="text-xl font-bold text-amber-400">{fmtAed(portfolioAed)}</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>{metalHoldings.length} metals</p>
          </div>
        </div>
        {metalHoldings.length > 0 && (
          <div className="mt-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-400/70">Stock In Hand</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {metalHoldings.map((m) => {
              const isLow = m.grams < 5000;
              return (
                <span key={m.metal} className={`flex items-center gap-1 text-xs ${isLow ? "rounded-full bg-rose-500/15 px-2 py-0.5" : ""}`}>
                  {isLow && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3 text-rose-400">
                      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={`font-medium capitalize ${isLow ? "text-rose-400" : m.color}`}>{m.metal}</span>
                  <span className={isLow ? "text-rose-300" : "text-gray-400"}>{m.grams >= 1000 ? `${(m.grams / 1000).toFixed(2)}kg` : `${m.grams.toFixed(0)}g`}</span>
                  {isLow && <span className="text-[9px] text-rose-400/70">LOW</span>}
                </span>
              );
            })}
          </div>
          </div>
        )}
      </div>

      <DemoMode />

      {/* Hero profit card */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-5 outline outline-1 outline-white/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-emerald-400" />
              <p className="text-xs font-medium text-gray-400">Today&apos;s Profit</p>
            </div>
            <p className={`mt-2 text-4xl font-bold tracking-tight sm:text-5xl ${todayProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {todayProfit >= 0 ? "+" : "-"}{fmt(Math.abs(todayProfit))}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {todayDeals.length} deals today &mdash; {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          {todayWhatsapp.length > 0 && (
            <div className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{todayWhatsapp.length}</p>
              <p className="text-[9px] text-emerald-400/70">WhatsApp</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly P&L chart */}
      {weeklyData.some((d) => d.profit !== 0) && (
        <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Last 7 Days Realized P&L</h2>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, i) => (
                    <Cell key={i} fill={entry.profit >= 0 ? "#34d399" : "#fb7185"} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <LockedDeals />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Today's Buys" value={fmt(totalBuyValue)} sublabel={`${todayBuys.length} deals | ${fmtG(totalBuyGrams)}`} />
        <StatCard label="Today's Sales" value={fmt(totalSellRevenue)} sublabel={`${todaySells.length} deals | ${fmtG(totalSellGrams)}`} />
        <StatCard label="Stock Value" value={fmt(stockValue)} sublabel={`${metalHoldings.length} metals`} />
        <StatCard label="Unrealized P&L" value={fmt(unrealizedPnl)} change={unrealizedPnl >= 0 ? `+${fmt(unrealizedPnl)}` : fmt(unrealizedPnl)} changeType={unrealizedPnl >= 0 ? "positive" : "negative"} sublabel="vs avg cost" />
      </div>

      <DeliveryPipeline />

      <FundsReceived />

      {/* Delivery & Settlement pipeline */}
      {(inTransit > 0 || preparing > 0 || pendingSettlements > 0) && (
        <div className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {preparing > 0 && (
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="size-1.5 rounded-full bg-gray-400" />
                {preparing} preparing
              </span>
            )}
            {inTransit > 0 && (
              <span className="flex items-center gap-1.5 text-yellow-400">
                <span className="size-1.5 animate-pulse rounded-full bg-yellow-400" />
                {inTransit} in transit to HK
              </span>
            )}
            {pendingSettlements > 0 && (
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="size-1.5 rounded-full bg-blue-400" />
                {pendingSettlements} pending settlements
                {unsettledAmount > 0 && <span className="text-white font-medium">(${unsettledAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recent activity with metal colors */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Activity</h2>
        <div className="space-y-2">
          {deals.slice(0, 10).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-900 px-3 py-3 outline outline-1 outline-white/10">
              <div className="flex items-center gap-2.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{d.direction.toUpperCase()}</span>
                <span className={`text-sm font-medium capitalize ${METAL_COLORS[d.metal] ?? "text-white"}`}>{d.metal}</span>
                <span className="text-xs text-gray-500">{d.purity} | {d.quantity_grams.toFixed(0)}g</span>
              </div>
              <span className="text-sm font-medium text-gray-300">${d.price_per_oz.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Live view ─────────────────────────────────────────────────────────
//
// Rich operations dashboard pulling from every "live" endpoint in the
// app. Cards are grouped into rows so at any given screen width the
// user can read one row at a time top-to-bottom.
//
// Role gating: trading P&L cards (Revenue / Cost / Realized PnL /
// Unrealized PnL) only render when the current user is admin or
// super_admin. Staff see everything else — inbound volume, stock in
// hand, queue counts, active-user counter, recent activity feed.
//
// FY-aware: every query that accepts a date window uses the currently
// selected FY from useFy(). Stock In Hand deliberately doesn't — it's
// a "right now" snapshot, always in the current FY by definition.

type LiveDeal = {
  id: string;
  sender_name: string;
  received_at: string;
  reviewed_at: string | null;
  deal_type: "K" | "P" | null;
  direction: "buy" | "sell" | null;
  metal: string | null;
  purity: string | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  party_alias: string | null;
  amount_usd: number;
  dispatched_at: string | null;
  dispatched_to: string | null;
};

type LiveDealsResponse = {
  deals: LiveDeal[];
  count: number;
  totals: { buy_count: number; sell_count: number; buy_usd: number; sell_usd: number };
};

type OpeningMetal = {
  metal: string;
  opening_grams: number;
  bought_grams: number;
  sold_grams: number;
  in_hand_grams: number;
  delta_grams: number;
  market_rate_usd_per_oz: number;
  in_hand_value_usd: number;
};

type OpeningResponse = {
  date: string;
  metals: OpeningMetal[];
  totals: { in_hand_value_usd: number };
};

type LiveStockResponse = {
  metals: Array<{
    metal: string;
    net_fine_grams: number;
    market_value_usd: number;
    unrealized_pnl_usd: number;
  }>;
  totals: {
    total_market_value_usd: number;
    total_cost_usd: number;
    total_unrealized_pnl_usd: number;
    total_net_fine_grams: number;
  };
};

type ReviewResponse = {
  counts: { pending: number; approved: number; rejected: number; ignored: number };
};

type DispatchResponse = {
  pakka_outbox: Array<{ id: string }>;
  kachha_outbox: Array<{ id: string }>;
  history: Array<{ dispatched_at: string | null }>;
};

type SessionsResponse = { active_count: number };
type AuthResponse = { authenticated: boolean; label?: string; role?: string };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Today in IST as a YYYY-MM-DD string — matches the boundary used by
// /api/stock/opening so the dashboard's "today" card and the stock
// page's opening stock speak about the same business day.
function istTodayPrefix(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function isTodayIst(iso: string | null): boolean {
  if (!iso) return false;
  const istStr = new Date(new Date(iso).getTime() + IST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  return istStr === istTodayPrefix();
}

function formatUsd(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function formatGrams(g: number): string {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  if (Math.abs(g) < 0.01) return "0 g";
  return `${g.toFixed(0)} g`;
}

function LiveView() {
  const { fy } = useFy();
  const [liveDeals, setLiveDeals] = useState<LiveDealsResponse | null>(null);
  const [opening, setOpening] = useState<OpeningResponse | null>(null);
  const [liveStock, setLiveStock] = useState<LiveStockResponse | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [dispatch, setDispatch] = useState<DispatchResponse | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [me, setMe] = useState<AuthResponse | null>(null);

  const load = useCallback(async () => {
    const fyParams = new URLSearchParams({ from: fy.fromIso, to: fy.toIso });
    try {
      const [dealsRes, openingRes, stockRes, reviewRes, dispatchRes, sessionsRes, meRes] =
        await Promise.all([
          fetch(`/api/deals/live?${fyParams.toString()}`),
          fetch("/api/stock/opening"),
          fetch(`/api/stock/live?${fyParams.toString()}`),
          fetch("/api/review?status=pending&limit=1"),
          fetch("/api/dispatch"),
          fetch("/api/sessions"),
          fetch("/api/auth"),
        ]);
      const [dealsJson, openingJson, stockJson, reviewJson, dispatchJson, sessionsJson, meJson] =
        await Promise.all([
          dealsRes.json(),
          openingRes.json(),
          stockRes.json(),
          reviewRes.json(),
          dispatchRes.json(),
          sessionsRes.json(),
          meRes.json(),
        ]);
      setLiveDeals(dealsJson);
      setOpening(openingJson);
      setLiveStock(stockJson);
      setReview(reviewJson);
      setDispatch(dispatchJson);
      setSessions(sessionsJson);
      setMe(meJson);
    } catch {
      // keep stale state on network error
    }
  }, [fy.fromIso, fy.toIso]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 10_000);
    return () => clearInterval(poll);
  }, [load]);

  // Today's subset of FY deals — computed client-side so we don't need
  // a second round-trip for the "today" cards.
  const fyDealsList = liveDeals?.deals ?? [];
  const todayDeals = useMemo(
    () =>
      fyDealsList.filter((d) => isTodayIst(d.reviewed_at) || isTodayIst(d.received_at)),
    [fyDealsList]
  );

  const todayBuys = todayDeals.filter((d) => d.direction === "buy");
  const todaySells = todayDeals.filter((d) => d.direction === "sell");
  const todayBuyUsd = todayBuys.reduce((s, d) => s + d.amount_usd, 0);
  const todaySellUsd = todaySells.reduce((s, d) => s + d.amount_usd, 0);
  const todayBuyGrams = todayBuys.reduce((s, d) => s + (d.qty_grams ?? 0), 0);
  const todaySellGrams = todaySells.reduce((s, d) => s + (d.qty_grams ?? 0), 0);
  const todayRealizedPnl = todaySellUsd - todayBuyUsd;

  const fyRealizedPnl = (liveDeals?.totals.sell_usd ?? 0) - (liveDeals?.totals.buy_usd ?? 0);

  // Kachha / Pakka split over the FY.
  const fyKachha = fyDealsList.filter((d) => d.deal_type === "K").length;
  const fyPakka = fyDealsList.filter((d) => d.deal_type === "P").length;
  const fyTotal = fyDealsList.length;

  // Grams volume by metal over the FY — used for the mini bar chart.
  const volumeByMetal = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of fyDealsList) {
      const key = (d.metal ?? "other").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + (d.qty_grams ?? 0));
    }
    return Array.from(map.entries())
      .map(([metal, grams]) => ({ metal, grams }))
      .sort((a, b) => b.grams - a.grams);
  }, [fyDealsList]);

  // Action queue counters — all non-sensitive, shown to every role.
  const pendingReviewCount = review?.counts.pending ?? 0;
  const outboxCount = (dispatch?.pakka_outbox.length ?? 0) + (dispatch?.kachha_outbox.length ?? 0);
  const dispatchedTodayCount = useMemo(
    () => (dispatch?.history ?? []).filter((h) => isTodayIst(h.dispatched_at)).length,
    [dispatch]
  );
  const activeUsersCount = sessions?.active_count ?? 0;

  const role = me?.role ?? "staff";
  const isPrivileged = role === "admin" || role === "super_admin";

  // Top counterparties by deal count across the FY — shown to everyone
  // (volume/count only, no $ amounts so staff can see it too).
  const topParties = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of fyDealsList) {
      const party = d.party_alias ?? d.sender_name ?? "?";
      map.set(party, (map.get(party) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([party, count]) => ({ party, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [fyDealsList]);

  return (
    <div className="space-y-4">
      {/* ── Welcome bar with current user context ──────────────────── */}
      {me?.authenticated && me.label && (
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-gradient-to-r from-gray-900 to-gray-900/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-full text-sm font-bold ring-1 ${
                role === "super_admin"
                  ? "bg-violet-500/15 text-violet-200 ring-violet-400/40"
                  : role === "admin"
                  ? "bg-amber-500/15 text-amber-200 ring-amber-400/40"
                  : "bg-gray-500/15 text-gray-200 ring-gray-400/40"
              }`}
            >
              {initialsFromLabel(me.label)}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                Welcome back, {me.label}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">
                {roleLabel(role)} · {fy.label}
              </div>
            </div>
          </div>
          <div className="hidden text-right text-xs text-gray-400 sm:block">
            <div className="font-semibold text-white">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="text-[10px] text-gray-500">
              {new Date().toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Action queue row ──────────────────────────────────────── */}
      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Operational Queue
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Pending Review"
            value={pendingReviewCount.toString()}
            sublabel={pendingReviewCount > 0 ? "needs a checker" : "all clear"}
            changeType={pendingReviewCount > 0 ? "negative" : "positive"}
          />
          <StatCard
            label="In Outbox"
            value={outboxCount.toString()}
            sublabel="approved · awaiting dispatch"
          />
          <StatCard
            label="Dispatched Today"
            value={dispatchedTodayCount.toString()}
            sublabel="delivered to OroSoft / SBS"
          />
          <StatCard
            label="Active Users"
            value={activeUsersCount.toString()}
            sublabel="online in last 2 min"
          />
        </div>
      </div>

      {/* ── Today's activity row ──────────────────────────────────── */}
      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Today&apos;s Activity
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Deals Today"
            value={todayDeals.length.toString()}
            sublabel={`${todayBuys.length} buy · ${todaySells.length} sell`}
          />
          <StatCard
            label="Buys Today"
            value={formatGrams(todayBuyGrams)}
            sublabel={`${todayBuys.length} deal${todayBuys.length === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Sells Today"
            value={formatGrams(todaySellGrams)}
            sublabel={`${todaySells.length} deal${todaySells.length === 1 ? "" : "s"}`}
          />
          <StatCard
            label={`${fy.label} Deals`}
            value={fyTotal.toString()}
            sublabel={`${fyKachha} Kachha · ${fyPakka} Pakka`}
          />
        </div>
      </div>

      {/* ── Stock In Hand strip ──────────────────────────────────── */}
      {opening && (
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Stock In Hand
            <span className="ml-2 text-[10px] font-normal normal-case text-gray-600">
              from today&apos;s opening + live activity
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {opening.metals
              .filter((m) => ["gold", "silver", "platinum", "palladium"].includes(m.metal))
              .map((m) => {
                const up = m.delta_grams > 0.01;
                const down = m.delta_grams < -0.01;
                return (
                  <div
                    key={m.metal}
                    className="rounded-lg border border-white/5 bg-gray-900 p-4"
                  >
                    <div className="flex items-baseline justify-between">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          METAL_COLORS[m.metal] ?? "text-gray-300"
                        }`}
                      >
                        {m.metal}
                      </span>
                      {up && <span className="text-[9px] font-bold text-emerald-400">↑</span>}
                      {down && <span className="text-[9px] font-bold text-rose-400">↓</span>}
                    </div>
                    <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                      {formatGrams(m.in_hand_grams)}
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between text-[10px]">
                      <span
                        className={
                          up
                            ? "text-emerald-400"
                            : down
                            ? "text-rose-400"
                            : "text-gray-500"
                        }
                      >
                        {up ? "+" : down ? "−" : "±"}
                        {formatGrams(Math.abs(m.delta_grams))}
                      </span>
                      <span className="text-gray-500">
                        {m.market_rate_usd_per_oz > 0 ? formatUsd(m.in_hand_value_usd) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Financial metrics row (admin + super_admin only) ──────── */}
      {isPrivileged && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Trading P&amp;L
            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
              Admin only
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Today's Revenue"
              value={formatUsd(todaySellUsd)}
              sublabel={`${todaySells.length} sells`}
              changeType="positive"
            />
            <StatCard
              label="Today's Cost"
              value={formatUsd(todayBuyUsd)}
              sublabel={`${todayBuys.length} buys`}
              changeType="neutral"
            />
            <StatCard
              label="Realized P&L Today"
              value={formatUsd(todayRealizedPnl)}
              change={todayRealizedPnl >= 0 ? `+${formatUsd(todayRealizedPnl)}` : formatUsd(todayRealizedPnl)}
              changeType={todayRealizedPnl >= 0 ? "positive" : "negative"}
              sublabel="sells − buys"
            />
            <StatCard
              label={`Realized P&L ${fy.label}`}
              value={formatUsd(fyRealizedPnl)}
              change={fyRealizedPnl >= 0 ? `+${formatUsd(fyRealizedPnl)}` : formatUsd(fyRealizedPnl)}
              changeType={fyRealizedPnl >= 0 ? "positive" : "negative"}
              sublabel="year-to-date"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Unrealized P&L"
              value={formatUsd(liveStock?.totals.total_unrealized_pnl_usd ?? 0)}
              change={
                (liveStock?.totals.total_unrealized_pnl_usd ?? 0) >= 0
                  ? `+${formatUsd(liveStock?.totals.total_unrealized_pnl_usd ?? 0)}`
                  : formatUsd(liveStock?.totals.total_unrealized_pnl_usd ?? 0)
              }
              changeType={
                (liveStock?.totals.total_unrealized_pnl_usd ?? 0) >= 0 ? "positive" : "negative"
              }
              sublabel="stock vs avg cost"
            />
            <StatCard
              label="Stock Value"
              value={formatUsd(liveStock?.totals.total_market_value_usd ?? 0)}
              sublabel="at current market"
            />
            <StatCard
              label="Cost Basis"
              value={formatUsd(liveStock?.totals.total_cost_usd ?? 0)}
              sublabel="remaining stock"
            />
            <StatCard
              label="Avg Deal Size"
              value={
                fyTotal > 0
                  ? formatUsd(
                      ((liveDeals?.totals.buy_usd ?? 0) + (liveDeals?.totals.sell_usd ?? 0)) /
                        fyTotal
                    )
                  : "—"
              }
              sublabel={`${fyTotal} deal${fyTotal === 1 ? "" : "s"}`}
            />
          </div>
        </div>
      )}

      {/* ── Analytics row: Kachha/Pakka + Metal volume + Top parties ── */}
      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {fy.label} Analytics
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Kachha vs Pakka split */}
          <div className="rounded-lg border border-white/5 bg-gray-900 p-4">
            <div className="mb-3 text-xs font-semibold text-white">Kachha vs Pakka</div>
            <div className="space-y-2">
              <SplitBar
                label="Kachha"
                count={fyKachha}
                total={fyTotal}
                color="bg-sky-500"
                textColor="text-sky-300"
              />
              <SplitBar
                label="Pakka"
                count={fyPakka}
                total={fyTotal}
                color="bg-emerald-500"
                textColor="text-emerald-300"
              />
            </div>
          </div>
          {/* Volume by metal — grams only, no $ */}
          <div className="rounded-lg border border-white/5 bg-gray-900 p-4">
            <div className="mb-3 text-xs font-semibold text-white">
              Volume by Metal (grams)
            </div>
            {volumeByMetal.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500">No activity yet</div>
            ) : (
              <div className="space-y-2">
                {volumeByMetal.slice(0, 4).map((v) => {
                  const max = volumeByMetal[0].grams;
                  const pct = max > 0 ? (v.grams / max) * 100 : 0;
                  return (
                    <div key={v.metal}>
                      <div className="mb-0.5 flex items-baseline justify-between text-[10px]">
                        <span
                          className={`font-semibold capitalize ${
                            METAL_COLORS[v.metal] ?? "text-gray-300"
                          }`}
                        >
                          {v.metal}
                        </span>
                        <span className="font-mono text-gray-400 tabular-nums">
                          {formatGrams(v.grams)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-full ${
                            v.metal === "gold"
                              ? "bg-amber-500"
                              : v.metal === "silver"
                              ? "bg-gray-400"
                              : v.metal === "platinum"
                              ? "bg-blue-400"
                              : v.metal === "palladium"
                              ? "bg-purple-400"
                              : "bg-gray-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Top counterparties */}
          <div className="rounded-lg border border-white/5 bg-gray-900 p-4">
            <div className="mb-3 text-xs font-semibold text-white">Top Counterparties</div>
            {topParties.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500">No activity yet</div>
            ) : (
              <ul className="space-y-2">
                {topParties.map((p, i) => (
                  <li key={p.party} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-gray-300">
                      <span className="flex size-5 items-center justify-center rounded-full bg-white/5 text-[9px] font-bold text-gray-500">
                        {i + 1}
                      </span>
                      <span className="truncate font-semibold text-white">
                        {p.party}
                      </span>
                    </span>
                    <span className="tabular-nums text-gray-400">
                      {p.count} deal{p.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent activity feed ──────────────────────────────────── */}
      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Recent Trades
        </h2>
        <div className="overflow-hidden rounded-lg border border-white/5 bg-gray-900">
          <ul className="divide-y divide-white/5">
            {fyDealsList.slice(0, 10).map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      d.deal_type === "P"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-sky-500/10 text-sky-300"
                    }`}
                  >
                    {d.deal_type === "P" ? "PAKKA" : "KACHHA"}
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      d.direction === "sell" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {(d.direction ?? "—").toUpperCase()}
                  </span>
                  <span
                    className={`text-xs font-semibold capitalize ${
                      METAL_COLORS[d.metal ?? ""] ?? "text-gray-300"
                    }`}
                  >
                    {d.metal ?? "?"}
                    {d.purity ? <span className="ml-1 text-gray-500">{d.purity}</span> : null}
                  </span>
                  <span className="truncate text-xs text-gray-400">
                    {d.party_alias ?? d.sender_name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono tabular-nums text-white">
                    {formatGrams(d.qty_grams ?? 0)}
                  </span>
                  {isPrivileged && (
                    <span className="font-mono tabular-nums text-gray-400">
                      {formatUsd(d.amount_usd)}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {fyDealsList.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-500">
                No approved trades in {fy.label} yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers used only by LiveView ────────────────────────────────────

function SplitBar({
  label,
  count,
  total,
  color,
  textColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  textColor: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between text-[11px]">
        <span className={`font-semibold ${textColor}`}>{label}</span>
        <span className="tabular-nums text-gray-400">
          {count} · {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
