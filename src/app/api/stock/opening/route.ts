import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type Database from "better-sqlite3";

/**
 * Daily opening stock register — the "starting point" for each business
 * day. Niyam's desk sets an opening stock in the morning (or it gets
 * auto-rolled from yesterday's closing), every approved WhatsApp trade
 * during the day adjusts the running Stock In Hand, and at end of day
 * the running total becomes the closing stock that seeds tomorrow.
 *
 * Design decisions:
 *
 * • Business day = IST calendar day (UTC+05:30). Niyam and staff are
 *   all in Mumbai, so using IST avoids the "stock magically reset at
 *   5:30 AM local time" bug that would happen with naive UTC dates.
 *
 * • Roll-forward is LAZY. Instead of a cron job at midnight IST, the
 *   GET handler walks forward from the latest stored opening to today,
 *   computing each intervening day's closing and inserting it as the
 *   next day's opening. A server that's been down for a week catches
 *   up the next time a user opens /stock — no supervisor needed.
 *
 * • Auto-rolled rows are marked `auto_rolled = 1` so the UI can tell
 *   the user "this was computed, not entered" and offer a quick edit.
 *
 * • Net stock is clamped at zero (you can't actually hold negative
 *   bullion). Matches the clamp in /api/stock/live so both surfaces
 *   report the same philosophical position.
 */

const GRAMS_PER_TROY_OZ = 31.1034768;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Canonical metals always appear in the opening register even if they
// have never been traded — avoids the "silver disappeared" UX bug after
// a day with zero silver activity.
const CANONICAL_METALS = ["gold", "silver", "platinum", "palladium"];

const SYMBOL_FOR_METAL: Record<string, string> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD for "now" in IST. `new Date()` is UTC; shift it
 * by +05:30 then slice the ISO string. Used everywhere we need a
 * business-day key.
 */
function istDateToday(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Returns the YYYY-MM-DD date of `iso` in IST. Used to bucket a deal's
 * reviewed_at into a business day.
 */
function istDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Next YYYY-MM-DD after `date`. Pure string math via Date so month
 * boundaries and leap years work without a library.
 */
function nextDate(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function purityFactor(purity: string | null): number {
  if (!purity) return 1;
  const t = purity.trim().toUpperCase();
  if (t.endsWith("K")) {
    const k = parseFloat(t);
    if (!Number.isNaN(k)) return k / 24;
  }
  const n = parseFloat(t);
  if (!Number.isNaN(n)) return n >= 1 ? n / 1000 : n;
  return 1;
}

type DealRow = {
  metal: string | null;
  direction: "buy" | "sell" | null;
  qty_grams: number | null;
  purity: string | null;
  reviewed_at: string | null;
  received_at: string;
};

type OpeningRow = {
  date: string;
  metal: string;
  grams: number;
  set_by: string | null;
  set_at: string;
  auto_rolled: number;
};

type DayBuckets = {
  /** Signed net fine grams per metal (buys − sells). */
  net: Map<string, number>;
  /** Raw bought fine grams per metal — used for "bought today" display. */
  bought: Map<string, number>;
  /** Raw sold fine grams per metal — used for "sold today" display. */
  sold: Map<string, number>;
};

/**
 * Compute per-metal activity for an IST business day. Pulls every
 * approved pending_deal whose business-day bucket falls in that
 * day's UTC range, normalizes to fine grams via purityFactor, and
 * returns three parallel maps: signed net, raw bought, raw sold.
 *
 * Returning all three means callers never have to re-scan the deals
 * table per metal — one query, three buckets, zero N+1.
 */
function dayActivity(db: Database.Database, istDate: string): DayBuckets {
  // IST day → UTC half-open range. istDate + 00:00 IST = istDate − 05:30 UTC.
  const startOfDayUtc = new Date(istDate + "T00:00:00Z").getTime() - IST_OFFSET_MS;
  const endOfDayUtc = startOfDayUtc + 24 * 60 * 60 * 1000;
  const fromIso = new Date(startOfDayUtc).toISOString();
  const toIso = new Date(endOfDayUtc).toISOString();

  const rows = db
    .prepare(
      `SELECT metal, direction, qty_grams, purity, reviewed_at, received_at
         FROM pending_deals
         WHERE status = 'approved'
           AND qty_grams IS NOT NULL
           AND COALESCE(reviewed_at, received_at) >= ?
           AND COALESCE(reviewed_at, received_at) <  ?`
    )
    .all(fromIso, toIso) as DealRow[];

  const net = new Map<string, number>();
  const bought = new Map<string, number>();
  const sold = new Map<string, number>();
  for (const r of rows) {
    const metal = (r.metal ?? "unknown").toLowerCase().trim() || "unknown";
    const fine = (r.qty_grams ?? 0) * purityFactor(r.purity);
    if (r.direction === "buy") {
      bought.set(metal, (bought.get(metal) ?? 0) + fine);
      net.set(metal, (net.get(metal) ?? 0) + fine);
    } else if (r.direction === "sell") {
      sold.set(metal, (sold.get(metal) ?? 0) + fine);
      net.set(metal, (net.get(metal) ?? 0) - fine);
    }
  }
  return { net, bought, sold };
}

/**
 * Returns every distinct metal the opening register has ever seen,
 * plus the four canonical metals. Used when rolling forward so we
 * don't drop a metal that was only opened once months ago.
 */
function knownMetals(db: Database.Database): string[] {
  const rows = db
    .prepare("SELECT DISTINCT metal FROM stock_opening")
    .all() as { metal: string }[];
  const set = new Set<string>(CANONICAL_METALS);
  for (const r of rows) set.add(r.metal);
  return Array.from(set);
}

/**
 * Compute the closing stock of `date` by combining that date's opening
 * rows with that date's approved-deal activity. Returns a full metal
 * map (zero-filled for canonical + known metals).
 */
function closingFor(
  db: Database.Database,
  date: string,
  metals: string[]
): Map<string, number> {
  const openings = db
    .prepare("SELECT metal, grams FROM stock_opening WHERE date = ?")
    .all(date) as { metal: string; grams: number }[];
  const { net } = dayActivity(db, date);

  const closing = new Map<string, number>();
  for (const m of metals) closing.set(m, 0);
  for (const o of openings) closing.set(o.metal, o.grams);
  for (const [metal, delta] of net) {
    closing.set(metal, (closing.get(metal) ?? 0) + delta);
  }
  // Clamp at zero — you can't hold negative bullion.
  for (const [metal, grams] of closing) {
    if (grams < 0) closing.set(metal, 0);
  }
  return closing;
}

/**
 * Walk forward from the latest stored opening date to `target`,
 * computing closings and inserting them as the next day's opening.
 * Idempotent — safe to call repeatedly, and the INSERT OR IGNORE
 * guard means a user-set opening is never overwritten by roll-forward.
 */
function rollForwardTo(db: Database.Database, target: string) {
  const latest = db
    .prepare("SELECT MAX(date) as d FROM stock_opening")
    .get() as { d: string | null };

  // Initial state: no openings at all — seed today with zeros for
  // canonical metals. The user will edit them via POST.
  if (!latest.d) {
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO stock_opening (date, metal, grams, set_by, set_at, auto_rolled)
       VALUES (?, ?, ?, NULL, ?, 1)`
    );
    for (const m of CANONICAL_METALS) {
      insert.run(target, m, 0, now);
    }
    return;
  }

  // Walk forward in a single transaction. Each iteration computes the
  // closing of `cursor` and inserts it as opening of `cursor+1`.
  const metals = knownMetals(db);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO stock_opening (date, metal, grams, set_by, set_at, auto_rolled)
     VALUES (?, ?, ?, NULL, ?, 1)`
  );
  const txn = db.transaction(() => {
    let cursor = latest.d as string;
    while (cursor < target) {
      const closing = closingFor(db, cursor, metals);
      const nextDay = nextDate(cursor);
      const now = new Date().toISOString();
      for (const [metal, grams] of closing) {
        insert.run(nextDay, metal, grams, now);
      }
      cursor = nextDay;
    }
  });
  txn();
}

/**
 * Load the current session's PIN label, if any. Used to tag who set
 * the opening stock. Best-effort — if the user is mid-login or the
 * cookie is missing, just return null.
 */
function currentUserLabel(req: NextRequest): string | null {
  const db = getDb();
  const sessionId = req.cookies.get("nt_session")?.value;
  if (!sessionId) return null;
  const row = db
    .prepare(
      `SELECT p.label FROM auth_sessions s
         JOIN auth_pins p ON p.id = s.pin_id
         WHERE s.id = ? LIMIT 1`
    )
    .get(sessionId) as { label: string } | undefined;
  return row?.label ?? null;
}

// ─── GET /api/stock/opening ─────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const db = getDb();
  const today = istDateToday();

  // Roll forward first — lazy catch-up across any downtime.
  rollForwardTo(db, today);

  const openings = db
    .prepare(
      "SELECT date, metal, grams, set_by, set_at, auto_rolled FROM stock_opening WHERE date = ?"
    )
    .all(today) as OpeningRow[];

  // Single scan of today's approved deals, split into bought/sold/net
  // buckets in one pass. Used by the per-metal loop below with O(1)
  // lookups — no N+1 per-metal re-query.
  const { bought, sold } = dayActivity(db, today);

  const prices = db
    .prepare("SELECT metal, price_usd FROM prices")
    .all() as { metal: string; price_usd: number }[];
  const priceBySymbol = new Map(prices.map((p) => [p.metal, p.price_usd]));

  // Build the full metal list so canonical metals always appear and
  // any non-canonical metal that actually traded today is included.
  const metalSet = new Set<string>(CANONICAL_METALS);
  for (const o of openings) metalSet.add(o.metal);
  for (const [m] of bought) metalSet.add(m);
  for (const [m] of sold) metalSet.add(m);

  type Entry = {
    metal: string;
    opening_grams: number;
    bought_grams: number;
    sold_grams: number;
    in_hand_grams: number;
    delta_grams: number;
    market_rate_usd_per_oz: number;
    opening_value_usd: number;
    in_hand_value_usd: number;
    delta_value_usd: number;
  };

  const openingBy = new Map(openings.map((o) => [o.metal, o]));
  const entries: Entry[] = [];
  for (const metal of metalSet) {
    const opening = openingBy.get(metal)?.grams ?? 0;
    const boughtToday = bought.get(metal) ?? 0;
    const soldToday = sold.get(metal) ?? 0;
    const inHand = Math.max(0, opening + boughtToday - soldToday);
    const symbol = SYMBOL_FOR_METAL[metal];
    const rate = symbol ? priceBySymbol.get(symbol) ?? 0 : 0;
    const openingOz = opening / GRAMS_PER_TROY_OZ;
    const inHandOz = inHand / GRAMS_PER_TROY_OZ;
    const openingValue = openingOz * rate;
    const inHandValue = inHandOz * rate;

    entries.push({
      metal,
      opening_grams: opening,
      bought_grams: boughtToday,
      sold_grams: soldToday,
      in_hand_grams: inHand,
      delta_grams: inHand - opening,
      market_rate_usd_per_oz: rate,
      opening_value_usd: openingValue,
      in_hand_value_usd: inHandValue,
      delta_value_usd: inHandValue - openingValue,
    });
  }

  // Stable order: canonical metals first, then others alphabetically.
  entries.sort((a, b) => {
    const order: Record<string, number> = { gold: 0, silver: 1, platinum: 2, palladium: 3 };
    const ao = order[a.metal] ?? 100;
    const bo = order[b.metal] ?? 100;
    if (ao !== bo) return ao - bo;
    return a.metal.localeCompare(b.metal);
  });

  // Totals across the visible metals.
  const totals = entries.reduce(
    (acc, e) => {
      acc.opening_value_usd += e.opening_value_usd;
      acc.in_hand_value_usd += e.in_hand_value_usd;
      acc.delta_value_usd += e.delta_value_usd;
      return acc;
    },
    { opening_value_usd: 0, in_hand_value_usd: 0, delta_value_usd: 0 }
  );

  // Was today's opening auto-rolled or user-entered? Prefer showing
  // "auto-rolled" if ANY row for today was auto-rolled — Niyam should
  // edit before trusting the figures.
  const anyAutoRolled = openings.some((o) => o.auto_rolled === 1);
  const setBy = openings.find((o) => o.set_by !== null)?.set_by ?? null;
  const setAt = openings[0]?.set_at ?? null;

  return NextResponse.json({
    date: today,
    auto_rolled: anyAutoRolled || openings.length === 0,
    set_by: setBy,
    set_at: setAt,
    metals: entries,
    totals,
    generated_at: new Date().toISOString(),
  });
}

// ─── POST /api/stock/opening ────────────────────────────────────────────

type UpdateBody = {
  metal?: string;
  grams?: number;
  metals?: { metal: string; grams: number }[];
};

export async function POST(req: NextRequest) {
  const db = getDb();
  const today = istDateToday();
  const user = currentUserLabel(req);
  const now = new Date().toISOString();

  const body = (await req.json()) as UpdateBody;
  const updates: { metal: string; grams: number }[] = [];
  if (Array.isArray(body.metals)) {
    for (const u of body.metals) {
      if (typeof u.metal === "string" && typeof u.grams === "number") {
        updates.push({ metal: u.metal.toLowerCase().trim(), grams: u.grams });
      }
    }
  } else if (typeof body.metal === "string" && typeof body.grams === "number") {
    updates.push({ metal: body.metal.toLowerCase().trim(), grams: body.grams });
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Provide { metal, grams } or { metals: [...] }" },
      { status: 400 }
    );
  }

  // Make sure today's row exists even before we upsert — rollForwardTo
  // is idempotent, so calling it here guarantees we're not racing a
  // first-of-day cold start.
  rollForwardTo(db, today);

  const upsert = db.prepare(
    `INSERT INTO stock_opening (date, metal, grams, set_by, set_at, auto_rolled)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(date, metal) DO UPDATE SET
       grams = excluded.grams,
       set_by = excluded.set_by,
       set_at = excluded.set_at,
       auto_rolled = 0`
  );
  const txn = db.transaction(() => {
    for (const u of updates) {
      const grams = Number.isFinite(u.grams) && u.grams >= 0 ? u.grams : 0;
      upsert.run(today, u.metal, grams, user, now);
    }
  });
  txn();

  return NextResponse.json({ ok: true, date: today, updated: updates.length });
}
