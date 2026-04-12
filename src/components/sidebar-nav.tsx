"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { initialsFromLabel, roleAccentClass, roleLabel } from "@/lib/user-display";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25", badge: "" },
  { name: "Review", href: "/review", icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z", badge: "review" },
  { name: "Stock", href: "/stock", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125", badge: "" },
  { name: "Deals", href: "/deals", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5", badge: "deals" },
  { name: "Outbox", href: "/outbox", icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v13.5", badge: "" },
  { name: "WhatsApp", href: "/whatsapp", icon: "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z", badge: "chats" },
  { name: "Bot", href: "/bot", icon: "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z", badge: "" },
  { name: "Money Flow", href: "/money-flow", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z", badge: "" },
  { name: "Reports", href: "/reports", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z", badge: "" },
  { name: "Users", href: "/users", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z", badge: "" },
  { name: "Parties", href: "/parties", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21", badge: "" },
  { name: "Audit", href: "/audit", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z", badge: "" },
  { name: "Backup", href: "/backup", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125", badge: "" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState(0);
  const [dealsCount, setDealsCount] = useState(0);
  const [chatsCount, setChatsCount] = useState(0);
  // Current user card state — populated from /api/auth. The same
  // endpoint already returns label + role so there's no extra query.
  const [currentUser, setCurrentUser] = useState<{
    label: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated && d.label) {
          setCurrentUser({ label: d.label, role: d.role ?? "staff" });
        }
      })
      .catch(() => {});
  }, []);

  // Poll counts every 3 seconds — matches bottom-nav behaviour for mobile/desktop
  // consistency. Only runs while the sidebar is mounted (i.e. desktop viewport).
  useEffect(() => {
    function fetchCounts() {
      fetch("/api/review?status=pending&limit=1")
        .then((r) => r.json())
        .then((res: { counts?: { pending?: number } }) => {
          setReviewCount(res?.counts?.pending ?? 0);
        })
        .catch(() => {});
      fetch("/api/deals?limit=100")
        .then((r) => r.json())
        .then((deals: { created_by: string }[]) => {
          setDealsCount(deals.filter((d) => d.created_by === "whatsapp").length);
        })
        .catch(() => {});
      fetch("/api/whatsapp")
        .then((r) => r.json())
        .then((contacts: { contact_name: string }[]) => {
          setChatsCount(contacts.length);
        })
        .catch(() => {});
    }
    fetchCounts();
    const poll = setInterval(fetchCounts, 3000);
    return () => clearInterval(poll);
  }, []);

  function getBadgeCount(badge: string): number {
    if (badge === "review") return reviewCount;
    if (badge === "deals") return dealsCount;
    if (badge === "chats") return chatsCount;
    return 0;
  }

  return (
    <div className="hidden print:lg:hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-60 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-white/10 bg-gray-900 px-6">
        <div className="flex h-16 shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/prismx-logo.png"
            alt="PrismX"
            className="h-8 w-auto"
          />
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="-mx-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const count = getBadgeCount(item.badge);
              // Review badge always shows while pending > 0 (even on the active tab) —
              // it's a work queue, so the remaining count matters even while you're
              // working through it. Deals/Chats badges hide on their own active tab
              // to avoid redundant clutter.
              const showBadge =
                count > 0 && (item.badge === "review" || !isActive);
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold ${
                      isActive ? "bg-white/5 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span className="flex-1">{item.name}</span>
                    {showBadge && (
                      <span
                        className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          item.badge === "review"
                            ? "bg-amber-500 text-gray-950"
                            : "bg-rose-500 text-white"
                        }`}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto space-y-1 pb-4">
            {/* Current user card — shown above Settings so "who am I"
                is the first thing visible in the footer region. */}
            {currentUser && (
              <div className="mb-2 flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.02] px-2 py-2">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${roleAccentClass(
                    currentUser.role
                  )}`}
                >
                  {initialsFromLabel(currentUser.label)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">
                    {currentUser.label}
                  </div>
                  <div className="truncate text-[10px] uppercase tracking-wider text-gray-500">
                    {roleLabel(currentUser.role)}
                  </div>
                </div>
              </div>
            )}
            <Link href="/settings" className="group flex gap-x-3 rounded-md p-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            {/* Change PIN — self-service */}
            <ChangePinButton />
            <button
              onClick={() => {
                fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                }).then(() => window.location.reload());
              }}
              className="group flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-rose-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Logout
            </button>
            {/* Version tag */}
            <div className="mt-2 px-2 text-[9px] text-gray-600">
              PrismX v1.0 · Apr 2026
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

// ─── Change PIN button + inline dialog ────────────────────────────────

function ChangePinButton() {
  const [open, setOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleChange() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ text: "PIN changed successfully", ok: true });
        setCurrentPin("");
        setNewPin("");
        setTimeout(() => { setOpen(false); setMsg(null); }, 1500);
      } else {
        setMsg({ text: json.error || "Failed", ok: false });
      }
    } catch {
      setMsg({ text: "Network error", ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
        Change PIN
      </button>
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-2">
      <div className="mb-2 text-xs font-semibold text-white">Change PIN</div>
      <div className="space-y-1.5">
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="Current PIN"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded border border-white/10 bg-gray-950 px-2 py-1 font-mono text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="New PIN (4-8 digits)"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded border border-white/10 bg-gray-950 px-2 py-1 font-mono text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
        />
      </div>
      {msg && (
        <p className={`mt-1.5 text-[11px] ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>
          {msg.text}
        </p>
      )}
      <div className="mt-2 flex gap-1">
        <button
          onClick={handleChange}
          disabled={busy || !currentPin || !newPin || newPin.length < 4}
          className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
        >
          {busy ? "…" : "Save"}
        </button>
        <button
          onClick={() => { setOpen(false); setMsg(null); setCurrentPin(""); setNewPin(""); }}
          className="rounded bg-gray-700 px-2 py-1 text-[11px] font-semibold text-gray-300 hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
