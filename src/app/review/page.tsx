"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────

interface PendingDeal {
  id: string;
  whatsapp_message_id: string;
  sender_phone: string;
  sender_name: string;
  raw_message: string;
  received_at: string;
  deal_type: "K" | "P" | null;
  direction: "buy" | "sell" | null;
  qty_grams: number | null;
  metal: string | null;
  purity: string | null;
  rate_usd_per_oz: number | null;
  premium_type: "absolute" | "percent" | null;
  premium_value: number | null;
  party_alias: string | null;
  parse_errors: string[];
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface ReviewResponse {
  deals: PendingDeal[];
  counts: { pending: number; approved: number; rejected: number };
}

type StatusFilter = "pending" | "approved" | "rejected";

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

function formatQty(grams: number | null): string {
  if (grams == null) return "—";
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 2)} kg`;
  return `${grams.toFixed(0)} g`;
}

function formatPremium(deal: PendingDeal): string {
  if (deal.premium_value == null) return "—";
  if (deal.premium_value === 0) return "—";
  const sign = deal.premium_value >= 0 ? "+" : "";
  const suffix = deal.premium_type === "percent" ? "%" : "";
  return `${sign}${deal.premium_value}${suffix}`;
}

function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `$${rate.toFixed(4)}/oz`;
}

// ── Component ────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/review?status=${filter}`);
      if (res.ok) {
        setData(await res.json());
        setLastLoaded(new Date());
      }
    } catch {
      // swallow — next poll will retry
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  async function approve(deal: PendingDeal) {
    if (deal.deal_type !== "K" && deal.deal_type !== "P") return;
    setBusyId(deal.id);
    try {
      await fetch(`/api/review/${deal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // Atomic classify-and-approve for unclassified (#NT) cards.
  // The server handles both field updates in a single POST /api/review/:id transaction.
  async function approveAs(id: string, dealType: "K" | "P") {
    setBusyId(id);
    try {
      await fetch(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", deal_type: dealType }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(deal: PendingDeal) {
    setBusyId(deal.id);
    try {
      await fetch(`/api/review/${deal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const deals = data?.deals ?? [];
  const counts = data?.counts ?? { pending: 0, approved: 0, rejected: 0 };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-950 pb-24 lg:pb-8 lg:pl-60">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-white">Deal Review</h1>
              <p className="mt-1 text-sm text-gray-400">
                Maker-checker queue for WhatsApp lock codes. Approve to write to SBS (Kachha) or OroSoft (Pakka).
              </p>
            </div>
            <LiveIndicator lastLoaded={lastLoaded} />
          </div>
        </header>

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border border-white/10 bg-gray-900 p-1">
          {(["pending", "approved", "rejected"] as StatusFilter[]).map((f) => {
            const count = counts[f];
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold capitalize transition ${
                  active ? "bg-amber-500/20 text-amber-300" : "text-gray-400 hover:text-white"
                }`}
              >
                {f}
                {count > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-amber-500/30" : "bg-white/10"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading && deals.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
        ) : deals.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm text-gray-500">No {filter} deals</div>
            <div className="mt-2 text-xs text-gray-600">
              Send a WhatsApp message starting with <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-amber-300">#NTP</code>, <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-amber-300">#NTK</code>, or <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-amber-300">#NT</code> to the bot.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                busy={busyId === deal.id}
                onApproveAs={approveAs}
                onApprove={approve}
                onReject={reject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DealCard ─────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: PendingDeal;
  busy: boolean;
  onApproveAs: (id: string, type: "K" | "P") => void;
  onApprove: (deal: PendingDeal) => void;
  onReject: (deal: PendingDeal) => void;
}

function DealCard({ deal, busy, onApproveAs, onApprove, onReject }: DealCardProps) {
  const hasErrors = deal.parse_errors.length > 0;
  const isUnclassified = deal.deal_type === null;

  return (
    <div
      className={`w-full min-w-0 rounded-lg border p-4 ${
        hasErrors ? "border-rose-500/30 bg-rose-950/20" : "border-white/10 bg-gray-900"
      }`}
    >
      {/* Header: sender + type badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{deal.sender_name}</div>
          <div className="text-[11px] text-gray-500">{formatTime(deal.received_at)}</div>
        </div>
        <TypeBadge type={deal.deal_type} />
      </div>

      {/* Raw message — block element with aggressive wrapping so long lines
          never push the card wider than the viewport on mobile. */}
      <div className="mt-3 w-full min-w-0 rounded border border-white/5 bg-black/40 p-2">
        <pre className="w-full whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-gray-300">
          {deal.raw_message}
        </pre>
      </div>

      {/* Parse errors */}
      {hasErrors && (
        <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 p-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-rose-400">
            Parse errors
          </div>
          <ul className="mt-1 space-y-0.5">
            {deal.parse_errors.map((e, i) => (
              <li key={i} className="text-xs text-rose-300">
                • {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parsed fields grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Field label="Direction" value={deal.direction ? deal.direction.toUpperCase() : "—"} tone={deal.direction === "buy" ? "emerald" : deal.direction === "sell" ? "amber" : "muted"} />
        <Field label="Metal" value={deal.metal ? `${deal.metal[0].toUpperCase()}${deal.metal.slice(1)} ${deal.purity ?? ""}`.trim() : "—"} />
        <Field label="Quantity" value={formatQty(deal.qty_grams)} />
        <Field label="Rate" value={formatRate(deal.rate_usd_per_oz)} />
        <Field label="Premium" value={formatPremium(deal)} />
        <Field label="Party" value={deal.party_alias ?? "—"} mono />
      </div>

      {/* Actions for UNCLASSIFIED cards: Approve-as-Kachha / Approve-as-Pakka / Reject.
          Each picker button does classify + approve atomically in one tap. */}
      {deal.status === "pending" && isUnclassified && (
        <>
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2.5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-400">
              Approve as
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApproveAs(deal.id, "K")}
                disabled={busy}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "…" : "Kachha (SBS)"}
              </button>
              <button
                onClick={() => onApproveAs(deal.id, "P")}
                disabled={busy}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "…" : "Pakka (OroSoft)"}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={() => onReject(deal)}
              disabled={busy}
              className="w-full rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </>
      )}

      {/* Actions for ALREADY CLASSIFIED cards (explicit #NTK/#NTP triggers): simple Approve + Reject */}
      {deal.status === "pending" && !isUnclassified && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onApprove(deal)}
            disabled={busy}
            className="flex-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "…" : "Approve"}
          </button>
          <button
            onClick={() => onReject(deal)}
            disabled={busy}
            className="flex-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {/* Reviewed meta */}
      {deal.status !== "pending" && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
              deal.status === "approved"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            {deal.status === "approved" ? "✓ Approved" : "✗ Rejected"}
          </span>
          <span>
            by {deal.reviewed_by ?? "—"} · {formatTime(deal.reviewed_at)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Small UI bits ────────────────────────────────────────────────────────

function LiveIndicator({ lastLoaded }: { lastLoaded: Date | null }) {
  // Tick once per second so the "Xs ago" label stays current even when no new
  // data arrives. This is purely a display clock; it does NOT trigger data fetches.
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const ago = lastLoaded
    ? Math.max(0, Math.floor((now.getTime() - lastLoaded.getTime()) / 1000))
    : null;
  const label =
    ago === null ? "connecting…" : ago < 2 ? "just now" : `${ago}s ago`;

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          Live
        </span>
        <span className="text-[9px] text-emerald-500/70">{label}</span>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: "K" | "P" | null }) {
  if (type === "K") {
    return (
      <span className="shrink-0 rounded-full border border-gray-500/40 bg-gray-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-300">
        Kachha
      </span>
    );
  }
  if (type === "P") {
    return (
      <span className="shrink-0 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Pakka
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
      Unclassified
    </span>
  );
}

function Field({
  label,
  value,
  tone = "default",
  mono = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "emerald" | "amber";
  mono?: boolean;
}) {
  const toneClass =
    tone === "muted"
      ? "text-gray-500"
      : tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
      ? "text-amber-400"
      : "text-gray-200";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`${toneClass} ${mono ? "font-mono" : ""} text-sm font-medium`}>{value}</div>
    </div>
  );
}
