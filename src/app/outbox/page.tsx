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

type DispatchResponse = {
  pakka_outbox: Deal[];
  kachha_outbox: Deal[];
  history: Deal[];
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
    title: "SBS Excel",
    subtitle: "Kachha deals — sheet upload",
    type: "K",
    acronym: "XLS",
    destLabel: "SBS",
    wayLabel: "via Excel batch",
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
  });

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
    const poll = setInterval(load, 4000);
    return () => clearInterval(poll);
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-white">Outbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Approved trades waiting to be pushed to{" "}
          <span className="font-semibold text-emerald-300">OroSoft</span> (Pakka · API) or
          exported to{" "}
          <span className="font-semibold text-sky-300">SBS</span> (Kachha · Excel).
          This is where the lifecycle ends — once a trade lands here,
          it&apos;s a quotable, invoice-ready line item.
        </p>
      </header>

      {/* ── Two destination panels ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DestinationPanel target="orosoft" queue={data.pakka_outbox} onDispatched={load} />
        <DestinationPanel target="sbs" queue={data.kachha_outbox} onDispatched={load} />
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
    </div>
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
  onDispatched,
}: {
  target: Target;
  queue: Deal[];
  onDispatched: () => void;
}) {
  const meta = TARGET_META[target];
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

      {/* Hero visual */}
      <div className="border-b border-white/5 bg-gray-950/40 p-5">
        {target === "orosoft" ? (
          <OrosoftVisual phase={phase} stage={stage} />
        ) : (
          <SbsVisual phase={phase} queue={queue} batchDeals={lastBatch?.deals ?? []} />
        )}
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
          <button
            onClick={sendAll}
            disabled={queue.length === 0 || phase === "sending"}
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
                {target === "orosoft" ? "Transmitting to OroSoft…" : "Updating SBS sheet…"}
              </>
            ) : (
              <>
                {target === "orosoft" ? "Send all to OroSoft" : "Update SBS Excel"}
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
    </section>
  );
}

// ─── OrosoftVisual ──────────────────────────────────────────────────────
//
// Horizontal flow: [PrismX] ─► [API gateway] ─► [OroSoft Neo]
// Dots travel along the line while `phase === "sending"`. The stage
// index lights up progress checkpoints underneath so Niyam can see what
// the system is doing at each moment.

function OrosoftVisual({ phase, stage }: { phase: "idle" | "sending" | "done"; stage: number }) {
  const stages = [
    "Authenticate",
    "Format payload",
    "POST /sales",
    "Confirm receipt",
  ];

  return (
    <div className="space-y-4">
      {/* Flow line */}
      <div className="relative flex items-center justify-between gap-2">
        <FlowNode label="PrismX" sublabel="Source" active={phase !== "idle"} color="amber" />
        <div className="relative flex-1 px-2">
          <div className="h-px w-full bg-gradient-to-r from-amber-500/50 via-emerald-400/50 to-emerald-500/50" />
          {phase === "sending" && (
            <>
              <span
                className="absolute top-1/2 -mt-1 size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-flow"
                style={{ "--flow-distance": "calc(100% - 8px)" } as React.CSSProperties}
              />
              <span
                className="absolute top-1/2 -mt-1 size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-flow"
                style={{ "--flow-distance": "calc(100% - 8px)", animationDelay: "0.4s" } as React.CSSProperties}
              />
              <span
                className="absolute top-1/2 -mt-1 size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-flow"
                style={{ "--flow-distance": "calc(100% - 8px)", animationDelay: "0.8s" } as React.CSSProperties}
              />
            </>
          )}
          <div className="mt-1 text-center text-[10px] uppercase tracking-wider text-gray-500">
            HTTPS · REST
          </div>
        </div>
        <FlowNode label="OroSoft Neo" sublabel="Destination" active={phase === "done"} color="emerald" />
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
  color: "amber" | "emerald";
}) {
  const colorClasses = color === "amber"
    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
    : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
  const ringColor = color === "amber" ? "bg-amber-400/40" : "bg-emerald-400/40";
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
