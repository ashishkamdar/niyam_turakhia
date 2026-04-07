import { getDb } from "./db";
import type { Price, MetalSymbol } from "./types";

const DEMO_PRICES: Record<MetalSymbol, { price: number; prev: number }> = {
  XAU: { price: 2341.5678, prev: 2328.42 },
  XAG: { price: 30.245, prev: 29.87 },
  XPT: { price: 982.34, prev: 978.15 },
  XPD: { price: 1024.78, prev: 1018.5 },
};

export function seedDemoPrices(): void {
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO prices (metal, price_usd, prev_close, change, change_pct, source, fetched_at)
    VALUES (?, ?, ?, ?, ?, 'demo', ?)
    ON CONFLICT(metal) DO UPDATE SET
      price_usd = excluded.price_usd, prev_close = excluded.prev_close,
      change = excluded.change, change_pct = excluded.change_pct,
      source = excluded.source, fetched_at = excluded.fetched_at
  `);
  const seed = db.transaction(() => {
    for (const [symbol, data] of Object.entries(DEMO_PRICES)) {
      const change = data.price - data.prev;
      const changePct = (change / data.prev) * 100;
      upsert.run(symbol, data.price, data.prev, change, changePct, now);
    }
  });
  seed();
}

export async function fetchLivePrices(apiKey: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO prices (metal, price_usd, prev_close, change, change_pct, source, fetched_at)
    VALUES (?, ?, ?, ?, ?, 'live', ?)
    ON CONFLICT(metal) DO UPDATE SET
      price_usd = excluded.price_usd, prev_close = excluded.prev_close,
      change = excluded.change, change_pct = excluded.change_pct,
      source = excluded.source, fetched_at = excluded.fetched_at
  `);
  const symbols: MetalSymbol[] = ["XAU", "XAG", "XPT", "XPD"];
  for (const symbol of symbols) {
    try {
      const res = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
        headers: { "x-access-token": apiKey },
      });
      if (!res.ok) continue;
      const data = await res.json();
      upsert.run(symbol, data.price, data.prev_close_price ?? data.open_price, data.ch ?? 0, data.chp ?? 0, now);
    } catch {
      // Keep existing price on failure
    }
  }
}

export function getPrices(): Price[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM prices ORDER BY metal").all() as Price[];
  if (rows.length === 0) {
    seedDemoPrices();
    return db.prepare("SELECT * FROM prices ORDER BY metal").all() as Price[];
  }
  return rows;
}
