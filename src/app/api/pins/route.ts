import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

type PinRow = {
  id: string;
  label: string;
  pin: string;
  role: string;
  created_at: string;
};

/**
 * GET /api/pins — list all PINs + per-PIN active session count.
 *
 * The active count is computed in the same request so the Users page
 * can show "Niyam (2 active)" without a second round-trip. Active =
 * last_seen within the last 2 minutes (matches /api/sessions).
 */
export async function GET(_req: NextRequest) {
  const db = getDb();
  const pins = db
    .prepare("SELECT id, label, pin, role, created_at FROM auth_pins ORDER BY created_at ASC")
    .all() as PinRow[];

  const activeCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const activeCounts = db
    .prepare(
      `SELECT pin_id, COUNT(*) as c
         FROM auth_sessions
         WHERE last_seen >= ?
         GROUP BY pin_id`
    )
    .all(activeCutoff) as { pin_id: string; c: number }[];

  const countMap = new Map(activeCounts.map((r) => [r.pin_id, r.c]));

  return NextResponse.json({
    pins: pins.map((p) => ({ ...p, active_sessions: countMap.get(p.id) ?? 0 })),
  });
}

/**
 * POST /api/pins — create a new PIN.
 * Body: { label: string, pin: string, role?: "admin" | "staff" }
 *
 * Labels are not enforced unique because "Staff" might legitimately
 * appear on multiple rows (e.g. Mumbai Staff vs Dubai Staff). PINs are
 * not enforced unique either — the spec explicitly allows multiple users
 * sharing a PIN, which in practice means two PIN rows with the same value.
 * Admin can clean these up from the UI if they want.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { label, pin, role } = body as { label?: string; pin?: string; role?: string };

  if (!label || !pin) {
    return NextResponse.json({ ok: false, error: "label and pin required" }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json(
      { ok: false, error: "PIN must be 4-8 digits" },
      { status: 400 }
    );
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO auth_pins (id, label, pin, role, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, label.trim(), pin, role === "admin" ? "admin" : "staff", now);

  return NextResponse.json({ ok: true, id });
}

/**
 * PUT /api/pins — update an existing PIN.
 * Body: { id: string, label?: string, pin?: string, role?: "admin" | "staff" }
 *
 * Only the fields that are present in the body are updated — lets the
 * UI rename without rotating the PIN, or rotate the PIN without renaming.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, label, pin, role } = body as {
    id?: string;
    label?: string;
    pin?: string;
    role?: string;
  };

  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  if (pin !== undefined && !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json(
      { ok: false, error: "PIN must be 4-8 digits" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM auth_pins WHERE id = ?")
    .get(id) as { id: string } | undefined;
  if (!existing) {
    return NextResponse.json({ ok: false, error: "PIN not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];
  if (label !== undefined) {
    updates.push("label = ?");
    params.push(label.trim());
  }
  if (pin !== undefined) {
    updates.push("pin = ?");
    params.push(pin);
  }
  if (role !== undefined) {
    updates.push("role = ?");
    params.push(role === "admin" ? "admin" : "staff");
  }
  if (updates.length === 0) {
    return NextResponse.json({ ok: true });
  }
  params.push(id);
  db.prepare(`UPDATE auth_pins SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/pins?id=xxx — delete a PIN and all its sessions.
 *
 * auth_sessions has ON DELETE CASCADE on pin_id so any active sessions
 * using this PIN are immediately invalidated — those users will see the
 * PinPad on their next heartbeat and have to log in with a different PIN.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare("DELETE FROM auth_pins WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ ok: false, error: "PIN not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
