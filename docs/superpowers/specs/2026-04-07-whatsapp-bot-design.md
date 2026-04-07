# WhatsApp Bot Demo — Design Spec

## Overview

A simulated WhatsApp chat interface integrated into the MIS dashboard. Shows realistic multi-contact negotiations for precious metals deals. When "lock" appears in any message, the deal is auto-captured and displayed in a prominent "Locked Deals" section. Includes a chat simulator that pours in interleaved conversations across multiple contacts.

## New Route

`/whatsapp` — accessible from bottom nav (mobile) and sidebar (desktop). Replaces "Reports" in the 5th bottom nav slot on mobile. Reports remains accessible from sidebar on desktop.

## Page Layout

**Mobile:** Full-screen contact list. Tap contact → opens chat thread (back button returns to list).

**Desktop:** Two-panel — contact list on left (~300px), chat thread on right.

**Top bar:** Toggle button "Chat Simulator" (on/off). When on, conversations auto-generate.

## Chat Simulator Engine

Pre-built negotiation scripts with realistic message flows:

| Contact | Location | Metal | Qty | Messages | Locks? |
|---------|----------|-------|-----|----------|--------|
| Mr. Chang | Hong Kong | Gold | 10kg | 8-12, price negotiation | Yes |
| Karim & Co. | Dubai | Silver | 50kg | 6-10, haggling on purity | Yes |
| Shah Brothers | UAE | Platinum | 2kg | 3-5, quick deal | Yes |
| Li Wei Trading | Hong Kong | Gold | 5kg | 5-8, walks away | No |
| Patel Exports | Dubai | Palladium | 1kg | 3-4, urgent fast lock | Yes |

Behavior:
- Messages arrive every 3-8 seconds when simulator is on
- Multiple conversations interleave (not one at a time)
- Not every negotiation locks — Li Wei walks away (realistic)
- Outgoing messages (from "us") are auto-generated too
- When conversation reaches lock point, message contains "lock" with deal details
- Manual messages can also be typed into any conversation at any time

## Lock Detection

When any message (auto or manual) contains the word "lock" (case-insensitive):
1. Parse the conversation context to determine: metal, quantity, rate, contact name, location
2. Create a deal in the deals table with `created_by: "whatsapp"`, `status: "locked"`, `contact_name` set
3. Show toast notification: "Deal locked from [contact] — [qty] [metal]"
4. Mark the message with `is_lock: 1` and link to the created deal

## Locked Deals Section

Displayed on:
- Dashboard (`/`) — prominent card at the top showing recent WhatsApp-locked deals
- Deals page (`/deals`) — filtered view or highlighted section

Each locked deal card shows:
- Contact initial avatar (colored circle with first letter)
- Contact name and location
- Metal, quantity, rate
- "WhatsApp" badge (green)
- Timestamp
- Status label: "Locked — pending staff entry"

## Data Model

### New table: whatsapp_messages

| Field | Type | Notes |
|-------|------|-------|
| id | text | uuid, primary key |
| contact_name | text | e.g. "Mr. Chang" |
| contact_location | text | e.g. "hong_kong" |
| direction | text | "incoming" or "outgoing" |
| message | text | message body |
| is_lock | integer | 1 if contains lock keyword |
| linked_deal_id | text | nullable FK to deals |
| timestamp | text | ISO datetime |

### Deals table modification

Add column: `contact_name TEXT DEFAULT ''`

Deals with `created_by = 'whatsapp'` will have `contact_name` populated.

## Navigation Changes

### Bottom nav (mobile) — 5 tabs:
1. Home `/`
2. Stock `/stock`
3. Deals `/deals`
4. WhatsApp `/whatsapp` (new, replaces Money)
5. Money `/money-flow`

Reports accessible from sidebar only on desktop.

### Sidebar (desktop) — add WhatsApp between Deals and Money Flow

## New Files

```
src/app/whatsapp/page.tsx          — WhatsApp chat page
src/components/chat-thread.tsx      — Chat message thread UI
src/components/contact-list.tsx     — Contact list sidebar
src/components/locked-deals.tsx     — Locked deals card (reused on dashboard + deals)
src/lib/chat-scripts.ts            — Pre-built negotiation scripts
src/lib/chat-simulator.ts          — Simulator engine (generates messages over time)
src/app/api/whatsapp/route.ts      — GET/POST messages API
```

## Modified Files

```
src/lib/db.ts                      — Add whatsapp_messages table, add contact_name to deals
src/components/sidebar-nav.tsx      — Add WhatsApp nav item
src/components/bottom-nav.tsx       — Replace Reports with WhatsApp, shift Money to 5th
src/app/page.tsx                   — Add Locked Deals section at top
src/app/deals/page.tsx             — Add Locked Deals highlight section
```
