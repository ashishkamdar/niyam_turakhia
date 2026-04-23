import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { parseDealCode } from "@/lib/deal-code-parser";

/**
 * POST /api/trade-entry
 *   body: { text: string }
 *
 * Accepts one or more lock code lines (newline-separated). Each line
 * is parsed via parseDealCode() and inserted into pending_deals with
 * status='pending' — identical to how the WhatsApp webhook inserts.
 *
 * The Review tab on the main PrismX app picks these up on its next
 * 3-second poll, indistinguishable from WhatsApp-sourced trades
 * except for the whatsapp_message_id prefix ("trade-desk-" vs a
 * real Meta wamid).
 *
 * GET /api/trade-entry?limit=10
 *   Returns the last N pending_deals inserted by the current user
 *   (matched by sender_name = PIN label). Used by the "My Recent
 *   Entries" section on the Trade Desk page.
 */
export async function POST(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const text = (body.text as string | undefined)?.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "No trade text provided" }, { status: 400 });
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: "No trade lines found" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const results: Array<{
    line: string;
    ok: boolean;
    id?: string;
    parsed?: Record<string, unknown>;
    errors?: string[];
  }> = [];

  const insert = db.prepare(
    `INSERT INTO pending_deals (
       id, whatsapp_message_id, sender_phone, sender_name, raw_message, received_at,
       deal_type, direction, qty_grams, metal, purity, rate_usd_per_oz,
       premium_type, premium_value, party_alias, parse_errors, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  );

  const txn = db.transaction(() => {
    for (const line of lines) {
      const parseResult = parseDealCode(line);

      if (!parseResult.is_deal_code) {
        results.push({
          line,
          ok: false,
          errors: ["Not a deal code — must start with #NTK, #NTP, or #NT"],
        });
        continue;
      }

      const id = randomUUID();
      const f = parseResult.fields;
      const parseErrors = parseResult.errors.length > 0
        ? JSON.stringify(parseResult.errors)
        : null;

      insert.run(
        id,
        `trade-desk-${id}`,   // marker prefix so Review can show source badge
        "trade-desk",           // no real phone number
        actor.label,            // sender_name = the PIN label of whoever entered it
        line,
        now,
        f.deal_type,
        f.direction,
        f.qty_grams,
        f.metal,
        f.purity,
        f.rate_usd_per_oz,
        f.premium_type,
        f.premium_value,
        f.party_alias,
        parseErrors
      );

      results.push({
        line,
        ok: true,
        id,
        parsed: f as unknown as Record<string, unknown>,
        errors: parseResult.errors.length > 0 ? parseResult.errors : undefined,
      });
    }
  });
  txn();

  const inserted = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  if (inserted > 0) {
    logAudit(db, {
      actor: { label: actor.label, pinId: actor.pin_id },
      action: "trade_desk_entry",
      targetTable: "pending_deals",
      summary: `${inserted} trade${inserted === 1 ? "" : "s"} entered via Trade Desk${failed > 0 ? ` (${failed} failed)` : ""}`,
      newValues: { inserted, failed, ids: results.filter((r) => r.ok).map((r) => r.id) },
    });

    createNotification(db, {
      type: "trade_desk_entry",
      title: `${inserted} trade${inserted === 1 ? "" : "s"} entered via Trade Desk`,
      body: `by ${actor.label}`,
      icon: "💻",
      href: "/review",
      createdBy: actor.label,
    });
  }

  return NextResponse.json({
    ok: true,
    inserted,
    failed,
    results,
  });
}

export async function GET(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor) {
    return NextResponse.json({ entries: [] });
  }

  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(Math.max(limitRaw, 1), 50);

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, raw_message, deal_type, direction, metal, purity, qty_grams,
              rate_usd_per_oz, party_alias, status, received_at
         FROM pending_deals
         WHERE sender_name = ? AND whatsapp_message_id LIKE 'trade-desk-%'
         ORDER BY received_at DESC
         LIMIT ?`
    )
    .all(actor.label, limit);

  return NextResponse.json({ entries: rows });
}
