import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const db = getDb();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
  const status = req.nextUrl.searchParams.get("status");
  let sql = "SELECT * FROM settlements WHERE 1=1";
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
    INSERT INTO settlements (id, linked_delivery_id, amount_received, currency_received, payment_method, amount_sent_to_dubai, currency_sent, channel, seller_paid, seller_amount, status, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.linked_delivery_id ?? null, body.amount_received, body.currency_received, body.payment_method, body.amount_sent_to_dubai ?? 0, body.currency_sent ?? "AED", body.channel ?? "", body.seller_paid ?? "", body.seller_amount ?? 0, body.status ?? "pending", body.date ?? new Date().toISOString());
  return NextResponse.json({ id }, { status: 201 });
}
