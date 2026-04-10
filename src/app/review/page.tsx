"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────

interface ScreenshotOcr {
  provider?: string;
  type?: "payment" | "barlist" | "receipt" | "unknown";
  amount?: number;
  currency?: string;
  sender_wallet?: string;
  receiver_wallet?: string;
  transaction_id?: string;
  date?: string;
  status?: string;
  weight_grams?: number;
  bar_count?: number;
  raw_text?: string;
}

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
  screenshot_ocr: ScreenshotOcr | null;
  screenshot_url: string | null;
}

interface ReviewResponse {
  deals: PendingDeal[];
  counts: { pending: number; approved: number; rejected: number; ignored: number };
}

type StatusFilter = "pending" | "approved" | "rejected" | "ignored";

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

  // Save edited fields to a pending deal. Fields that are unchanged from the
  // current deal state are still sent — the server updates everything in the
  // body, which keeps the endpoint simple and idempotent.
  async function saveEdit(id: string, updates: Record<string, unknown>) {
    setBusyId(id);
    try {
      await fetch(`/api/review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
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
  const counts = data?.counts ?? { pending: 0, approved: 0, rejected: 0, ignored: 0 };

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
          {(["pending", "approved", "rejected", "ignored"] as StatusFilter[]).map((f) => {
            const count = counts[f];
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-md px-2 py-2 text-[11px] font-semibold capitalize transition ${
                  active ? "bg-amber-500/20 text-amber-300" : "text-gray-400 hover:text-white"
                }`}
              >
                {f}
                {count > 0 && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-amber-500/30" : "bg-white/10"}`}>
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
            <div className="text-sm text-gray-500">
              {filter === "ignored" ? "No ignored messages" : `No ${filter} deals`}
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {filter === "ignored" ? (
                <>Any non-deal WhatsApp message to the bot will show up here as proof it was received.</>
              ) : (
                <>Send a WhatsApp message starting with <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-amber-300">#NTP</code>, <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-amber-300">#NTK</code>, or <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-amber-300">#NT</code> to the bot.</>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filter === "ignored"
              ? deals.map((deal) => <IgnoredCard key={deal.id} deal={deal} />)
              : deals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    busy={busyId === deal.id}
                    onApproveAs={approveAs}
                    onApprove={approve}
                    onReject={reject}
                    onSaveEdit={saveEdit}
                  />
                ))}
          </div>
        )}
        {filter === "ignored" && deals.length > 0 && (
          <p className="mt-4 text-center text-[10px] text-gray-600">
            Showing last {deals.length} ignored message{deals.length === 1 ? "" : "s"} · in-memory only · cleared on server restart
          </p>
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
  onSaveEdit: (id: string, updates: Record<string, unknown>) => Promise<void>;
}

// Draft shape — mirrors the writable fields the PATCH endpoint accepts.
// Kept separate from PendingDeal so we can track in-progress edits without
// touching the polled "truth" state.
interface DraftFields {
  deal_type: "K" | "P" | null;
  direction: "buy" | "sell" | null;
  qty_grams: number | null;
  metal: "gold" | "silver" | "platinum" | "palladium" | null;
  purity: string | null;
  rate_usd_per_oz: number | null;
  premium_type: "absolute" | "percent" | null;
  premium_value: number | null;
  party_alias: string | null;
}

function toDraft(deal: PendingDeal): DraftFields {
  return {
    deal_type: deal.deal_type,
    direction: deal.direction,
    qty_grams: deal.qty_grams,
    metal: (deal.metal as DraftFields["metal"]) ?? null,
    purity: deal.purity,
    rate_usd_per_oz: deal.rate_usd_per_oz,
    premium_type: deal.premium_type,
    premium_value: deal.premium_value,
    party_alias: deal.party_alias,
  };
}

function DealCard({ deal, busy, onApproveAs, onApprove, onReject, onSaveEdit }: DealCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftFields>(() => toDraft(deal));
  const [saving, setSaving] = useState(false);

  // Refresh the draft from the authoritative deal only when we're NOT editing.
  // This prevents the 3-second polling loop from clobbering unsaved changes.
  useEffect(() => {
    if (!editing) {
      setDraft(toDraft(deal));
    }
  }, [deal, editing]);

  const hasErrors = deal.parse_errors.length > 0;
  const isUnclassified = deal.deal_type === null;
  // Edit + actions are available on both pending and rejected deals:
  //  - pending: normal review flow (approve / reject / edit before deciding)
  //  - rejected: rescue flow (fix fields and re-evaluate, or re-approve directly)
  // Approved deals stay view-only — once approved, they'll eventually have
  // downstream side effects (SBS Excel append, OroSoft API push) and must
  // be immutable to prevent drift between PrismX and the accounting systems.
  const canEdit = deal.status === "pending" || deal.status === "rejected";
  const showActions = canEdit; // same gating — any card that can be edited can also be re-decided
  const isBusy = busy || saving;

  function toggleEdit() {
    if (editing) {
      // Toggling off = cancel + discard draft
      setDraft(toDraft(deal));
      setEditing(false);
    } else {
      setEditing(true);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveEdit(deal.id, draft as unknown as Record<string, unknown>);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function updateDraft<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div
      className={`w-full min-w-0 rounded-lg border p-4 ${
        editing
          ? "border-amber-500/40 bg-amber-950/10"
          : hasErrors
          ? "border-rose-500/30 bg-rose-950/20"
          : "border-white/10 bg-gray-900"
      }`}
    >
      {/* Header: sender + edit toggle + type badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{deal.sender_name}</div>
          <div className="text-[11px] text-gray-500">{formatTime(deal.received_at)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && <EditToggle on={editing} disabled={saving} onToggle={toggleEdit} />}
          <TypeBadge type={editing ? draft.deal_type : deal.deal_type} />
        </div>
      </div>

      {/* Raw message — always shown even in edit mode so the user can see what was originally received */}
      <div className="mt-3 w-full min-w-0 rounded border border-white/5 bg-black/40 p-2">
        <pre className="w-full whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-gray-300">
          {deal.raw_message}
        </pre>
      </div>

      {/* Screenshot OCR — placed directly under the raw message so the reviewer
          sees the payment evidence side-by-side with the deal text, before
          examining the parsed fields below. Hidden in edit mode. */}
      {!editing && (deal.screenshot_ocr || deal.screenshot_url) && (
        <OcrSection ocr={deal.screenshot_ocr} screenshotUrl={deal.screenshot_url} />
      )}

      {/* Parse errors — only shown in view mode; editing clears the visual noise */}
      {hasErrors && !editing && (
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
          <div className="mt-1.5 text-[10px] italic text-rose-400/70">
            Tap Edit above to fix the missing fields before approving.
          </div>
        </div>
      )}

      {/* Fields: read-only view or edit form */}
      {editing ? (
        <DealEditForm draft={draft} onChange={updateDraft} />
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Field label="Direction" value={deal.direction ? deal.direction.toUpperCase() : "—"} tone={deal.direction === "buy" ? "emerald" : deal.direction === "sell" ? "amber" : "muted"} />
          <Field label="Metal" value={deal.metal ? `${deal.metal[0].toUpperCase()}${deal.metal.slice(1)} ${deal.purity ?? ""}`.trim() : "—"} />
          <Field label="Quantity" value={formatQty(deal.qty_grams)} />
          <Field label="Rate" value={formatRate(deal.rate_usd_per_oz)} />
          <Field label="Premium" value={formatPremium(deal)} />
          <Field label="Party" value={deal.party_alias ?? "—"} mono />
        </div>
      )}


      {/* ACTION BUTTONS — three mutually exclusive states:
            1. editing          → Save + Cancel
            2. (pending OR rejected) + unclassified + not editing → Approve-as picker + Reject
            3. (pending OR rejected) + classified + not editing   → Approve + Reject
          Rejected cards also get action buttons so staff can "rescue" a
          mistakenly-rejected deal by re-approving it. Approving a rejected
          deal is a direct status flip (no pending intermediate). */}
      {editing ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={isBusy}
            className="flex-1 rounded-md bg-amber-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={toggleEdit}
            disabled={isBusy}
            className="flex-1 rounded-md border border-white/10 bg-gray-800 px-3 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : showActions && isUnclassified ? (
        <>
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2.5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-400">
              {deal.status === "rejected" ? "Reconsider as" : "Approve as"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApproveAs(deal.id, "K")}
                disabled={isBusy}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {isBusy ? "…" : "Kachha (SBS)"}
              </button>
              <button
                onClick={() => onApproveAs(deal.id, "P")}
                disabled={isBusy}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {isBusy ? "…" : "Pakka (OroSoft)"}
              </button>
            </div>
          </div>
          {deal.status === "pending" && (
            <div className="mt-3">
              <button
                onClick={() => onReject(deal)}
                disabled={isBusy}
                className="w-full rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
        </>
      ) : showActions ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onApprove(deal)}
            disabled={isBusy}
            className="flex-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            {isBusy ? "…" : deal.status === "rejected" ? "Approve anyway" : "Approve"}
          </button>
          {deal.status === "pending" && (
            <button
              onClick={() => onReject(deal)}
              disabled={isBusy}
              className="flex-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      ) : null}

      {/* Reviewed meta — for approved/rejected cards only */}
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

// ── Screenshot OCR display ───────────────────────────────────────────────

function truncateMiddle(s: string, keepStart = 6, keepEnd = 4): string {
  if (s.length <= keepStart + keepEnd + 3) return s;
  return `${s.slice(0, keepStart)}…${s.slice(-keepEnd)}`;
}

function OcrSection({
  ocr,
  screenshotUrl,
}: {
  ocr: ScreenshotOcr | null;
  screenshotUrl: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasPayment = !!ocr && ocr.amount != null && ocr.currency;
  const hasWallets = !!ocr && (ocr.sender_wallet || ocr.receiver_wallet);
  const hasTx = !!ocr?.transaction_id;
  const hasWeight = !!ocr && (ocr.weight_grams != null || ocr.bar_count != null);
  const kindLabel =
    ocr?.type === "payment"
      ? "Payment screenshot"
      : ocr?.type === "barlist"
      ? "Bar list photo"
      : ocr?.type === "receipt"
      ? "Receipt"
      : "Screenshot attached";

  return (
    <div className="mt-3 rounded border border-sky-500/30 bg-sky-500/5 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-sky-300">
          📎 {kindLabel}
        </div>
        {ocr?.provider && (
          <span className="text-[9px] italic text-sky-400/70">via {ocr.provider}</span>
        )}
      </div>

      {/* Image thumbnail — tap to open full size in a new tab */}
      {screenshotUrl && (
        <a
          href={screenshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt="Payment screenshot"
            className="max-h-48 w-auto rounded border border-white/10 transition hover:border-sky-400/60"
          />
        </a>
      )}

      {hasPayment && ocr && (
        <div className="mt-1.5 text-sm font-semibold text-white">
          {ocr.currency}{" "}
          {typeof ocr.amount === "number" ? ocr.amount.toLocaleString() : ocr.amount}
          {ocr.status && (
            <span className="ml-2 text-[10px] font-normal text-emerald-400">
              · {ocr.status}
            </span>
          )}
        </div>
      )}

      {hasWeight && ocr && (
        <div className="mt-1.5 text-sm font-semibold text-white">
          {ocr.weight_grams != null && <span>{(ocr.weight_grams / 1000).toFixed(3)} kg</span>}
          {ocr.bar_count != null && (
            <span className="ml-2 text-[10px] font-normal text-gray-400">
              · {ocr.bar_count} pcs
            </span>
          )}
        </div>
      )}

      {hasWallets && ocr && (
        <div className="mt-1.5 space-y-0.5 font-mono text-[10px] text-gray-400">
          {ocr.sender_wallet && (
            <div>
              <span className="text-gray-600">From:</span> {truncateMiddle(ocr.sender_wallet, 6, 4)}
            </div>
          )}
          {ocr.receiver_wallet && (
            <div>
              <span className="text-gray-600">To:</span> {truncateMiddle(ocr.receiver_wallet, 6, 4)}
            </div>
          )}
        </div>
      )}

      {hasTx && ocr?.transaction_id && (
        <div className="mt-1 font-mono text-[10px] text-gray-400">
          <span className="text-gray-600">Tx:</span> {truncateMiddle(ocr.transaction_id, 8, 6)}
        </div>
      )}

      {ocr?.date && (
        <div className="mt-1 text-[10px] text-gray-400">
          <span className="text-gray-600">Date:</span> {ocr.date}
        </div>
      )}

      {ocr?.raw_text && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-sky-400 hover:text-sky-300"
          >
            {expanded ? "Hide raw text ▲" : "Show raw text ▼"}
          </button>
          {expanded && (
            <pre className="mt-1.5 w-full min-w-0 whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[10px] leading-snug text-gray-400">
              {ocr.raw_text}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

// ── Edit mode UI ─────────────────────────────────────────────────────────

function EditToggle({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      className="flex items-center gap-1.5 disabled:opacity-50"
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-wide ${
          on ? "text-amber-400" : "text-gray-500"
        }`}
      >
        Edit
      </span>
      <div
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${
          on ? "bg-amber-500" : "bg-gray-700"
        }`}
      >
        <span
          className={`inline-block size-3 transform rounded-full bg-white shadow transition ${
            on ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}

function DealEditForm({
  draft,
  onChange,
}: {
  draft: DraftFields;
  onChange: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void;
}) {
  const qtyKg = draft.qty_grams != null ? draft.qty_grams / 1000 : null;

  return (
    <div className="mt-3 space-y-3">
      {/* Type (K/P) + Direction (BUY/SELL) */}
      <div className="grid grid-cols-2 gap-2">
        <PillSelect
          label="Type"
          value={draft.deal_type}
          options={[
            { value: "K", label: "Kachha" },
            { value: "P", label: "Pakka" },
          ]}
          onChange={(v) => onChange("deal_type", v as DraftFields["deal_type"])}
        />
        <PillSelect
          label="Direction"
          value={draft.direction}
          options={[
            { value: "buy", label: "BUY" },
            { value: "sell", label: "SELL" },
          ]}
          onChange={(v) => onChange("direction", v as DraftFields["direction"])}
        />
      </div>

      {/* Metal + Purity */}
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Metal"
          value={draft.metal ?? ""}
          options={[
            { value: "gold", label: "Gold" },
            { value: "silver", label: "Silver" },
            { value: "platinum", label: "Platinum" },
            { value: "palladium", label: "Palladium" },
          ]}
          onChange={(v) => onChange("metal", (v as DraftFields["metal"]) || null)}
        />
        <TextField
          label="Purity"
          value={draft.purity ?? ""}
          placeholder="24K / 999"
          onChange={(v) => onChange("purity", v.toUpperCase() || null)}
        />
      </div>

      {/* Quantity in kg */}
      <NumberField
        label="Quantity (kg)"
        value={qtyKg}
        step="0.001"
        placeholder="10"
        onChange={(v) => onChange("qty_grams", v != null ? v * 1000 : null)}
      />

      {/* Rate USD/oz */}
      <NumberField
        label="Rate (USD / troy oz)"
        value={draft.rate_usd_per_oz}
        step="0.01"
        placeholder="2566.80"
        onChange={(v) => onChange("rate_usd_per_oz", v)}
      />

      {/* Premium value + type */}
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Premium"
          value={draft.premium_value}
          step="0.01"
          placeholder="-0.1"
          onChange={(v) => onChange("premium_value", v)}
        />
        <PillSelect
          label="Prem. type"
          value={draft.premium_type}
          options={[
            { value: "absolute", label: "Abs" },
            { value: "percent", label: "%" },
          ]}
          onChange={(v) => onChange("premium_type", v as DraftFields["premium_type"])}
        />
      </div>

      {/* Party alias */}
      <TextField
        label="Party"
        value={draft.party_alias ?? ""}
        placeholder="TAKFUNG"
        mono
        onChange={(v) => onChange("party_alias", v.toUpperCase() || null)}
      />
    </div>
  );
}

function PillSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="flex gap-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 rounded-md border px-1.5 py-1.5 text-[11px] font-semibold transition ${
                active
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-white/10 bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  mono,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  mono?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border border-white/10 bg-gray-800 px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  step?: string;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        className="w-full rounded-md border border-white/10 bg-gray-800 px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
      />
    </div>
  );
}

// ── IgnoredCard — simpler layout for non-deal messages ──────────────────
// These come from the in-memory Ignored buffer, not the DB. They have no
// parsed fields, no actions, no approval flow — they exist purely as proof
// that the bot received a message that didn't match the #NT trigger.

function IgnoredCard({ deal }: { deal: PendingDeal }) {
  return (
    <div className="w-full min-w-0 rounded-lg border border-white/5 bg-gray-900/50 p-3 opacity-70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-gray-400">{deal.sender_name}</div>
          <div className="text-[10px] text-gray-600">{formatTime(deal.received_at)}</div>
        </div>
        <span className="shrink-0 rounded-full border border-gray-600/40 bg-gray-600/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">
          Ignored
        </span>
      </div>
      <div className="mt-2 w-full min-w-0 rounded border border-white/5 bg-black/30 p-2">
        <pre className="w-full whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-gray-500">
          {deal.raw_message}
        </pre>
      </div>
      <div className="mt-1.5 text-[10px] italic text-gray-600">
        Received but not a deal code — no action required
      </div>
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
