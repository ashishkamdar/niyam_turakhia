import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

const COOKIE_NAME = "nt_session";
// 365 days in seconds — sessions persist for a year of continuous use, but
// the "currently online" list only counts sessions whose last_seen is
// within ACTIVE_WINDOW_MS (see /api/sessions).
const MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Best-effort client IP extraction. When nginx reverse-proxies to the
 * Next.js server on localhost, NextRequest.headers has x-forwarded-for
 * (set by nginx) and x-real-ip. Pick the first public-looking IP from
 * x-forwarded-for, then fall back to x-real-ip, then "unknown".
 *
 * We never trust a client-supplied header outside of these two — they're
 * explicitly set by our nginx config.
 */
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for is a comma-separated list: "client, proxy1, proxy2".
    // The left-most entry is the original client.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

// ── Brute-force protection ────────────────────────────────────────────
// In-memory map of IP → { count, lockedUntil }. After 5 failed PIN
// attempts from the same IP, that IP is locked out for 15 minutes.
// Module-scoped so it survives across requests but clears on PM2
// restart (acceptable — a restart is a natural cooldown).
const LOGIN_ATTEMPTS = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkBruteForce(ip: string): { blocked: boolean; remainingMs?: number } {
  const entry = LOGIN_ATTEMPTS.get(ip);
  if (!entry) return { blocked: false };
  if (entry.lockedUntil > Date.now()) {
    return { blocked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  // Lockout expired — reset
  if (entry.lockedUntil > 0) {
    LOGIN_ATTEMPTS.delete(ip);
  }
  return { blocked: false };
}

function recordFailedAttempt(ip: string): void {
  const entry = LOGIN_ATTEMPTS.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  LOGIN_ATTEMPTS.set(ip, entry);
}

function clearAttempts(ip: string): void {
  LOGIN_ATTEMPTS.delete(ip);
}

export async function POST(req: NextRequest) {
  const { pin, action, source } = await req.json();
  const db = getDb();

  if (action === "logout") {
    // Delete the session row so it immediately disappears from the
    // active-users list — don't wait for the active-window sweep.
    const sessionId = req.cookies.get(COOKIE_NAME)?.value;
    if (sessionId) {
      db.prepare("DELETE FROM auth_sessions WHERE id = ?").run(sessionId);
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  }

  if (typeof pin !== "string" || pin.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing PIN" }, { status: 400 });
  }

  // Brute-force check BEFORE the DB lookup so locked-out IPs can't
  // even probe whether a PIN exists.
  const ip = getClientIp(req);
  const bruteCheck = checkBruteForce(ip);
  if (bruteCheck.blocked) {
    const mins = Math.ceil((bruteCheck.remainingMs ?? 0) / 60000);
    return NextResponse.json(
      { ok: false, error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
      { status: 429 }
    );
  }

  // Multiple pins CAN have the same value (user explicitly allowed this in
  // the spec). Take the first NON-LOCKED match — locked PINs are skipped
  // entirely so an admin can block a leaked PIN without deleting it, and
  // any legitimate duplicate PIN rows still work. If every matching row
  // is locked, treat it like a wrong PIN so we don't leak the fact that
  // the PIN exists at all.
  const match = db
    .prepare(
      "SELECT id, label, role FROM auth_pins WHERE pin = ? AND locked = 0 LIMIT 1"
    )
    .get(pin) as { id: string; label: string; role: string } | undefined;

  if (!match) {
    recordFailedAttempt(ip);
    return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
  }

  // Trade Desk users can only log in via /nt/staff/trade/. The Trade
  // Desk HTML sends source:"trade_desk" in the login body. If a
  // trade_desk role user tries to log in from the mother app (no
  // source field), block them.
  if (match.role === "trade_desk" && source !== "trade_desk") {
    return NextResponse.json(
      { ok: false, error: "Access restricted to Trade Desk" },
      { status: 403 }
    );
  }

  // Successful login — clear any accumulated failed attempts for this IP.
  clearAttempts(ip);

  const now = new Date().toISOString();
  const sessionId = randomUUID();
  // ip already resolved above for brute-force check — reuse it
  const userAgent = req.headers.get("user-agent") ?? "";
  // Cloudflare injects CF-IPCountry on every proxied request — free geo lookup
  const country = req.headers.get("cf-ipcountry") ?? null;

  db.prepare(
    `INSERT INTO auth_sessions (id, pin_id, ip, user_agent, country, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, match.id, ip, userAgent, country, now, now);

  const res = NextResponse.json({ ok: true, label: match.label, role: match.role });
  res.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const sessionId = req.cookies.get(COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ authenticated: false });
  }

  // Look up the session and the associated PIN label in one query.
  const row = db
    .prepare(
      `SELECT s.id, s.pin_id, p.label, p.role
         FROM auth_sessions s
         JOIN auth_pins p ON p.id = s.pin_id
         WHERE s.id = ?
         LIMIT 1`
    )
    .get(sessionId) as { id: string; pin_id: string; label: string; role: string } | undefined;

  if (!row) {
    // Cookie references a session row that no longer exists (e.g. the PIN
    // was deleted, or this is an old "authenticated" cookie from before
    // migration v7). Clear it so the user sees the PinPad and logs in
    // fresh under the new system.
    const res = NextResponse.json({ authenticated: false });
    res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  }

  // Heartbeat: bump last_seen every time the auth gate or page ping calls
  // this endpoint. Cheap — just a timestamp write on a single row.
  db.prepare("UPDATE auth_sessions SET last_seen = ? WHERE id = ?").run(
    new Date().toISOString(),
    sessionId
  );

  return NextResponse.json({
    authenticated: true,
    label: row.label,
    role: row.role,
  });
}
