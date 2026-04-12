/**
 * Audit trail helper — single entry point for logging every mutation
 * across the system into the audit_log table.
 *
 * Usage (from any route handler that has already resolved the actor):
 *
 *   logAudit(db, {
 *     actor: { label: "Niyam", pinId: "pin_niyam" },
 *     action: "approve",
 *     targetTable: "pending_deals",
 *     targetId: deal.id,
 *     summary: "Approved Pakka deal SELL 10KG GOLD @2566.80 TAKFUNG",
 *     oldValues: { status: "pending" },
 *     newValues: { status: "approved", reviewed_by: "niyam" },
 *   });
 *
 * The log is append-only and immutable — rows are never updated or
 * deleted. This makes the table a reliable source of truth for
 * compliance, dispute resolution, and operational review.
 */

import { randomUUID } from "crypto";
import type Database from "better-sqlite3";

export interface AuditEntry {
  actor: { label: string | null; pinId: string | null } | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  summary: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert one audit_log row. Intentionally synchronous (better-sqlite3
 * runs sync) so it commits in the same tick as the mutation it's
 * logging — no window where the mutation is committed but the audit
 * entry isn't.
 *
 * Never throws on failure — audit logging should not crash the route
 * handler that called it. Errors are silently swallowed. A missing
 * audit entry is less bad than a 500 on a legitimate mutation.
 */
export function logAudit(db: Database.Database, entry: AuditEntry): void {
  try {
    db.prepare(
      `INSERT INTO audit_log
         (id, timestamp, actor_label, actor_pin_id, action, target_table, target_id, summary, old_values, new_values, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      new Date().toISOString(),
      entry.actor?.label ?? null,
      entry.actor?.pinId ?? null,
      entry.action,
      entry.targetTable ?? null,
      entry.targetId ?? null,
      entry.summary,
      entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      entry.newValues ? JSON.stringify(entry.newValues) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    );
  } catch {
    // Swallow — audit must never break the caller.
  }
}
