"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { DEMO_SCRIPTS } from "@/lib/demo-scripts";

interface DemoState {
  running: boolean;
  elapsed: number;
  stats: { sent: number; locked: number; active: number };
  start: () => void;
  stop: () => void;
}

const DemoContext = createContext<DemoState>({
  running: false,
  elapsed: 0,
  stats: { sent: 0, locked: 0, active: 0 },
  start: () => {},
  stop: () => {},
});

export function useDemo() {
  return useContext(DemoContext);
}

const MAX_DURATION = 10 * 60;

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState({ sent: 0, locked: 0, active: 0 });
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(new Map<string, number>());

  const stopFn = useCallback(() => {
    activeRef.current = false;
    setRunning(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    timeoutRef.current = null;
    timerRef.current = null;
  }, []);

  const scheduleNext = useCallback(() => {
    if (!activeRef.current) return;

    const active = DEMO_SCRIPTS.filter((s) => {
      const p = progressRef.current.get(s.contact_name) ?? 0;
      return p < s.messages.length;
    });

    if (active.length === 0) {
      stopFn();
      return;
    }

    const delay = Math.floor(Math.random() * 6000) + 4000; // 4-10 seconds
    timeoutRef.current = setTimeout(async () => {
      if (!activeRef.current) return;

      const count = Math.random() > 0.8 ? 2 : 1; // mostly 1 message at a time
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
  }, [stopFn]);

  const startFn = useCallback(() => {
    // Reset demo data first
    fetch("/api/simulator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-demo" }),
    }).then(() => {
      activeRef.current = true;
      setRunning(true);
      setElapsed(0);
      setStats({ sent: 0, locked: 0, active: 0 });
      progressRef.current = new Map();
      DEMO_SCRIPTS.forEach((s) => progressRef.current.set(s.contact_name, 0));

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_DURATION - 1) {
            stopFn();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

      scheduleNext();
    });
  }, [stopFn, scheduleNext]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <DemoContext.Provider value={{ running, elapsed, stats, start: startFn, stop: stopFn }}>
      {children}
    </DemoContext.Provider>
  );
}
