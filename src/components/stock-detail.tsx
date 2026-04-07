import type { Deal } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  in_hk: "bg-blue-400/10 text-blue-400",
  in_transit: "bg-yellow-400/10 text-yellow-400",
  in_refinery: "bg-orange-400/10 text-orange-400",
  locked: "bg-gray-400/10 text-gray-400",
  pending: "bg-gray-400/10 text-gray-400",
};

export function StockDetail({ deals, onClose }: { deals: Deal[]; onClose: () => void }) {
  return (
    <div className="space-y-3">
      <button onClick={onClose} className="text-sm text-amber-400 hover:text-amber-300">&larr; Back to summary</button>
      <div className="space-y-2">
        {deals.map((d) => (
          <div key={d.id} className="rounded-lg bg-gray-800/50 p-3 outline outline-1 outline-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{new Date(d.date).toLocaleDateString()}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[d.status] ?? "bg-gray-400/10 text-gray-400"}`}>{d.status.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
              <div>Purity: <span className="text-gray-200">{d.purity}</span></div>
              <div>Qty: <span className="text-gray-200">{d.quantity_grams.toFixed(2)}g</span></div>
              <div>Pure: <span className="text-gray-200">{d.pure_equivalent_grams.toFixed(2)}g</span></div>
              <div>Cost: <span className="text-gray-200">${d.price_per_oz.toFixed(4)}/oz</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
