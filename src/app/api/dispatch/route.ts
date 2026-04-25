import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import {
  getOroSoftConfig,
  getOroSoftToken,
  submitFixingTrade,
  invalidateToken,
  fetchAccountsList,
} from "@/lib/orosoft-client";
import { mapDealToFixingTrade, type DispatchableDeal as MappableDeal } from "@/lib/orosoft-mapper";

/**
 * Dispatch lock — co-ordinates concurrent dispatches across multiple
 * operators. Stored in the settings KV under `dispatch_lock` so it
 * survives restarts and is atomically swappable via a single SQL
 * INSERT OR REPLACE.
 *
 * Shape (JSON):
 *   {
 *     started_at: ISO string,
 *     started_by: PIN label (e.g. "Niyam"),
 *     target: "orosoft" | "sbs",
 *     deal_count: number,
 *     expires_at: ISO string — when the lock naturally ages out
 *   }
 *
 * The lock holds for 3 seconds of wall-clock time so every client's
 * 2-second poll is guaranteed to see it at least once before it
 * expires. The server-side DB work is much faster than that (~50ms)
 * — the lock's purpose is UI visibility, not serialization of the
 * actual SQL writes (those are already race-safe because better-
 * sqlite3 serializes writes through the Node process).
 *
 * When GET /api/dispatch is called and the current lock is stale
 * (expires_at < now), it's cleared atomically so UIs can trust the
 * "no lock" response.
 */

const LOCK_KEY = "dispatch_lock";
const LOCK_DURATION_MS = 3000;

type DispatchLock = {
  started_at: string;
  started_by: string;
  target: "orosoft" | "sbs";
  deal_count: number;
  expires_at: string;
};

function readLock(
  db: ReturnType<typeof getDb>
): DispatchLock | null {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(LOCK_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as DispatchLock;
    // Stale check — if expires_at is in the past, clear and return null.
    if (new Date(parsed.expires_at).getTime() <= Date.now()) {
      db.prepare("DELETE FROM settings WHERE key = ?").run(LOCK_KEY);
      return null;
    }
    return parsed;
  } catch {
    db.prepare("DELETE FROM settings WHERE key = ?").run(LOCK_KEY);
    return null;
  }
}

function writeLock(
  db: ReturnType<typeof getDb>,
  lock: DispatchLock
): void {
  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
  ).run(LOCK_KEY, JSON.stringify(lock));
}

/**
 * Dispatch outbox — pushes approved deals out to their final destination.
 *
 * A deal's journey through PrismX:
 *   WhatsApp lock code
 *     → pending_deals (status: pending)
 *     → /review page        (status: approved)
 *     → /outbox page        (dispatched_at set here)
 *
 * Kachha deals (deal_type='K') flow to SBS via an Excel export.
 * Pakka deals  (deal_type='P') flow to OroSoft via API.
 *
 * During the demo, both destinations are simulated locally — OroSoft
 * doesn't have an API we can hit yet (Monday's meeting with them gates
 * that) and the real Bullion Sales Order.xlsx column schema isn't
 * finalized. For now both targets update dispatch_* columns on the
 * pending_deal row so the UI can show a convincing "sent" state.
 */

// Trivial shape used by the UI. Keep this mirrored to the PendingDeal
// interface in review/page.tsx minus the fields /outbox doesn't need.
type DispatchableDeal = {
  id: string;
  sender_name: string;
  received_at: string;
  reviewed_at: string | null;
  deal_type: "K" | "P" | null;
  direction: "buy" | "sell" | null;
  metal: string | null;
  purity: string | null;
  qty_grams: number | null;
  rate_usd_per_oz: number | null;
  premium_type: "absolute" | "percent" | null;
  premium_value: number | null;
  party_alias: string | null;
  dispatched_at: string | null;
  dispatched_to: string | null;
  dispatch_response: string | null;
  dispatch_batch_id: string | null;
};

/**
 * GET /api/dispatch
 *
 * Returns the outbox split by target plus a flat list of recently
 * dispatched deals. The UI uses this to render two queue cards
 * (OroSoft / SBS) and a history timeline.
 *
 * Only approved deals are eligible — rejected / pending never show up.
 */
export async function GET(_req: NextRequest) {
  const db = getDb();

  // Read + auto-clear stale lock. Returned alongside the outbox data
  // so every caller (global banner, /outbox page, dashboard) sees the
  // same view of who's dispatching right now.
  const lock = readLock(db);

  // Waiting to ship: approved AND not yet dispatched.
  const pending = db
    .prepare(
      `SELECT id, sender_name, received_at, reviewed_at,
              deal_type, direction, metal, purity, qty_grams,
              rate_usd_per_oz, premium_type, premium_value, party_alias,
              dispatched_at, dispatched_to, dispatch_response, dispatch_batch_id, orosoft_doc_type
         FROM pending_deals
         WHERE status = 'approved' AND dispatched_at IS NULL
         ORDER BY reviewed_at ASC`
    )
    .all() as DispatchableDeal[];

  // History: anything that has been dispatched, most recent first.
  // Capped at 50 so the UI doesn't try to render a ten-thousand-row list.
  const history = db
    .prepare(
      `SELECT id, sender_name, received_at, reviewed_at,
              deal_type, direction, metal, purity, qty_grams,
              rate_usd_per_oz, premium_type, premium_value, party_alias,
              dispatched_at, dispatched_to, dispatch_response, dispatch_batch_id, orosoft_doc_type
         FROM pending_deals
         WHERE dispatched_at IS NOT NULL
         ORDER BY dispatched_at DESC
         LIMIT 50`
    )
    .all() as DispatchableDeal[];

  // Sync log — last 50 entries for the Sync History section on /outbox.
  const syncLog = db
    .prepare(
      `SELECT id, timestamp, target, deal_count, deal_ids, batch_id,
              request_summary, http_status, response_body, status,
              error_message, sent_by
         FROM dispatch_log
         ORDER BY id DESC
         LIMIT 50`
    )
    .all() as Record<string, unknown>[];

  // Format the sync_ref from the integer id.
  const syncLogFormatted = syncLog.map((row) => ({
    ...row,
    sync_ref: `SYNC-${String(row.id).padStart(4, "0")}`,
    deal_ids: typeof row.deal_ids === "string" ? JSON.parse(row.deal_ids) : [],
  }));

  return NextResponse.json({
    pakka_outbox: pending.filter((d) => d.deal_type === "P"),
    kachha_outbox: pending.filter((d) => d.deal_type === "K"),
    history,
    lock,
    sync_log: syncLogFormatted,
  });
}

/**
 * POST /api/dispatch
 *   body: { target: "orosoft" | "sbs", ids?: string[] }
 *
 * If `ids` is omitted, all eligible deals for the target are dispatched
 * (use-case: "Send all" button). Otherwise only the listed ids go.
 *
 * Returns the batch id and the updated deal rows so the client can
 * animate them into the "sent" state without a follow-up fetch.
 *
 * The "transmission" is simulated: we just stamp the DB row. A real
 * OroSoft HTTP call would go here once Niyam has API credentials.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const target = body.target as "orosoft" | "sbs" | undefined;
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : null;
  const dryRun = body.dry_run === true;

  if (target !== "orosoft" && target !== "sbs") {
    return NextResponse.json(
      { ok: false, error: "target must be 'orosoft' or 'sbs'" },
      { status: 400 }
    );
  }
  const expectedType = target === "orosoft" ? "P" : "K";
  const db = getDb();

  // Check for an existing non-stale lock held by ANOTHER user. If
  // another operator's dispatch is still within its 3-second display
  // window, we reject with 409 so the UI can show a clear "wait your
  // turn" message. better-sqlite3 serializes writes, so this read
  // cannot race against a concurrent lock acquisition — the next POST
  // in line waits for this one to commit.
  const actor = getCurrentUser(req);
  const actorLabel = actor?.label ?? "unknown";
  const existing = readLock(db);
  if (existing && existing.started_by !== actorLabel) {
    return NextResponse.json(
      {
        ok: false,
        error: `${existing.started_by} is already dispatching ${existing.deal_count} deal${
          existing.deal_count === 1 ? "" : "s"
        } to ${existing.target === "orosoft" ? "OroSoft" : "SBS"}. Please wait a moment.`,
        lock: existing,
      },
      { status: 409 }
    );
  }

  // Gather the rows that are actually eligible right now. We filter in
  // SQL instead of trusting the client — a stale UI could otherwise
  // re-dispatch an already-sent deal.
  let eligible: { id: string }[];
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    eligible = db
      .prepare(
        `SELECT id FROM pending_deals
          WHERE id IN (${placeholders})
            AND status = 'approved'
            AND dispatched_at IS NULL
            AND deal_type = ?`
      )
      .all(...ids, expectedType) as { id: string }[];
  } else {
    eligible = db
      .prepare(
        `SELECT id FROM pending_deals
          WHERE status = 'approved'
            AND dispatched_at IS NULL
            AND deal_type = ?`
      )
      .all(expectedType) as { id: string }[];
  }

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, batch_id: null, dispatched: 0 });
  }

  // Acquire the lock BEFORE the UPDATE so concurrent POSTs racing in
  // behind us see the lock on their next readLock() and bounce with a
  // 409. The lock expires 3 seconds from now so the global banner has
  // time to render on every other client's 2-second poll cycle even
  // though the actual DB write finishes in ~50ms.
  const lockStartedAt = new Date();
  const newLock: DispatchLock = {
    started_at: lockStartedAt.toISOString(),
    started_by: actorLabel,
    target,
    deal_count: eligible.length,
    expires_at: new Date(lockStartedAt.getTime() + LOCK_DURATION_MS).toISOString(),
  };
  writeLock(db, newLock);

  const batchId = randomUUID();
  const now = new Date().toISOString();

  // ── OroSoft real API dispatch ───────────────────────────────────
  const oroConfig = target === "orosoft" ? getOroSoftConfig(db) : null;
  const useRealOroSoft = target === "orosoft" && oroConfig?.enabled;

  let response = "";
  let batchStatus: "success" | "failed" | "partial" = "success";
  let batchHttpStatus = 200;
  let batchErrorMessage: string | null = null;
  const perDealResults: Array<{ id: string; ok: boolean; docNumber?: string; error?: string }> = [];

  if (useRealOroSoft && oroConfig) {
    // Fetch full deal data for mapping
    const idList = eligible.map((r) => r.id);
    const ph = idList.map(() => "?").join(",");
    const fullDeals = db.prepare(
      `SELECT id, deal_type, direction, qty_grams, metal, purity,
              rate_usd_per_oz, premium_type, premium_value, party_alias, received_at, orosoft_doc_type
         FROM pending_deals WHERE id IN (${ph})`
    ).all(...idList) as MappableDeal[];

    // Pre-validate all deals — with auto-sync retry on missing party
    function validateDeals(deals: MappableDeal[]) {
      const mapped: Array<{ id: string; payload: import("@/lib/orosoft-client").FixingTradePayload }> = [];
      const errors: Array<{ id: string; errors: string[] }> = [];
      for (const deal of deals) {
        const result = mapDealToFixingTrade(db, deal);
        if (result.ok) mapped.push({ id: deal.id, payload: result.payload });
        else errors.push({ id: deal.id, errors: result.errors });
      }
      return { mapped, errors };
    }

    let { mapped: mappedPayloads, errors: validationErrors } = validateDeals(fullDeals);

    // If any errors mention missing party, auto-sync from OroSoft and retry once
    const hasPartyErrors = validationErrors.some((e) =>
      e.errors.some((msg) => msg.includes("No party found"))
    );

    if (hasPartyErrors && !dryRun) {
      // Sync parties from OroSoft
      const authForSync = await getOroSoftToken(oroConfig);
      if (authForSync.ok) {
        const accountsResult = await fetchAccountsList(oroConfig, authForSync.token);
        if (accountsResult.ok) {
          const now = new Date().toISOString();
          const { randomUUID: syncUuid } = await import("crypto");
          for (const acct of accountsResult.data) {
            if (acct.accountType !== "C" && acct.accountType !== "S") continue;
            const existing = db.prepare(
              "SELECT id FROM parties WHERE orosoft_party_code = ?"
            ).get(acct.accountCode);
            if (!existing) {
              const partyType = acct.accountType === "C" ? "customer" : "supplier";
              db.prepare(
                `INSERT INTO parties (id, name, short_code, type, orosoft_party_code, active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
              ).run(syncUuid(), acct.accountName, acct.accountCode, partyType, acct.accountCode, now, now);
            }
          }
          // Retry validation after sync
          const retry = validateDeals(fullDeals);
          mappedPayloads = retry.mapped;
          validationErrors = retry.errors;
        }
      }
    }

    if (validationErrors.length > 0) {
      db.prepare("DELETE FROM settings WHERE key = ?").run(LOCK_KEY);
      return NextResponse.json({
        ok: false,
        error: "Validation failed for some deals",
        failures: validationErrors,
        synced: hasPartyErrors ? true : undefined,
      }, { status: 422 });
    }

    // Dry run — validation passed, return without sending
    if (dryRun) {
      db.prepare("DELETE FROM settings WHERE key = ?").run(LOCK_KEY);
      return NextResponse.json({
        ok: true,
        dry_run: true,
        validated: mappedPayloads.length,
        payloads: mappedPayloads.map((p) => ({ id: p.id, ...p.payload })),
      });
    }

    // Authenticate
    const authResult = await getOroSoftToken(oroConfig);
    if (!authResult.ok) {
      db.prepare("DELETE FROM settings WHERE key = ?").run(LOCK_KEY);
      return NextResponse.json({
        ok: false,
        error: `OroSoft authentication failed: ${authResult.error}`,
      }, { status: 502 });
    }
    let token = authResult.token;

    // Submit deals one by one
    for (const { id, payload } of mappedPayloads) {
      let result = await submitFixingTrade(oroConfig, token, payload);

      // Retry on 401 (token expired)
      if (!result.ok && result.httpStatus === 401) {
        invalidateToken();
        const reauth = await getOroSoftToken(oroConfig);
        if (reauth.ok) {
          token = reauth.token;
          result = await submitFixingTrade(oroConfig, token, payload);
        }
      }

      if (result.ok) {
        perDealResults.push({ id, ok: true, docNumber: result.data.docNumber });
      } else {
        perDealResults.push({ id, ok: false, error: result.error });
      }
    }

    const succeeded = perDealResults.filter((r) => r.ok);
    const failed = perDealResults.filter((r) => !r.ok);

    if (succeeded.length === 0) batchStatus = "failed";
    else if (failed.length > 0) batchStatus = "partial";
    else batchStatus = "success";

    batchHttpStatus = batchStatus === "success" ? 200 : batchStatus === "partial" ? 207 : 502;
    batchErrorMessage = failed.length > 0
      ? failed.map((f) => `${f.id.slice(0, 8)}: ${f.error}`).join("; ")
      : null;
    response = succeeded.length > 0
      ? `OroSoft Neo · ${succeeded.length} accepted · ${succeeded.map((s) => s.docNumber).join(", ")}`
      : `OroSoft Neo · all ${failed.length} failed`;

    // Only mark succeeded deals as dispatched
    const updateStmt = db.prepare(
      `UPDATE pending_deals
          SET dispatched_at = ?, dispatched_to = ?, dispatch_response = ?, dispatch_batch_id = ?
        WHERE id = ?`
    );
    const txn = db.transaction(() => {
      for (const s of succeeded) {
        updateStmt.run(now, target, `OroSoft Neo doc #${s.docNumber}`, batchId, s.id);
      }
    });
    txn();

  } else {
    // ── Simulation fallback (SBS or OroSoft disabled) ──────────────
    response =
      target === "orosoft"
        ? `OroSoft Neo · simulated · doc #${batchId.slice(0, 8).toUpperCase()}`
        : `SBS Excel · row batch ${batchId.slice(0, 8).toUpperCase()} appended`;

    const update = db.prepare(
      `UPDATE pending_deals
          SET dispatched_at = ?, dispatched_to = ?, dispatch_response = ?, dispatch_batch_id = ?
        WHERE id = ?`
    );
    const txn = db.transaction((rows: { id: string }[]) => {
      for (const row of rows) {
        update.run(now, target, response, batchId, row.id);
      }
    });
    txn(eligible);
  }

  // Return the freshly updated rows so the UI can slot them into the
  // history list immediately without re-fetching.
  const placeholders = eligible.map(() => "?").join(",");
  const updated = db
    .prepare(
      `SELECT id, sender_name, received_at, reviewed_at,
              deal_type, direction, metal, purity, qty_grams,
              rate_usd_per_oz, premium_type, premium_value, party_alias,
              dispatched_at, dispatched_to, dispatch_response, dispatch_batch_id, orosoft_doc_type
         FROM pending_deals
         WHERE id IN (${placeholders})
         ORDER BY dispatched_at DESC`
    )
    .all(...eligible.map((r) => r.id)) as DispatchableDeal[];

  logAudit(db, {
    actor: actor ? { label: actor.label, pinId: actor.pin_id } : null,
    action: "dispatch",
    targetTable: "pending_deals",
    targetId: batchId,
    summary: `Dispatched ${eligible.length} ${target === "orosoft" ? "Pakka" : "Kachha"} deal${eligible.length === 1 ? "" : "s"} to ${target === "orosoft" ? "OroSoft" : "SBS"}${batchStatus !== "success" ? ` (${batchStatus})` : ""}`,
    newValues: { batch_id: batchId, target, deal_ids: eligible.map((r) => r.id), status: batchStatus },
    metadata: { response },
  });

  const dealSummaries = updated.slice(0, 5).map(
    (d) => `${d.direction ?? "?"} ${d.qty_grams ?? "?"}g ${d.metal ?? "?"}`
  );
  const requestSummary = `${eligible.length} ${target === "orosoft" ? "Pakka" : "Kachha"} deal${eligible.length === 1 ? "" : "s"}: ${dealSummaries.join(", ")}${updated.length > 5 ? "…" : ""}`;

  db.prepare(
    `INSERT INTO dispatch_log
       (timestamp, target, deal_count, deal_ids, batch_id, request_summary,
        http_status, response_body, status, error_message, sent_by, sent_by_pin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    now,
    target,
    eligible.length,
    JSON.stringify(eligible.map((r) => r.id)),
    batchId,
    requestSummary,
    batchHttpStatus,
    response,
    batchStatus,
    batchErrorMessage,
    actorLabel,
    actor?.pin_id ?? null
  );

  const syncRow = db
    .prepare("SELECT id FROM dispatch_log WHERE batch_id = ? ORDER BY id DESC LIMIT 1")
    .get(batchId) as { id: number } | undefined;
  const syncNumber = syncRow?.id ?? null;
  const syncRef = syncNumber ? `SYNC-${String(syncNumber).padStart(4, "0")}` : null;

  createNotification(db, {
    type: "dispatch",
    title: `${eligible.length} ${target === "orosoft" ? "Pakka" : "Kachha"} deal${eligible.length === 1 ? "" : "s"} dispatched to ${target === "orosoft" ? "OroSoft" : "SBS"}${batchStatus !== "success" ? ` (${batchStatus})` : ""}`,
    body: syncRef ?? undefined,
    icon: batchStatus === "success" ? "📦" : batchStatus === "partial" ? "⚠️" : "❌",
    href: "/outbox",
    createdBy: actorLabel,
  });

  return NextResponse.json({
    ok: batchStatus !== "failed",
    batch_id: batchId,
    sync_number: syncNumber,
    sync_ref: syncRef,
    dispatched: perDealResults.filter((r) => r.ok).length || eligible.length,
    deals: updated,
    response,
    lock: newLock,
    ...(perDealResults.some((r) => !r.ok) ? { failures: perDealResults.filter((r) => !r.ok) } : {}),
  });
}
