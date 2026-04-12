import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/auth/change-pin
 *   body: { current_pin: string, new_pin: string }
 *
 * Self-service PIN change — any logged-in user can change their own
 * PIN without an admin. Requires the current PIN for verification
 * (prevents a stolen session from silently rotating the PIN).
 */
export async function POST(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const currentPin = body.current_pin as string | undefined;
  const newPin = body.new_pin as string | undefined;

  if (!currentPin || !newPin) {
    return NextResponse.json(
      { ok: false, error: "Both current_pin and new_pin are required" },
      { status: 400 }
    );
  }
  if (!/^\d{4,8}$/.test(newPin)) {
    return NextResponse.json(
      { ok: false, error: "New PIN must be 4-8 digits" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Verify the current PIN matches what's on the user's auth_pins row.
  const pinRow = db
    .prepare("SELECT pin FROM auth_pins WHERE id = ?")
    .get(actor.pin_id) as { pin: string } | undefined;

  if (!pinRow || pinRow.pin !== currentPin) {
    return NextResponse.json(
      { ok: false, error: "Current PIN is incorrect" },
      { status: 403 }
    );
  }

  if (currentPin === newPin) {
    return NextResponse.json(
      { ok: false, error: "New PIN must be different from current PIN" },
      { status: 400 }
    );
  }

  db.prepare("UPDATE auth_pins SET pin = ? WHERE id = ?").run(newPin, actor.pin_id);

  logAudit(db, {
    actor: { label: actor.label, pinId: actor.pin_id },
    action: "change_own_pin",
    targetTable: "auth_pins",
    targetId: actor.pin_id,
    summary: `${actor.label} changed their own PIN`,
  });

  return NextResponse.json({ ok: true });
}
