/**
 * Role hierarchy + current-user resolution, shared by every route
 * handler that needs to gate a mutation on the caller's identity.
 *
 * Three roles, totally ordered:
 *
 *   super_admin > admin > staff
 *
 * Rules enforced at the API layer (never trust the client):
 *
 *   • Only super_admin can create, edit, lock, or delete a super_admin
 *     PIN. Only super_admin can kick a super_admin session.
 *   • Admin can create/edit/lock/delete admin and staff PINs, and can
 *     kick admin and staff sessions. Admin CANNOT touch super_admin
 *     rows at all — no lock, no delete, no role escalation, no kick.
 *   • Admin CANNOT escalate anyone (including themselves) to
 *     super_admin via POST or PUT — the role field is validated on
 *     write.
 *   • Staff are read-only for the /api/pins and /api/sessions kick
 *     surfaces. They have no administrative rights.
 *
 * Additionally:
 *   • The server refuses to delete the LAST remaining super_admin PIN
 *     so the system can never end up in a state where no one can
 *     create future super_admins.
 *
 * The current user is resolved from the nt_session cookie → the
 * auth_sessions row → the joined auth_pins row. If the cookie is
 * missing or orphaned, the caller is treated as unauthenticated and
 * every mutation is denied.
 */

import type { NextRequest } from "next/server";
import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";

export type Role = "super_admin" | "admin" | "staff" | "trade_desk";

export type CurrentUser = {
  pin_id: string;
  label: string;
  role: Role;
};

const COOKIE_NAME = "nt_session";

/**
 * Read the session cookie, join through auth_sessions → auth_pins,
 * and return the resolved user. Best-effort — callers that need to
 * enforce a mutation should call this and then check the role.
 */
export function getCurrentUser(req: NextRequest): CurrentUser | null {
  const sessionId = req.cookies.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.id AS pin_id, p.label, p.role
         FROM auth_sessions s
         JOIN auth_pins p ON p.id = s.pin_id
         WHERE s.id = ?
         LIMIT 1`
    )
    .get(sessionId) as { pin_id: string; label: string; role: string } | undefined;
  if (!row) return null;
  return {
    pin_id: row.pin_id,
    label: row.label,
    role: normalizeRole(row.role),
  };
}

/**
 * Coerce any string from the DB (or a client body) into a valid Role.
 * Unknown values collapse to 'staff' — the least-privileged default,
 * so a corrupt row can never accidentally grant admin rights.
 */
export function normalizeRole(raw: string | null | undefined): Role {
  if (raw === "super_admin") return "super_admin";
  if (raw === "admin") return "admin";
  if (raw === "trade_desk") return "trade_desk";
  return "staff";
}

/**
 * Can `actor` create a PIN with role `target`?
 * super_admin can create any role.
 * admin can create admin and staff only.
 * staff cannot create anyone.
 */
export function canCreateRole(actor: Role, target: Role): boolean {
  if (actor === "super_admin") return true;
  if (actor === "admin") return target === "admin" || target === "staff" || target === "trade_desk";
  return false;
}

/**
 * Can `actor` modify an existing PIN currently assigned role `target`?
 * "Modify" = rename, rotate, lock/unlock, or delete.
 */
export function canModifyPin(actor: Role, target: Role): boolean {
  if (actor === "super_admin") return true;
  if (actor === "admin") return target === "admin" || target === "staff" || target === "trade_desk";
  return false;
}

/**
 * Can `actor` kick (force-logout) a session currently held by a user
 * with role `target`? Same rules as pin modification — you can't kick
 * anyone whose PIN row you can't touch.
 */
export function canKickRole(actor: Role, target: Role): boolean {
  return canModifyPin(actor, target);
}

/**
 * Prevent the system from ending up with zero super_admins. Returns
 * the count of super_admin PIN rows — callers use this to block a
 * delete or role-downgrade that would drop the count to zero.
 */
export function countSuperAdmins(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM auth_pins WHERE role = 'super_admin'")
    .get() as { c: number };
  return row.c;
}
