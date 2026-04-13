import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser, normalizeRole } from "@/lib/auth-context";

/**
 * GET /api/notifications
 *   Returns the last 50 notifications visible to the current user's role.
 *   Each notification includes an `is_read` boolean computed from the
 *   read_by JSON array vs the current user's label.
 *
 * POST /api/notifications
 *   body: { action: "mark_read", id: string }        — mark one as read
 *   body: { action: "mark_all_read" }                 — mark all as read
 */

type NotifRow = {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  href: string | null;
  target_role: string;
  created_by: string | null;
  read_by: string;
};

const ROLE_LEVELS: Record<string, number> = {
  staff: 0,
  admin: 1,
  super_admin: 2,
};

export async function GET(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ notifications: [], unread_count: 0 });
  }

  const db = getDb();
  const actorLevel = ROLE_LEVELS[normalizeRole(actor.role)] ?? 0;

  const rows = db
    .prepare(
      `SELECT * FROM notifications ORDER BY timestamp DESC LIMIT 50`
    )
    .all() as NotifRow[];

  // Filter by role visibility: "all" = everyone, "admin" = admin+super_admin,
  // "super_admin" = super_admin only.
  const visible = rows.filter((r) => {
    const targetLevel = ROLE_LEVELS[r.target_role] ?? 0;
    if (r.target_role === "all") return true;
    return actorLevel >= targetLevel;
  });

  const notifications = visible.map((r) => {
    let readByArr: string[] = [];
    try { readByArr = JSON.parse(r.read_by); } catch { /* keep empty */ }
    return {
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      title: r.title,
      body: r.body,
      icon: r.icon,
      href: r.href,
      created_by: r.created_by,
      is_read: readByArr.includes(actor.label),
    };
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return NextResponse.json({ notifications, unread_count: unreadCount });
}

export async function POST(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action as string;
  const db = getDb();

  if (action === "mark_read" && body.id) {
    const row = db.prepare("SELECT read_by FROM notifications WHERE id = ?").get(body.id) as { read_by: string } | undefined;
    if (row) {
      let arr: string[] = [];
      try { arr = JSON.parse(row.read_by); } catch { /* keep empty */ }
      if (!arr.includes(actor.label)) {
        arr.push(actor.label);
        db.prepare("UPDATE notifications SET read_by = ? WHERE id = ?").run(JSON.stringify(arr), body.id);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_all_read") {
    const rows = db.prepare("SELECT id, read_by FROM notifications").all() as { id: string; read_by: string }[];
    const update = db.prepare("UPDATE notifications SET read_by = ? WHERE id = ?");
    const txn = db.transaction(() => {
      for (const row of rows) {
        let arr: string[] = [];
        try { arr = JSON.parse(row.read_by); } catch { /* keep empty */ }
        if (!arr.includes(actor.label)) {
          arr.push(actor.label);
          update.run(JSON.stringify(arr), row.id);
        }
      }
    });
    txn();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
