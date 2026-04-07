interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  sublabel?: string;
}

export function StatCard({ label, value, change, changeType = "neutral", sublabel }: StatCardProps) {
  const changeColor = changeType === "positive" ? "text-emerald-400" : changeType === "negative" ? "text-rose-400" : "text-gray-400";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-lg bg-gray-900 px-4 py-6 outline outline-1 outline-white/10 sm:px-6">
      <dt className="text-sm font-medium text-gray-400">{label}</dt>
      {change && <dd className={`text-xs font-medium ${changeColor}`}>{change}</dd>}
      <dd className="w-full flex-none text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</dd>
      {sublabel && <dd className="text-xs text-gray-500">{sublabel}</dd>}
    </div>
  );
}
