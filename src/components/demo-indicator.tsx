"use client";

import { useDemo } from "./demo-engine";

export function DemoIndicator() {
  const { running, stats } = useDemo();

  if (!running) return null;

  return (
    <div className="fixed right-3 top-24 z-[90] rounded-full bg-gray-800/95 px-3 py-1.5 shadow-lg outline outline-1 outline-emerald-500/30 backdrop-blur sm:right-4 lg:right-8">
      <div className="flex items-center gap-2 text-[10px]">
        <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
        <span className="font-medium text-emerald-400">{stats.locked} locked</span>
        <span className="text-gray-500">|</span>
        <span className="text-blue-400">{stats.active} live</span>
      </div>
    </div>
  );
}
