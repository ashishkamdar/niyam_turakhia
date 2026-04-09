/**
 * WhatsApp Chat Deal Parser
 * Parses raw WhatsApp export text and extracts precious metal deals.
 */

export type ParsedMetal = "gold" | "silver" | "platinum" | "palladium";
export type ParsedDirection = "buy" | "sell";
export type ParsedStatus = "locked" | "cancelled" | "working" | "pending";

export interface ParsedDeal {
  id: string;
  date: string;             // ISO string of when the deal was detected
  metal: ParsedMetal;
  direction: ParsedDirection;
  quantity_grams: number;
  price_per_oz: number;
  premium_discount: string; // e.g. "+1.2", "-15", "-0.2%"
  total_usdt: number;
  status: ParsedStatus;
  participants: string[];
  raw_messages: string[];   // key messages that formed the deal
}

// ---------------------------------------------------------------------------
// Internal: parsed WhatsApp message line
// ---------------------------------------------------------------------------
interface WaLine {
  datetime: Date;
  dateStr: string;    // original date token e.g. "30/3/2026"
  timeStr: string;    // original time token e.g. "13:52:54"
  sender: string;
  text: string;
  raw: string;
}

// ---------------------------------------------------------------------------
// Parse raw WhatsApp export into structured lines
// ---------------------------------------------------------------------------
// Format: [D/M/YYYY, HH:MM:SS] Sender: message text (possibly multi-line)
const LINE_RE = /^\[(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{2}:\d{2})\] ([^:]+): ([\s\S]*)/;

function parseLines(raw: string): WaLine[] {
  const lines: WaLine[] = [];
  const parts = raw.split(/\n(?=\[)/);

  for (const part of parts) {
    const m = part.match(LINE_RE);
    if (!m) continue;
    const [, dateStr, timeStr, sender, text] = m;
    const [day, month, year] = dateStr.split("/").map(Number);
    const [h, min, sec] = timeStr.split(":").map(Number);
    const datetime = new Date(year, month - 1, day, h, min, sec);
    lines.push({
      datetime,
      dateStr,
      timeStr,
      sender: sender.trim().replace(/^[~\s]+/, "").trim(),
      text: text.trim(),
      raw: `[${dateStr}, ${timeStr}] ${sender.trim()}: ${text.trim()}`,
    });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Metal detection
// ---------------------------------------------------------------------------
function detectMetal(text: string): ParsedMetal | null {
  const t = text.toLowerCase();
  if (/\bxau\b|gold|kilo bar|lb\b|lbma|am fix|pm fix/.test(t)) return "gold";
  if (/\bpd\b|palladium/.test(t)) return "palladium";
  if (/\bpt\b|platinum/.test(t)) return "platinum";
  if (/\bsilver\b|sliver|ball|珠子|\bce\b/.test(t)) return "silver";
  return null;
}

// ---------------------------------------------------------------------------
// Quantity parsing: "10kg", "10 kgs", "10k", "100k", "10000g"
// In this context "k" = kg, NOT thousands
// ---------------------------------------------------------------------------
function parseQuantityGrams(token: string): number | null {
  // explicit grams: "10000g" or "10000 grams"
  const gramsMatch = token.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:grams?|g\b)/i);
  if (gramsMatch) return parseFloat(gramsMatch[1].replace(/,/g, ""));

  // "150kg" / "150 kgs" / "150 kg"
  const kgMatch = token.match(/(\d[\d,]*(?:\.\d+)?)\s*kgs?\b/i);
  if (kgMatch) return parseFloat(kgMatch[1].replace(/,/g, "")) * 1000;

  // "10k" / "100k" — k = kg in this domain
  const kMatch = token.match(/(\d[\d,]*(?:\.\d+)?)k\b/i);
  if (kMatch) return parseFloat(kMatch[1].replace(/,/g, "")) * 1000;

  return null;
}

// ---------------------------------------------------------------------------
// Gusini's calculation formula parser
// Patterns:
//   price+premium=net/31.1035*grams=USDT
//   price-discount=net/31.1035*grams=USDT
//   price+premium=net*32.1507*kg=USDT
//   price-discount=net*32.1507*kg=USDT
// ---------------------------------------------------------------------------
interface CalcResult {
  price_per_oz: number;
  premium_discount: string;
  net_price: number;
  quantity_grams: number;
  total_usdt: number;
  metal?: ParsedMetal;
}

const CALC_RE =
  /(\d+(?:\.\d+)?)([\+\-]\d+(?:\.\d+)?(?:%)?)?=(\d+(?:\.\d+)?)(?:\/31\.1035\*(\d+(?:\.\d+)?)|[*×]32\.1507[*×]?(\d+(?:\.\d+)?))=(\d+(?:\.\d+)?)/;

function parseCalculation(text: string): CalcResult | null {
  const m = text.match(CALC_RE);
  if (!m) return null;

  const basePrice = parseFloat(m[1]);
  const premiumRaw = m[2] ?? "";          // e.g. "+1.2" or "-15"
  const netPrice = parseFloat(m[3]);
  // group 4 = grams (for /31.1035*grams), group 5 = kg (for *32.1507*kg)
  let quantityGrams: number;
  if (m[4]) {
    quantityGrams = parseFloat(m[4]);     // already in grams
  } else {
    quantityGrams = parseFloat(m[5]) * 1000; // kg → grams
  }
  const totalUsdt = parseFloat(m[6]);

  return {
    price_per_oz: basePrice,
    premium_discount: premiumRaw,
    net_price: netPrice,
    quantity_grams: quantityGrams,
    total_usdt: totalUsdt,
  };
}

// ---------------------------------------------------------------------------
// Premium/discount extraction from standalone messages like "+1", "+1.2", "-15/oz", "-0.2%"
// ---------------------------------------------------------------------------
function parsePremiumDiscount(text: string): string | null {
  const m = text.match(/^([+\-]\d+(?:\.\d+)?(?:%|\/oz)?)\s*(?:net|per oz)?$/i);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Extract spot price from a message that is just a number (Lin's style)
// ---------------------------------------------------------------------------
function isSpotPrice(text: string): number | null {
  const m = text.trim().match(/^(\d{2,4}(?:\.\d+)?)$/);
  if (m) {
    const v = parseFloat(m[1]);
    // Reasonable spot price range: silver 15-100, gold 1000-4000, PD 500-3000
    if (v >= 15 && v <= 4500) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Buy/sell direction from text
// ---------------------------------------------------------------------------
function parseDirection(text: string): ParsedDirection | null {
  const t = text.toLowerCase();
  if (/\bbuy\b|we buy|book/.test(t)) return "buy";
  if (/\bsell\b|we sell|u sell|sold\b/.test(t)) return "sell";
  return null;
}

// ---------------------------------------------------------------------------
// Status keywords
// ---------------------------------------------------------------------------
function parseStatus(text: string): ParsedStatus | null {
  const t = text.toLowerCase();
  if (/cancel+ed|cancelled/.test(t)) return "cancelled";
  if (/\blocke?d\b|鎖價/.test(t)) return "locked";
  if (/\bworking\b/.test(t)) return "working";
  return null;
}

// ---------------------------------------------------------------------------
// Generate a simple deterministic ID from deal properties
// ---------------------------------------------------------------------------
function makeId(date: string, metal: string, direction: string, qty: number): string {
  const base = `${date}-${metal}-${direction}-${Math.round(qty)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0;
  }
  return `deal_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

// ---------------------------------------------------------------------------
// Main parser — sliding-window context approach
// ---------------------------------------------------------------------------
export function parseChatDeals(rawText: string): ParsedDeal[] {
  const lines = parseLines(rawText);
  const deals: ParsedDeal[] = [];

  // We'll scan through lines looking for deal-formation sequences.
  // State machine with a rolling context window of recent relevant lines.

  interface DealContext {
    metal: ParsedMetal | null;
    direction: ParsedDirection | null;
    quantity_grams: number | null;
    price_per_oz: number | null;
    premium_discount: string;
    total_usdt: number | null;
    status: ParsedStatus | null;
    participants: Set<string>;
    keyLines: string[];
    startDate: Date | null;
    /** Whether we've seen a calc or explicit lock trigger */
    anchored: boolean;
  }

  function freshCtx(): DealContext {
    return {
      metal: null,
      direction: null,
      quantity_grams: null,
      price_per_oz: null,
      premium_discount: "",
      total_usdt: null,
      status: null,
      participants: new Set(),
      keyLines: [],
      startDate: null,
      anchored: false,
    };
  }

  function emitDeal(ctx: DealContext): ParsedDeal | null {
    if (!ctx.metal || !ctx.direction || !ctx.quantity_grams) return null;
    if (!ctx.price_per_oz && !ctx.total_usdt) return null;

    const priceOz = ctx.price_per_oz ?? 0;
    const qty = ctx.quantity_grams;
    const totalUsdt = ctx.total_usdt ?? (priceOz / 31.1035) * qty;
    const date = ctx.startDate?.toISOString() ?? new Date().toISOString();
    const id = makeId(date, ctx.metal, ctx.direction, qty);

    return {
      id,
      date,
      metal: ctx.metal,
      direction: ctx.direction,
      quantity_grams: qty,
      price_per_oz: priceOz,
      premium_discount: ctx.premium_discount,
      total_usdt: Math.round(totalUsdt * 100) / 100,
      status: ctx.status ?? "pending",
      participants: [...ctx.participants],
      raw_messages: ctx.keyLines.slice(0, 12),
    };
  }

  // Track emitted deal IDs to avoid duplicates
  const emittedIds = new Set<string>();

  function tryEmit(ctx: DealContext) {
    const deal = emitDeal(ctx);
    if (deal && !emittedIds.has(deal.id)) {
      emittedIds.add(deal.id);
      deals.push(deal);
    }
  }

  // Process lines with a context window
  let ctx = freshCtx();
  // Track last spot price seen (from Lin's bare-number messages)
  let pendingSpotPrice: number | null = null;
  let pendingSpotSender = "";
  let pendingMetal: ParsedMetal | null = null;
  let pendingPremium = "";
  // Time window: if gap > 3 hours, reset context
  const MAX_GAP_MS = 3 * 60 * 60 * 1000;
  let lastLineTime: Date | null = null;

  for (const line of lines) {
    // Skip system messages and media-only lines
    if (
      line.text.includes("<attached:") ||
      line.text === "This message was deleted." ||
      line.text.includes("added") ||
      line.text.includes("created this group") ||
      line.text.includes("Messages and calls are end-to-end encrypted")
    ) {
      continue;
    }

    // Check time gap — if large gap, emit pending deal and reset
    if (lastLineTime && line.datetime.getTime() - lastLineTime.getTime() > MAX_GAP_MS) {
      if (ctx.anchored) tryEmit(ctx);
      ctx = freshCtx();
      pendingSpotPrice = null;
      pendingMetal = null;
      pendingPremium = "";
    }
    lastLineTime = line.datetime;

    const text = line.text;
    const sender = line.sender;

    // -----------------------------------------------------------------------
    // 1. Gusini's calculation — highest confidence signal
    // -----------------------------------------------------------------------
    const calc = parseCalculation(text);
    if (calc) {
      // Could be a multi-lot net summary line (has no buy/sell direction in it)
      // or a real deal calc
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);

      if (!ctx.price_per_oz) ctx.price_per_oz = calc.price_per_oz;
      if (!ctx.quantity_grams) ctx.quantity_grams = calc.quantity_grams;
      if (!ctx.premium_discount && calc.premium_discount) ctx.premium_discount = calc.premium_discount;
      ctx.total_usdt = calc.total_usdt;
      ctx.anchored = true;
      if (!ctx.startDate) ctx.startDate = line.datetime;

      // Try to infer metal from context if not set
      if (!ctx.metal && pendingMetal) ctx.metal = pendingMetal;
      // Default metal for silver-style calc (price ~20-100 range)
      if (!ctx.metal) {
        if (calc.price_per_oz < 200) ctx.metal = "silver";
        else if (calc.price_per_oz < 1500) ctx.metal = "palladium";
        else ctx.metal = "gold";
      }

      // Multi-lot summary lines often have no direction — keep existing or default buy
      if (!ctx.direction) ctx.direction = "buy";
      continue;
    }

    // -----------------------------------------------------------------------
    // 2. Status keywords: Locked / Cancelled / Working
    // -----------------------------------------------------------------------
    const status = parseStatus(text);
    if (status) {
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      if (status === "locked" || status === "cancelled") {
        ctx.status = status;
        ctx.anchored = true;
        if (!ctx.startDate) ctx.startDate = line.datetime;
        if (status === "locked" && ctx.metal && ctx.direction && ctx.quantity_grams) {
          tryEmit(ctx);
          ctx = freshCtx();
          pendingSpotPrice = null;
        }
      } else if (status === "working" && !ctx.status) {
        ctx.status = "working";
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // 3. Detect metal
    // -----------------------------------------------------------------------
    const metalInLine = detectMetal(text);
    if (metalInLine) {
      if (!ctx.metal) ctx.metal = metalInLine;
      pendingMetal = metalInLine;
    }

    // -----------------------------------------------------------------------
    // 4. Premium/discount standalone (e.g. "+1.2", "-15", "+1 net")
    //    Also detect inline "@+1", "@ -4", "@ -0.2%"
    // -----------------------------------------------------------------------
    const pdStandalone = parsePremiumDiscount(text.trim());
    if (pdStandalone) {
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      ctx.premium_discount = pdStandalone;
      pendingPremium = pdStandalone;
      continue;
    }
    // Inline premium like "150kg @ +1" or "130kg @ -0.2%"
    const inlinePD = text.match(/@\s*([+\-]\d+(?:\.\d+)?(?:%|\/oz)?)/);
    if (inlinePD) {
      ctx.premium_discount = inlinePD[1];
      pendingPremium = inlinePD[1];
    }

    // -----------------------------------------------------------------------
    // 5. Spot price (bare number from Lin / Austin)
    // -----------------------------------------------------------------------
    const spot = isSpotPrice(text);
    if (spot) {
      pendingSpotPrice = spot;
      pendingSpotSender = sender;
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      if (!ctx.price_per_oz) ctx.price_per_oz = spot;
      if (!ctx.startDate) ctx.startDate = line.datetime;
      continue;
    }

    // -----------------------------------------------------------------------
    // 6. Direction + quantity in one line: "Buy 10k", "Buy 100k", "Buy 10kg silver spot"
    //    Also "U sell 0.49516@960-15"  (quantity in kg)
    // -----------------------------------------------------------------------
    const dir = parseDirection(text);
    if (dir) {
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      if (!ctx.direction) ctx.direction = dir;
      if (!ctx.startDate) ctx.startDate = line.datetime;

      // Extract quantity
      const qty = parseQuantityGrams(text);
      if (qty && !ctx.quantity_grams) {
        ctx.quantity_grams = qty;
        ctx.anchored = true;
      }

      // "U sell 0.49516@960-15" — small PD quantity in kg
      const uSellMatch = text.match(/[Uu]\s+sell\s+(\d+(?:\.\d+)?)\s*@\s*(\d+(?:\.\d+)?)([\+\-]\d+(?:\.\d+)?)/);
      if (uSellMatch) {
        const qtyKg = parseFloat(uSellMatch[1]);
        ctx.quantity_grams = qtyKg * 1000;
        ctx.price_per_oz = parseFloat(uSellMatch[2]);
        ctx.premium_discount = uSellMatch[3];
        ctx.anchored = true;
        ctx.metal = ctx.metal ?? pendingMetal ?? "palladium";
      }

      // "150kg @ +1 Tomorrow delivery"  — direction/qty/premium combined
      const bigTradeMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b.*?@\s*([+\-]\d+(?:\.\d+)?(?:%)?)/i);
      if (bigTradeMatch && !ctx.quantity_grams) {
        ctx.quantity_grams = parseFloat(bigTradeMatch[1]) * 1000;
        ctx.premium_discount = bigTradeMatch[2];
        pendingPremium = bigTradeMatch[2];
        ctx.anchored = true;
      }

      // If spot price recently seen, inherit it
      if (!ctx.price_per_oz && pendingSpotPrice) {
        ctx.price_per_oz = pendingSpotPrice;
      }
      // Inherit pending metal
      if (!ctx.metal && pendingMetal) ctx.metal = pendingMetal;
      if (pendingPremium && !ctx.premium_discount) ctx.premium_discount = pendingPremium;

      continue;
    }

    // -----------------------------------------------------------------------
    // 7. "Buy fix limit 64.5 for 10 kgs" — limit order
    // -----------------------------------------------------------------------
    const limitMatch = text.match(/buy\s+fix\s+limit\s+(\d+(?:\.\d+)?)\s+for\s+(\d+(?:\.\d+)?)\s*kgs?/i);
    if (limitMatch) {
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      ctx.direction = "buy";
      ctx.price_per_oz = parseFloat(limitMatch[1]);
      ctx.quantity_grams = parseFloat(limitMatch[2]) * 1000;
      ctx.status = "working";
      ctx.anchored = true;
      if (!ctx.startDate) ctx.startDate = line.datetime;
      if (!ctx.metal && pendingMetal) ctx.metal = pendingMetal;
      continue;
    }

    // -----------------------------------------------------------------------
    // 8. Fixing announcement: "15th November 2024 XAU AM Fix We sell Pure 272318.6 grams"
    // -----------------------------------------------------------------------
    const fixingMatch = text.match(/(XAU|XAG|XPT|XPD)\s+(AM|PM)\s+Fix\s+(We\s+(?:buy|sell))\s+(?:Pure\s+)?(\d+(?:\.\d+)?)\s*grams?/i);
    if (fixingMatch) {
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      const metalCode = fixingMatch[1].toUpperCase();
      ctx.metal =
        metalCode === "XAU" ? "gold" :
        metalCode === "XAG" ? "silver" :
        metalCode === "XPT" ? "platinum" : "palladium";
      ctx.direction = fixingMatch[3].toLowerCase().includes("buy") ? "buy" : "sell";
      ctx.quantity_grams = parseFloat(fixingMatch[4]);
      ctx.status = "working";
      ctx.anchored = true;
      if (!ctx.startDate) ctx.startDate = line.datetime;
      continue;
    }

    // -----------------------------------------------------------------------
    // 9. Fix price result: "2566.7+0.1=2566.8" or "2917.7-0.1=2917.6"
    // -----------------------------------------------------------------------
    const fixPriceMatch = text.match(/^(\d{3,4}(?:\.\d+)?)([\+\-]0\.1)=(\d{3,4}(?:\.\d+)?)$/);
    if (fixPriceMatch) {
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      ctx.price_per_oz = parseFloat(fixPriceMatch[3]);
      ctx.premium_discount = fixPriceMatch[2];
      if (!ctx.startDate) ctx.startDate = line.datetime;
      ctx.anchored = true;
      continue;
    }

    // -----------------------------------------------------------------------
    // 10. Boss-style: "@Lin buy 10kg silver spot" — instruction line
    // -----------------------------------------------------------------------
    const instructionMatch = text.match(/@[^\s]+\s+(buy|sell)\s+(\d+(?:\.\d+)?)\s*kgs?\s+(\w+)/i);
    if (instructionMatch) {
      ctx.participants.add(sender);
      ctx.keyLines.push(line.raw);
      if (!ctx.direction) ctx.direction = instructionMatch[1].toLowerCase() as ParsedDirection;
      if (!ctx.quantity_grams) ctx.quantity_grams = parseFloat(instructionMatch[2]) * 1000;
      const metalHint = detectMetal(instructionMatch[3]);
      if (metalHint && !ctx.metal) ctx.metal = metalHint;
      if (!ctx.startDate) ctx.startDate = line.datetime;
      continue;
    }

    // -----------------------------------------------------------------------
    // 11. USDT amount mentions "626669usdt", "23055.28usdt" (standalone confirmation)
    // -----------------------------------------------------------------------
    const usdtMatch = text.match(/(\d[\d,]*(?:\.\d+)?)\s*usdt/i);
    if (usdtMatch && !calc) {
      const usdt = parseFloat(usdtMatch[1].replace(/,/g, ""));
      if (usdt > 1000 && !ctx.total_usdt) {
        ctx.total_usdt = usdt;
        ctx.participants.add(sender);
        ctx.keyLines.push(line.raw);
      }
    }

    // -----------------------------------------------------------------------
    // 12. Senders are participants (add for any relevant-ish line)
    // -----------------------------------------------------------------------
    if (ctx.anchored && text.length > 2) {
      ctx.participants.add(sender);
    }
  }

  // Emit any trailing context
  if (ctx.anchored) tryEmit(ctx);

  return deals;
}

// ---------------------------------------------------------------------------
// Format a ParsedDeal for display (helper used by the Bot page)
// ---------------------------------------------------------------------------
export function formatQuantity(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(3)} kg`;
  }
  return `${grams.toFixed(2)} g`;
}

export function formatUsdt(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}
