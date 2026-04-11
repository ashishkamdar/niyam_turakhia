import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DEFAULT_FY_START, parseFyStart } from "@/lib/financial-year";

/**
 * Thin key/value store for app-wide settings that don't warrant their
 * own table. Backed by the existing `settings` table (migration 0).
 *
 * Currently the only key in active use is `financial_year_start`, but
 * the endpoint is deliberately generic so the next "one small piece
 * of config" doesn't need a new route.
 *
 * Shape:
 *   GET  /api/settings           → all known keys, plus derived defaults
 *   PUT  /api/settings { key, value }  → upsert a single key
 *
 * Validation happens per-key: `financial_year_start` must parse as a
 * sane MM-DD via parseFyStart before we'll accept it.
 */

type KnownKey = "financial_year_start";

const KNOWN_KEYS: readonly KnownKey[] = ["financial_year_start"];

function readAll(): Record<string, string> {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM settings")
    .all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function GET(_req: NextRequest) {
  const stored = readAll();

  // Always return the known keys with sensible defaults so the client
  // can render without a "loading" dance. The underlying DB row may
  // still be absent — that's fine, the default wins until someone saves.
  const fyStart = stored.financial_year_start ?? DEFAULT_FY_START;

  return NextResponse.json({
    settings: {
      ...stored,
      financial_year_start: fyStart,
    },
    defaults: {
      financial_year_start: DEFAULT_FY_START,
    },
  });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { key?: string; value?: string };
  const { key, value } = body;

  if (typeof key !== "string" || typeof value !== "string") {
    return NextResponse.json(
      { ok: false, error: "Body must be { key: string, value: string }" },
      { status: 400 }
    );
  }
  if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json(
      { ok: false, error: `Unknown settings key: ${key}` },
      { status: 400 }
    );
  }

  // Per-key validation. The settings table is stringly-typed on
  // purpose — we validate shape here so bad inputs can't poison the
  // downstream consumers.
  if (key === "financial_year_start") {
    // parseFyStart falls back silently, so we detect invalid input
    // by round-tripping: if parse then reformat doesn't match the
    // input exactly, the user supplied something malformed.
    const parsed = parseFyStart(value);
    const roundTrip = `${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
    if (roundTrip !== value.trim()) {
      return NextResponse.json(
        { ok: false, error: "financial_year_start must be MM-DD (e.g. 04-01)" },
        { status: 400 }
      );
    }
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);

  return NextResponse.json({ ok: true, key, value });
}
