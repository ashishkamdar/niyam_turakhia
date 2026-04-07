import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const db = getDb();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10);
  const payments = db.prepare("SELECT * FROM payments ORDER BY date DESC LIMIT ?").all(limit);
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = uuid();
  db.prepare("INSERT INTO payments (id,amount,currency,direction,mode,from_location,to_location,linked_deal_id,date) VALUES (?,?,?,?,?,?,?,?,?)").run(id, body.amount, body.currency, body.direction, body.mode, body.from_location ?? "", body.to_location ?? "", body.linked_deal_id ?? null, body.date ?? new Date().toISOString());
  return NextResponse.json({ id }, { status: 201 });
}
