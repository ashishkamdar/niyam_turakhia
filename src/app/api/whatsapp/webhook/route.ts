import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { verifyWebhookSignature, downloadMedia, getMetaConfig } from "@/lib/meta-whatsapp";
import { analyzeImage, type OcrProvider, type OcrResult } from "@/lib/image-ocr";
import { parseDealCode } from "@/lib/deal-code-parser";
import { pushIgnored } from "@/lib/ignored-messages";
import {
  pushOrphan,
  findOrphanByWaMessageId,
  removeOrphanByWaMessageId,
} from "@/lib/orphaned-attachments";

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
        // Meta's actual WhatsApp message id — used for reply/context matching
        // across messages. This is different from `msgId` (our local uuid used
        // as the primary key in whatsapp_messages).
        const waMessageId: string = msg.id ?? "";
        // If this message is a reply to an earlier message, context.id is
        // the Meta wamid of the replied-to message.
        const replyToWaId: string | null = msg.context?.id ?? null;

        let messageText = "";
        // OCR result for this specific message (populated only when the
        // message is an image AND the Meta access_token is configured so we
        // can download the media via the Graph API).
        let ocrResult: OcrResult | null = null;

        if (msg.type === "text") {
          messageText = msg.text?.body ?? "";
        } else if (msg.type === "image" && msg.image?.id) {
          messageText = msg.image?.caption ?? "";
          try {
            const accessToken = config.access_token ?? "";
            if (accessToken) {
              const imageBuffer = await downloadMedia(msg.image.id, accessToken);
              const mimeType = msg.image.mime_type ?? "image/jpeg";
              const provider = (config.ocr_provider as OcrProvider | undefined) ?? undefined;
              ocrResult = await analyzeImage(imageBuffer, mimeType, {
                provider,
                google_api_key: config.google_api_key,
                anthropic_api_key: config.anthropic_api_key,
                openai_api_key: config.openai_api_key,
              });
              // For the legacy whatsapp_messages log, keep a readable summary
              if (!messageText) {
                messageText = `[Image] ${ocrResult.type}${ocrResult.amount ? " " + (ocrResult.currency ?? "") + " " + ocrResult.amount : ""}`;
              }
            } else {
              if (!messageText) messageText = "[Image — access token not configured]";
            }
          } catch {
            if (!messageText) messageText = "[Image — OCR failed]";
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
        // WhatsApp message with line breaks between them. We split on newlines
        // and parse each line independently, inserting one pending_deals row
        // per valid deal line.
        //
        // Screenshot attachment linking (Phase C):
        //   - Image with deal-code caption → OCR attached to the new deal(s)
        //   - Text reply to an earlier image → orphan's OCR attached to new deal
        //   - Image reply to an earlier text deal → this image's OCR updated onto
        //     the earlier deal
        //   - Image alone (no caption, no reply) → buffered as an orphan awaiting
        //     a later reply
        //
        // Text messages with zero deal codes go to the Ignored buffer.
        // Images with zero deal codes go to the Orphan buffer (different class
        // of "not yet linked").
        const ocrJsonForNewDeals = ocrResult ? JSON.stringify(ocrResult) : null;
        const lines = messageText.split(/\r?\n/);
        let dealsInsertedFromThisMessage = 0;
        const insertedDealIds: string[] = [];
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
              premium_type, premium_value, party_alias, parse_errors, status, screenshot_ocr
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
          `).run(
            pendingId,
            waMessageId || msgId, // prefer Meta's real id for reply matching; fall back to our uuid
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
            parseErrorsJson,
            ocrJsonForNewDeals
          );
          dealsInsertedFromThisMessage++;
          insertedDealIds.push(pendingId);
        }

        // ── Attachment linking cases ──

        // Case A: TEXT message replying to an earlier orphaned image.
        //         Attach the orphan's OCR to the first deal created from this text.
        if (
          msg.type === "text" &&
          replyToWaId &&
          insertedDealIds.length > 0 &&
          !ocrResult
        ) {
          const orphan = findOrphanByWaMessageId(replyToWaId);
          if (orphan) {
            db.prepare(
              "UPDATE pending_deals SET screenshot_ocr = ? WHERE id = ?"
            ).run(JSON.stringify(orphan.ocr), insertedDealIds[0]);
            removeOrphanByWaMessageId(replyToWaId);
          }
        }

        // Case B: IMAGE with no deal-code caption, replying to an earlier text deal.
        //         Attach THIS image's OCR to that earlier deal.
        if (
          msg.type === "image" &&
          ocrResult &&
          dealsInsertedFromThisMessage === 0 &&
          replyToWaId
        ) {
          const existing = db
            .prepare(
              "SELECT id FROM pending_deals WHERE whatsapp_message_id = ? ORDER BY received_at DESC LIMIT 1"
            )
            .get(replyToWaId) as { id: string } | undefined;
          if (existing) {
            db.prepare(
              "UPDATE pending_deals SET screenshot_ocr = ? WHERE id = ?"
            ).run(JSON.stringify(ocrResult), existing.id);
          } else if (waMessageId) {
            // Context target isn't a known pending deal — buffer as orphan
            pushOrphan({
              wa_message_id: waMessageId,
              sender_phone: senderPhone,
              sender_name: senderName,
              ocr: ocrResult,
              received_at: timestamp,
            });
          }
        }

        // Case C: IMAGE alone (no deal code, no reply). Buffer as orphan.
        if (
          msg.type === "image" &&
          ocrResult &&
          dealsInsertedFromThisMessage === 0 &&
          !replyToWaId &&
          waMessageId
        ) {
          pushOrphan({
            wa_message_id: waMessageId,
            sender_phone: senderPhone,
            sender_name: senderName,
            ocr: ocrResult,
            received_at: timestamp,
          });
        }

        // TEXT with no deal codes → Ignored buffer.
        // (Images with no deal codes are handled by Case B/C above, not Ignored.)
        if (
          dealsInsertedFromThisMessage === 0 &&
          msg.type === "text" &&
          messageText.trim().length > 0
        ) {
          pushIgnored({
            id: uuid(),
            sender_name: senderName,
            sender_phone: senderPhone,
            raw_message: messageText,
            received_at: timestamp,
          });
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

        // Store the message in the legacy whatsapp_messages log (used by /whatsapp tab)
        db.prepare(`
          INSERT INTO whatsapp_messages (id, contact_name, contact_location, direction, message, is_lock, linked_deal_id, timestamp)
          VALUES (?, ?, ?, 'incoming', ?, ?, ?, ?)
        `).run(msgId, senderName, "hong_kong", messageText, isLock, linkedDealId, timestamp);
      }
    }
  }

  // Meta requires 200 response quickly
  return NextResponse.json({ status: "ok" });
}
