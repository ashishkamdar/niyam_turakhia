import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseChatDeals } from "@/lib/chat-parser";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM parsed_deals ORDER BY date DESC LIMIT 200")
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { chatText?: string; source?: string };
  const chatText = body.chatText ?? "";
  const source = body.source ?? "upload";

  if (!chatText.trim()) {
    return NextResponse.json({ error: "chatText is required" }, { status: 400 });
  }

  const deals = parseChatDeals(chatText);
  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO parsed_deals
      (id, chat_source, date, metal, direction, quantity_grams, price_per_oz,
       premium_discount, total_usdt, status, participants, raw_messages, parsed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const d of deals) {
      insert.run(
        d.id,
        source,
        d.date,
        d.metal,
        d.direction,
        d.quantity_grams,
        d.price_per_oz,
        d.premium_discount,
        d.total_usdt,
        d.status,
        JSON.stringify(d.participants),
        JSON.stringify(d.raw_messages),
        now,
      );
    }
  });

  insertMany();

  return NextResponse.json({ deals, count: deals.length }, { status: 200 });
}
