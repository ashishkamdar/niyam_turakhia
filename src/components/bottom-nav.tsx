"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemo } from "./demo-engine";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25", badge: "" },
  { name: "Stock", href: "/stock", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125", badge: "" },
  { name: "Deals", href: "/deals", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5", badge: "deals" },
  { name: "Chats", href: "/whatsapp", icon: "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z", badge: "chats" },
  { name: "Bot", href: "/bot", icon: "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z", badge: "" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { stats, running } = useDemo();
  const [whatsappCount, setWhatsappCount] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);

  useEffect(() => {
    function fetchCounts() {
      fetch("/api/deals?limit=100").then((r) => r.json()).then((deals: { created_by: string }[]) => {
        setLockedCount(deals.filter((d) => d.created_by === "whatsapp").length);
      }).catch(() => {});
      fetch("/api/whatsapp").then((r) => r.json()).then((contacts: { contact_name: string }[]) => {
        setWhatsappCount(contacts.length);
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
    return 0;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[100vw] border-t border-white/10 bg-gray-900/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const count = getBadgeCount(item.badge);
          return (
            <Link key={item.name} href={item.href} className={`relative flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10px] font-medium ${isActive ? "text-amber-400" : "text-gray-500"}`}>
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {count > 0 && !isActive && (
                  <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
