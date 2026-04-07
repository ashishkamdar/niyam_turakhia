import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { PURE_PURITIES, YIELD_TABLE, type Purity } from "@/lib/types";

export async function GET(req: NextRequest) {
  const db = getDb();
  const contact = req.nextUrl.searchParams.get("contact");

  if (contact) {
    const messages = db
      .prepare("SELECT * FROM whatsapp_messages WHERE contact_name = ? ORDER BY timestamp ASC")
      .all(contact);
    return NextResponse.json(messages);
  }

  // Return contacts summary
  const contacts = db
    .prepare(`
      SELECT contact_name, contact_location,
        (SELECT message FROM whatsapp_messages m2 WHERE m2.contact_name = m1.contact_name ORDER BY timestamp DESC LIMIT 1) as lastMessage,
        (SELECT timestamp FROM whatsapp_messages m2 WHERE m2.contact_name = m1.contact_name ORDER BY timestamp DESC LIMIT 1) as lastTimestamp,
        COUNT(CASE WHEN direction = 'incoming' AND is_lock = 0 THEN 1 END) as unread
      FROM whatsapp_messages m1
      GROUP BY contact_name
      ORDER BY MAX(timestamp) DESC
    `)
    .all();
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = uuid();
  const timestamp = body.timestamp ?? new Date().toISOString();
  const messageText: string = body.message;
  const isLock = /\block\b/i.test(messageText) ? 1 : 0;

  let linkedDealId: string | null = null;

  // If message contains "lock", create a deal
  if (isLock && body.metal && body.quantity_grams && body.price_per_oz) {
    const dealId = uuid();
    const purity = (body.purity ?? "24K") as Purity;
    const isPure = PURE_PURITIES.includes(purity);
    const yieldFactor = YIELD_TABLE[purity] ?? 1.0;
    const pureEquiv = body.quantity_grams * yieldFactor;
    const direction = body.deal_direction ?? "buy";
    const location = body.contact_location === "hong_kong" ? "hong_kong" : "uae";

    db.prepare(`
      INSERT INTO deals (id, metal, purity, is_pure, quantity_grams, pure_equivalent_grams, price_per_oz, direction, location, status, date, created_by, contact_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'locked', ?, 'whatsapp', ?)
    `).run(
      dealId, body.metal, purity, isPure ? 1 : 0,
      body.quantity_grams, pureEquiv, body.price_per_oz,
      direction, location, timestamp, body.contact_name
    );
    linkedDealId = dealId;
  }

  db.prepare(`
    INSERT INTO whatsapp_messages (id, contact_name, contact_location, direction, message, is_lock, linked_deal_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.contact_name, body.contact_location, body.direction, messageText, isLock, linkedDealId, timestamp);

  return NextResponse.json({ id, is_lock: isLock, linked_deal_id: linkedDealId }, { status: 201 });
}
