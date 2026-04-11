import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { PURE_PURITIES, YIELD_TABLE, type Purity } from "@/lib/types";
import { getMetaConfig, sendTextMessage } from "@/lib/meta-whatsapp";

/**
 * Resolve a contact's phone number from the pending_deals table.
 *
 * The /whatsapp page lists contacts derived from the whatsapp_messages
 * table (which has no phone column). For outbound sends we need E.164,
 * so we look up the most-recent pending_deal where sender_name matches
 * and pull sender_phone. If the contact has never sent a lock code
 * through the real webhook, we can't know their phone and return null.
 *
 * Match is case-insensitive and trimmed — "Ashish Kamdar" in the chat
 * list should hit a pending_deal with sender_name = "Ashish Kamdar"
 * even if whitespace or case drifted.
 */
function resolveContactPhone(
  db: ReturnType<typeof getDb>,
  contactName: string
): string | null {
  const row = db
    .prepare(
      `SELECT sender_phone
         FROM pending_deals
         WHERE LOWER(TRIM(sender_name)) = LOWER(TRIM(?))
           AND sender_phone IS NOT NULL
           AND sender_phone != ''
         ORDER BY received_at DESC
         LIMIT 1`
    )
    .get(contactName) as { sender_phone: string } | undefined;
  return row?.sender_phone ?? null;
}

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
        COUNT(CASE WHEN direction = 'incoming' AND is_lock = 0 THEN 1 END) as unread,
        SUM(is_lock) as lock_count,
        CASE WHEN SUM(is_lock) > 0 THEN
          (SELECT COUNT(*) FROM whatsapp_messages m3
           WHERE m3.contact_name = m1.contact_name
           AND m3.direction = 'incoming'
           AND m3.is_lock = 0
           AND m3.timestamp > (SELECT MAX(m4.timestamp) FROM whatsapp_messages m4 WHERE m4.contact_name = m1.contact_name AND m4.is_lock = 1))
        ELSE 0 END as msgs_after_last_lock
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
  if (isLock) {
    // Use provided metadata (from simulator scripts) or parse from message text
    let metal = body.metal as string | undefined;
    let quantityGrams = body.quantity_grams as number | undefined;
    let pricePerOz = body.price_per_oz as number | undefined;
    let purityStr = body.purity as string | undefined;
    let dealDirection = body.deal_direction as string | undefined;

    // Parse from message text if metadata not provided
    if (!metal || !quantityGrams || !pricePerOz) {
      const parsed = parseDealFromText(messageText);
      metal = metal ?? parsed.metal;
      quantityGrams = quantityGrams ?? parsed.quantityGrams;
      pricePerOz = pricePerOz ?? parsed.pricePerOz;
      purityStr = purityStr ?? parsed.purity;
      dealDirection = dealDirection ?? parsed.direction;
    }

    // Also scan recent conversation for context if still missing
    if (!metal || !quantityGrams || !pricePerOz) {
      const recentMsgs = db
        .prepare("SELECT message FROM whatsapp_messages WHERE contact_name = ? ORDER BY timestamp DESC LIMIT 20")
        .all(body.contact_name) as { message: string }[];
      for (const msg of recentMsgs) {
        const parsed = parseDealFromText(msg.message);
        metal = metal ?? parsed.metal;
        quantityGrams = quantityGrams ?? parsed.quantityGrams;
        pricePerOz = pricePerOz ?? parsed.pricePerOz;
        purityStr = purityStr ?? parsed.purity;
        dealDirection = dealDirection ?? parsed.direction;
        if (metal && quantityGrams && pricePerOz) break;
      }
    }

    if (metal && quantityGrams && pricePerOz) {
      const dealId = uuid();
      const purity = (purityStr ?? "24K") as Purity;
      const isPure = PURE_PURITIES.includes(purity);
      const yieldFactor = YIELD_TABLE[purity] ?? 1.0;
      const pureEquiv = quantityGrams * yieldFactor;
      const direction = dealDirection ?? "buy";
      const location = body.contact_location === "hong_kong" ? "hong_kong" : "uae";

      const status = direction === "sell" ? "sold" : "locked";

      db.prepare(`
        INSERT INTO deals (id, metal, purity, is_pure, quantity_grams, pure_equivalent_grams, price_per_oz, direction, location, status, date, created_by, contact_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp', ?)
      `).run(
        dealId, metal, purity, isPure ? 1 : 0,
        quantityGrams, pureEquiv, pricePerOz,
        direction, location, status, timestamp, body.contact_name
      );
      linkedDealId = dealId;

      // For sell deals, create a payment received record
      if (direction === "sell") {
        const paymentCurrency = body.payment_currency ?? "USD";
        const revenueUsd = (pureEquiv / 31.1035) * pricePerOz;
        const HKD_RATE = 7.82;
        const paymentAmount = paymentCurrency === "HKD" ? revenueUsd * HKD_RATE : revenueUsd;
        const mode = paymentCurrency === "USDT" ? "crypto_exchange" : paymentCurrency === "HKD" ? "local_dealer" : "bank";
        const buyerType = body.buyer_type ?? "firm";

        db.prepare(`
          INSERT INTO payments (id, amount, currency, direction, mode, from_location, to_location, linked_deal_id, date)
          VALUES (?, ?, ?, 'received', ?, 'hong_kong', 'uae', ?, ?)
        `).run(uuid(), paymentAmount, paymentCurrency, mode, dealId, timestamp);

        // Also create a settlement record as pending
        db.prepare(`
          INSERT INTO settlements (id, linked_delivery_id, amount_received, currency_received, payment_method, amount_sent_to_dubai, currency_sent, channel, seller_paid, seller_amount, status, date)
          VALUES (?, ?, ?, ?, ?, 0, 'AED', '', '', 0, 'pending', ?)
        `).run(
          uuid(), null, paymentAmount, paymentCurrency,
          buyerType === "bank" ? "Wire transfer (SWIFT)" : buyerType === "crypto_exchange" ? "Crypto transfer" : "Local bank transfer / Cash",
          timestamp
        );
      }
    }
  }

  // For outbound messages, attempt a real Meta Cloud API send BEFORE
  // persisting the row, so the DB reflects the true send status on
  // every reload. The row is still written on failure — the UI shows
  // it with a "failed" indicator so the user can retry or investigate
  // rather than silently losing the attempt.
  let wamid: string | null = null;
  let sendStatus: "sent" | "failed" | null = null;
  let sendError: string | null = null;

  if (body.direction === "outgoing") {
    const config = getMetaConfig(db);
    const phoneNumberId = config.phone_number_id;
    const accessToken = config.access_token;
    const recipientPhone = resolveContactPhone(db, body.contact_name);

    if (!phoneNumberId || !accessToken) {
      sendStatus = "failed";
      sendError =
        "Meta credentials not configured. Set phone_number_id + access_token in Settings → Meta WhatsApp Business API.";
    } else if (!recipientPhone) {
      sendStatus = "failed";
      sendError =
        `No phone number on file for "${body.contact_name}". Real sends only work for contacts whose inbound messages have hit the webhook.`;
    } else {
      const result = await sendTextMessage(
        phoneNumberId,
        accessToken,
        recipientPhone,
        messageText
      );
      if (result.ok) {
        wamid = result.wamid;
        sendStatus = "sent";
      } else {
        sendStatus = "failed";
        sendError = result.error;
      }
    }
  }

  db.prepare(`
    INSERT INTO whatsapp_messages (id, contact_name, contact_location, direction, message, is_lock, linked_deal_id, timestamp, wamid, send_status, send_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.contact_name,
    body.contact_location,
    body.direction,
    messageText,
    isLock,
    linkedDealId,
    timestamp,
    wamid,
    sendStatus,
    sendError
  );

  return NextResponse.json(
    {
      id,
      is_lock: isLock,
      linked_deal_id: linkedDealId,
      wamid,
      send_status: sendStatus,
      send_error: sendError,
    },
    { status: 201 }
  );
}

/**
 * Parse deal details from message text.
 * Handles formats like:
 *   "10 Kg 24K Gold at USD 2338.7500 buy — lock"
 *   "50 Kg 999 Silver at 29.985 sell lock"
 *   "2 kg platinum 979.25 lock"
 *   "Gold 5kg at $2340 lock"
 *   "I need 10 kg of 24K gold"
 */
function parseDealFromText(text: string): {
  metal?: string;
  quantityGrams?: number;
  pricePerOz?: number;
  purity?: string;
  direction?: string;
} {
  const lower = text.toLowerCase();

  // Metal
  let metal: string | undefined;
  if (/\bgold\b/.test(lower)) metal = "gold";
  else if (/\bsilver\b/.test(lower)) metal = "silver";
  else if (/\bplatinum\b/.test(lower)) metal = "platinum";
  else if (/\bpalladium\b/.test(lower)) metal = "palladium";

  // Quantity — look for number followed by kg or g
  let quantityGrams: number | undefined;
  const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  const gMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:gm|gms|gram|grams|g)\b/);
  if (kgMatch) quantityGrams = parseFloat(kgMatch[1]) * 1000;
  else if (gMatch) quantityGrams = parseFloat(gMatch[1]);

  // Price — look for USD/$ followed by number, or number after "at"
  let pricePerOz: number | undefined;
  const priceMatch = text.match(/(?:USD|usd|\$)\s*(\d+(?:\.\d+)?)/);
  const atMatch = text.match(/at\s+(?:USD|usd|\$)?\s*(\d+(?:\.\d+)?)/i);
  if (priceMatch) pricePerOz = parseFloat(priceMatch[1]);
  else if (atMatch) pricePerOz = parseFloat(atMatch[1]);

  // Purity
  let purity: string | undefined;
  if (/\b24k\b/i.test(text)) purity = "24K";
  else if (/\b22k\b/i.test(text)) purity = "22K";
  else if (/\b20k\b/i.test(text)) purity = "20K";
  else if (/\b18k\b/i.test(text)) purity = "18K";
  else if (/\b999\b/.test(text)) purity = "999";
  else if (/\b995\b/.test(text)) purity = "995";

  // Direction
  let direction: string | undefined;
  if (/\bbuy\b/i.test(lower) || /\bpurchase\b/i.test(lower) || /\bneed\b/i.test(lower)) direction = "buy";
  else if (/\bsell\b/i.test(lower) || /\bsale\b/i.test(lower) || /\boffer\b/i.test(lower)) direction = "sell";

  return { metal, quantityGrams, pricePerOz, purity, direction };
}
