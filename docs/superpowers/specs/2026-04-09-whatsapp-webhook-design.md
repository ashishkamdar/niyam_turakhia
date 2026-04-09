# Meta WhatsApp Business API Webhook Integration — Design Spec

## Overview

Connect Niyam's WhatsApp Business number to our PrismX dashboard via Meta's Cloud API. Every message received on WhatsApp appears in real-time on the dashboard. Deal patterns are auto-detected. This is the POC that leads to the paid engagement.

## Architecture

```
WhatsApp Business (Niyam's staff + clients)
  │
  ▼
Meta Cloud API
  │
  ▼
GET/POST https://nt.areakpi.in/api/whatsapp/webhook
  │
  ├── Verify webhook (GET — Meta challenge)
  ├── Receive message (POST — every incoming/outgoing message)
  ├── Verify signature (X-Hub-Signature-256 header)
  ├── Parse Meta payload → extract sender, text, timestamp, media
  ├── Store in whatsapp_messages table (existing)
  ├── Run chat parser on message + recent context
  ├── If deal detected → create deal in deals table
  ├── If "lock" → flag as locked, appears on dashboard instantly
  └── Dashboard auto-refreshes (existing 3s polling + dealTick)
```

## New Files

```
src/app/api/whatsapp/webhook/route.ts  — Meta webhook GET (verify) + POST (receive)
src/lib/meta-whatsapp.ts               — Meta API client (send messages, verify signature)
```

## Modified Files

```
src/app/settings/page.tsx              — Add Meta WhatsApp config section
src/lib/db.ts                          — Add meta_config table (migration v5)
```

## Webhook Endpoint

### GET /api/whatsapp/webhook (Verification)

Meta sends a GET request with:
- `hub.mode` = "subscribe"
- `hub.verify_token` = our configured token
- `hub.challenge` = a string to return

We verify the token matches and return the challenge.

### POST /api/whatsapp/webhook (Message Receipt)

Meta sends a POST with JSON payload containing messages. For each message:

1. Verify `X-Hub-Signature-256` header against our App Secret
2. Extract: sender phone, sender name, message text, timestamp, media (if any)
3. Map phone number to contact name (from our contacts or use WhatsApp profile name)
4. Store in `whatsapp_messages` table with `direction: "incoming"`
5. Run deal parser on the message text + last 20 messages from same contact
6. If deal detected → create in `deals` table with `created_by: "whatsapp"`
7. Return 200 immediately (Meta requires fast response)

### Meta Payload Format

```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "971501234567",
          "timestamp": "1712678400",
          "type": "text",
          "text": { "body": "Buy 10kg gold at 2340 lock" }
        }],
        "contacts": [{
          "wa_id": "971501234567",
          "profile": { "name": "Sapan" }
        }]
      }
    }]
  }]
}
```

## Meta API Client

```typescript
// lib/meta-whatsapp.ts

// Verify webhook signature
function verifySignature(payload: string, signature: string, appSecret: string): boolean

// Send a text message (for future bot replies)
async function sendMessage(phoneNumberId: string, accessToken: string, to: string, text: string): Promise<void>

// Mark message as read
async function markAsRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<void>
```

## Settings — Meta WhatsApp Config

New section in Settings page:

| Field | Description |
|-------|-------------|
| Meta App ID | From developers.facebook.com |
| Phone Number ID | The WhatsApp Business number ID |
| Access Token | Permanent access token |
| Verify Token | Our custom string for webhook verification |
| App Secret | For signature verification |
| Webhook URL | `https://nt.areakpi.in/api/whatsapp/webhook` (read-only, copy button) |
| Status | Connected / Disconnected (test with a ping) |

Stored in `meta_config` table (key-value, encrypted values).

## DB Changes

### New table: meta_config

```sql
CREATE TABLE IF NOT EXISTS meta_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Migration version 5.

## What Already Works (No Changes Needed)

- WhatsApp tab displays messages from `whatsapp_messages` table — **works**
- Deal parser detects metals, quantities, prices, lock — **works**
- Dashboard shows locked deals, stock updates, profit — **works**
- Toast notifications on deal lock — **works**
- Contact list with Active/Locked sections — **works**
- All screens auto-refresh every 3s — **works**

## Setup Steps For Niyam

1. Go to developers.facebook.com → Create App → Business type
2. Add "WhatsApp" product to the app
3. In WhatsApp > Getting Started: connect his WhatsApp Business number
4. Copy: Phone Number ID, Access Token
5. In WhatsApp > Configuration: set webhook URL to `https://nt.areakpi.in/api/whatsapp/webhook`
6. Subscribe to: `messages` webhook field
7. Enter the tokens in our Settings page
8. Send a test message — it should appear in the WhatsApp tab

## Security

- Webhook signature verification on every POST (X-Hub-Signature-256)
- Access tokens stored in DB, not in code
- HTTPS only (already have SSL)
- Rate limiting: Meta sends max ~80 messages/second (well within our capacity)
