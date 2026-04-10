import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * PATCH /api/review/:id
 *   body: partial update of parsed fields + optional reviewer_notes
 *
 *   Used by the review UI when the checker wants to fix a bad parse before approving.
 *   Writable fields: deal_type, direction, qty_grams, metal, purity, rate_usd_per_oz,
 *                    premium_type, premium_value, party_alias, reviewer_notes
 *
 * POST /api/review/:id
 *   body: { action: "approve" | "reject", reviewer?: string, notes?: string }
 *
 *   approve → status='approved', reviewed_by, reviewed_at set
 *   reject  → status='rejected', reviewed_by, reviewed_at set
 *
 *   Approval of an unclassified (#NT) deal requires deal_type to already be set
 *   (either via a prior PATCH or by including deal_type in the approve body).
 */

const WRITABLE_FIELDS = new Set([
  "deal_type",
  "direction",
  "qty_grams",
  "metal",
  "purity",
  "rate_usd_per_oz",
  "premium_type",
  "premium_value",
  "party_alias",
  "reviewer_notes",
]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const existing = db.prepare("SELECT id FROM pending_deals WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "Pending deal not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (WRITABLE_FIELDS.has(key)) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No writable fields in body" }, { status: 400 });
  }

  values.push(id);
  db.prepare(`UPDATE pending_deals SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM pending_deals WHERE id = ?").get(id);
  return NextResponse.json({ deal: updated });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const action = body.action as "approve" | "reject" | undefined;
  const reviewer = (body.reviewer as string | undefined) ?? "niyam";
  const notes = (body.notes as string | undefined) ?? null;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const existing = db
    .prepare("SELECT * FROM pending_deals WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Pending deal not found" }, { status: 404 });
  }

  // If approving, classify-if-needed. The request may include deal_type to resolve #NT items.
  if (action === "approve") {
    const incomingType = body.deal_type as "K" | "P" | undefined;
    if (incomingType === "K" || incomingType === "P") {
      db.prepare("UPDATE pending_deals SET deal_type = ? WHERE id = ?").run(incomingType, id);
      existing.deal_type = incomingType;
    }
    if (existing.deal_type !== "K" && existing.deal_type !== "P") {
      return NextResponse.json(
        { error: "Cannot approve an unclassified deal — pass deal_type='K' or 'P' in the body" },
        { status: 400 }
      );
    }
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE pending_deals SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewer_notes = ? WHERE id = ?"
  ).run(newStatus, reviewer, now, notes, id);

  const updated = db.prepare("SELECT * FROM pending_deals WHERE id = ?").get(id);
  return NextResponse.json({ deal: updated });
}
