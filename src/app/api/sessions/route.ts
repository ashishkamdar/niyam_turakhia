import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// A session is considered "active" if its last_seen is within the last
// 2 minutes. The AuthGate heartbeats every 30 seconds, so 2 minutes gives
// us 3 missed pings of tolerance for flaky networks / background tabs.
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

// How far back to include in the "recent sessions" history list on the
// Users page. Anything older than this is considered archived and not
// returned. 24 hours is enough to answer "who logged in today?".
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

type SessionRow = {
  id: string;
  pin_id: string;
  label: string;
  role: string;
  ip: string;
  user_agent: string;
  created_at: string;
  last_seen: string;
};

/**
 * GET /api/sessions
 *
 * Returns all sessions (active + recent) joined with their PIN label.
 * The client-side /users page splits them into "active now" vs "recent"
 * and groups active sessions by (label, ip) to show shared-PIN users.
 *
 * We also sweep out sessions older than the history window so the table
 * never grows unbounded on long-running servers.
 */
export async function GET(_req: NextRequest) {
  const db = getDb();
  const now = Date.now();
  const cutoff = new Date(now - HISTORY_WINDOW_MS).toISOString();

  // Sweep: delete any session whose last_seen is older than the history
  // window. Keeps the table bounded and the Users page snappy.
  db.prepare("DELETE FROM auth_sessions WHERE last_seen < ?").run(cutoff);

  const rows = db
    .prepare(
      `SELECT s.id, s.pin_id, p.label, p.role, s.ip, s.user_agent, s.created_at, s.last_seen
         FROM auth_sessions s
         JOIN auth_pins p ON p.id = s.pin_id
         ORDER BY s.last_seen DESC`
    )
    .all() as SessionRow[];

  const activeCutoff = now - ACTIVE_WINDOW_MS;
  const sessions = rows.map((r) => ({
    ...r,
    is_active: new Date(r.last_seen).getTime() >= activeCutoff,
  }));

  return NextResponse.json({
    sessions,
    active_count: sessions.filter((s) => s.is_active).length,
    generated_at: new Date(now).toISOString(),
    active_window_seconds: ACTIVE_WINDOW_MS / 1000,
  });
}

/**
 * DELETE /api/sessions?id=xxx                → kick one session by id
 * DELETE /api/sessions?label=xxx&ip=xxx      → kick every session matching
 *                                              a (PIN label, IP) pair — used
 *                                              by the grouped "Kick all"
 *                                              button on the active table
 *
 * Either form returns { ok: true, kicked: N }. A kicked session cookie is
 * orphaned: the next GET /api/auth will find no matching row and respond
 * with authenticated: false, which AuthGate's 30-second heartbeat flips
 * into the PIN pad — so the kick takes effect in at most 30 seconds on
 * the victim's browser with no extra plumbing.
 */
export async function DELETE(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get("id");
  const label = req.nextUrl.searchParams.get("label");
  const ip = req.nextUrl.searchParams.get("ip");

  if (id) {
    const result = db.prepare("DELETE FROM auth_sessions WHERE id = ?").run(id);
    return NextResponse.json({ ok: true, kicked: result.changes });
  }

  if (label && ip) {
    // Delete by (label, ip) — joins through auth_pins because label lives
    // on the pins table. Using a subquery keeps this portable vs. DELETE
    // with a JOIN (SQLite doesn't support that syntax directly).
    const result = db
      .prepare(
        `DELETE FROM auth_sessions
           WHERE ip = ?
             AND pin_id IN (SELECT id FROM auth_pins WHERE label = ?)`
      )
      .run(ip, label);
    return NextResponse.json({ ok: true, kicked: result.changes });
  }

  return NextResponse.json(
    { ok: false, error: "Provide either ?id=... or ?label=...&ip=..." },
    { status: 400 }
  );
}
