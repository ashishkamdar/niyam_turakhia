/**
 * Deal code parser — extracts structured deal fields from a WhatsApp "lock code" message.
 *
 * Designed to run against messages staff post in the internal PrismX WhatsApp group.
 * Three trigger variants are accepted:
 *   #NTK  →  explicit Kachha (black / SBS)
 *   #NTP  →  explicit Pakka (white / OroSoft)
 *   #NT   →  unclassified — checker picks K or P in the review UI
 *
 * Grammar (all fields are case-insensitive; keywords normalised internally):
 *   <TRIGGER> <BUY|SELL> <QTY><UNIT> <METAL> [<PURITY>] @<RATE> [<PREMIUM>] <PARTY>
 *
 * Examples (all valid):
 *   #NTP SELL 10KG GOLD 24K @2566.80 -0.1 TAKFUNG
 *   #NTK BUY 50KG SILVER 999 @70.51 +1.2 SAPAN
 *   #NT SELL 1KG PALLADIUM 999 @1021.50 -15 CHANG
 *   #NTP BUY 5KG GOLD 22K @2556.40 -0.2% PATEL
 *   #NTK SELL 100 OZ SILVER 999 @71.85 +1.0 KARIM
 *   #NTp sell 25kg gold 24k @2567.15 -0.15 LIWEI
 *
 * Non-goals:
 *   - Does NOT validate deals economically (e.g. "is 2566 a reasonable gold price").
 *   - Does NOT recover from grossly malformed input — errors are reported as strings,
 *     partial fields are preserved, and the review UI shows both to the checker.
 *   - Does NOT touch the database — pure function, trivially unit-testable.
 */

export type DealType = "K" | "P" | null;
export type Direction = "buy" | "sell";
export type Metal = "gold" | "silver" | "platinum" | "palladium";
export type PremiumType = "absolute" | "percent";

export interface ParsedDealFields {
  deal_type: DealType;
  direction: Direction | null;
  qty_grams: number | null;
  metal: Metal | null;
  purity: string | null;
  rate_usd_per_oz: number | null;
  premium_type: PremiumType | null;
  premium_value: number | null;
  party_alias: string | null;
}

export interface ParseResult {
  /** True if the message begins with the #NT trigger family, regardless of whether parsing succeeded. */
  is_deal_code: boolean;
  /** True if every required field parsed cleanly (no errors). */
  parsed: boolean;
  fields: ParsedDealFields;
  errors: string[];
}

const GRAMS_PER_TROY_OZ = 31.1035;

const METAL_ALIASES: Record<string, Metal> = {
  GOLD: "gold",
  XAU: "gold",
  SILVER: "silver",
  XAG: "silver",
  PLATINUM: "platinum",
  PT: "platinum",
  XPT: "platinum",
  PALLADIUM: "palladium",
  PD: "palladium",
  XPD: "palladium",
};

const PURITIES = new Set(["18K", "20K", "22K", "24K", "995", "999", "9999", "4N"]);
const QTY_UNITS = new Set(["KG", "KGS", "G", "GRAMS", "OZ"]);

// The trigger must anchor the start of the (trimmed) message.
// \b after the optional suffix prevents false matches like "#NTX".
const TRIGGER_RE = /^\s*#\s*NT([KP])?\b/i;
const COMBINED_QTY_RE = /^(\d+(?:\.\d+)?)(KG|KGS|G|GRAMS|OZ)$/i;
const NUMBER_ONLY_RE = /^(\d+(?:\.\d+)?)$/;

function emptyFields(): ParsedDealFields {
  return {
    deal_type: null,
    direction: null,
    qty_grams: null,
    metal: null,
    purity: null,
    rate_usd_per_oz: null,
    premium_type: null,
    premium_value: null,
    party_alias: null,
  };
}

function toGrams(value: number, unit: string): number {
  switch (unit.toUpperCase()) {
    case "KG":
    case "KGS":
      return value * 1000;
    case "G":
    case "GRAMS":
      return value;
    case "OZ":
      return value * GRAMS_PER_TROY_OZ;
    default:
      return value;
  }
}

export function parseDealCode(raw: string): ParseResult {
  const fields = emptyFields();
  const errors: string[] = [];

  const trimmed = (raw ?? "").trim();
  const triggerMatch = trimmed.match(TRIGGER_RE);
  if (!triggerMatch) {
    return { is_deal_code: false, parsed: false, fields, errors };
  }

  // Extract deal type from trigger suffix (K, P, or none)
  const suffix = triggerMatch[1]?.toUpperCase();
  fields.deal_type = suffix === "K" ? "K" : suffix === "P" ? "P" : null;

  // Everything after the trigger is what we need to parse
  const rest = trimmed.slice(triggerMatch[0].length).trim();
  if (!rest) {
    errors.push("Empty message after trigger");
    return { is_deal_code: true, parsed: false, fields, errors };
  }

  // Tokenise on whitespace. The parser is position-based: each field consumes
  // one or more tokens in order. Optional fields peek first, then consume on match.
  const tokens = rest.split(/\s+/);
  let idx = 0;

  const take = (): string | undefined => tokens[idx++];
  const peek = (): string | undefined => tokens[idx];

  // ── Direction ────────────────────────────────────────────────────────
  const dirTok = take();
  if (!dirTok) {
    errors.push("Missing direction (BUY/SELL)");
  } else if (/^buy$/i.test(dirTok)) {
    fields.direction = "buy";
  } else if (/^sell$/i.test(dirTok)) {
    fields.direction = "sell";
  } else {
    errors.push(`Invalid direction: "${dirTok}" (expected BUY or SELL)`);
    // Put the token back — it might actually be quantity or metal
    idx--;
  }

  // ── Quantity + unit ──────────────────────────────────────────────────
  // Accepts either combined ("10KG", "5.5OZ") or separated ("100 OZ").
  const qtyTok = take();
  if (!qtyTok) {
    errors.push("Missing quantity");
  } else {
    const combined = qtyTok.match(COMBINED_QTY_RE);
    if (combined) {
      fields.qty_grams = toGrams(parseFloat(combined[1]), combined[2]);
    } else {
      const numOnly = qtyTok.match(NUMBER_ONLY_RE);
      if (numOnly) {
        const value = parseFloat(numOnly[1]);
        const unitTok = peek();
        if (unitTok && QTY_UNITS.has(unitTok.toUpperCase())) {
          idx++; // consume unit
          fields.qty_grams = toGrams(value, unitTok);
        } else {
          errors.push(`Quantity "${qtyTok}" has no unit (expected KG/G/OZ)`);
          fields.qty_grams = value;
        }
      } else {
        errors.push(`Invalid quantity: "${qtyTok}"`);
        idx--; // Put it back — might be a metal token
      }
    }
  }

  // ── Metal ────────────────────────────────────────────────────────────
  const metalTok = take();
  if (!metalTok) {
    errors.push("Missing metal");
  } else {
    const mapped = METAL_ALIASES[metalTok.toUpperCase()];
    if (mapped) {
      fields.metal = mapped;
    } else {
      errors.push(`Unknown metal: "${metalTok}"`);
    }
  }

  // ── Purity (optional; default applied if missing) ────────────────────
  const purityTok = peek();
  if (purityTok && PURITIES.has(purityTok.toUpperCase())) {
    idx++;
    fields.purity = purityTok.toUpperCase();
  } else {
    // Default: gold→24K, everything else→999
    fields.purity = fields.metal === "gold" ? "24K" : "999";
  }

  // ── Rate ─────────────────────────────────────────────────────────────
  // Either "@2566.80" (glued), "@ 2566.80" (separate), or bare "2566.80".
  const rateTok = take();
  if (!rateTok) {
    errors.push("Missing rate");
  } else {
    let rateStr = rateTok.replace(/^@/, "");
    if (rateStr === "") {
      // "@" was its own token — consume the next one for the actual number
      const following = take();
      if (!following) {
        errors.push("Missing rate value after @");
      } else {
        rateStr = following;
      }
    }
    if (rateStr !== "") {
      const parsed = parseFloat(rateStr);
      if (isNaN(parsed)) {
        errors.push(`Invalid rate: "${rateTok}"`);
      } else {
        fields.rate_usd_per_oz = parsed;
      }
    }
  }

  // ── Premium (optional — presence indicated by leading + or −) ────────
  const premTok = peek();
  if (premTok && /^[+\-]/.test(premTok)) {
    idx++;
    const isPct = premTok.endsWith("%");
    const numStr = isPct ? premTok.slice(0, -1) : premTok;
    const parsed = parseFloat(numStr);
    if (isNaN(parsed)) {
      errors.push(`Invalid premium: "${premTok}"`);
    } else {
      fields.premium_type = isPct ? "percent" : "absolute";
      fields.premium_value = parsed;
    }
  } else {
    // Not stated → assume 0 absolute
    fields.premium_type = "absolute";
    fields.premium_value = 0;
  }

  // ── Party alias (everything remaining, joined with spaces) ───────────
  const partyTokens: string[] = [];
  while (idx < tokens.length) {
    partyTokens.push(tokens[idx++]);
  }
  if (partyTokens.length === 0) {
    errors.push("Missing party/counterparty");
  } else {
    fields.party_alias = partyTokens.join(" ").trim();
  }

  return {
    is_deal_code: true,
    parsed: errors.length === 0,
    fields,
    errors,
  };
}
