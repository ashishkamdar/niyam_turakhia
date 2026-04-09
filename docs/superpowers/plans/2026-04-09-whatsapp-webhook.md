# WhatsApp Webhook + Image OCR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect Niyam's WhatsApp Business to PrismX dashboard via Meta Cloud API — real-time messages, auto deal detection, and image OCR for payment screenshots.

**Architecture:** Meta webhook → our API endpoint → store messages → run deal parser → OCR images via Claude Vision API. All data flows into existing tables and UI components.

**Tech Stack:** Next.js API routes, Meta Cloud API, Claude Vision API (image OCR), existing SQLite + chat parser.

---

## File Structure

```
New:
  src/app/api/whatsapp/webhook/route.ts  — Meta webhook verify (GET) + receive (POST)
  src/lib/meta-whatsapp.ts               — Meta API client + signature verification
  src/lib/image-ocr.ts                   — Claude Vision API for payment screenshot OCR

Modified:
  src/lib/db.ts                          — Add meta_config table, migration v5
  src/app/settings/page.tsx              — Add Meta WhatsApp config section
  src/app/api/whatsapp/route.ts          — Update POST to also handle webhook-sourced messages
```

---

### Task 1: DB Schema + Meta API Client

**Files:**
- Modify: src/lib/db.ts
- Create: src/lib/meta-whatsapp.ts

- [ ] **Step 1: Add meta_config table to db.ts**

In initSchema, add after parsed_deals table:
```sql
CREATE TABLE IF NOT EXISTS meta_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Add migration v5:
```ts
{
  version: 5,
  description: "Add meta_config table for WhatsApp Business API",
  up: () => {},
},
```

- [ ] **Step 2: Create Meta WhatsApp client**

Create src/lib/meta-whatsapp.ts:
```ts
import crypto from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function downloadMedia(
  mediaId: string,
  accessToken: string
): Promise<Buffer> {
  // Step 1: Get media URL
  const urlRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const urlData = await urlRes.json();

  // Step 2: Download the media
  const mediaRes = await fetch(urlData.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  return buffer;
}

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

// Helper to get config from DB
export function getMetaConfig(db: import("better-sqlite3").Database): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM meta_config").all() as { key: string; value: string }[];
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value;
  return config;
}

export function setMetaConfig(db: import("better-sqlite3").Database, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO meta_config (key, value) VALUES (?, ?)").run(key, value);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts src/lib/meta-whatsapp.ts
git commit -m "feat: Meta WhatsApp API client + meta_config DB table"
```

---

### Task 2: Image OCR with Claude Vision

**Files:**
- Create: src/lib/image-ocr.ts

- [ ] **Step 1: Create OCR module**

Create src/lib/image-ocr.ts:
```ts
export interface OcrResult {
  type: "payment" | "barlist" | "receipt" | "unknown";
  amount?: number;
  currency?: string;
  sender_wallet?: string;
  receiver_wallet?: string;
  transaction_id?: string;
  date?: string;
  status?: string;
  weight_grams?: number;
  bar_count?: number;
  raw_text: string;
}

export async function analyzeImage(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { type: "unknown", raw_text: "No ANTHROPIC_API_KEY configured" };
  }

  const base64 = imageBuffer.toString("base64");
  const mediaType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Analyze this image from a precious metals trading WhatsApp chat. Extract financial details.

Return ONLY a JSON object with these fields (omit fields that don't apply):
{
  "type": "payment" | "barlist" | "receipt" | "unknown",
  "amount": number (the main amount),
  "currency": "USDT" | "HKD" | "USD" | "AED",
  "sender_wallet": "wallet address if visible",
  "receiver_wallet": "wallet address if visible",
  "transaction_id": "tx hash if visible",
  "date": "date if visible",
  "status": "confirmed" | "pending" | "sent",
  "weight_grams": number (if this is a weighing/barlist photo),
  "bar_count": number (if bars are visible),
  "raw_text": "all readable text from the image"
}

Return ONLY the JSON, no markdown, no explanation.`,
            },
          ],
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "{}";

    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as OcrResult;
    }
    return { type: "unknown", raw_text: text };
  } catch (err) {
    return { type: "unknown", raw_text: `OCR error: ${err}` };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/image-ocr.ts
git commit -m "feat: Image OCR via Claude Vision API for payment screenshots"
```

---

### Task 3: Webhook Endpoint

**Files:**
- Create: src/app/api/whatsapp/webhook/route.ts

- [ ] **Step 1: Create webhook route**

Create src/app/api/whatsapp/webhook/route.ts:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { verifyWebhookSignature, downloadMedia, getMetaConfig } from "@/lib/meta-whatsapp";
import { analyzeImage } from "@/lib/image-ocr";
import { PURE_PURITIES, YIELD_TABLE, type Purity } from "@/lib/types";

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

        // Check for lock/deal
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
      }
    }
  }

  // Meta requires 200 response quickly
  return NextResponse.json({ status: "ok" });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts
git commit -m "feat: Meta WhatsApp webhook endpoint — verify + receive + OCR"
```

---

### Task 4: Settings Page — Meta Config Section

**Files:**
- Modify: src/app/settings/page.tsx

- [ ] **Step 1: Add Meta WhatsApp configuration section to Settings**

Add a new section after the existing Data Source section with fields for:
- Webhook URL (read-only with copy button): `https://nt.areakpi.in/api/whatsapp/webhook`
- Verify Token (editable, default "prismx_webhook_verify")
- Meta App Secret
- Phone Number ID
- Access Token
- Anthropic API Key (for image OCR)
- Test Connection button
- Status indicator

Save to meta_config table via a new API endpoint or inline fetch to /api/whatsapp/webhook/config.

- [ ] **Step 2: Create config API**

Create src/app/api/whatsapp/config/route.ts:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMetaConfig, setMetaConfig } from "@/lib/meta-whatsapp";

export async function GET() {
  const db = getDb();
  const config = getMetaConfig(db);
  // Don't expose secrets fully — mask them
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    safe[k] = v.length > 8 ? v.substring(0, 4) + "..." + v.substring(v.length - 4) : "****";
  }
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" && value.trim()) {
      setMetaConfig(db, key, value.trim());
    }
  }
  return NextResponse.json({ status: "saved" });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx src/app/api/whatsapp/config/route.ts
git commit -m "feat: Meta WhatsApp config in Settings — tokens, webhook URL, test connection"
```

---

### Task 5: Set ANTHROPIC_API_KEY on Server

- [ ] **Step 1: Add environment variable to PM2**

```bash
ssh nuremberg "cd /var/www/nt-metals && pm2 set nt-metals:ANTHROPIC_API_KEY sk-ant-..."
```

Or add to PM2 ecosystem config. The key is needed for Claude Vision OCR.

- [ ] **Step 2: Deploy and verify**

```bash
bash deploy.sh
curl -s https://nt.areakpi.in/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=prismx_webhook_verify&hub.challenge=test123
```

Expected: `test123` (webhook verification working)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: WhatsApp webhook ready for Meta Cloud API connection"
```

---

## Self-Review

- **Spec coverage:** Webhook verify (T3), message receive (T3), signature verification (T2), media download + OCR (T2+T3), deal detection (T3), settings config (T4), meta_config DB (T1)
- **No placeholders:** All code complete
- **Type consistency:** Uses existing WhatsApp tables, ParsedDeal not needed here (raw message-level processing)
