"use client";

import { useDemo } from "./demo-engine";

export function DemoMode() {
  const { running, elapsed, stats, start, stop } = useDemo();

  const MAX_DURATION = 10 * 60;
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
        onClick={start}
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
          onClick={stop}
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
