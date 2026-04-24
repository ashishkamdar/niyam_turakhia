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
  const p = (purity || "").toUpperCase();
  const m = metal.toLowerCase();

  if (m === "gold") {
    if (p === "9999" || p === "24K" || p === "4N") return "KG 4X9";
    if (p === "995") return "KG 995";
    return "KG 4X9"; // default for gold
  }
  if (m === "silver") {
    if (p === "999" || p === "9999" || p === "4N") return "KG 4X9";
    if (p === "995") return "KG 995";
    return "KG 4X9";
  }
  // Platinum and palladium default to OZ
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

function gramsToUnit(grams: number, stockCode: string): number {
  // stockCode unit is defined by its convFactor (how many OZ per unit).
  // So 1 unit of "KG 4X9" = 32.15 OZ = 32.15 * 31.1035g = ~1000.18g
  // piecesQty = grams / (convFactor * 31.1035)
  // But for KG units, 1 KG = 1000g, so piecesQty = grams / 1000
  // For OZ: piecesQty = grams / 31.1035
  // For GMS: piecesQty = grams (since 1 GMS = 1 gram)

  if (stockCode === "GMS") return Math.round(grams * 1000) / 1000;
  if (stockCode === "OZ") return Math.round((grams / 31.1035) * 1000) / 1000;
  if (stockCode.startsWith("KG")) return Math.round((grams / 1000) * 1000) / 1000;
  if (stockCode === "TTB") return Math.round((grams / (3.74625 * 31.1035)) * 1000) / 1000;

  // Fallback: convert to OZ
  return Math.round((grams / 31.1035) * 1000) / 1000;
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
  const piecesQty = gramsToUnit(deal.qty_grams, stockCode);
  const dealFlag = deal.direction.toLowerCase() === "buy" ? 1 : 0;

  // Date from received_at (YYYYMMDD format)
  const docDate = deal.received_at
    ? deal.received_at.slice(0, 10).replace(/-/g, "")
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const payload: FixingTradePayload = {
    accountCode,
    cmdtyPair: cmdtyPair!,
    deal: dealFlag,
    piecesQty,
    price: Math.round(deal.rate_usd_per_oz * 10000000) / 10000000, // max 7 decimals
    stockCode,
    documentType: "FCT",
    docDate,
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
