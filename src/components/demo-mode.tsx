"use client";

import { useState, useRef, useEffect } from "react";
import { DEMO_SCRIPTS } from "@/lib/demo-scripts";

export function DemoMode() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState({ sent: 0, locked: 0, active: 0 });
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(new Map<string, number>());

  const MAX_DURATION = 10 * 60; // 10 minutes in seconds

  function startDemo() {
    activeRef.current = true;
    setRunning(true);
    setElapsed(0);
    setStats({ sent: 0, locked: 0, active: 0 });
    progressRef.current = new Map();
    DEMO_SCRIPTS.forEach((s) => progressRef.current.set(s.contact_name, 0));

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= MAX_DURATION - 1) {
          stopDemo();
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);

    scheduleNext();
  }

  function stopDemo() {
    activeRef.current = false;
    setRunning(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    timeoutRef.current = null;
    timerRef.current = null;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function scheduleNext() {
    if (!activeRef.current) return;

    const active = DEMO_SCRIPTS.filter((s) => {
      const progress = progressRef.current.get(s.contact_name) ?? 0;
      return progress < s.messages.length;
    });

    if (active.length === 0) {
      stopDemo();
      return;
    }

    // Random delay: 2-6 seconds
    const delay = Math.floor(Math.random() * 4000) + 2000;
    timeoutRef.current = setTimeout(async () => {
      if (!activeRef.current) return;

      // Send 1-2 messages at a time (simulate parallel conversations)
      const count = Math.random() > 0.6 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const remaining = DEMO_SCRIPTS.filter((s) => {
          const p = progressRef.current.get(s.contact_name) ?? 0;
          return p < s.messages.length;
        });
        if (remaining.length === 0) break;

        const script = remaining[Math.floor(Math.random() * remaining.length)];
        const idx = progressRef.current.get(script.contact_name) ?? 0;
        const msg = script.messages[idx];
        const isLockMsg = /\block\b/i.test(msg.text);

        try {
          await fetch("/api/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contact_name: script.contact_name,
              contact_location: script.contact_location,
              direction: msg.direction,
              message: msg.text,
              ...(isLockMsg && script.locks
                ? {
                    metal: script.metal,
                    purity: script.purity,
                    quantity_grams: script.quantity_grams,
                    price_per_oz: script.price_per_oz,
                    deal_direction: script.contact_location === "hong_kong" ? "sell" : "buy",
                  }
                : {}),
            }),
          });

          progressRef.current.set(script.contact_name, idx + 1);

          setStats((prev) => ({
            sent: prev.sent + 1,
            locked: prev.locked + (isLockMsg && script.locks ? 1 : 0),
            active: DEMO_SCRIPTS.filter((s) => {
              const p = progressRef.current.get(s.contact_name) ?? 0;
              return p > 0 && p < s.messages.length;
            }).length,
          }));
        } catch {
          // ignore
        }
      }

      scheduleNext();
    }, delay);
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const remaining = MAX_DURATION - elapsed;
  const remMin = Math.floor(remaining / 60);
  const remSec = remaining % 60;
  const remStr = `${remMin}:${remSec.toString().padStart(2, "0")}`;

  if (!running) {
    return (
      <button
        onClick={startDemo}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-center shadow-lg shadow-emerald-500/20 transition hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98]"
      >
        <div className="flex items-center justify-center gap-3">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6 text-white">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-base font-bold text-white">Start Demo</p>
            <p className="text-[10px] text-emerald-100/70">15 WhatsApp chats &middot; 10 min &middot; live deals</p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900 p-4 outline outline-1 outline-emerald-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-3 animate-pulse rounded-full bg-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-white">Demo Running</p>
            <p className="text-[10px] text-gray-400">{timeStr} elapsed &middot; {remStr} remaining</p>
          </div>
        </div>
        <button
          onClick={stopDemo}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
        >
          Stop
        </button>
      </div>
      <div className="mt-3 flex gap-3">
        <div className="flex-1 rounded-lg bg-white/5 p-2 text-center">
          <p className="text-lg font-bold text-white">{stats.sent}</p>
          <p className="text-[9px] text-gray-400">Messages</p>
        </div>
        <div className="flex-1 rounded-lg bg-blue-500/10 p-2 text-center">
          <p className="text-lg font-bold text-blue-400">{stats.active}</p>
          <p className="text-[9px] text-blue-400/70">Negotiating</p>
        </div>
        <div className="flex-1 rounded-lg bg-amber-500/10 p-2 text-center">
          <p className="text-lg font-bold text-amber-400">{stats.locked}</p>
          <p className="text-[9px] text-amber-400/70">Locked</p>
        </div>
      </div>
    </div>
  );
}
