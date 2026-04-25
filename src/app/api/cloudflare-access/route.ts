import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { getAccessPolicy, setAccessEnforced, setSessionDuration, addAccessEmail, removeAccessEmail } from "@/lib/cloudflare-access";

/**
 * GET /api/cloudflare-access
 *   Returns current Cloudflare Access state: enforced (toggle on/off) + email list.
 *
 * PUT /api/cloudflare-access
 *   Body: { enforced: boolean }
 *   Toggles Cloudflare Access on/off. When turning ON, syncs all non-locked
 *   auth_pins emails to the policy. When turning OFF, sets policy to bypass.
 */

export async function GET(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor || (actor.role !== "super_admin" && actor.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const db = getDb();
  const state = await getAccessPolicy(db);

  if (!state) {
    return NextResponse.json({
      ok: true,
      configured: false,
      enforced: false,
      emails: [],
    });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    enforced: state.enforced,
    emails: state.emails,
    sessionDuration: state.sessionDuration,
  });
}

export async function PUT(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor || (actor.role !== "super_admin" && actor.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const db = getDb();
  const body = await req.json();
  const { enforced, sessionDuration, addEmail, removeEmail } = body as {
    enforced?: boolean;
    sessionDuration?: string;
    addEmail?: string;
    removeEmail?: string;
  };

  // Handle session duration change
  if (sessionDuration !== undefined) {
    const valid = ["24h", "168h", "720h", "8760h"];
    if (!valid.includes(sessionDuration)) {
      return NextResponse.json({ ok: false, error: "Invalid session duration" }, { status: 400 });
    }
    const result = await setSessionDuration(db, sessionDuration);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    if (enforced === undefined) {
      return NextResponse.json({ ok: true, sessionDuration });
    }
  }

  // Handle individual email add/remove
  if (addEmail) {
    const result = await addAccessEmail(db, addEmail);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    const state = await getAccessPolicy(db);
    return NextResponse.json({ ok: true, emails: state?.emails ?? [] });
  }
  if (removeEmail) {
    const result = await removeAccessEmail(db, removeEmail);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    const state = await getAccessPolicy(db);
    return NextResponse.json({ ok: true, emails: state?.emails ?? [] });
  }

  if (typeof enforced !== "boolean") {
    return NextResponse.json({ ok: false, error: "enforced must be boolean" }, { status: 400 });
  }

  if (enforced) {
    // Collect all emails from non-locked auth_pins
    const rows = db
      .prepare("SELECT email FROM auth_pins WHERE email IS NOT NULL AND email != '' AND locked = 0")
      .all() as { email: string }[];
    const emails = rows.map((r) => r.email);

    if (emails.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No users have email addresses. Add emails to users before enabling Secure Access.",
      }, { status: 400 });
    }

    const result = await setAccessEnforced(db, true, emails);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, enforced: true, emails });
  } else {
    const result = await setAccessEnforced(db, false, []);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, enforced: false });
  }
}
