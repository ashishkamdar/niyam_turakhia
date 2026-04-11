"use client";

/**
 * FySelector — compact dropdown for switching the active financial year.
 *
 * Placement: top bar (PriceTicker) on mobile, any page header on
 * desktop. Small enough to fit next to other header controls, but
 * tappable on a phone.
 *
 * Reads + writes via useFy(). Closes on outside-click, escape key,
 * and selection.
 */

import { useEffect, useRef, useState } from "react";
import { useFy } from "./fy-provider";

export function FySelector({ className = "" }: { className?: string }) {
  const { fy, fys, setFy } = useFy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Outside-click and Escape key both dismiss the menu. Only attach
  // handlers while open so idle <FySelector>s don't consume events.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative print:hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5 text-amber-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span className="tabular-nums">{fy.label}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`size-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-white/10 bg-gray-900 shadow-2xl"
        >
          <div className="border-b border-white/5 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Financial Year
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {fys.map((option, i) => {
              const isSelected = option.label === fy.label;
              const isCurrent = i === 0;
              return (
                <li key={option.label}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setFy(option.label);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? "bg-amber-500/10 text-amber-200"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums font-semibold">{option.label}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                          Current
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3.5 text-amber-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
