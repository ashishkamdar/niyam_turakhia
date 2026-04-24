"use client";

/**
 * /outbox — Final step of the trade lifecycle.
 *
 * Approved deals from the review queue are dispatched here:
 *   • Pakka (deal_type='P') → OroSoft Neo via API (simulated)
 *   • Kachha (deal_type='K') → SBS via Excel export
 *
 * Niyam's demo hook: Indian customers don't pay until they can *see*
 * their trade hit the destination system. This page is that confirmation
 * surface. It has to feel production-ready even though OroSoft's API
 * doesn't exist yet and the SBS template is still being finalized.
 *
 * The page is split into two mirrored columns — one per destination —
 * each with a queue, a "Send All" button, an animated flow visual, and
 * an audit trail. Below both is a unified dispatch history timeline.
 */

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";

type Deal = {
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
  premium_type: "absolute" | "percent" | null;
  premium_value: number | null;
  party_alias: string | null;
  dispatched_at: string | null;
  dispatched_to: string | null;
  dispatch_response: string | null;
  dispatch_batch_id: string | null;
};

type Lock = {
  started_at: string;
  started_by: string;
  target: "orosoft" | "sbs";
  deal_count: number;
  expires_at: string;
};

type SyncLogEntry = {
  id: number;
  sync_ref: string;
  timestamp: string;
  target: "orosoft" | "sbs";
  deal_count: number;
  deal_ids: string[];
  batch_id: string;
  request_summary: string;
  http_status: number | null;
  response_body: string | null;
  status: "success" | "failed" | "partial";
  error_message: string | null;
  sent_by: string | null;
};

type DispatchResponse = {
  pakka_outbox: Deal[];
  kachha_outbox: Deal[];
  history: Deal[];
  lock: Lock | null;
  sync_log: SyncLogEntry[];
};

type Target = "orosoft" | "sbs";

// Labels shared by both destination panels. Keeping them in one table
// makes it trivial to retitle ("OroSoft Neo" → "OroSoft v2" etc) without
// hunting through JSX.
const TARGET_META: Record<Target, {
  title: string;
  subtitle: string;
  type: "P" | "K";
  acronym: string;
  destLabel: string;
  wayLabel: string;
  accent: string;
  accentRing: string;
  accentText: string;
  accentBg: string;
}> = {
  orosoft: {
    title: "OroSoft Neo",
    subtitle: "Pakka deals — live API",
    type: "P",
    acronym: "API",
    destLabel: "OroSoft",
    wayLabel: "via REST API",
    accent: "from-emerald-500/30 to-emerald-400/5",
    accentRing: "ring-emerald-400/40",
    accentText: "text-emerald-300",
    accentBg: "bg-emerald-500/10",
  },
  sbs: {
    title: "SBS",
    subtitle: "Kachha deals — live API",
    type: "K",
    acronym: "API",
    destLabel: "SBS",
    wayLabel: "via REST API",
    accent: "from-sky-500/30 to-sky-400/5",
    accentRing: "ring-sky-400/40",
    accentText: "text-sky-300",
    accentBg: "bg-sky-500/10",
  },
};

const GRAMS_PER_TROY_OZ = 31.1034768;

function formatDealLine(d: Deal): string {
  const dir = d.direction === "sell" ? "SELL" : d.direction === "buy" ? "BUY" : "—";
  const qty = d.qty_grams ? `${d.qty_grams.toFixed(0)}g` : "?g";
  const metal = (d.metal ?? "?").toUpperCase();
  const purity = d.purity ? ` ${d.purity}` : "";
  const rate = d.rate_usd_per_oz ? `@${d.rate_usd_per_oz.toFixed(2)}` : "@?";
  return `${dir} ${qty} ${metal}${purity} ${rate}`;
}

function formatAmount(d: Deal): string {
  if (!d.qty_grams || !d.rate_usd_per_oz) return "—";
  const fineOz = d.qty_grams / GRAMS_PER_TROY_OZ;
  return "$" + (fineOz * d.rate_usd_per_oz).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OutboxPage() {
  const [data, setData] = useState<DispatchResponse>({
    pakka_outbox: [],
    kachha_outbox: [],
    history: [],
    lock: null,
    sync_log: [],
  });
  // Current user's label — used to decide whether the dispatch lock
  // belongs to us (don't disable our own buttons) or to another
  // operator (disable ours + show "waiting" copy).
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated && d.label) setCurrentLabel(d.label);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dispatch");
      const json = await res.json();
      setData(json);
    } catch {
      // Silent — stale UI is fine, the poll will catch up next tick.
    }
  }, []);

  useEffect(() => {
    load();
    // 2s poll so the in-progress lock held by another user is reflected
    // on this page's buttons with minimal lag (the banner in the layout
    // polls at the same cadence).
    const poll = setInterval(load, 2000);
    return () => clearInterval(poll);
  }, [load]);

  // A lock belongs to "someone else" when it exists AND its started_by
  // doesn't match the current user. Own-lock dispatches let the user
  // continue to interact normally with their local /outbox animation.
  const othersLock =
    data.lock && data.lock.started_by !== currentLabel ? data.lock : null;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-white">Outbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Approved trades waiting to be pushed to{" "}
          <span className="font-semibold text-emerald-300">OroSoft</span> (Pakka · API) or{" "}
          <span className="font-semibold text-sky-300">SBS</span> (Kachha · API).
          This is where the lifecycle ends — once a trade lands here,
          it&apos;s a quotable, invoice-ready line item.
        </p>
      </header>

      {/* ── Two destination panels ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DestinationPanel
          target="orosoft"
          queue={data.pakka_outbox}
          dispatched={data.history.filter((d) => d.dispatched_to === "orosoft")}
          othersLock={othersLock}
          onDispatched={load}
        />
        <DestinationPanel
          target="sbs"
          queue={data.kachha_outbox}
          dispatched={data.history.filter((d) => d.dispatched_to === "sbs")}
          othersLock={othersLock}
          onDispatched={load}
        />
      </div>

      {/* ── History timeline ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Dispatches</h2>
        {data.history.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-gray-900 p-6 text-center text-sm text-gray-500">
            Nothing has been dispatched yet. Approved trades will appear here once sent.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/5 bg-gray-900">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Target</th>
                  <th className="px-4 py-2 text-left font-semibold">Deal</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold">Party</th>
                  <th className="px-4 py-2 text-left font-semibold">Response</th>
                  <th className="px-4 py-2 text-left font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.history.map((d) => {
                  const target: Target = d.dispatched_to === "orosoft" ? "orosoft" : "sbs";
                  const meta = TARGET_META[target];
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.accentBg} ${meta.accentText}`}>
                          <span className={`size-1.5 rounded-full ${target === "orosoft" ? "bg-emerald-400" : "bg-sky-400"}`} />
                          {meta.destLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-300">
                        {formatDealLine(d)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-white tabular-nums">
                        {formatAmount(d)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {d.party_alias ?? d.sender_name}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {d.dispatch_response ?? ""}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {timeAgo(d.dispatched_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sync Log ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          Sync Log
          <span className="text-xs font-normal text-gray-500">
            · every API call to SBS / OroSoft
          </span>
        </h2>
        {data.sync_log.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-gray-900 p-6 text-center text-sm text-gray-500">
            No syncs yet. Each &quot;Send all&quot; creates a numbered sync entry here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/5 bg-gray-900">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Sync #</th>
                  <th className="px-4 py-2 text-left font-semibold">Time</th>
                  <th className="px-4 py-2 text-left font-semibold">Target</th>
                  <th className="px-4 py-2 text-right font-semibold">Deals</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-left font-semibold">Response</th>
                  <th className="px-4 py-2 text-left font-semibold">Sent By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.sync_log.map((s) => {
                  const targetMeta = TARGET_META[s.target];
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2">
                        <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                          {s.sync_ref}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {new Date(s.timestamp).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${targetMeta.accentBg} ${targetMeta.accentText}`}>
                          <span className={`size-1.5 rounded-full ${s.target === "orosoft" ? "bg-emerald-400" : "bg-sky-400"}`} />
                          {targetMeta.destLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-white">
                        {s.deal_count}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            s.status === "success"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : s.status === "failed"
                              ? "bg-rose-500/10 text-rose-300"
                              : "bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {s.status}
                        </span>
                        {s.http_status && (
                          <span className="ml-1.5 font-mono text-[10px] text-gray-500">
                            HTTP {s.http_status}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[300px] truncate px-4 py-2 text-xs text-gray-500">
                        {s.error_message ?? s.response_body ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {s.sent_by ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Developer Info (collapsible) ─────────────────────────────── */}
      <DeveloperInfo />
    </div>
  );
}

// ─── DeveloperInfo ──────────────────────────────────────────────────────

function DeveloperInfo() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadInfo() {
    if (info) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orosoft/test");
      const d = await res.json();
      setInfo(d);
    } catch {
      setInfo({ ok: false, error: "Failed to load" });
    }
    setLoading(false);
  }

  return (
    <section className="print:hidden">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) loadInfo(); }}
        className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-gray-900 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-white/5"
      >
        <span className="flex items-center gap-2">
          Developer Info
          <span className="text-xs font-normal text-gray-500">
            · OroSoft NeoConnect field mappings & connection status
          </span>
        </span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="mt-3 space-y-4 rounded-lg border border-white/5 bg-gray-900 p-4">
          {loading ? (
            <div className="text-center text-sm text-gray-500">Loading OroSoft data…</div>
          ) : info ? (
            <>
              {/* Connection */}
              <div className="rounded-md border border-white/5 bg-gray-950 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Connection Status
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    info.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                  }`}>
                    Auth: {info.ok ? "Connected" : "Failed"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    info.enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
                  }`}>
                    Dispatch: {info.enabled ? "Enabled (Live)" : "Disabled (Simulated)"}
                  </span>
                  {Boolean(info.ok) && typeof info.accounts === "object" && info.accounts !== null && "total" in (info.accounts as Record<string, unknown>) && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400">
                      {String((info.accounts as Record<string, unknown>).customers)} customers · {String((info.accounts as Record<string, unknown>).suppliers)} suppliers
                    </span>
                  )}
                </div>
                {!info.ok && info.error ? (
                  <p className="mt-2 text-xs text-rose-400">{String(info.error)}</p>
                ) : null}
              </div>

              {/* Field Mapping */}
              <div className="rounded-md border border-white/5 bg-gray-950 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  FixingTrade Field Mapping (PrismX → NeoConnect)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="pb-1 text-left font-semibold">PrismX Field</th>
                        <th className="pb-1 text-left font-semibold">NeoConnect Field</th>
                        <th className="pb-1 text-left font-semibold">Required</th>
                        <th className="pb-1 text-left font-semibold">Transformation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {[
                        ["party_alias", "accountCode", "Yes", "Lookup parties.orosoft_party_code by alias match"],
                        ["metal", "cmdtyPair", "Yes", "gold→XAUUSD, silver→XAGUSD, platinum→XPTUSD, palladium→XPDUSD"],
                        ["direction", "deal", "Yes", "buy→1, sell→0"],
                        ["qty_grams", "piecesQty", "Yes", "Convert to stockCode unit (÷1000 for KG, ÷31.1035 for OZ)"],
                        ["rate_usd_per_oz", "price", "Yes", "Direct (max 7 decimals)"],
                        ["purity", "stockCode", "Yes", "24K/9999→KG 4X9, 995→KG 995, default→OZ"],
                        ["premium_value", "prmRate", "No", "Direct pass-through"],
                        ["premium_type", "prmRateType", "No", "absolute→OZ"],
                        ["received_at", "docDate", "No", "YYYYMMDD format"],
                        ["—", "valueDate", "No", "Default: T+2 (OroSoft default)"],
                        ["deal id", "referenceNo", "No", "PX-{id first 8 chars}"],
                        ["—", "documentType", "No", "FCT (Fixing Confirm Trade)"],
                        ["—", "priceType", "No", "OZ (price per troy ounce)"],
                      ].map(([px, nc, req, transform], i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-mono text-amber-300/80">{px}</td>
                          <td className="py-1.5 font-mono text-emerald-300/80">{nc}</td>
                          <td className="py-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              req === "Yes" ? "bg-rose-500/10 text-rose-300" : "bg-white/5 text-gray-500"
                            }`}>{req}</span>
                          </td>
                          <td className="py-1.5 text-gray-400">{transform}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OroSoft Customer Accounts */}
              {info.ok && typeof info.accounts === "object" && info.accounts !== null && "customer_list" in (info.accounts as Record<string, unknown>) && (
                <div className="rounded-md border border-white/5 bg-gray-950 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    OroSoft Customer Accounts (for accountCode mapping)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="pb-1 text-left font-semibold">Account Code</th>
                          <th className="pb-1 text-left font-semibold">Account Name</th>
                          <th className="pb-1 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-300">
                        {((info.accounts as Record<string, unknown>).customer_list as Array<{ code: string; name: string; active: boolean }>)?.map((a) => (
                          <tr key={a.code}>
                            <td className="py-1 font-mono text-emerald-300/80">{a.code}</td>
                            <td className="py-1">{a.name}</td>
                            <td className="py-1">
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                a.active ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                              }`}>{a.active ? "Active" : "Inactive"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Fixing Stock Codes */}
              {info.ok && Array.isArray(info.fixing_stocks) && (
                <div className="rounded-md border border-white/5 bg-gray-950 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Fixing Stock Codes (for stockCode mapping)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(info.fixing_stocks as Array<{ commodity: string; stockCode: string; convFactor: number }>).map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs">
                        <span className="font-semibold text-amber-300">{s.commodity}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-mono text-white">{s.stockCode}</span>
                        <span className="text-gray-600">(×{s.convFactor})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Locations */}
              {info.ok && Array.isArray(info.locations) && (
                <div className="rounded-md border border-white/5 bg-gray-950 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Locations
                  </div>
                  <div className="flex gap-2">
                    {(info.locations as Array<{ locationCode: string; locationName: string }>).map((l) => (
                      <span key={l.locationCode} className="rounded bg-white/5 px-2 py-1 text-xs">
                        <span className="font-mono text-emerald-300/80">{l.locationCode}</span>
                        <span className="ml-1 text-gray-400">{l.locationName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ─── DestinationPanel ───────────────────────────────────────────────────
//
// Generic over OroSoft or SBS. The visual hero at the top swaps based on
// `target` — OroSoft shows a REST API pipeline, SBS shows a live Excel
// sheet with rows being appended.

function DestinationPanel({
  target,
  queue,
  dispatched,
  othersLock,
  onDispatched,
}: {
  target: Target;
  queue: Deal[];
  dispatched: Deal[];
  othersLock: Lock | null;
  onDispatched: () => void;
}) {
  const meta = TARGET_META[target];
  // "Blocked" = another user is currently dispatching (to either
  // target). We disable BOTH panels' Send buttons while that's
  // happening, not just the panel that matches the other user's
  // target. The point is "one dispatch at a time across the whole
  // app" so operators can't step on each other.
  const blocked = othersLock !== null;
  // One of: idle | sending | done
  const [phase, setPhase] = useState<"idle" | "sending" | "done">("idle");
  const [lastBatch, setLastBatch] = useState<{
    id: string | null;
    count: number;
    response: string;
    deals: Deal[];
  } | null>(null);

  // Track the "stage" through the fake pipeline animation so we can show
  // progress checkmarks. Each stage takes ~600ms so the full sequence
  // runs in about 2 seconds — long enough to feel real, short enough
  // that Niyam isn't tapping his foot.
  const [stage, setStage] = useState(0);
  const stageTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      stageTimers.current.forEach(clearTimeout);
    };
  }, []);

  async function sendAll() {
    if (queue.length === 0 || phase === "sending") return;
    // Hard guard — if another operator holds the lock, don't even
    // attempt the POST. The server will 409 anyway but this avoids
    // the round-trip and keeps the UI feeling responsive.
    if (blocked) return;

    setPhase("sending");
    setStage(0);

    // Fake staged progress. Each setTimeout bumps the stage index so
    // the UI can tick through "Authenticating → Formatting → Transmitting
    // → Confirmed" independent of the actual HTTP round-trip (which is
    // basically instant against our own backend).
    stageTimers.current = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1000),
      setTimeout(() => setStage(3), 1500),
    ];

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, ids: queue.map((d) => d.id) }),
      });
      const json = await res.json();
      // Wait for the staged animation to finish before flipping to
      // "done" so the user sees the full checklist complete.
      setTimeout(() => {
        setLastBatch({
          id: json.batch_id,
          count: json.dispatched,
          response: json.response ?? "",
          deals: json.deals ?? [],
        });
        setStage(4);
        setPhase("done");
        onDispatched();
      }, 1800);
    } catch {
      setPhase("idle");
      setStage(0);
    }
  }

  function reset() {
    setPhase("idle");
    setStage(0);
    setLastBatch(null);
  }

  return (
    <section className={`overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${meta.accent} shadow-lg`}>
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gray-950/60 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-lg ${meta.accentBg} ring-1 ${meta.accentRing}`}>
            <span className={`text-[11px] font-bold ${meta.accentText}`}>{meta.acronym}</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{meta.title}</h2>
            <p className="text-xs text-gray-400">{meta.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.accentBg} ${meta.accentText}`}>
            {queue.length} waiting
          </span>
        </div>
      </div>

      {/* Hero visual — same API pipeline flow for both targets since
          SBS vendor agreed to build REST APIs (Apr 11 meeting). */}
      <div className="border-b border-white/5 bg-gray-950/40 p-5">
        <ApiFlowVisual
          phase={phase}
          stage={stage}
          destLabel={meta.title}
          accentColor={target === "orosoft" ? "emerald" : "sky"}
        />
      </div>

      {/* Queue list */}
      <div className="space-y-2 p-5">
        {phase !== "done" && queue.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-xs text-gray-500">
            No approved {target === "orosoft" ? "Pakka" : "Kachha"} deals waiting.
          </div>
        )}
        {phase !== "done" && queue.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Queued</div>
            <ul className="space-y-1.5">
              {queue.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-gray-900/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-white">{formatDealLine(d)}</div>
                    <div className="text-[10px] text-gray-500">
                      {d.party_alias ?? d.sender_name} · approved {timeAgo(d.reviewed_at)}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-gray-200 tabular-nums">
                    {formatAmount(d)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {phase === "done" && lastBatch && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500 animate-check-pop">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-5 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-emerald-200">
                  {lastBatch.count} deal{lastBatch.count === 1 ? "" : "s"} delivered
                </div>
                <div className="truncate text-xs text-emerald-300/80">{lastBatch.response}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {target === "sbs" && lastBatch.id && (
                <a
                  href={`/api/dispatch/export?batch=${lastBatch.id}&target=sbs`}
                  className="flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download .csv
                </a>
              )}
              <button
                onClick={reset}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
              >
                Send another batch
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action footer */}
      {phase !== "done" && (
        <div className="border-t border-white/10 bg-gray-950/60 px-5 py-4">
          {blocked && othersLock && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/80">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4 shrink-0 text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <div>
                <span className="font-semibold text-amber-200">{othersLock.started_by}</span>{" "}
                is pushing {othersLock.deal_count} deal
                {othersLock.deal_count === 1 ? "" : "s"} to{" "}
                {othersLock.target === "orosoft" ? "OroSoft" : "SBS"}. Other
                dispatches are paused until this completes.
              </div>
            </div>
          )}
          <button
            onClick={sendAll}
            disabled={queue.length === 0 || phase === "sending" || blocked}
            title={blocked ? `${othersLock?.started_by} is dispatching — please wait` : undefined}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              target === "orosoft"
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "bg-sky-600 text-white hover:bg-sky-500"
            }`}
          >
            {phase === "sending" ? (
              <>
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                </svg>
                {target === "orosoft" ? "Transmitting to OroSoft…" : "Transmitting to SBS…"}
              </>
            ) : (
              <>
                {target === "orosoft" ? "Send all to OroSoft" : "Send all to SBS"}
                {queue.length > 0 && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                    {queue.length}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Dispatched deals log (collapsible) ──────────────────────── */}
      {dispatched.length > 0 && (
        <DispatchedLog deals={dispatched} target={target} />
      )}
    </section>
  );
}

function DispatchedLog({ deals, target }: { deals: Deal[]; target: Target }) {
  const [open, setOpen] = useState(false);
  const meta = TARGET_META[target];

  function extractDocNumber(response: string | null): string {
    if (!response) return "—";
    // "OroSoft Neo doc #FCT/2025/000001" → "FCT/2025/000001"
    const match = response.match(/doc #(.+)$/);
    if (match) return match[1];
    // "OroSoft Neo · accepted · doc #..." or "OroSoft Neo · simulated · doc #..."
    const match2 = response.match(/doc #([A-Z0-9/-]+)/);
    if (match2) return match2[1];
    return response;
  }

  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-xs font-semibold text-gray-400 hover:text-gray-200 transition"
      >
        <span className="flex items-center gap-2">
          Dispatched Trades
          <span className="text-gray-600">· {deals.length}</span>
        </span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-white/5 bg-gray-950/40">
          <table className="w-full min-w-[500px] text-xs">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Doc #</th>
                <th className="px-3 py-2 text-left font-semibold">Trade</th>
                <th className="px-3 py-2 text-left font-semibold">Party</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 text-left font-semibold">Dispatched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deals.map((d) => {
                const docNum = extractDocNumber(d.dispatch_response);
                return (
                  <tr key={d.id}>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] font-bold ${meta.accentBg} ${meta.accentText}`}>
                        {docNum}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-300">
                      {formatDealLine(d)}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {d.party_alias ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-200">
                      {formatAmount(d)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {d.dispatched_at ? new Date(d.dispatched_at).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
                      }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ApiFlowVisual ──────────────────────────────────────────────────────
//
// Horizontal flow: [PrismX] ─► [API gateway] ─► [Destination]
// Used by BOTH OroSoft and SBS panels since SBS vendor agreed to
// REST APIs (Apr 11 meeting). Dots travel along the line while
// `phase === "sending"`. The stage index lights up progress
// checkpoints underneath. destLabel and accentColor let each panel
// render with its own identity (emerald for OroSoft, sky for SBS).

function ApiFlowVisual({
  phase,
  stage,
  destLabel = "OroSoft Neo",
  accentColor = "emerald",
}: {
  phase: "idle" | "sending" | "done";
  stage: number;
  destLabel?: string;
  accentColor?: "emerald" | "sky";
}) {
  const stages = [
    "Authenticate",
    "Format payload",
    "POST /sales",
    "Confirm receipt",
  ];

  const dotColor = accentColor === "sky" ? "bg-sky-400" : "bg-emerald-400";
  const dotShadow = accentColor === "sky"
    ? "shadow-[0_0_12px_rgba(56,189,248,0.9)]"
    : "shadow-[0_0_12px_rgba(52,211,153,0.9)]";
  const gradientVia = accentColor === "sky" ? "via-sky-400/50" : "via-emerald-400/50";
  const gradientTo = accentColor === "sky" ? "to-sky-500/50" : "to-emerald-500/50";

  return (
    <div className="space-y-4">
      {/* Flow line */}
      <div className="relative flex items-center justify-between gap-2">
        <FlowNode label="PrismX" sublabel="Source" active={phase !== "idle"} color="amber" />
        <div className="relative flex-1 px-2">
          <div className={`h-px w-full bg-gradient-to-r from-amber-500/50 ${gradientVia} ${gradientTo}`} />
          {phase === "sending" && (
            <>
              <span
                className={`absolute top-1/2 -mt-1 size-2 rounded-full ${dotColor} ${dotShadow} animate-flow`}
                style={{ "--flow-distance": "calc(100% - 8px)" } as React.CSSProperties}
              />
              <span
                className={`absolute top-1/2 -mt-1 size-2 rounded-full ${dotColor} ${dotShadow} animate-flow`}
                style={{ "--flow-distance": "calc(100% - 8px)", animationDelay: "0.4s" } as React.CSSProperties}
              />
              <span
                className={`absolute top-1/2 -mt-1 size-2 rounded-full ${dotColor} ${dotShadow} animate-flow`}
                style={{ "--flow-distance": "calc(100% - 8px)", animationDelay: "0.8s" } as React.CSSProperties}
              />
            </>
          )}
          <div className="mt-1 text-center text-[10px] uppercase tracking-wider text-gray-500">
            HTTPS · REST
          </div>
        </div>
        <FlowNode label={destLabel} sublabel="Destination" active={phase === "done"} color={accentColor} />
      </div>

      {/* Stage checklist */}
      <div className="grid grid-cols-4 gap-2">
        {stages.map((label, i) => {
          const done = stage > i || phase === "done";
          const active = phase === "sending" && stage === i;
          return (
            <div
              key={label}
              className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center transition ${
                done
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : active
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-white/5 bg-gray-950/40"
              }`}
            >
              <div
                className={`flex size-5 items-center justify-center rounded-full ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-amber-500 text-gray-950"
                    : "bg-white/10 text-gray-500"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : active ? (
                  <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                    <path d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span className="text-[9px] font-semibold">{i + 1}</span>
                )}
              </div>
              <span className={`text-[10px] ${done || active ? "text-white" : "text-gray-500"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowNode({
  label,
  sublabel,
  active,
  color,
}: {
  label: string;
  sublabel: string;
  active: boolean;
  color: "amber" | "emerald" | "sky";
}) {
  const colorClasses =
    color === "amber"
      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
      : color === "sky"
      ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
      : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
  const ringColor =
    color === "amber" ? "bg-amber-400/40" : color === "sky" ? "bg-sky-400/40" : "bg-emerald-400/40";
  return (
    <div className="relative flex flex-col items-center">
      {active && (
        <span className={`absolute inset-0 rounded-xl ${ringColor} animate-pulse-ring`} />
      )}
      <div className={`relative rounded-xl border px-3 py-2 text-center ${colorClasses}`}>
        <div className="text-xs font-bold uppercase tracking-wide">{label}</div>
        <div className="text-[9px] uppercase tracking-wider opacity-70">{sublabel}</div>
      </div>
    </div>
  );
}

// ─── SbsVisual ──────────────────────────────────────────────────────────
//
// Mini spreadsheet. When the user hits "Update SBS Excel", rows slide
// into the sheet one by one. Once done, the rows stay and a footer
// indicates the row count + batch id.

function SbsVisual({
  phase,
  queue,
  batchDeals,
}: {
  phase: "idle" | "sending" | "done";
  queue: Deal[];
  batchDeals: Deal[];
}) {
  // Which rows to render in the sheet: the queue while idle/sending,
  // the batch_deals once done. Cap at 6 rows so the visual stays a
  // fixed height regardless of queue size — the rest are hinted with
  // a "…and N more" row.
  const source = phase === "done" ? batchDeals : queue;
  const visible = source.slice(0, 6);
  const extra = Math.max(0, source.length - visible.length);

  // When sending, reveal rows progressively so it looks like they're
  // being appended by a running script. We simulate this by tagging
  // each row with an animation delay proportional to its index.
  const showRowFrom = phase === "sending" ? Date.now() : 0;

  return (
    <div className="space-y-3">
      {/* Window chrome to sell the "Excel" illusion */}
      <div className="overflow-hidden rounded-lg border border-white/10 bg-gray-950 shadow-inner">
        <div className="flex items-center gap-1.5 border-b border-white/10 bg-gray-900/80 px-3 py-1.5">
          <span className="size-2 rounded-full bg-rose-400/70" />
          <span className="size-2 rounded-full bg-amber-400/70" />
          <span className="size-2 rounded-full bg-emerald-400/70" />
          <span className="ml-2 font-mono text-[10px] text-gray-500">
            Bullion Sales Order.xlsx — Sheet1
          </span>
        </div>
        <table className="w-full text-[11px]">
          <thead className="bg-white/5 text-[9px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-8 border-b border-r border-white/10 px-2 py-1.5 text-left"></th>
              <th className="border-b border-r border-white/10 px-2 py-1.5 text-left font-semibold">Party</th>
              <th className="border-b border-r border-white/10 px-2 py-1.5 text-left font-semibold">Product</th>
              <th className="border-b border-r border-white/10 px-2 py-1.5 text-right font-semibold">GrossWt</th>
              <th className="border-b border-r border-white/10 px-2 py-1.5 text-right font-semibold">Rate</th>
              <th className="border-b border-white/10 px-2 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="font-mono text-gray-300">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-600">
                  Sheet is empty — approved Kachha deals will be staged here.
                </td>
              </tr>
            )}
            {visible.map((d, i) => {
              const style =
                phase === "sending"
                  ? ({ animationDelay: `${i * 180}ms` } as React.CSSProperties)
                  : undefined;
              return (
                <tr
                  key={`${d.id}-${showRowFrom}`}
                  className={phase === "sending" || phase === "done" ? "animate-sheet-row" : ""}
                  style={style}
                >
                  <td className="border-b border-r border-white/5 bg-white/5 px-2 py-1 text-center text-[9px] text-gray-500">
                    {i + 2}
                  </td>
                  <td className="border-b border-r border-white/5 px-2 py-1 text-white">
                    {(d.party_alias ?? d.sender_name).slice(0, 14)}
                  </td>
                  <td className="border-b border-r border-white/5 px-2 py-1 uppercase">
                    {d.metal ?? "?"}
                    {d.purity ? ` ${d.purity}` : ""}
                  </td>
                  <td className="border-b border-r border-white/5 px-2 py-1 text-right tabular-nums">
                    {d.qty_grams ? d.qty_grams.toFixed(0) : "—"}
                  </td>
                  <td className="border-b border-r border-white/5 px-2 py-1 text-right tabular-nums">
                    {d.rate_usd_per_oz ? d.rate_usd_per_oz.toFixed(2) : "—"}
                  </td>
                  <td className="border-b border-white/5 px-2 py-1 text-right tabular-nums">
                    {formatAmount(d)}
                  </td>
                </tr>
              );
            })}
            {extra > 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-1 text-center text-[10px] italic text-gray-500">
                  …and {extra} more row{extra === 1 ? "" : "s"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500">
        <span>14 columns · OroSoft Neo import format</span>
        <span>
          {source.length} row{source.length === 1 ? "" : "s"}
          {phase === "done" ? " · committed" : phase === "sending" ? " · writing…" : " · staged"}
        </span>
      </div>
    </div>
  );
}
