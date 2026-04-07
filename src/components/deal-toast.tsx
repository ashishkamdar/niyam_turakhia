"use client";

import { useEffect, useState, useRef } from "react";

interface ToastDeal {
  id: string;
  contact_name: string;
  metal: string;
  quantity_grams: number;
  price_per_oz: number;
  created_by: string;
}

const METAL_COLORS: Record<string, string> = {
  gold: "text-amber-400",
  silver: "text-gray-300",
  platinum: "text-blue-300",
  palladium: "text-purple-300",
};

export function DealToast() {
  const [toast, setToast] = useState<ToastDeal | null>(null);
  const [visible, setVisible] = useState(false);
  const seenIds = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    // Load existing IDs first so we don't toast on page load
    fetch("/api/deals?limit=50")
      .then((r) => r.json())
      .then((deals: ToastDeal[]) => {
        deals.forEach((d) => { if (d.created_by === "whatsapp") seenIds.current.add(d.id); });
        initialized.current = true;
      })
      .catch(() => { initialized.current = true; });

    const poll = setInterval(async () => {
      if (!initialized.current) return;
      try {
        const res = await fetch("/api/deals?limit=20");
        const deals: ToastDeal[] = await res.json();
        for (const d of deals) {
          if (d.created_by === "whatsapp" && !seenIds.current.has(d.id)) {
            seenIds.current.add(d.id);
            setToast(d);
            setVisible(true);
            setTimeout(() => setVisible(false), 4000);
            break;
          }
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => clearInterval(poll);
  }, []);

  if (!toast || !visible) return null;

  const metalColor = METAL_COLORS[toast.metal] ?? "text-white";
  const qty = toast.quantity_grams >= 1000
    ? `${(toast.quantity_grams / 1000).toFixed(1)}kg`
    : `${toast.quantity_grams.toFixed(0)}g`;

  return (
    <div className="fixed left-3 right-3 top-3 z-[100] animate-slide-down sm:left-auto sm:right-4 sm:w-80">
      <div className="rounded-xl bg-gray-800 p-4 shadow-2xl shadow-black/50 outline outline-1 outline-amber-500/30">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 text-amber-400">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-400">Deal Locked</p>
            <p className="mt-0.5 text-sm text-white">{toast.contact_name}</p>
            <p className="mt-1 text-xs text-gray-400">
              {qty}{" "}
              <span className={metalColor}>
                {toast.metal.charAt(0).toUpperCase() + toast.metal.slice(1)}
              </span>{" "}
              at ${toast.price_per_oz.toFixed(2)}/oz
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
