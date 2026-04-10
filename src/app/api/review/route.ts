import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/review
 *   ?status=pending|approved|rejected|all   (default: pending)
 *   ?limit=50                                (default: 100)
 *
 * Returns pending_deals rows ordered by received_at DESC.
 * Parse errors are returned as a parsed array instead of a JSON string.
 */
export async function GET(req: NextRequest) {
  const db = getDb();

  const statusParam = req.nextUrl.searchParams.get("status") ?? "pending";
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100;

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

  // Parse the parse_errors JSON blob for each row
  const normalised = rows.map((row) => {
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
    return { ...row, parse_errors: parseErrors };
  });

  // Counts by status (used by nav badge)
  const counts = db
    .prepare("SELECT status, COUNT(*) as count FROM pending_deals GROUP BY status")
    .all() as { status: string; count: number }[];
  const countMap: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const c of counts) {
    countMap[c.status] = c.count;
  }

  return NextResponse.json({ deals: normalised, counts: countMap });
}
