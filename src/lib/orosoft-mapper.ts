/**
 * Maps PrismX pending_deals fields to OroSoft NeoConnect FixingTrade payloads.
 *
 * Handles: metal→cmdtyPair, direction→deal, qty conversion,
 * party alias→accountCode resolution, purity→stockCode.
 */

import type Database from "better-sqlite3";
import type { FixingTradePayload } from "./orosoft-client";

// ── Types ───────────────────────────────────────────────────────────

export type DispatchableDeal = {
  id: string;
  deal_type: string;
  direction: string;
  qty_grams: number;
  metal: string;
  purity: string | null;
  rate_usd_per_oz: number;
  premium_type: string | null;
  premium_value: number | null;
  party_alias: string | null;
  received_at: string;
};

export type MapResult =
  | { ok: true; payload: FixingTradePayload }
  | { ok: false; errors: string[] };

// ── Metal → cmdtyPair ───────────────────────────────────────────────

const CMDTY_PAIR_MAP: Record<string, string> = {
  gold: "XAUUSD",
  silver: "XAGUSD",
  platinum: "XPTUSD",
  palladium: "XPDUSD",
};

// ── Purity + metal → stockCode ──────────────────────────────────────
// Based on actual FixingStocks from OroSoft demo:
//   XAU: "OZ"(1.0), "GMS"(0.03215), "KG 4X9"(32.15), "KG 995"(31.99), "TTB"(3.74625)
//   XAG: "KG 4X9"(32.15), "KG 995"(31.99)
//   XPT: "OZ"(1.0), "KG"(32.15)
//   XPD: "OZ"(1.0), "KG"(32.15)

function resolveStockCode(metal: string, purity: string | null): string {
  // OroSoft FixingTrade stockCode enum: OZ, GMS, KG4X9, KG995, LBS (NO spaces)
  // Default to OZ — universally supported and matches priceType=OZ
  return "OZ";
}

// ── Qty conversion ──────────────────────────────────────────────────
// Convert grams to the unit implied by stockCode.
// convFactor from FixingStocks tells us how many OZ are in one unit.
// We want piecesQty in the stockCode unit.

const CONV_FACTORS: Record<string, number> = {
  "OZ": 1.0,
  "GMS": 0.03215,
  "KG 4X9": 32.15,
  "KG 995": 31.99,
  "KG": 32.15,
  "TTB": 3.74625,
};

function gramsToOz(grams: number): number {
  return Math.round((grams / 31.1035) * 1000) / 1000; // max 3 decimals
}

// ── Party alias → accountCode ───────────────────────────────────────

export function resolveAccountCode(
  db: Database.Database,
  partyAlias: string
): { ok: true; accountCode: string } | { ok: false; error: string } {
  const alias = partyAlias.trim();

  // Try exact match on name, short_code
  const byName = db.prepare(
    "SELECT orosoft_party_code FROM parties WHERE LOWER(name) = LOWER(?) AND active = 1 LIMIT 1"
  ).get(alias) as { orosoft_party_code: string | null } | undefined;

  if (byName) {
    if (!byName.orosoft_party_code) {
      return { ok: false, error: `Party "${alias}" found but has no OroSoft account code. Update the party record first.` };
    }
    return { ok: true, accountCode: byName.orosoft_party_code };
  }

  const byCode = db.prepare(
    "SELECT orosoft_party_code FROM parties WHERE LOWER(short_code) = LOWER(?) AND active = 1 LIMIT 1"
  ).get(alias) as { orosoft_party_code: string | null } | undefined;

  if (byCode) {
    if (!byCode.orosoft_party_code) {
      return { ok: false, error: `Party "${alias}" found but has no OroSoft account code.` };
    }
    return { ok: true, accountCode: byCode.orosoft_party_code };
  }

  // Try aliases JSON array
  const allParties = db.prepare(
    "SELECT name, aliases, orosoft_party_code FROM parties WHERE active = 1 AND aliases IS NOT NULL"
  ).all() as { name: string; aliases: string; orosoft_party_code: string | null }[];

  for (const p of allParties) {
    try {
      const arr = JSON.parse(p.aliases) as string[];
      if (arr.some((a) => a.toLowerCase() === alias.toLowerCase())) {
        if (!p.orosoft_party_code) {
          return { ok: false, error: `Party "${p.name}" matched alias "${alias}" but has no OroSoft account code.` };
        }
        return { ok: true, accountCode: p.orosoft_party_code };
      }
    } catch {
      // Invalid JSON in aliases — skip
    }
  }

  // Fallback: check if a default test account is configured
  const fallback = (db.prepare(
    "SELECT value FROM settings WHERE key = 'orosoft_default_account'"
  ).get() as { value: string } | undefined)?.value;

  if (fallback) {
    return { ok: true, accountCode: fallback };
  }

  return { ok: false, error: `No party found matching "${alias}". Add the party with an OroSoft account code first.` };
}

// ── Main mapper ─────────────────────────────────────────────────────

export function mapDealToFixingTrade(
  db: Database.Database,
  deal: DispatchableDeal
): MapResult {
  const errors: string[] = [];

  // Party
  if (!deal.party_alias) {
    errors.push("Missing party alias");
  }
  let accountCode = "";
  if (deal.party_alias) {
    const resolved = resolveAccountCode(db, deal.party_alias);
    if (resolved.ok) {
      accountCode = resolved.accountCode;
    } else {
      errors.push(resolved.error);
    }
  }

  // Metal
  const cmdtyPair = CMDTY_PAIR_MAP[deal.metal?.toLowerCase()];
  if (!cmdtyPair) {
    errors.push(`Unknown metal "${deal.metal}"`);
  }

  // Direction
  if (!deal.direction || !["buy", "sell"].includes(deal.direction.toLowerCase())) {
    errors.push(`Invalid direction "${deal.direction}"`);
  }

  // Quantity
  if (!deal.qty_grams || deal.qty_grams <= 0) {
    errors.push("Quantity must be > 0");
  }

  // Rate
  if (!deal.rate_usd_per_oz || deal.rate_usd_per_oz <= 0) {
    errors.push("Rate must be > 0");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const stockCode = resolveStockCode(deal.metal, deal.purity);
  const piecesQty = gramsToOz(deal.qty_grams);
  const dealFlag = deal.direction.toLowerCase() === "buy" ? 1 : 0;

  // Date in yyyyMMdd format — OroSoft requires this explicitly
  const now = new Date();
  const docDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  // Value date = T+2
  const vd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const valueDate = `${vd.getFullYear()}${String(vd.getMonth() + 1).padStart(2, "0")}${String(vd.getDate()).padStart(2, "0")}`;

  const payload: FixingTradePayload = {
    accountCode,
    cmdtyPair: cmdtyPair!,
    deal: dealFlag,
    piecesQty,
    price: Math.round(deal.rate_usd_per_oz * 10000000) / 10000000, // max 7 decimals
    stockCode,
    documentType: "FCT",
    docDate,
    valueDate,
    priceType: "OZ",
    referenceNo: `PX-${deal.id.slice(0, 8).toUpperCase()}`,
    remarks: `PrismX deal ${deal.id}`,
  };

  // Premium
  if (deal.premium_value != null && deal.premium_value !== 0) {
    payload.prmRate = deal.premium_value;
    payload.prmRateType = "OZ"; // premium per troy ounce
  }

  return { ok: true, payload };
}
