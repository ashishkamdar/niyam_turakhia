"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ParsedDeal } from "@/lib/chat-parser";
import { formatQuantity, formatUsdt } from "@/lib/chat-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ViewDeal = ParsedDeal & { chat_source?: string; _expanded?: boolean };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const METAL_COLORS: Record<string, string> = {
  gold: "text-amber-400",
  silver: "text-slate-300",
  platinum: "text-cyan-300",
  palladium: "text-purple-400",
};

const METAL_BG: Record<string, string> = {
  gold: "bg-amber-400/10 border-amber-400/30",
  silver: "bg-slate-400/10 border-slate-400/30",
  platinum: "bg-cyan-400/10 border-cyan-400/30",
  palladium: "bg-purple-400/10 border-purple-400/30",
};

const STATUS_BADGE: Record<string, string> = {
  locked: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  settled: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  cancelled: "bg-gray-500/20 text-gray-400 border border-gray-500/40",
  working: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
  pending: "bg-gray-600/20 text-gray-400 border border-gray-500/30",
  detected: "bg-gray-600/20 text-gray-400 border border-gray-500/30",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-HK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------
function SummaryBar({ deals }: { deals: ParsedDeal[] }) {
  const locked = deals.filter((d) => d.status === "locked").length;
  const settled = deals.filter((d) => d.status === "settled").length;
  const working = deals.filter((d) => d.status === "working").length;
  const totalUsdt = deals.reduce((s, d) => s + d.total_usdt, 0);
  const totalGrams = deals.reduce((s, d) => s + d.quantity_grams, 0);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        { label: "Deals Found", value: String(deals.length), accent: "text-white" },
        { label: "Locked / Settled", value: `${locked} / ${settled}`, accent: "text-amber-400" },
        { label: "Total Volume", value: formatQuantity(totalGrams), accent: "text-emerald-400" },
        { label: "Total USDT", value: formatUsdt(totalUsdt), accent: "text-sky-400" },
      ].map((s) => (
        <div key={s.label} className="rounded-lg border border-white/10 bg-gray-800/60 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{s.label}</p>
          <p className={`mt-0.5 text-xl font-bold ${s.accent}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single deal card
// ---------------------------------------------------------------------------
function DealCard({ deal, onToggle }: { deal: ViewDeal; onToggle: () => void }) {
  const metalColor = METAL_COLORS[deal.metal] ?? "text-white";
  const metalBg = METAL_BG[deal.metal] ?? "bg-gray-700/30 border-gray-600/30";
  const statusCls = STATUS_BADGE[deal.status] ?? STATUS_BADGE.pending;

  return (
    <div className={`rounded-xl border p-4 transition-all ${metalBg}`}>
      {/* Top row */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Metal pill */}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${metalColor} bg-current/10`}>
          {deal.metal}
        </span>

        {/* Direction */}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
            deal.direction === "buy"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-rose-500/20 text-rose-400"
          }`}
        >
          {deal.direction}
        </span>

        {/* Status */}
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${statusCls}`}>
          {deal.status}
        </span>

        <span className="ml-auto text-[11px] text-gray-500">{formatDate(deal.date)}</span>
      </div>

      {/* Main figures */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Quantity</p>
          <p className="text-sm font-semibold text-white">{formatQuantity(deal.quantity_grams)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Price/oz</p>
          <p className="text-sm font-semibold text-white">
            {deal.price_per_oz > 0 ? `$${deal.price_per_oz.toLocaleString()}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Premium/Disc</p>
          <p className={`text-sm font-semibold ${deal.premium_discount.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
            {deal.premium_discount || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Total USDT</p>
          <p className="text-sm font-bold text-sky-400">
            {deal.total_usdt > 0 ? `$${deal.total_usdt.toLocaleString()}` : "—"}
          </p>
        </div>
      </div>

      {/* Participants */}
      {deal.participants.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {deal.participants.map((p) => (
            <span key={p} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Expand/collapse key messages */}
      {deal.raw_messages.length > 0 && (
        <>
          <button
            onClick={onToggle}
            className="mt-2 flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`size-3 transition-transform ${deal._expanded ? "rotate-90" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            {deal._expanded ? "Hide" : "Show"} key messages ({deal.raw_messages.length})
          </button>
          {deal._expanded && (
            <div className="mt-2 space-y-1 rounded-lg bg-black/30 p-3">
              {deal.raw_messages.map((msg, i) => (
                <p key={i} className="font-mono text-[10px] leading-relaxed text-gray-400 break-all">
                  {msg}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload / paste zone
// ---------------------------------------------------------------------------
function UploadZone({
  onText,
  disabled,
}: {
  onText: (text: string) => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) onText(text);
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  if (pasteMode) {
    return (
      <div className="rounded-xl border border-white/10 bg-gray-800/50 p-4">
        <textarea
          className="h-40 w-full resize-none rounded-lg bg-gray-900 p-3 font-mono text-xs text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
          placeholder="Paste WhatsApp chat text here…"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <button
            disabled={disabled || !pasteText.trim()}
            onClick={() => { onText(pasteText); setPasteText(""); setPasteMode(false); }}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-40 transition-colors"
          >
            Parse Deals
          </button>
          <button
            onClick={() => { setPasteMode(false); setPasteText(""); }}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors ${
        dragging
          ? "border-amber-400 bg-amber-400/5"
          : "border-white/10 bg-gray-800/30 hover:border-white/20 hover:bg-gray-800/50"
      }`}
    >
      <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-8 text-gray-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-300">Drop WhatsApp chat .txt file here</p>
        <p className="mt-0.5 text-xs text-gray-600">or click to browse</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setPasteMode(true); }}
        className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
      >
        Paste text instead
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BotPage() {
  const [deals, setDeals] = useState<ViewDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("upload");
  // Filter & sort state
  const [filterMetal, setFilterMetal] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");

  // Load previously parsed deals on mount
  useEffect(() => {
    fetch("/api/bot")
      .then((r) => r.json())
      .then((rows: (ParsedDeal & { participants: string; raw_messages: string })[]) => {
        const parsed: ViewDeal[] = rows.map((r) => ({
          ...r,
          participants: tryParseJson(r.participants, []),
          raw_messages: tryParseJson(r.raw_messages, []),
          _expanded: false,
        }));
        setDeals(parsed);
      })
      .catch(() => {});
  }, []);

  function tryParseJson<T>(val: unknown, fallback: T): T {
    if (Array.isArray(val)) return val as T;
    if (typeof val === "string") {
      try { return JSON.parse(val) as T; } catch { return fallback; }
    }
    return fallback;
  }

  const handleChatText = useCallback(async (text: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatText: text, source }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { deals: ParsedDeal[]; count: number };
      const viewDeals: ViewDeal[] = data.deals.map((d) => ({ ...d, _expanded: false }));
      setDeals(viewDeals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [source]);

  function toggleExpand(id: string) {
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, _expanded: !d._expanded } : d))
    );
  }

  // Filtered + sorted deals
  const filtered = deals.filter((d) => {
    if (filterMetal !== "all" && d.metal !== filterMetal) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterSource !== "all" && d.chat_source !== filterSource) return false;
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case "date-asc": return a.date.localeCompare(b.date);
      case "date-desc": return b.date.localeCompare(a.date);
      case "metal": return a.metal.localeCompare(b.metal);
      case "status": return a.status.localeCompare(b.status);
      case "amount-desc": return b.total_usdt - a.total_usdt;
      case "amount-asc": return a.total_usdt - b.total_usdt;
      case "quantity-desc": return b.quantity_grams - a.quantity_grams;
      default: return b.date.localeCompare(a.date);
    }
  });

  const metals = ["all", ...Array.from(new Set(deals.map((d) => d.metal)))];
  const statuses = ["all", ...Array.from(new Set(deals.map((d) => d.status)))];
  const sources = ["all", ...Array.from(new Set(deals.map((d) => d.chat_source)))];

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">Deal Bot</h1>
        <p className="text-xs text-gray-400">Parse WhatsApp chat exports to extract precious metal deals</p>
      </div>

      {/* Upload zone */}
      <UploadZone onText={handleChatText} disabled={loading} />

      {/* Source label */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500">Source label</label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-40 rounded-lg border border-white/10 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-amber-500/50"
          placeholder="e.g. SAPAN-HK"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <div className="size-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          Parsing chat…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Results */}
      {deals.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <SummaryBar deals={deals} />

          {/* Filters & Sort */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-gray-800/50 px-2 py-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">Source</span>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-transparent text-xs text-gray-200 outline-none">
                {sources.map((s) => <option key={s} value={s} className="bg-gray-900">{s === "all" ? "All sources" : s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-gray-800/50 px-2 py-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">Metal</span>
              <select value={filterMetal} onChange={(e) => setFilterMetal(e.target.value)} className="bg-transparent text-xs text-gray-200 outline-none">
                {metals.map((m) => <option key={m} value={m} className="bg-gray-900">{m === "all" ? "All metals" : m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-gray-800/50 px-2 py-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">Status</span>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-transparent text-xs text-gray-200 outline-none">
                {statuses.map((s) => <option key={s} value={s} className="bg-gray-900">{s === "all" ? "All" : s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-gray-800/50 px-2 py-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-xs text-gray-200 outline-none">
                <option value="date-desc" className="bg-gray-900">Newest first</option>
                <option value="date-asc" className="bg-gray-900">Oldest first</option>
                <option value="metal" className="bg-gray-900">By metal</option>
                <option value="status" className="bg-gray-900">By status</option>
                <option value="amount-desc" className="bg-gray-900">Highest USDT</option>
                <option value="quantity-desc" className="bg-gray-900">Highest quantity</option>
              </select>
            </div>
            <span className="ml-auto self-center text-xs text-gray-500">
              {filtered.length} / {deals.length} deals
            </span>
          </div>

          {/* Deal cards */}
          <div className="space-y-3">
            {filtered.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onToggle={() => toggleExpand(deal.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && deals.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-gray-800/20 py-16 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="mx-auto size-12 text-gray-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.357 2.059l.537.22a2.25 2.25 0 001.357-.046l.537-.22a2.25 2.25 0 001.357-2.059V3.186m-9 0A24.306 24.306 0 0112 3c1.564 0 3.1.126 4.5.372m0 0c.249.032.499.059.75.082M4.5 7.5a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H5.25a.75.75 0 01-.75-.75z" />
          </svg>
          <p className="mt-4 text-sm text-gray-600">Upload a WhatsApp chat export to extract deals</p>
        </div>
      )}
    </div>
  );
}
