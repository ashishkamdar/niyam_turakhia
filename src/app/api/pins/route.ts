import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import {
  canCreateRole,
  canModifyPin,
  countSuperAdmins,
  getCurrentUser,
  normalizeRole,
  type Role,
} from "@/lib/auth-context";

type PinRow = {
  id: string;
  label: string;
  pin: string;
  role: string;
  locked: number;
  created_at: string;
};

/**
 * Clamp an incoming role string to one of the three valid values.
 * Anything else (including "super-admin" with a hyphen, null, etc.)
 * collapses to "staff" — least privilege wins on ambiguous input.
 */
function parseIncomingRole(raw: unknown): Role {
  if (raw === "super_admin") return "super_admin";
  if (raw === "admin") return "admin";
  return "staff";
}

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
    .prepare(
      "SELECT id, label, pin, role, locked, created_at FROM auth_pins ORDER BY created_at ASC"
    )
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
    // Coerce locked from the raw 0/1 SQLite integer to a proper boolean so
    // the client can use it directly in JSX conditionals without worrying
    // about "0" being truthy in string contexts.
    pins: pins.map((p) => ({
      ...p,
      locked: p.locked === 1,
      active_sessions: countMap.get(p.id) ?? 0,
    })),
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
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (actor.role === "staff") {
    return NextResponse.json(
      { ok: false, error: "Staff cannot create PINs" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { label, pin } = body as { label?: string; pin?: string; role?: string };
  const requestedRole = parseIncomingRole(body.role);

  if (!label || !pin) {
    return NextResponse.json({ ok: false, error: "label and pin required" }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json(
      { ok: false, error: "PIN must be 4-8 digits" },
      { status: 400 }
    );
  }
  if (!canCreateRole(actor.role, requestedRole)) {
    return NextResponse.json(
      { ok: false, error: "Only a Super Admin can create Super Admin PINs" },
      { status: 403 }
    );
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO auth_pins (id, label, pin, role, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, label.trim(), pin, requestedRole, now);

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
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (actor.role === "staff") {
    return NextResponse.json(
      { ok: false, error: "Staff cannot modify PINs" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { id, label, pin, locked } = body as {
    id?: string;
    label?: string;
    pin?: string;
    role?: string;
    locked?: boolean;
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
    .prepare("SELECT id, role FROM auth_pins WHERE id = ?")
    .get(id) as { id: string; role: string } | undefined;
  if (!existing) {
    return NextResponse.json({ ok: false, error: "PIN not found" }, { status: 404 });
  }

  const existingRole = normalizeRole(existing.role);

  // Admin is not allowed to touch super_admin rows at all — they can't
  // see them (UI hides the buttons) and the server refuses if someone
  // bypasses the UI. Only super_admin can mutate a super_admin row.
  if (!canModifyPin(actor.role, existingRole)) {
    return NextResponse.json(
      { ok: false, error: "Only a Super Admin can modify a Super Admin PIN" },
      { status: 403 }
    );
  }

  // If a role change is requested, the NEW role must also be allowed
  // to be created by the actor. Prevents an admin from escalating a
  // staff PIN to super_admin via PUT.
  let nextRole: Role | undefined;
  if (body.role !== undefined) {
    nextRole = parseIncomingRole(body.role);
    if (!canCreateRole(actor.role, nextRole)) {
      return NextResponse.json(
        { ok: false, error: "Only a Super Admin can assign the Super Admin role" },
        { status: 403 }
      );
    }
    // Refuse to downgrade the last remaining super_admin — otherwise
    // the system ends up with zero super_admins and no way to ever
    // create another one.
    if (existingRole === "super_admin" && nextRole !== "super_admin") {
      if (countSuperAdmins(db) <= 1) {
        return NextResponse.json(
          { ok: false, error: "Cannot downgrade the last Super Admin" },
          { status: 400 }
        );
      }
    }
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
  if (nextRole !== undefined) {
    updates.push("role = ?");
    params.push(nextRole);
  }
  if (locked !== undefined) {
    // SQLite has no BOOL — store as 0/1 INTEGER.
    updates.push("locked = ?");
    params.push(locked ? 1 : 0);
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
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (actor.role === "staff") {
    return NextResponse.json(
      { ok: false, error: "Staff cannot delete PINs" },
      { status: 403 }
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const db = getDb();
  const target = db
    .prepare("SELECT id, role FROM auth_pins WHERE id = ?")
    .get(id) as { id: string; role: string } | undefined;
  if (!target) {
    return NextResponse.json({ ok: false, error: "PIN not found" }, { status: 404 });
  }

  const targetRole = normalizeRole(target.role);
  if (!canModifyPin(actor.role, targetRole)) {
    return NextResponse.json(
      { ok: false, error: "Only a Super Admin can delete a Super Admin PIN" },
      { status: 403 }
    );
  }

  // Never allow the last super_admin to be deleted — that would leave
  // the system with no one able to create future super_admins.
  if (targetRole === "super_admin" && countSuperAdmins(db) <= 1) {
    return NextResponse.json(
      { ok: false, error: "Cannot delete the last Super Admin" },
      { status: 400 }
    );
  }

  db.prepare("DELETE FROM auth_pins WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
