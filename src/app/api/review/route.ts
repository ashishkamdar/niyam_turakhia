import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getIgnored, getIgnoredCount } from "@/lib/ignored-messages";

/**
 * GET /api/review
 *   ?status=pending|approved|rejected|ignored|all   (default: pending)
 *   ?limit=50                                        (default: 100)
 *
 * Returns pending_deals rows ordered by received_at DESC.
 * Parse errors are returned as a parsed array instead of a JSON string.
 *
 * The "ignored" status is special: it returns the in-memory Ignored buffer
 * (messages received by the webhook that contained no #NT deal codes).
 * These are NOT persisted — they vanish on server restart. The counts map
 * always includes the live ignored count so the Ignored tab badge stays
 * accurate regardless of which status filter the client is querying.
 */
export async function GET(req: NextRequest) {
  const db = getDb();

  const statusParam = req.nextUrl.searchParams.get("status") ?? "pending";
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100;

  // Special case: ignored messages live in a module-scoped ring buffer, not the DB.
  // Shape them to look like deal rows (with all deal fields null) so the client
  // can use one render path for both kinds of card.
  let normalised: Record<string, unknown>[];
  if (statusParam === "ignored") {
    const ignored = getIgnored().slice(0, limit);
    normalised = ignored.map((m) => ({
      id: m.id,
      whatsapp_message_id: m.id,
      sender_phone: m.sender_phone,
      sender_name: m.sender_name,
      raw_message: m.raw_message,
      received_at: m.received_at,
      deal_type: null,
      direction: null,
      qty_grams: null,
      metal: null,
      purity: null,
      rate_usd_per_oz: null,
      premium_type: null,
      premium_value: null,
      party_alias: null,
      parse_errors: [],
      status: "ignored",
      reviewed_by: null,
      reviewed_at: null,
      reviewer_notes: null,
      screenshot_url: null,
      screenshot_ocr: null,
    }));
  } else {
    let rows: Record<string, unknown>[];
    if (statusParam === "all") {
      rows = db
        .prepare("SELECT * FROM pending_deals ORDER BY received_at DESC LIMIT ?")
        .all(limit) as Record<string, unknown>[];
    } else {
      rows = db
        .prepare("SELECT * FROM pending_deals WHERE status = ? ORDER BY received_at DESC LIMIT ?")
        .all(statusParam, limit) as Record<string, unknown>[];
    }

    // Parse the parse_errors JSON blob AND the screenshot_ocr JSON blob
    // so the client gets native arrays/objects instead of strings.
    normalised = rows.map((row) => {
      const errBlob = row.parse_errors;
      let parseErrors: string[] = [];
      if (typeof errBlob === "string" && errBlob.length > 0) {
        try {
          const arr = JSON.parse(errBlob);
          if (Array.isArray(arr)) parseErrors = arr.map(String);
        } catch {
          parseErrors = [String(errBlob)];
        }
      }
      const ocrBlob = row.screenshot_ocr;
      let screenshotOcr: Record<string, unknown> | null = null;
      if (typeof ocrBlob === "string" && ocrBlob.length > 0) {
        try {
          screenshotOcr = JSON.parse(ocrBlob);
        } catch {
          screenshotOcr = { raw_text: String(ocrBlob), type: "unknown" };
        }
      }
      return { ...row, parse_errors: parseErrors, screenshot_ocr: screenshotOcr };
    });
  }

  // Counts by status (used by tab badges) — includes both DB statuses and
  // the live in-memory ignored count so the Ignored tab badge always matches.
  const counts = db
    .prepare("SELECT status, COUNT(*) as count FROM pending_deals GROUP BY status")
    .all() as { status: string; count: number }[];
  const countMap: Record<string, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    ignored: getIgnoredCount(),
  };
  for (const c of counts) {
    countMap[c.status] = c.count;
  }

  return NextResponse.json({ deals: normalised, counts: countMap });
}
