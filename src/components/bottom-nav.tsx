"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemo } from "./demo-engine";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25", badge: "" },
  { name: "Review", href: "/review", icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z", badge: "review" },
  { name: "Stock", href: "/stock", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125", badge: "" },
  { name: "Deals", href: "/deals", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5", badge: "deals" },
  { name: "Chats", href: "/whatsapp", icon: "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z", badge: "chats" },
];

// Overflow menu — everything from the desktop sidebar that didn't make the
// cut for the 5 primary bottom-nav tabs. Opened via the "More" button so
// mobile users can still reach every page on the site.
const MORE_ITEMS = [
  { name: "Reports", href: "/reports", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { name: "Users", href: "/users", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { name: "Money Flow", href: "/money-flow", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { name: "Bot", href: "/bot", icon: "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" },
  { name: "Settings", href: "/settings", icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28zM15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { stats, running } = useDemo();
  const [whatsappCount, setWhatsappCount] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet whenever the route changes (e.g. after tapping an item).
  // This covers both client-side Link navigations and the programmatic
  // router.push() used by the Logout button below.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Prevent body scroll while the sheet is open so users can't scroll the
  // page behind the overlay on iOS Safari.
  useEffect(() => {
    if (moreOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [moreOpen]);

  function handleLogout() {
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).then(() => window.location.reload());
  }

  // "More" tab counts as active when the current route is one of the
  // overflow items (Reports, Money Flow, Bot, Settings). Keeps the tab
  // state honest so users can see where they are.
  const moreActive = MORE_ITEMS.some((item) => pathname === item.href);

  useEffect(() => {
    function fetchCounts() {
      fetch("/api/deals?limit=100").then((r) => r.json()).then((deals: { created_by: string }[]) => {
        setLockedCount(deals.filter((d) => d.created_by === "whatsapp").length);
      }).catch(() => {});
      fetch("/api/whatsapp").then((r) => r.json()).then((contacts: { contact_name: string }[]) => {
        setWhatsappCount(contacts.length);
      }).catch(() => {});
      fetch("/api/review?status=pending&limit=1").then((r) => r.json()).then((res: { counts?: { pending?: number } }) => {
        setReviewCount(res?.counts?.pending ?? 0);
      }).catch(() => {});
    }
    fetchCounts();
    const poll = setInterval(fetchCounts, 3000);
    return () => clearInterval(poll);
  }, [stats.locked]); // refetch when demo locks a deal

  // Use demo stats directly when running for instant updates
  const effectiveChats = running ? Math.max(whatsappCount, stats.active + stats.locked) : whatsappCount;
  const effectiveLocked = running ? Math.max(lockedCount, stats.locked) : lockedCount;

  function getBadgeCount(badge: string): number {
    if (badge === "deals" && effectiveLocked > 0) return effectiveLocked;
    if (badge === "chats" && effectiveChats > 0) return effectiveChats;
    if (badge === "review" && reviewCount > 0) return reviewCount;
    return 0;
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[100vw] border-t border-white/10 bg-gray-900/95 backdrop-blur lg:hidden print:hidden">
        {/* 6 columns now: the original 5 primary tabs plus a "More" overflow
            button that opens the sheet below. Touch targets stay comfortable
            on a 390px iPhone (~65px per tab). */}
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const count = getBadgeCount(item.badge);
            // Review badge stays visible even on the active /review tab so the
            // reviewer can see the remaining count while working through the queue.
            // Deals/Chats badges hide on their own active tab as before.
            const showBadge =
              count > 0 && (item.badge === "review" || !isActive);
            return (
              <Link key={item.name} href={item.href} className={`relative flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10px] font-medium ${isActive ? "text-amber-400" : "text-gray-500"}`}>
                <div className="relative">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {showBadge && (
                    <span
                      className={`absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full text-[8px] font-bold ${
                        item.badge === "review"
                          ? "bg-amber-500 text-gray-950"
                          : "bg-rose-500 text-white"
                      }`}
                    >
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </div>
                {item.name}
              </Link>
            );
          })}
          {/* More tab — opens overflow sheet with Reports/Money Flow/Bot/Settings */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="More menu"
            className={`relative flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10px] font-medium ${moreActive || moreOpen ? "text-amber-400" : "text-gray-500"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            More
          </button>
        </div>
      </nav>

      {/* Overflow sheet — slides up from above the bottom-nav on mobile only.
          Clicking the dim backdrop closes it. Route changes also close it via
          the useEffect on pathname above. */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-14 rounded-t-2xl border-t border-white/10 bg-gray-900 pb-3 shadow-2xl">
            <div className="mx-auto mb-2 mt-2 h-1 w-10 rounded-full bg-white/20" aria-hidden />
            <ul className="divide-y divide-white/5 px-2">
              {MORE_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${
                        isActive ? "bg-amber-500/10 text-amber-300" : "text-gray-200 hover:bg-white/5"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      {item.name}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-gray-200 hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
