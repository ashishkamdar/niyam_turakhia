"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/stat-card";
import type { Delivery, Settlement, Payment, Currency } from "@/lib/types";

type Tab = "deliveries" | "payments" | "settlement";

const BUYER_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "firm", label: "Firm / Company" },
  { value: "bank", label: "Bank" },
  { value: "crypto_exchange", label: "Crypto Exchange" },
];

const BUYER_CURRENCY: Record<string, { currency: string; method: string }> = {
  individual: { currency: "HKD", method: "Local bank transfer" },
  firm: { currency: "HKD", method: "Local bank transfer" },
  bank: { currency: "USD", method: "Wire transfer (SWIFT)" },
  crypto_exchange: { currency: "USDT", method: "Crypto transfer" },
};

const SETTLEMENT_CHANNELS = [
  { value: "wire_transfer", label: "Wire Transfer (SWIFT)" },
  { value: "crypto", label: "Crypto Transfer" },
  { value: "local_dealer", label: "Local FX Dealer" },
  { value: "cash", label: "Cash / Hawala" },
];

const CURRENCY_COLORS: Record<string, string> = { USD: "text-emerald-400", HKD: "text-blue-400", AED: "text-amber-400", USDT: "text-cyan-400" };
const STATUS_COLORS: Record<string, string> = {
  preparing: "bg-gray-400/10 text-gray-400",
  in_transit: "bg-yellow-400/10 text-yellow-400",
  delivered: "bg-emerald-400/10 text-emerald-400",
  pending: "bg-yellow-400/10 text-yellow-400",
  partial: "bg-blue-400/10 text-blue-400",
  settled: "bg-emerald-400/10 text-emerald-400",
};

const selectCls = "w-full appearance-none rounded-md bg-white/5 py-2 pr-8 pl-3 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";
const inputCls = "block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

const fmt = (n: number, curr?: string) => {
  const pre = curr === "HKD" ? "HK$" : curr === "AED" ? "AED " : curr === "USDT" ? "USDT " : "$";
  return pre + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function MoneyFlowPage() {
  const [tab, setTab] = useState<Tab>("deliveries");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    fetch("/api/deliveries?limit=200").then((r) => r.json()).then(setDeliveries).catch(() => {});
    fetch("/api/settlements?limit=200").then((r) => r.json()).then(setSettlements).catch(() => {});
    fetch("/api/payments?limit=200").then((r) => r.json()).then(setPayments).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const inTransit = deliveries.filter((d) => d.status === "in_transit").length;
  const preparing = deliveries.filter((d) => d.status === "preparing").length;
  const pendingSettlements = settlements.filter((s) => s.status === "pending").length;
  const totalShippingCost = deliveries.reduce((s, d) => s + d.shipping_cost_usd, 0);
  const totalReceived = settlements.reduce((s, d) => s + d.amount_received, 0);
  const totalSentDubai = settlements.reduce((s, d) => s + d.amount_sent_to_dubai, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Delivery & Payment</h1>
        <p className="text-xs text-gray-400">Ship metal to HK, receive payment, settle to Dubai.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Preparing" value={String(preparing)} sublabel="shipments" />
        <StatCard label="In Transit" value={String(inTransit)} sublabel="to Hong Kong" />
        <StatCard label="Pending" value={String(pendingSettlements)} sublabel="settlements" />
        <StatCard label="Shipping Cost" value={fmt(totalShippingCost)} sublabel="total" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-800/50 p-1">
        {([
          { id: "deliveries" as Tab, label: "Deliveries", count: deliveries.length },
          { id: "payments" as Tab, label: "Received", count: settlements.filter((s) => s.amount_received > 0).length },
          { id: "settlement" as Tab, label: "Settlement", count: settlements.length },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setShowForm(false); }}
            className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${tab === t.id ? "bg-amber-600 text-white" : "text-gray-400"}`}
          >
            {t.label} {t.count > 0 && <span className="ml-1 text-[10px] opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full rounded-lg bg-gray-900 py-3 text-center text-sm font-medium text-amber-400 outline outline-1 outline-white/10 hover:bg-gray-800"
      >
        {showForm ? "Cancel" : tab === "deliveries" ? "+ New Delivery" : tab === "payments" ? "+ Record Payment Received" : "+ Record Settlement"}
      </button>

      {/* Forms */}
      {showForm && tab === "deliveries" && <DeliveryForm onCreated={() => { load(); setShowForm(false); }} />}
      {showForm && tab === "payments" && <PaymentReceivedForm onCreated={() => { load(); setShowForm(false); }} />}
      {showForm && tab === "settlement" && <SettlementForm onCreated={() => { load(); setShowForm(false); }} />}

      {/* Lists */}
      {tab === "deliveries" && (
        <div className="space-y-2">
          {deliveries.map((d) => (
            <div key={d.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize text-amber-400">{d.metal}</span>
                  <span className="text-xs text-gray-400">{d.weight_grams.toLocaleString()}g</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[d.status]}`}>
                  {d.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
                <div>To: <span className="text-white">{d.buyer_name || "—"}</span></div>
                <div>Type: <span className="text-white">{d.buyer_type.replace(/_/g, " ")}</span></div>
                <div>Shipping: <span className="text-white">{fmt(d.shipping_cost_usd)}</span></div>
                <div>Date: <span className="text-white">{new Date(d.date).toLocaleDateString()}</span></div>
              </div>
            </div>
          ))}
          {deliveries.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No deliveries yet.</p>}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-2">
          {settlements.filter((s) => s.amount_received > 0).map((s) => (
            <div key={s.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className={`text-base font-semibold ${CURRENCY_COLORS[s.currency_received] ?? "text-white"}`}>
                  {fmt(s.amount_received, s.currency_received)}
                </span>
                <span className="text-xs text-gray-400">{s.payment_method}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{new Date(s.date).toLocaleDateString()}</p>
            </div>
          ))}
          {/* Also show old payments table data */}
          {payments.filter((p) => p.direction === "received").slice(0, 10).map((p) => (
            <div key={p.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className={`text-base font-semibold ${CURRENCY_COLORS[p.currency] ?? "text-white"}`}>
                  {fmt(p.amount, p.currency)}
                </span>
                <span className="text-xs text-gray-400">{p.mode.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{new Date(p.date).toLocaleDateString()}</p>
            </div>
          ))}
          {settlements.length === 0 && payments.filter((p) => p.direction === "received").length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No payments received yet.</p>
          )}
        </div>
      )}

      {tab === "settlement" && (
        <div className="space-y-2">
          {/* Summary */}
          {(totalReceived > 0 || totalSentDubai > 0) && (
            <div className="rounded-lg bg-white/5 p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Received from HK: <span className="font-medium text-emerald-400">{fmt(totalReceived)}</span></div>
                <div>Sent to Dubai: <span className="font-medium text-rose-300">{fmt(totalSentDubai)}</span></div>
              </div>
            </div>
          )}
          {settlements.map((s) => (
            <div key={s.id} className="rounded-lg bg-gray-900 p-3 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">HK</span>
                  <span className={`text-sm font-medium ${CURRENCY_COLORS[s.currency_received] ?? "text-white"}`}>
                    {fmt(s.amount_received, s.currency_received)}
                  </span>
                  <span className="text-gray-500">&rarr;</span>
                  <span className="text-xs text-gray-400">Dubai</span>
                  <span className={`text-sm font-medium ${CURRENCY_COLORS[s.currency_sent] ?? "text-white"}`}>
                    {fmt(s.amount_sent_to_dubai, s.currency_sent)}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[s.status]}`}>
                  {s.status.toUpperCase()}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
                <div>Channel: <span className="text-white">{s.channel.replace(/_/g, " ") || "—"}</span></div>
                <div>Seller: <span className="text-white">{s.seller_paid || "—"} {s.seller_amount > 0 && `(${fmt(s.seller_amount, "AED")})`}</span></div>
              </div>
              <p className="mt-1 text-xs text-gray-500">{new Date(s.date).toLocaleDateString()}</p>
            </div>
          ))}
          {settlements.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No settlements yet.</p>}
        </div>
      )}
    </div>
  );
}

/* ─── Delivery Form ───────────────────────────────────────── */
const BUYER_DIRECTORY: Record<string, { name: string; type: string }[]> = {
  bank: [
    { name: "HSBC Hong Kong", type: "bank" },
    { name: "Standard Chartered HK", type: "bank" },
    { name: "Bank of China HK", type: "bank" },
  ],
  firm: [
    { name: "Chang Enterprises", type: "firm" },
    { name: "Li Wei Trading", type: "firm" },
    { name: "HK Gold Dealers Ltd", type: "firm" },
    { name: "Asia Precious Metals Co", type: "firm" },
  ],
  individual: [
    { name: "Mr. Chang", type: "individual" },
    { name: "Mr. Wong", type: "individual" },
  ],
  crypto_exchange: [
    { name: "Binance HK", type: "crypto_exchange" },
    { name: "OKX Exchange", type: "crypto_exchange" },
    { name: "Crypto.com", type: "crypto_exchange" },
  ],
};

function DeliveryForm({ onCreated }: { onCreated: () => void }) {
  const [buyerType, setBuyerType] = useState("firm");
  const [buyerName, setBuyerName] = useState("");
  const [metal, setMetal] = useState("gold");
  const [weight, setWeight] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestedBuyers = BUYER_DIRECTORY[buyerType] ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyer_type: buyerType, buyer_name: buyerName, metal, weight_grams: parseFloat(weight) || 0, shipping_cost_usd: parseFloat(shippingCost) || 0, status: "preparing" }),
    });
    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">New Delivery to Hong Kong</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400">Metal</label>
          <select value={metal} onChange={(e) => setMetal(e.target.value)} className={`mt-1 ${selectCls}`}>
            {["gold", "silver", "platinum", "palladium"].map((m) => <option key={m} value={m} className="bg-gray-800">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Weight (grams)</label>
          <input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1000" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Buyer Type</label>
          <select value={buyerType} onChange={(e) => setBuyerType(e.target.value)} className={`mt-1 ${selectCls}`}>
            {BUYER_TYPES.map((b) => <option key={b.value} value={b.value} className="bg-gray-800">{b.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Buyer Name</label>
          <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="HSBC HK" className={`mt-1 ${inputCls}`} />
          {suggestedBuyers.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestedBuyers.map((b) => (
                <button key={b.name} type="button" onClick={() => setBuyerName(b.name)} className={`rounded-full px-2 py-0.5 text-[10px] transition ${buyerName === b.name ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-gray-400 hover:text-white"}`}>
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400">Shipping + Insurance Cost (USD)</label>
          <input type="number" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="2500.00" className={`mt-1 ${inputCls}`} />
        </div>
      </div>
      {buyerType && (
        <div className="rounded-md bg-white/5 px-3 py-2 text-xs text-gray-400">
          Expected payment: <span className={`font-medium ${CURRENCY_COLORS[BUYER_CURRENCY[buyerType]?.currency] ?? "text-white"}`}>{BUYER_CURRENCY[buyerType]?.currency}</span> via {BUYER_CURRENCY[buyerType]?.method}
        </div>
      )}
      <button type="submit" disabled={saving} className="w-full rounded-md bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
        {saving ? "Saving..." : "Create Delivery"}
      </button>
    </form>
  );
}

/* ─── Payment Received Form ───────────────────────────────── */
function PaymentReceivedForm({ onCreated }: { onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("HKD");
  const [method, setMethod] = useState("Local bank transfer");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_received: parseFloat(amount) || 0, currency_received: currency, payment_method: method, status: "pending" }),
    });
    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Payment Received from HK Buyer</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400">Amount</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000.00" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`mt-1 ${selectCls}`}>
            <option value="HKD" className="bg-gray-800">HKD (Local/Firm)</option>
            <option value="USD" className="bg-gray-800">USD (Bank)</option>
            <option value="USDT" className="bg-gray-800">USDT (Crypto)</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400">Payment Method</label>
          <input type="text" value={method} onChange={(e) => setMethod(e.target.value)} className={`mt-1 ${inputCls}`} />
        </div>
      </div>
      <button type="submit" disabled={saving} className="w-full rounded-md bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
        {saving ? "Saving..." : "Record Payment"}
      </button>
    </form>
  );
}

/* ─── Settlement Form ─────────────────────────────────────── */
function SettlementForm({ onCreated }: { onCreated: () => void }) {
  const [amountReceived, setAmountReceived] = useState("");
  const [currencyReceived, setCurrencyReceived] = useState("HKD");
  const [amountSent, setAmountSent] = useState("");
  const [currencySent, setCurrencySent] = useState("AED");
  const [channel, setChannel] = useState("wire_transfer");
  const [sellerName, setSellerName] = useState("");
  const [sellerAmount, setSellerAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_received: parseFloat(amountReceived) || 0,
        currency_received: currencyReceived,
        payment_method: "Settlement",
        amount_sent_to_dubai: parseFloat(amountSent) || 0,
        currency_sent: currencySent,
        channel,
        seller_paid: sellerName,
        seller_amount: parseFloat(sellerAmount) || 0,
        status: "settled",
      }),
    });
    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">Settlement — HK to Dubai</h3>

      <div className="rounded-md bg-blue-500/5 p-3 outline outline-1 outline-blue-500/20">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400">Received in Hong Kong</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Amount</label>
            <input type="number" step="0.01" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder="390,000" className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Currency</label>
            <select value={currencyReceived} onChange={(e) => setCurrencyReceived(e.target.value)} className={`mt-1 ${selectCls}`}>
              <option value="HKD" className="bg-gray-800">HKD</option>
              <option value="USD" className="bg-gray-800">USD</option>
              <option value="USDT" className="bg-gray-800">USDT</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-center text-gray-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
        </svg>
      </div>

      <div className="rounded-md bg-amber-500/5 p-3 outline outline-1 outline-amber-500/20">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-400">Sent to Dubai</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Amount</label>
            <input type="number" step="0.01" value={amountSent} onChange={(e) => setAmountSent(e.target.value)} placeholder="185,000" className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Currency</label>
            <select value={currencySent} onChange={(e) => setCurrencySent(e.target.value)} className={`mt-1 ${selectCls}`}>
              <option value="AED" className="bg-gray-800">AED (Dirhams)</option>
              <option value="USD" className="bg-gray-800">USD</option>
              <option value="USDT" className="bg-gray-800">USDT</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-400">Transfer Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={`mt-1 ${selectCls}`}>
            {SETTLEMENT_CHANNELS.map((c) => <option key={c.value} value={c.value} className="bg-gray-800">{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-md bg-rose-500/5 p-3 outline outline-1 outline-rose-500/20">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400">Seller Payment (Dubai)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Seller Name</label>
            <input type="text" value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="Karim & Co." className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Amount (AED)</label>
            <input type="number" step="0.01" value={sellerAmount} onChange={(e) => setSellerAmount(e.target.value)} placeholder="185,000" className={`mt-1 ${inputCls}`} />
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full rounded-md bg-purple-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
        {saving ? "Saving..." : "Record Settlement"}
      </button>
    </form>
  );
}
