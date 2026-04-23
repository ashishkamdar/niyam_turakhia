"use client";

/**
 * Trade Desk — standalone trade entry page for desk staff.
 *
 * URL: /portal/trade
 *
 * Completely isolated from PrismX. Staff sees a clean form to enter
 * lock codes in the same #NT format used on WhatsApp. Trades land in
 * pending_deals(status='pending') and appear on PrismX's /review tab
 * for the checker to approve.
 *
 * No sidebar, no navigation, no PrismX branding. Staff has no idea
 * the mother software exists.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PinPad } from "@/components/pin-pad";
import { parseDealCode } from "@/lib/deal-code-parser";

type RecentEntry = {
  id: string;
  raw_message: string;
  deal_type: string | null;
  direction: string | null;
  metal: string | null;
  purity: string | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  party_alias: string | null;
  status: string;
  received_at: string;
};

type SubmitResult = {
  line: string;
  ok: boolean;
  parsed?: Record<string, unknown>;
  errors?: string[];
};

const METAL_COLORS: Record<string, string> = {
  gold: "text-amber-400",
  silver: "text-gray-300",
  platinum: "text-blue-300",
  palladium: "text-purple-300",
};

export default function TradeDeskPage() {
  const [authed, setAuthed] = useState<"loading" | "locked" | "unlocked">("loading");
  const [label, setLabel] = useState("");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) {
          setAuthed("unlocked");
          setLabel(d.label ?? "");
        } else {
          setAuthed("locked");
        }
      })
      .catch(() => setAuthed("locked"));
  }, []);

  if (authed === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (authed === "locked") {
    return (
      <div className="min-h-screen">
        <TradeHeader />
        <PinPad
          onSuccess={() => {
            fetch("/api/auth")
              .then((r) => r.json())
              .then((d) => {
                setLabel(d.label ?? "");
                setAuthed("unlocked");
              });
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TradeHeader label={label} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <TradeEntryForm label={label} />
      </main>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────

function TradeHeader({ label }: { label?: string }) {
  return (
    <header className="border-b border-white/10 bg-gray-900/80 px-4 py-3">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <div>
          <h1 className="text-sm font-bold tracking-wide text-white">
            JINYI GOLD HK
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            Trade Desk
          </p>
        </div>
        <div className="flex items-center gap-3">
          {label && (
            <span className="text-xs text-gray-400">{label}</span>
          )}
          {label && (
            <button
              onClick={() => {
                fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                }).then(() => window.location.reload());
              }}
              className="rounded border border-white/10 px-2 py-1 text-[11px] text-gray-400 hover:text-rose-400"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Trade Entry Form ────────────────────────────────────────────────

function TradeEntryForm({ label }: { label: string }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResults, setLastResults] = useState<SubmitResult[] | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-entry?limit=10");
      const json = await res.json();
      setRecent(json.entries ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Live parse preview — parse each line as the user types
  const preview = useMemo(() => {
    if (!text.trim()) return [];
    return text
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const result = parseDealCode(line.trim());
        return { line: line.trim(), ...result };
      });
  }, [text]);

  async function handleSubmit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setLastResults(null);

    try {
      const res = await fetch("/api/trade-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (json.ok) {
        setLastResults(json.results);
        setText("");
        loadRecent();
      } else {
        setLastResults([{ line: text, ok: false, errors: [json.error] }]);
      }
    } catch {
      setLastResults([{ line: text, ok: false, errors: ["Network error"] }]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Entry area */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          Enter Trade Code
        </label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setLastResults(null); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={3}
          placeholder={"#NTP SELL 10KG GOLD 24K @2566.80 -0.1 TAKFUNG\n#NTK BUY 50KG SILVER 999 @70.51 +1.2 SAPAN"}
          className="w-full rounded-lg border border-white/10 bg-gray-900 px-4 py-3 font-mono text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-gray-500">
            One trade per line · Ctrl+Enter to submit
          </p>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit Trade"}
          </button>
        </div>
      </div>

      {/* Live preview */}
      {preview.length > 0 && !lastResults && (
        <div className="rounded-lg border border-white/5 bg-gray-900 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Preview
          </div>
          <div className="space-y-2">
            {preview.map((p, i) => (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-xs ${
                  p.is_deal_code && p.parsed
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : p.is_deal_code && !p.parsed
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-rose-500/20 bg-rose-500/5"
                }`}
              >
                {p.is_deal_code ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-bold ${
                      p.fields.deal_type === "K" ? "text-sky-300" :
                      p.fields.deal_type === "P" ? "text-emerald-300" :
                      "text-amber-300"
                    }`}>
                      {p.fields.deal_type === "K" ? "KACHHA" : p.fields.deal_type === "P" ? "PAKKA" : "UNCLASSIFIED"}
                    </span>
                    <span className={`font-semibold ${
                      p.fields.direction === "sell" ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {(p.fields.direction ?? "?").toUpperCase()}
                    </span>
                    <span className="text-white">
                      {p.fields.qty_grams ? (p.fields.qty_grams >= 1000 ? `${(p.fields.qty_grams / 1000).toFixed(2)}kg` : `${p.fields.qty_grams}g`) : "?"}
                    </span>
                    <span className={`font-semibold capitalize ${METAL_COLORS[p.fields.metal ?? ""] ?? "text-gray-300"}`}>
                      {p.fields.metal ?? "?"}
                    </span>
                    {p.fields.purity && <span className="text-gray-400">{p.fields.purity}</span>}
                    <span className="text-gray-300">@{p.fields.rate_usd_per_oz ?? "?"}</span>
                    {p.fields.premium_value != null && (
                      <span className="text-gray-400">
                        {p.fields.premium_value > 0 ? "+" : ""}{p.fields.premium_value}{p.fields.premium_type === "percent" ? "%" : ""}
                      </span>
                    )}
                    <span className="font-semibold text-white">{p.fields.party_alias ?? ""}</span>
                    {p.errors.length > 0 && (
                      <span className="text-amber-400">⚠ {p.errors.join(", ")}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-rose-300">
                    ✗ Not a deal code — must start with #NTK, #NTP, or #NT
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit results */}
      {lastResults && (
        <div className="rounded-lg border border-white/5 bg-gray-900 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Result
          </div>
          <div className="space-y-2">
            {lastResults.map((r, i) => (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-xs ${
                  r.ok
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/5 text-rose-300"
                }`}
              >
                {r.ok ? (
                  <span>✓ Trade submitted — {r.line}</span>
                ) : (
                  <span>✗ {r.errors?.join(", ") ?? "Failed"} — {r.line}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Format reference (collapsible) */}
      <details className="rounded-lg border border-white/5 bg-gray-900">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-gray-400 hover:text-white">
          Format Reference
        </summary>
        <div className="border-t border-white/5 px-4 py-3 font-mono text-xs text-gray-400">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">Syntax</p>
          <p className="text-white">&lt;TRIGGER&gt; &lt;BUY/SELL&gt; &lt;QTY&gt;&lt;UNIT&gt; &lt;METAL&gt; [PURITY] @&lt;RATE&gt; [PREMIUM] &lt;PARTY&gt;</p>
          <p className="mt-3 mb-2 text-[10px] uppercase tracking-wider text-gray-500">Examples</p>
          <p>#NTP SELL 10KG GOLD 24K @2566.80 -0.1 TAKFUNG</p>
          <p>#NTK BUY 50KG SILVER 999 @70.51 +1.2 SAPAN</p>
          <p>#NT SELL 2KG PLATINUM 999 @979.25 -4 SHAH</p>
          <p className="mt-3 mb-2 text-[10px] uppercase tracking-wider text-gray-500">Triggers</p>
          <p><span className="text-emerald-300">#NTP</span> = Pakka &nbsp; <span className="text-sky-300">#NTK</span> = Kachha &nbsp; <span className="text-amber-300">#NT</span> = Decide later</p>
        </div>
      </details>

      {/* Recent entries */}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            My Recent Entries
          </h2>
          <div className="overflow-hidden rounded-lg border border-white/5 bg-gray-900">
            <ul className="divide-y divide-white/5">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-gray-300">{e.raw_message}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                      <span className={e.status === "approved" ? "text-emerald-400" : e.status === "rejected" ? "text-rose-400" : "text-amber-300"}>
                        {e.status.toUpperCase()}
                      </span>
                      <span>
                        {new Date(e.received_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
