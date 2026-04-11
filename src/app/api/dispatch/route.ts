import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

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

  // Waiting to ship: approved AND not yet dispatched.
  const pending = db
    .prepare(
      `SELECT id, sender_name, received_at, reviewed_at,
              deal_type, direction, metal, purity, qty_grams,
              rate_usd_per_oz, premium_type, premium_value, party_alias,
              dispatched_at, dispatched_to, dispatch_response, dispatch_batch_id
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
              dispatched_at, dispatched_to, dispatch_response, dispatch_batch_id
         FROM pending_deals
         WHERE dispatched_at IS NOT NULL
         ORDER BY dispatched_at DESC
         LIMIT 50`
    )
    .all() as DispatchableDeal[];

  return NextResponse.json({
    pakka_outbox: pending.filter((d) => d.deal_type === "P"),
    kachha_outbox: pending.filter((d) => d.deal_type === "K"),
    history,
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

  if (target !== "orosoft" && target !== "sbs") {
    return NextResponse.json(
      { ok: false, error: "target must be 'orosoft' or 'sbs'" },
      { status: 400 }
    );
  }
  const expectedType = target === "orosoft" ? "P" : "K";
  const db = getDb();

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

  const batchId = randomUUID();
  const now = new Date().toISOString();
  // Fake response strings — in production these would be the parsed
  // body of the OroSoft API response or the filename the Excel writer
  // produced. Keeping them human-readable so the UI can just print them.
  const response =
    target === "orosoft"
      ? `OroSoft Neo · accepted · doc #${batchId.slice(0, 8).toUpperCase()}`
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

  // Return the freshly updated rows so the UI can slot them into the
  // history list immediately without re-fetching.
  const placeholders = eligible.map(() => "?").join(",");
  const updated = db
    .prepare(
      `SELECT id, sender_name, received_at, reviewed_at,
              deal_type, direction, metal, purity, qty_grams,
              rate_usd_per_oz, premium_type, premium_value, party_alias,
              dispatched_at, dispatched_to, dispatch_response, dispatch_batch_id
         FROM pending_deals
         WHERE id IN (${placeholders})
         ORDER BY dispatched_at DESC`
    )
    .all(...eligible.map((r) => r.id)) as DispatchableDeal[];

  return NextResponse.json({
    ok: true,
    batch_id: batchId,
    dispatched: eligible.length,
    deals: updated,
    response,
  });
}
