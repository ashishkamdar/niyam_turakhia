"use client";

/**
 * DispatchBanner — global "someone is pushing trades right now" notice.
 *
 * Polls /api/dispatch every 2 seconds (any page, any user). When the
 * response carries a non-null `lock` AND the lock belongs to a user
 * OTHER than the current viewer, a slim pulsing banner slides down
 * below the price ticker. The banner hides itself automatically once
 * the lock expires (3 seconds after acquisition) or once the GET
 * response returns lock: null.
 *
 * The banner is deliberately rendered at the layout level (inside
 * AuthGate, outside the main scroll area) so it appears on EVERY
 * page — users on /dashboard, /stock, /review, etc. all see it, not
 * just people sitting on /outbox.
 *
 * Polling, not SSE: 10-15 concurrent users hitting /api/dispatch
 * every 2 seconds is ~7 req/sec of cheap SQLite reads. SSE would be
 * lower latency but adds plumbing (connection lifecycle, reconnect,
 * PM2 fork compat) that isn't worth the complexity for a 3-second
 * display window.
 */

import { useEffect, useState } from "react";

type Lock = {
  started_at: string;
  started_by: string;
  target: "orosoft" | "sbs";
  deal_count: number;
  expires_at: string;
};

type DispatchGetResponse = {
  pakka_outbox: unknown[];
  kachha_outbox: unknown[];
  history: unknown[];
  lock: Lock | null;
};

export function DispatchBanner() {
  const [lock, setLock] = useState<Lock | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);

  // Resolve the current user's label once on mount. Used to suppress
  // the banner when the current user is the one doing the dispatch —
  // they already see their own local animation on /outbox and don't
  // need a redundant "you are dispatching" notice.
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated && d.label) setCurrentLabel(d.label);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/dispatch");
        if (!res.ok) return;
        const json: DispatchGetResponse = await res.json();
        if (cancelled) return;
        setLock(json.lock);
      } catch {
        // stay silent — the next tick will retry
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Hide entirely when there's no lock, or when the lock is the
  // current user's own dispatch (they see the /outbox animation).
  if (!lock) return null;
  if (currentLabel && lock.started_by === currentLabel) return null;

  const targetLabel = lock.target === "orosoft" ? "OroSoft" : "SBS Excel";
  const targetAccent =
    lock.target === "orosoft"
      ? "from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/30"
      : "from-sky-500/20 via-sky-500/10 to-transparent border-sky-500/30";
  const dotAccent =
    lock.target === "orosoft" ? "bg-emerald-400" : "bg-sky-400";

  return (
    <div
      className={`sticky top-0 z-40 border-b bg-gradient-to-r ${targetAccent} print:hidden`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex size-2.5 shrink-0">
            <span className={`absolute inline-flex size-full animate-ping rounded-full ${dotAccent} opacity-60`} />
            <span className={`relative inline-flex size-2.5 rounded-full ${dotAccent}`} />
          </div>
          <span className="font-semibold text-white">
            <span className="text-amber-300">{lock.started_by}</span> is pushing{" "}
            <span className="tabular-nums">{lock.deal_count}</span> {lock.target === "orosoft" ? "Pakka" : "Kachha"} deal
            {lock.deal_count === 1 ? "" : "s"} to {targetLabel}…
          </span>
        </div>
        <span className="hidden text-[10px] uppercase tracking-wider text-gray-400 sm:inline">
          Dispatch in progress · other operations paused
        </span>
      </div>
    </div>
  );
}
