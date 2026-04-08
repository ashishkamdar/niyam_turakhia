import { getDb } from "./db";
import { v4 as uuid } from "uuid";
import { PURE_PURITIES, YIELD_TABLE, type Metal, type Purity } from "./types";

const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];
const BASE_PRICES: Record<Metal, number> = {
  gold: 2341.5678,
  silver: 30.2450,
  platinum: 982.3400,
  palladium: 1024.7800,
};
const PURITIES_WEIGHTED: Purity[] = ["18K", "18K", "22K", "22K", "24K", "24K", "24K", "999", "995"];

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60));
  return d.toISOString();
}

export function seedSampleData(): void {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as c FROM deals").get() as { c: number }).c;
  if (count > 0) return;

  const REFINING_COSTS: Record<Metal, number> = { gold: 1.50, silver: 0.15, platinum: 3.00, palladium: 2.50 };
  const insDeal = db.prepare("INSERT INTO deals (id,metal,purity,is_pure,quantity_grams,pure_equivalent_grams,price_per_oz,refining_cost_per_gram,total_cost_usd,direction,location,status,date,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'simulator')");
  const insPay = db.prepare("INSERT INTO payments (id,amount,currency,direction,mode,from_location,to_location,linked_deal_id,date) VALUES (?,?,?,?,?,?,?,?,?)");

  db.transaction(() => {
    for (let daysAgo = 3; daysAgo >= 1; daysAgo--) {
      // Small daily price variation per metal (+-0.5%)
      const dayPrices: Record<Metal, number> = {} as Record<Metal, number>;
      for (const m of METALS) {
        dayPrices[m] = BASE_PRICES[m] * (1 + rand(-0.005, 0.005));
      }

      // BUYS: always at 1-2.5% DISCOUNT to base (we buy cheap)
      const buyCount = Math.floor(Math.random() * 6) + 10;
      for (let i = 0; i < buyCount; i++) {
        const metal = pick(METALS);
        const purity = pick(PURITIES_WEIGHTED);
        const isPure = PURE_PURITIES.includes(purity);
        const qty = parseFloat(rand(100, 5000).toFixed(2));
        const pureEquiv = parseFloat((qty * YIELD_TABLE[purity]).toFixed(2));
        const discount = rand(0.010, 0.025); // 1-2.5% discount
        const price = parseFloat((dayPrices[metal] * (1 - discount)).toFixed(4));
        const statuses = isPure ? ["locked", "in_transit", "in_hk"] : ["locked", "in_refinery", "in_transit", "in_hk"];
        const status = pick(statuses);
        const date = randomDate(daysAgo);
        const refCostPerGram = isPure ? 0 : REFINING_COSTS[metal];
        const purchaseCostUsd = (pureEquiv / 31.1035) * price;
        const refiningTotalUsd = isPure ? 0 : qty * refCostPerGram;
        const totalCostUsd = purchaseCostUsd + refiningTotalUsd;
        const dealId = uuid();
        insDeal.run(dealId, metal, purity, isPure ? 1 : 0, qty, pureEquiv, price, refCostPerGram, totalCostUsd, "buy", "uae", status, date);
        const costUsd = totalCostUsd;
        const curr = pick(["AED", "USD"] as const);
        const amt = curr === "AED" ? costUsd * 3.6725 : costUsd;
        insPay.run(uuid(), parseFloat(amt.toFixed(2)), curr, "sent", "bank", "hong_kong", "uae", dealId, date);
      }

      // SELLS: always at 0.3-1% PREMIUM to base (we sell higher)
      const sellCount = Math.floor(Math.random() * 4) + 5;
      for (let i = 0; i < sellCount; i++) {
        const metal = pick(METALS);
        const qty = parseFloat(rand(100, 3000).toFixed(2));
        const premium = rand(0.003, 0.010); // 0.3-1% premium
        const price = parseFloat((dayPrices[metal] * (1 + premium)).toFixed(4));
        const date = randomDate(daysAgo);
        const dealId = uuid();
        insDeal.run(dealId, metal, "24K", 1, qty, qty, price, 0, 0, "sell", "hong_kong", "sold", date);
        const revUsd = (qty / 31.1035) * price;
        const curr = pick(["USD", "HKD", "USDT"] as const);
        const amt = curr === "HKD" ? revUsd * 7.82 : revUsd;
        const mode = curr === "USDT" ? "crypto_exchange" : curr === "HKD" ? "local_dealer" : "bank";
        insPay.run(uuid(), parseFloat(amt.toFixed(2)), curr, "received", mode, "hong_kong", "uae", dealId, date);
      }
    }
  })();
}
