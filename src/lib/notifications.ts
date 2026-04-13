/**
 * In-app notification helper. Creates notification rows that the bell
 * icon polls and displays. Call from any route handler after a key
 * event (approve, reject, dispatch, kick, etc.).
 *
 * target_role controls visibility:
 *   "all"         → every logged-in user sees it
 *   "admin"       → admin + super_admin only
 *   "super_admin" → super_admin only
 *
 * read_by is a JSON array of PIN labels who have dismissed it.
 * A notification is "unread" for a user if their label is NOT in read_by.
 */

import { randomUUID } from "crypto";
import type Database from "better-sqlite3";

export interface CreateNotification {
  type: string;          // "deal_approved" | "deal_rejected" | "dispatch" | "session_kicked" | "backup" | "party_created" | etc.
  title: string;         // "Deal approved — SELL 10KG GOLD"
  body?: string;         // Optional detail line
  icon?: string;         // Emoji or short label: "✓" "✗" "📦" "🔑"
  href?: string;         // Link to navigate to: "/review" "/outbox" "/users"
  targetRole?: string;   // "all" | "admin" | "super_admin"
  createdBy?: string;    // Label of the actor who triggered it
}

export function createNotification(db: Database.Database, n: CreateNotification): void {
  try {
    db.prepare(
      `INSERT INTO notifications (id, timestamp, type, title, body, icon, href, target_role, created_by, read_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')`
    ).run(
      randomUUID(),
      new Date().toISOString(),
      n.type,
      n.title,
      n.body ?? null,
      n.icon ?? null,
      n.href ?? null,
      n.targetRole ?? "all",
      n.createdBy ?? null
    );

    // Keep the table bounded — delete notifications older than 7 days
    // so the bell icon doesn't accumulate thousands of stale entries.
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("DELETE FROM notifications WHERE timestamp < ?").run(cutoff);
  } catch {
    // Never crash the caller — notifications are best-effort.
  }
}
