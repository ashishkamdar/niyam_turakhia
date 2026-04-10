import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { verifyWebhookSignature, downloadMedia, getMetaConfig } from "@/lib/meta-whatsapp";
import { analyzeImage } from "@/lib/image-ocr";
import { parseDealCode } from "@/lib/deal-code-parser";

// GET — Meta webhook verification
export async function GET(req: NextRequest) {
  const db = getDb();
  const config = getMetaConfig(db);
  const verifyToken = config.verify_token ?? "prismx_webhook_verify";

  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// POST — Receive messages from Meta
export async function POST(req: NextRequest) {
  const db = getDb();
  const config = getMetaConfig(db);
  const appSecret = config.app_secret ?? "";

  const rawBody = await req.text();

  // Verify signature if app_secret is configured
  if (appSecret) {
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = JSON.parse(rawBody);

  // Process each entry
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      const contacts = value.contacts ?? [];
      const contactMap = new Map<string, string>();
      for (const c of contacts) {
        contactMap.set(c.wa_id, c.profile?.name ?? c.wa_id);
      }

      for (const msg of value.messages) {
        const senderPhone = msg.from;
        const senderName = contactMap.get(senderPhone) ?? senderPhone;
        const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
        const msgId = uuid();

        let messageText = "";
        let ocrData: string | null = null;

        if (msg.type === "text") {
          messageText = msg.text?.body ?? "";
        } else if (msg.type === "image" && msg.image?.id) {
          // Download and OCR the image
          messageText = msg.image?.caption ?? "[Image]";
          try {
            const accessToken = config.access_token ?? "";
            if (accessToken) {
              const imageBuffer = await downloadMedia(msg.image.id, accessToken);
              const mimeType = msg.image.mime_type ?? "image/jpeg";
              const ocr = await analyzeImage(imageBuffer, mimeType);
              ocrData = JSON.stringify(ocr);
              if (ocr.raw_text) {
                messageText = `[Image] ${ocr.type}: ${ocr.amount ? ocr.currency + " " + ocr.amount : ""} ${ocr.raw_text.substring(0, 200)}`;
              }
            }
          } catch {
            messageText = "[Image — OCR failed]";
          }
        } else {
          messageText = `[${msg.type ?? "unknown"}]`;
        }

        // ── NEW (Apr 10, 2026): Check for structured #NT deal code ──
        // Staff in the internal PrismX group send messages like:
        //   #NTP SELL 10KG GOLD 24K @2566.80 -0.1 TAKFUNG
        // These get parsed and routed to the maker-checker review screen.
        //
        // Batching: staff often want to post multiple locked deals in a single
        // WhatsApp message with line breaks between them. We split the message
        // on newlines and parse each line independently, inserting one pending_deals
        // row per valid deal line. Non-deal lines (chatter before/after the codes,
        // empty lines, unrelated prose) are silently ignored.
        //
        // Messages without any #NT line fall through to the legacy lock-keyword
        // path below, which still works for historical free-text chats.
        const lines = messageText.split(/\r?\n/);
        for (const line of lines) {
          const parseResult = parseDealCode(line);
          if (!parseResult.is_deal_code) continue;

          const pendingId = uuid();
          const parseErrorsJson =
            parseResult.errors.length > 0 ? JSON.stringify(parseResult.errors) : null;
          db.prepare(`
            INSERT INTO pending_deals (
              id, whatsapp_message_id, sender_phone, sender_name, raw_message, received_at,
              deal_type, direction, qty_grams, metal, purity, rate_usd_per_oz,
              premium_type, premium_value, party_alias, parse_errors, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `).run(
            pendingId,
            msgId,
            senderPhone,
            senderName,
            line.trim(),
            timestamp,
            parseResult.fields.deal_type,
            parseResult.fields.direction,
            parseResult.fields.qty_grams,
            parseResult.fields.metal,
            parseResult.fields.purity,
            parseResult.fields.rate_usd_per_oz,
            parseResult.fields.premium_type,
            parseResult.fields.premium_value,
            parseResult.fields.party_alias,
            parseErrorsJson
          );
        }

        // Check for lock/deal (legacy free-text path — only fires if message contains "lock")
        const isLock = /\block\b/i.test(messageText) ? 1 : 0;
        let linkedDealId: string | null = null;

        if (isLock) {
          // Parse deal from message context
          const recentMsgs = db.prepare(
            "SELECT message FROM whatsapp_messages WHERE contact_name = ? ORDER BY timestamp DESC LIMIT 20"
          ).all(senderName) as { message: string }[];

          // Simple metal/qty/price detection from recent context
          const allText = [messageText, ...recentMsgs.map(m => m.message)].join(" ");
          const metalMatch = allText.match(/\b(gold|silver|platinum|palladium)\b/i);
          const qtyMatch = allText.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs)/i);
          const priceMatch = allText.match(/(?:USD|\$)\s*(\d+(?:\.\d+)?)/i);

          if (metalMatch && qtyMatch) {
            const dealId = uuid();
            const metal = metalMatch[1].toLowerCase();
            const qty = parseFloat(qtyMatch[1]) * 1000;
            const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

            db.prepare(`
              INSERT INTO deals (id, metal, purity, is_pure, quantity_grams, pure_equivalent_grams, price_per_oz, refining_cost_per_gram, total_cost_usd, direction, location, status, date, created_by, contact_name)
              VALUES (?, ?, '24K', 1, ?, ?, ?, 0, 0, 'buy', 'uae', 'locked', ?, 'whatsapp', ?)
            `).run(dealId, metal, qty, qty, price, timestamp, senderName);
            linkedDealId = dealId;
          }
        }

        // Store the message
        db.prepare(`
          INSERT INTO whatsapp_messages (id, contact_name, contact_location, direction, message, is_lock, linked_deal_id, timestamp)
          VALUES (?, ?, ?, 'incoming', ?, ?, ?, ?)
        `).run(msgId, senderName, "hong_kong", messageText, isLock, linkedDealId, timestamp);

        // Suppress unused variable warning
        void ocrData;
      }
    }
  }

  // Meta requires 200 response quickly
  return NextResponse.json({ status: "ok" });
}
