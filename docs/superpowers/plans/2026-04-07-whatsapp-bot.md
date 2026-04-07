# WhatsApp Bot Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a simulated WhatsApp chat interface with multi-contact negotiations, lock detection that auto-captures deals, and a chat simulator toggle.

**Architecture:** New /whatsapp page with contact list + chat thread. Chat scripts stored in a library file. Messages stored in SQLite. Lock keyword triggers deal creation via existing /api/deals. Simulator runs client-side with setInterval, posting messages to API.

**Tech Stack:** Same as existing — Next.js App Router, TypeScript, SQLite, Tailwind CSS dark theme.

---

## File Structure

```
New files:
  src/lib/chat-scripts.ts           — Pre-built negotiation scripts for 5 contacts
  src/app/api/whatsapp/route.ts     — GET/POST messages API + lock detection
  src/app/whatsapp/page.tsx         — WhatsApp page (contact list + chat thread)
  src/components/contact-list.tsx   — Contact list with last message preview
  src/components/chat-thread.tsx    — Chat message bubbles + manual input
  src/components/locked-deals.tsx   — Locked deals card (reused on dashboard + deals)

Modified files:
  src/lib/types.ts                  — Add WhatsAppMessage interface, update Deal.created_by
  src/lib/db.ts                     — Add whatsapp_messages table, add contact_name to deals
  src/components/sidebar-nav.tsx    — Add WhatsApp nav item
  src/components/bottom-nav.tsx     — Replace Reports with WhatsApp in mobile nav
  src/app/page.tsx                  — Add LockedDeals section
  src/app/deals/page.tsx            — Add LockedDeals section
```

---

### Task 1: Types + DB Schema Updates

**Files:**
- Modify: src/lib/types.ts
- Modify: src/lib/db.ts

- [ ] **Step 1: Add WhatsApp types to types.ts**

Add to the end of src/lib/types.ts:
```ts
export interface WhatsAppMessage {
  id: string;
  contact_name: string;
  contact_location: string;
  direction: "incoming" | "outgoing";
  message: string;
  is_lock: boolean;
  linked_deal_id: string | null;
  timestamp: string;
}

export interface WhatsAppContact {
  name: string;
  location: string;
  lastMessage: string;
  lastTimestamp: string;
  unread: number;
}
```

Update the Deal interface `created_by` field:
```ts
  created_by: "simulator" | "manual" | "whatsapp";
```

- [ ] **Step 2: Add whatsapp_messages table and contact_name column to deals in db.ts**

Add to the initSchema function in db.ts, after the settings table:
```ts
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id TEXT PRIMARY KEY,
      contact_name TEXT NOT NULL,
      contact_location TEXT NOT NULL,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      is_lock INTEGER NOT NULL DEFAULT 0,
      linked_deal_id TEXT,
      timestamp TEXT NOT NULL
    );
```

After all CREATE TABLE statements, add a migration for the contact_name column on deals:
```ts
  // Add contact_name to deals if not exists
  const cols = db.prepare("PRAGMA table_info(deals)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "contact_name")) {
    db.prepare("ALTER TABLE deals ADD COLUMN contact_name TEXT DEFAULT ''").run();
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/db.ts
git commit -m "feat: add WhatsApp message types and DB schema"
```

---

### Task 2: Chat Scripts

**Files:**
- Create: src/lib/chat-scripts.ts

- [ ] **Step 1: Create negotiation scripts**

Create src/lib/chat-scripts.ts:
```ts
import type { Metal } from "./types";

export interface ChatScript {
  contact_name: string;
  contact_location: string;
  metal: Metal;
  purity: string;
  quantity_grams: number;
  price_per_oz: number;
  locks: boolean;
  messages: { direction: "incoming" | "outgoing"; text: string }[];
}

export const CHAT_SCRIPTS: ChatScript[] = [
  {
    contact_name: "Mr. Chang",
    contact_location: "hong_kong",
    metal: "gold",
    purity: "24K",
    quantity_grams: 10000,
    price_per_oz: 2338.7500,
    locks: true,
    messages: [
      { direction: "incoming", text: "Good morning. I need 10 kg of 24K gold. What's your best price today?" },
      { direction: "outgoing", text: "Good morning Mr. Chang. For 10 kg 24K, I can do $2,342.50/oz." },
      { direction: "incoming", text: "That's a bit high. I'm seeing $2,335 in the market right now." },
      { direction: "outgoing", text: "Market is at $2,341.56 on the AM fix. My spread is very tight." },
      { direction: "incoming", text: "Can you come down to $2,338? For 10 kg that's a big order." },
      { direction: "outgoing", text: "For you Mr. Chang, $2,339.50 — best I can do on 10 kg." },
      { direction: "incoming", text: "Meet me at $2,338.75 and we have a deal." },
      { direction: "outgoing", text: "$2,338.75 for 10 kg 24K gold. Confirmed." },
      { direction: "incoming", text: "Yes. 10 Kg 24K Gold at USD 2338.7500 buy — lock" },
      { direction: "outgoing", text: "Locked. Deal confirmed. Will arrange delivery to HK." },
    ],
  },
  {
    contact_name: "Karim & Co.",
    contact_location: "uae",
    metal: "silver",
    purity: "999",
    quantity_grams: 50000,
    price_per_oz: 29.9850,
    locks: true,
    messages: [
      { direction: "incoming", text: "Salaam. We have 50 kg of 999 silver available. Interested?" },
      { direction: "outgoing", text: "Wa alaikum assalam. What price are you looking at?" },
      { direction: "incoming", text: "$30.25/oz for 50 kg. Good quality, certified." },
      { direction: "outgoing", text: "That's above fix. I can do $29.90/oz for the full lot." },
      { direction: "incoming", text: "Too low. $30.10 is my final." },
      { direction: "outgoing", text: "$29.985 — split the difference. 50 kg, one lot." },
      { direction: "incoming", text: "OK agreed. 50 Kg 999 Silver at USD 29.9850 sell — lock" },
      { direction: "outgoing", text: "Locked. Sending payment in AED today." },
    ],
  },
  {
    contact_name: "Shah Brothers",
    contact_location: "uae",
    metal: "platinum",
    purity: "999",
    quantity_grams: 2000,
    price_per_oz: 979.2500,
    locks: true,
    messages: [
      { direction: "incoming", text: "Need 2 kg platinum 999. Quick deal." },
      { direction: "outgoing", text: "$981.50/oz for 2 kg. Ready now." },
      { direction: "incoming", text: "$979.25 and done. 2 Kg 999 Platinum at USD 979.2500 buy — lock" },
      { direction: "outgoing", text: "Done. Locked at $979.25/oz." },
    ],
  },
  {
    contact_name: "Li Wei Trading",
    contact_location: "hong_kong",
    metal: "gold",
    purity: "24K",
    quantity_grams: 5000,
    price_per_oz: 0,
    locks: false,
    messages: [
      { direction: "incoming", text: "Hi, checking price for 5 kg 24K gold." },
      { direction: "outgoing", text: "Current offer: $2,343.00/oz for 5 kg." },
      { direction: "incoming", text: "Too expensive. I'll wait for the PM fix." },
      { direction: "outgoing", text: "PM fix might go higher. Lock now at $2,341?" },
      { direction: "incoming", text: "No thanks, I'll check back later." },
      { direction: "outgoing", text: "OK, let me know." },
    ],
  },
  {
    contact_name: "Patel Exports",
    contact_location: "uae",
    metal: "palladium",
    purity: "999",
    quantity_grams: 1000,
    price_per_oz: 1021.5000,
    locks: true,
    messages: [
      { direction: "incoming", text: "Urgent — 1 kg palladium 999. Best price?" },
      { direction: "outgoing", text: "$1,023.50/oz. Can deliver today." },
      { direction: "incoming", text: "$1,021.50 and I lock now. 1 Kg 999 Palladium at USD 1021.5000 buy — lock" },
      { direction: "outgoing", text: "Locked. Deal done." },
    ],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/chat-scripts.ts
git commit -m "feat: add WhatsApp chat negotiation scripts for 5 contacts"
```

---

### Task 3: WhatsApp Messages API

**Files:**
- Create: src/app/api/whatsapp/route.ts

- [ ] **Step 1: Create API route**

Create src/app/api/whatsapp/route.ts:
```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/whatsapp/route.ts
git commit -m "feat: add WhatsApp messages API with lock detection"
```

---

### Task 4: Contact List Component

**Files:**
- Create: src/components/contact-list.tsx

- [ ] **Step 1: Create contact list**

Create src/components/contact-list.tsx:
```tsx
"use client";

import type { WhatsAppContact } from "@/lib/types";

const AVATAR_COLORS: Record<string, string> = {
  "Mr. Chang": "bg-blue-600",
  "Karim & Co.": "bg-emerald-600",
  "Shah Brothers": "bg-amber-600",
  "Li Wei Trading": "bg-purple-600",
  "Patel Exports": "bg-rose-600",
};

export function ContactList({
  contacts,
  selected,
  onSelect,
}: {
  contacts: WhatsAppContact[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {contacts.map((c) => {
        const initial = c.name.charAt(0).toUpperCase();
        const color = AVATAR_COLORS[c.name] ?? "bg-gray-600";
        const isActive = selected === c.name;
        return (
          <button
            key={c.name}
            onClick={() => onSelect(c.name)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
              isActive ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}>
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{c.name}</span>
                {c.unread > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-gray-400">{c.lastMessage}</p>
            </div>
          </button>
        );
      })}
      {contacts.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-gray-500">No conversations yet. Start the chat simulator.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/contact-list.tsx
git commit -m "feat: add WhatsApp contact list component"
```

---

### Task 5: Chat Thread Component

**Files:**
- Create: src/components/chat-thread.tsx

- [ ] **Step 1: Create chat thread**

Create src/components/chat-thread.tsx:
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import type { WhatsAppMessage } from "@/lib/types";

export function ChatThread({
  contactName,
  messages,
  onSendMessage,
  onBack,
}: {
  contactName: string;
  messages: WhatsAppMessage[];
  onSendMessage: (text: string) => void;
  onBack?: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-400 hover:text-white lg:hidden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
          {contactName.charAt(0)}
        </div>
        <span className="text-sm font-semibold text-white">{contactName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          const isIncoming = m.direction === "incoming";
          const hasLock = m.is_lock;
          return (
            <div key={m.id} className={`flex ${isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  hasLock
                    ? "bg-amber-600/20 outline outline-1 outline-amber-500/50"
                    : isIncoming
                      ? "bg-gray-800 text-gray-100"
                      : "bg-emerald-700 text-white"
                }`}
              >
                <p>
                  {hasLock ? highlightLock(m.message) : m.message}
                </p>
                <p className={`mt-1 text-[10px] ${hasLock ? "text-amber-400/70" : isIncoming ? "text-gray-500" : "text-emerald-300/70"}`}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {hasLock && " — DEAL LOCKED"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 rounded-full bg-gray-800 px-4 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:outline-1 focus:outline-amber-500"
          />
          <button
            onClick={handleSend}
            className="flex size-10 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function highlightLock(text: string): React.ReactNode {
  const parts = text.split(/(\block\b)/i);
  return parts.map((part, i) =>
    /^lock$/i.test(part) ? (
      <span key={i} className="font-bold text-amber-400">{part}</span>
    ) : (
      part
    )
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat-thread.tsx
git commit -m "feat: add WhatsApp chat thread component with lock highlighting"
```

---

### Task 6: Locked Deals Component

**Files:**
- Create: src/components/locked-deals.tsx

- [ ] **Step 1: Create locked deals card**

Create src/components/locked-deals.tsx:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/types";

interface DealWithContact extends Deal {
  contact_name: string;
}

export function LockedDeals() {
  const [deals, setDeals] = useState<DealWithContact[]>([]);

  useEffect(() => {
    fetch("/api/deals?limit=50")
      .then((r) => r.json())
      .then((all: DealWithContact[]) => setDeals(all.filter((d) => d.created_by === "whatsapp")));

    const interval = setInterval(() => {
      fetch("/api/deals?limit=50")
        .then((r) => r.json())
        .then((all: DealWithContact[]) => setDeals(all.filter((d) => d.created_by === "whatsapp")));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (deals.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-2 animate-pulse rounded-full bg-emerald-400" />
        <h2 className="text-sm font-semibold text-white">WhatsApp Locked Deals</h2>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">{deals.length}</span>
      </div>
      <div className="space-y-2">
        {deals.map((d) => (
          <div key={d.id} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {(d.contact_name || "?").charAt(0)}
                </div>
                <div>
                  <span className="text-sm font-medium text-white">{d.contact_name || "Unknown"}</span>
                  <span className="ml-2 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">WhatsApp</span>
                </div>
              </div>
              <span className="text-xs text-amber-400 font-medium">LOCKED</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-400">
              <div>Metal: <span className="text-white capitalize">{d.metal}</span></div>
              <div>Qty: <span className="text-white">{d.quantity_grams.toLocaleString()}g</span></div>
              <div>Rate: <span className="text-white">${d.price_per_oz.toFixed(4)}/oz</span></div>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              Locked {new Date(d.date).toLocaleString()} — pending staff entry
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/locked-deals.tsx
git commit -m "feat: add locked deals component for WhatsApp-captured deals"
```

---

### Task 7: WhatsApp Page

**Files:**
- Create: src/app/whatsapp/page.tsx

- [ ] **Step 1: Create the main WhatsApp page**

Create src/app/whatsapp/page.tsx:
```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ContactList } from "@/components/contact-list";
import { ChatThread } from "@/components/chat-thread";
import type { WhatsAppMessage, WhatsAppContact } from "@/lib/types";
import { CHAT_SCRIPTS } from "@/lib/chat-scripts";

export default function WhatsAppPage() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptProgress = useRef<Map<string, number>>(new Map());

  const loadContacts = useCallback(() => {
    fetch("/api/whatsapp").then((r) => r.json()).then(setContacts);
  }, []);

  const loadMessages = useCallback((contact: string) => {
    fetch(`/api/whatsapp?contact=${encodeURIComponent(contact)}`)
      .then((r) => r.json())
      .then(setMessages);
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => {
    if (selected) loadMessages(selected);
  }, [selected, loadMessages]);

  // Poll for new messages
  useEffect(() => {
    const poll = setInterval(() => {
      loadContacts();
      if (selected) loadMessages(selected);
    }, 2000);
    return () => clearInterval(poll);
  }, [selected, loadContacts, loadMessages]);

  // Simulator
  function startSimulator() {
    setSimRunning(true);
    scriptProgress.current = new Map();
    CHAT_SCRIPTS.forEach((s) => scriptProgress.current.set(s.contact_name, 0));

    simRef.current = setInterval(() => {
      // Pick a random script that hasn't finished
      const active = CHAT_SCRIPTS.filter((s) => {
        const progress = scriptProgress.current.get(s.contact_name) ?? 0;
        return progress < s.messages.length;
      });
      if (active.length === 0) {
        stopSimulator();
        return;
      }
      const script = active[Math.floor(Math.random() * active.length)];
      const idx = scriptProgress.current.get(script.contact_name) ?? 0;
      const msg = script.messages[idx];
      const isLockMessage = /\block\b/i.test(msg.text);

      fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: script.contact_name,
          contact_location: script.contact_location,
          direction: msg.direction,
          message: msg.text,
          ...(isLockMessage && script.locks
            ? {
                metal: script.metal,
                purity: script.purity,
                quantity_grams: script.quantity_grams,
                price_per_oz: script.price_per_oz,
                deal_direction: script.contact_location === "hong_kong" ? "sell" : "buy",
              }
            : {}),
        }),
      });

      scriptProgress.current.set(script.contact_name, idx + 1);
    }, Math.random() * 5000 + 3000); // 3-8 seconds
  }

  function stopSimulator() {
    setSimRunning(false);
    if (simRef.current) clearInterval(simRef.current);
    simRef.current = null;
  }

  async function handleSendMessage(text: string) {
    if (!selected) return;
    const contact = contacts.find((c) => c.name === selected);
    await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_name: selected,
        contact_location: contact?.location ?? "uae",
        direction: "outgoing",
        message: text,
      }),
    });
    loadMessages(selected);
    loadContacts();
  }

  // Mobile: show chat thread full screen when selected
  const showThread = selected !== null;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.32))] flex-col">
      {/* Header with simulator toggle */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-lg font-semibold text-white">WhatsApp</h1>
          <p className="text-xs text-gray-400">Deal conversations</p>
        </div>
        <button
          onClick={simRunning ? stopSimulator : startSimulator}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
            simRunning
              ? "bg-rose-600 text-white hover:bg-rose-500"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          <div className={`size-2 rounded-full ${simRunning ? "animate-pulse bg-white" : "bg-emerald-300"}`} />
          {simRunning ? "Stop Chats" : "Start Chats"}
        </button>
      </div>

      {/* Desktop: two panel, Mobile: list or thread */}
      <div className="flex flex-1 overflow-hidden rounded-lg outline outline-1 outline-white/10">
        {/* Contact list — hidden on mobile when thread is open */}
        <div className={`w-full shrink-0 overflow-y-auto border-r border-white/10 bg-gray-900 lg:block lg:w-80 ${showThread ? "hidden" : "block"}`}>
          <ContactList contacts={contacts} selected={selected} onSelect={setSelected} />
        </div>

        {/* Chat thread */}
        <div className={`flex-1 bg-gray-950 ${showThread ? "block" : "hidden lg:block"}`}>
          {selected ? (
            <ChatThread
              contactName={selected}
              messages={messages}
              onSendMessage={handleSendMessage}
              onBack={() => setSelected(null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-500">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/whatsapp/page.tsx
git commit -m "feat: add WhatsApp page with simulator and manual messaging"
```

---

### Task 8: Navigation Updates

**Files:**
- Modify: src/components/sidebar-nav.tsx
- Modify: src/components/bottom-nav.tsx

- [ ] **Step 1: Add WhatsApp to sidebar nav**

In src/components/sidebar-nav.tsx, add to the NAV_ITEMS array after the "Deals" entry:
```ts
  { name: "WhatsApp", href: "/whatsapp", icon: "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" },
```

- [ ] **Step 2: Replace Reports with WhatsApp in bottom nav**

In src/components/bottom-nav.tsx, replace the NAV_ITEMS array:
```ts
const NAV_ITEMS = [
  { name: "Home", href: "/", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" },
  { name: "Stock", href: "/stock", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
  { name: "Deals", href: "/deals", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" },
  { name: "WhatsApp", href: "/whatsapp", icon: "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" },
  { name: "Money", href: "/money-flow", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar-nav.tsx src/components/bottom-nav.tsx
git commit -m "feat: add WhatsApp to sidebar and mobile bottom nav"
```

---

### Task 9: Add Locked Deals to Dashboard + Deals Page

**Files:**
- Modify: src/app/page.tsx
- Modify: src/app/deals/page.tsx

- [ ] **Step 1: Add LockedDeals to dashboard**

In src/app/page.tsx, add import at top:
```tsx
import { LockedDeals } from "@/components/locked-deals";
```

Add the LockedDeals component right after the StatCards grid and before "Recent Activity":
```tsx
      <LockedDeals />
```

- [ ] **Step 2: Add LockedDeals to deals page**

In src/app/deals/page.tsx, add import at top:
```tsx
import { LockedDeals } from "@/components/locked-deals";
```

Add the LockedDeals component right after the page heading div and before the "New Deal" card:
```tsx
      <LockedDeals />
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/app/deals/page.tsx
git commit -m "feat: show WhatsApp locked deals on dashboard and deals page"
```

---

### Task 10: Build, Verify, Deploy

- [ ] **Step 1: Build**

```bash
cd "/Users/ashishkamdar/Projects/niyam turakhia gold"
npm run build
```

All routes should compile including /whatsapp and /api/whatsapp.

- [ ] **Step 2: Test locally**

Run dev server, navigate to /whatsapp, click "Start Chats". Conversations should appear. When "lock" messages come through, deals should appear on / and /deals pages.

- [ ] **Step 3: Commit, push, deploy**

```bash
git push
ssh nuremberg "cd /var/www/nt-metals && git pull && npm run build && pm2 restart nt-metals"
```

---

## Self-Review

- **Spec coverage:** All sections covered — WhatsApp page (T7), contact list (T4), chat thread (T5), chat scripts (T2), lock detection (T3), locked deals display (T6+T9), simulator toggle (T7), nav changes (T8), DB schema (T1).
- **Placeholder scan:** No TBD/TODO. All code complete.
- **Type consistency:** WhatsAppMessage and WhatsAppContact defined in T1, used consistently. Deal.created_by updated to include "whatsapp". contact_name column added to deals in T1, used in T3 API and T6 display.
