interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  sublabel?: string;
}

export function StatCard({ label, value, change, changeType = "neutral", sublabel }: StatCardProps) {
  const changeColor =
    changeType === "positive"
      ? "text-emerald-400 print:text-emerald-700"
      : changeType === "negative"
      ? "text-rose-400 print:text-rose-700"
      : "text-gray-400 print:text-gray-600";

  return (
    // Print variants tighten padding so 7-figure amounts fit inside the card's
    // fixed grid-cols-3 width on A4 paper. The value font drops from text-3xl
    // (30px) on desktop to text-lg (18px) in print, and uses tabular-nums so
    // the digits line up column-to-column across the three stat cards.
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 overflow-hidden rounded-lg bg-gray-900 px-4 py-6 outline outline-1 outline-white/10 print:gap-x-2 print:gap-y-1 print:px-3 print:py-3 print:outline-0 sm:px-6">
      <dt className="text-sm font-medium text-gray-400 print:text-[10px] print:font-semibold print:uppercase print:tracking-wider print:text-gray-600">
        {label}
      </dt>
      {change && (
        <dd className={`text-xs font-medium ${changeColor} print:text-[10px]`}>{change}</dd>
      )}
      <dd className="w-full flex-none overflow-hidden text-2xl font-semibold tracking-tight text-white tabular-nums sm:text-3xl print:text-lg print:text-black">
        {value}
      </dd>
      {sublabel && (
        <dd className="text-xs text-gray-500 print:text-[9px] print:text-gray-500">{sublabel}</dd>
      )}
    </div>
  );
}
