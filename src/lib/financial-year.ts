/**
 * Financial-year math. Pure functions, no DB or React — both the
 * server (API routes) and client (React context) import the same
 * helpers so FY derivation can never drift between the two surfaces.
 *
 * Model: the user configures a single "FY start" as a MM-DD string
 * (default 04-01 for India's April-to-March fiscal year). From that
 * template we derive any year's FY window:
 *
 *   FY starting 2025-04-01 → 2025-04-01T00:00:00+05:30 to
 *                           2026-04-01T00:00:00+05:30 (exclusive)
 *
 * Labels follow the Indian convention:  "FY 2025-26".
 *
 * Timezone: FY boundaries are IST-aligned, same as stock_opening day
 * boundaries. A trade at 11:55 PM on March 31 IST lands in FY X-Y;
 * 10 minutes later at 12:05 AM April 1 IST lands in FY Y-Z, as
 * expected by any Indian accountant.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const DEFAULT_FY_START = "04-01";

/** A single derived financial year range. */
export type FinancialYear = {
  /** e.g. "FY 2025-26" */
  label: string;
  /** Start year (numeric) — the calendar year the FY begins in. */
  startYear: number;
  /** Inclusive start instant as an ISO string (IST-aligned midnight). */
  fromIso: string;
  /** Exclusive end instant as an ISO string (IST-aligned midnight). */
  toIso: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Parse "MM-DD" into {month, day} (1-indexed month). Falls back to
 * the default if the input is malformed so a broken settings value
 * never crashes the app.
 */
export function parseFyStart(startMmDd: string | null | undefined): {
  month: number;
  day: number;
} {
  const fallback = { month: 4, day: 1 };
  if (!startMmDd || typeof startMmDd !== "string") return fallback;
  const m = startMmDd.trim().match(/^(\d{2})-(\d{2})$/);
  if (!m) return fallback;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) return fallback;
  if (!Number.isFinite(day) || day < 1 || day > 31) return fallback;
  return { month, day };
}

/**
 * Format the two-year label: FY 2025-26, FY 2024-25, etc. Uses the
 * last two digits of the end year, zero-padded for years < 2010.
 */
function formatFyLabel(startYear: number): string {
  const endYear = startYear + 1;
  const suffix = (endYear % 100).toString().padStart(2, "0");
  return `FY ${startYear}-${suffix}`;
}

/**
 * Build the IST-aligned midnight ISO string for `year-month-day`.
 * We want the instant at 00:00 IST, which is year-month-day minus
 * 5.5 hours in UTC. Returning a proper ISO Z string means SQLite's
 * string comparison on the pending_deals.reviewed_at column will do
 * the right thing without timezone acrobatics on the server.
 */
function istMidnightIso(year: number, month: number, day: number): string {
  const utcMs =
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

// ─── Core API ──────────────────────────────────────────────────────────

/**
 * Given an FY start (MM-DD) and a reference instant, return the FY
 * that the instant falls into. If the reference is on or after the
 * FY start date of year Y, it's FY Y-(Y+1); otherwise it's FY
 * (Y-1)-Y.
 *
 * `reference` defaults to now. Tests can pass a fixed Date to make
 * this deterministic.
 */
export function deriveFy(
  startMmDd: string | null | undefined,
  reference: Date = new Date()
): FinancialYear {
  const { month, day } = parseFyStart(startMmDd);
  // Compare in IST: shift reference by +05:30 and read the calendar
  // date components. Using UTC methods on the shifted Date is the
  // simplest way to avoid server-timezone contamination.
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  const refYear = ist.getUTCFullYear();
  const refMonth = ist.getUTCMonth() + 1;
  const refDay = ist.getUTCDate();

  const beforeFyStart =
    refMonth < month || (refMonth === month && refDay < day);
  const startYear = beforeFyStart ? refYear - 1 : refYear;

  return {
    label: formatFyLabel(startYear),
    startYear,
    fromIso: istMidnightIso(startYear, month, day),
    toIso: istMidnightIso(startYear + 1, month, day),
  };
}

/**
 * Return a list of FYs ending with the current FY and walking back
 * `count - 1` years. Most recent first. Used by the UI dropdown so
 * users can switch between e.g. FY 2026-27, 2025-26, 2024-25…
 *
 * Default count of 6 covers the typical "current + five prior" view
 * Indian accountants want. Callers can request more or fewer.
 */
export function listFinancialYears(
  startMmDd: string | null | undefined,
  count: number = 6,
  reference: Date = new Date()
): FinancialYear[] {
  const { month, day } = parseFyStart(startMmDd);
  const current = deriveFy(startMmDd, reference);
  const out: FinancialYear[] = [];
  for (let i = 0; i < count; i++) {
    const startYear = current.startYear - i;
    out.push({
      label: formatFyLabel(startYear),
      startYear,
      fromIso: istMidnightIso(startYear, month, day),
      toIso: istMidnightIso(startYear + 1, month, day),
    });
  }
  return out;
}

/**
 * Intersection of an FY window with an arbitrary [from, to] window.
 * Used by pages that combine the FY dropdown with period filters
 * like "This Month" or "Custom From-To". Either bound of the period
 * can be null (meaning "unbounded on that side"), in which case the
 * FY bound wins.
 */
export function intersectFy(
  fy: FinancialYear,
  periodFrom: string | null,
  periodTo: string | null
): { from: string; to: string } {
  const from = periodFrom && periodFrom > fy.fromIso ? periodFrom : fy.fromIso;
  const to = periodTo && periodTo < fy.toIso ? periodTo : fy.toIso;
  return { from, to };
}
