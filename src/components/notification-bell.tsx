"use client";

/**
 * NotificationBell — bell icon with unread count badge + dropdown panel.
 *
 * Polls /api/notifications every 5 seconds. Shows a red badge with the
 * unread count when > 0. Click opens a dropdown with the last 20
 * notifications; clicking one marks it read and navigates to the href.
 * "Mark all read" clears the badge in one click.
 *
 * Mounted in PriceTicker (both mobile + desktop strips) alongside the
 * FY selector and theme toggle.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  href: string | null;
  created_by: string | null;
  is_read: boolean;
};

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const TYPE_ICONS: Record<string, string> = {
  deal_approved: "✓",
  deal_rejected: "✗",
  edit_deal: "✎",
  dispatch: "📦",
  session_kicked: "🔑",
  backup_created: "💾",
  backup_restored: "♻",
  party_created: "🏢",
  change_own_pin: "🔐",
};

export function NotificationBell({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.notifications?.slice(0, 20) ?? []);
      setUnreadCount(json.unread_count ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  // Outside click dismiss
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id }),
    });
    load();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    load();
  }

  function handleClick(n: Notification) {
    if (!n.is_read) markRead(n.id);
    if (n.href) {
      router.push(n.href);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={`relative print:hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative flex size-8 items-center justify-center rounded-md border border-white/10 bg-gray-900 text-gray-300 transition hover:bg-white/5 hover:text-amber-300"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 overflow-hidden rounded-lg border border-white/10 bg-gray-900 shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
            <span className="text-xs font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] font-semibold text-amber-300 hover:text-amber-200"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-gray-500">
                No notifications yet.
              </li>
            )}
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${
                    !n.is_read ? "bg-amber-500/5" : ""
                  }`}
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs">
                    {n.icon ?? TYPE_ICONS[n.type] ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-xs font-semibold ${!n.is_read ? "text-white" : "text-gray-300"}`}>
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-gray-500">
                        {timeAgo(n.timestamp)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">{n.body}</p>
                    )}
                    {n.created_by && (
                      <p className="mt-0.5 text-[10px] text-gray-500">by {n.created_by}</p>
                    )}
                  </div>
                  {!n.is_read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
