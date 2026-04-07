import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { PURE_PURITIES, YIELD_TABLE, type Purity } from "@/lib/types";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = req.nextUrl;
  const direction = searchParams.get("direction");
  const metal = searchParams.get("metal");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "100", 10);

  let sql = "SELECT * FROM deals WHERE 1=1";
  const params: unknown[] = [];
  if (direction) { sql += " AND direction = ?"; params.push(direction); }
  if (metal) { sql += " AND metal = ?"; params.push(metal); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY date DESC LIMIT ?";
  params.push(limit);

  const deals = db.prepare(sql).all(...params);
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const purity = body.purity as Purity;
  const isPure = PURE_PURITIES.includes(purity);
  const yieldFactor = YIELD_TABLE[purity] ?? 1.0;
  const pureEquiv = body.quantity_grams * yieldFactor;
  const id = uuid();

  db.prepare(`
    INSERT INTO deals (id, metal, purity, is_pure, quantity_grams, pure_equivalent_grams, price_per_oz, direction, location, status, date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.metal, purity, isPure ? 1 : 0, body.quantity_grams, pureEquiv, body.price_per_oz, body.direction, body.location, body.status ?? "locked", body.date ?? new Date().toISOString(), body.created_by ?? "manual");

  return NextResponse.json({ id }, { status: 201 });
}
