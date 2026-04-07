import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const db = getDb();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
  const status = req.nextUrl.searchParams.get("status");
  let sql = "SELECT * FROM deliveries WHERE 1=1";
  const params: unknown[] = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY date DESC LIMIT ?";
  params.push(limit);
  return NextResponse.json(db.prepare(sql).all(...params));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = uuid();
  db.prepare(`
    INSERT INTO deliveries (id, linked_deal_id, buyer_type, buyer_name, metal, weight_grams, shipping_cost_usd, destination, status, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.linked_deal_id ?? null, body.buyer_type, body.buyer_name, body.metal, body.weight_grams, body.shipping_cost_usd ?? 0, body.destination ?? "hong_kong", body.status ?? "preparing", body.date ?? new Date().toISOString());
  return NextResponse.json({ id }, { status: 201 });
}
