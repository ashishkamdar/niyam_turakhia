# Precious Metals MIS Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a mobile-first MIS dashboard for a precious metals dealer showing real-time P&L, stock positions, money flow, and reports — powered by a transaction simulator and hardcoded prices (with live API toggle).

**Architecture:** Next.js App Router + TypeScript + SQLite (better-sqlite3) + Tailwind CSS dark theme using Catalyst UI Blocks. Self-hosted on Nuremberg server with nginx + PM2. No Vercel.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, better-sqlite3, Recharts, uuid, PM2, nginx

---

## File Structure

```
src/
  app/
    layout.tsx              — Root layout: sidebar (desktop) + bottom nav (mobile) + price ticker header
    page.tsx                — Dashboard: today P&L cards, quick stats
    globals.css             — Tailwind imports, dark theme defaults
    stock/page.tsx          — Stock in hand summary + drill-down
    deals/page.tsx          — Deal list + entry form
    money-flow/page.tsx     — Currency-wise settlements
    reports/page.tsx        — Daily/weekly/quarterly/yearly P&L
    settings/page.tsx       — Cost config, simulator controls, API toggle
    api/
      prices/route.ts       — GET: return prices (demo or live)
      deals/route.ts        — GET/POST: deal CRUD
      payments/route.ts     — GET/POST: payment CRUD
      simulator/route.ts    — POST: start/stop/reset simulator
  components/
    price-ticker.tsx        — Sticky header with metal prices
    sidebar-nav.tsx         — Desktop sidebar navigation
    bottom-nav.tsx          — Mobile bottom tab bar
    stat-card.tsx           — Reusable KPI card (Catalyst stats pattern)
    deal-form.tsx           — Buy/sell deal entry form
    stock-detail.tsx        — Drill-down lot list for a metal
  lib/
    db.ts                   — SQLite connection + schema init
    types.ts                — TypeScript interfaces for Deal, Payment, Price, Settings
    prices.ts               — Demo prices + live API fetch logic
    calculations.ts         — P&L, weighted avg cost, position math, yield
    sample-data.ts          — Seed 2-3 days of realistic transactions
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: package.json, tsconfig.json, next.config.ts, tailwind.config.ts, src/app/globals.css, src/app/layout.tsx, src/app/page.tsx, .gitignore

- [ ] **Step 1: Initialize Next.js project**

Run from project root:
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*" --skip-install
```

If it prompts about existing files, allow overwrite for config files but keep PROJECT-PLAN.md and docs/.

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3 uuid recharts
npm install -D @types/better-sqlite3 @types/uuid
```

- [ ] **Step 3: Configure dark theme as default in globals.css**

Replace src/app/globals.css with:
```css
@import "tailwindcss";

:root {
  color-scheme: dark;
}

body {
  @apply bg-gray-950 text-white antialiased;
}
```

- [ ] **Step 4: Create minimal root layout**

Replace src/app/layout.tsx with:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NT Precious Metals - MIS Dashboard",
  description: "Real-time profitability dashboard for precious metals trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create placeholder home page**

Replace src/app/page.tsx with:
```tsx
export default function DashboardPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold text-white">NT Precious Metals - MIS</h1>
    </div>
  );
}
```

- [ ] **Step 6: Verify it runs**

```bash
npm run dev
```
Open http://localhost:3000 — should see dark background with heading centered.

- [ ] **Step 7: Update .gitignore and commit**

Ensure .gitignore includes node_modules/, .next/, *.db. Then:
```bash
git add -A
git commit -m "feat: scaffold Next.js project with dark theme"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: src/lib/types.ts

- [ ] **Step 1: Create all TypeScript interfaces**

Create src/lib/types.ts:
```ts
export type Metal = "gold" | "silver" | "platinum" | "palladium";
export type Purity = "18K" | "20K" | "22K" | "24K" | "995" | "999";
export type DealDirection = "buy" | "sell";
export type DealStatus = "pending" | "in_refinery" | "in_transit" | "in_hk" | "sold" | "locked";
export type Location = "uae" | "hong_kong";
export type Currency = "USD" | "HKD" | "AED" | "USDT";
export type PaymentDirection = "sent" | "received";
export type PaymentMode = "bank" | "local_dealer" | "crypto_exchange";
export type PriceSource = "demo" | "live";
export type MetalSymbol = "XAU" | "XAG" | "XPT" | "XPD";

export interface Deal {
  id: string;
  metal: Metal;
  purity: Purity;
  is_pure: boolean;
  quantity_grams: number;
  pure_equivalent_grams: number;
  price_per_oz: number;
  direction: DealDirection;
  location: Location;
  status: DealStatus;
  date: string;
  created_by: "simulator" | "manual";
}

export interface Payment {
  id: string;
  amount: number;
  currency: Currency;
  direction: PaymentDirection;
  mode: PaymentMode;
  from_location: string;
  to_location: string;
  linked_deal_id: string | null;
  date: string;
}

export interface Price {
  metal: MetalSymbol;
  price_usd: number;
  prev_close: number;
  change: number;
  change_pct: number;
  source: PriceSource;
  fetched_at: string;
}

export interface StockSummary {
  metal: Metal;
  total_grams: number;
  avg_cost_per_oz: number;
  market_value_usd: number;
  unrealized_pnl: number;
  in_uae: number;
  in_refinery: number;
  in_transit: number;
  in_hk: number;
}

export const PURE_PURITIES: Purity[] = ["24K", "999", "995"];

export const YIELD_TABLE: Record<Purity, number> = {
  "18K": 0.75,
  "20K": 0.833,
  "22K": 0.917,
  "24K": 1.0,
  "995": 1.0,
  "999": 1.0,
};

export const METAL_SYMBOLS: Record<Metal, MetalSymbol> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

export const GRAMS_PER_TROY_OZ = 31.1035;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types for deals, payments, prices"
```

---

### Task 3: Database Layer

**Files:**
- Create: src/lib/db.ts

- [ ] **Step 1: Create SQLite connection and schema**

Create src/lib/db.ts:
```ts
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      metal TEXT NOT NULL,
      purity TEXT NOT NULL,
      is_pure INTEGER NOT NULL DEFAULT 0,
      quantity_grams REAL NOT NULL,
      pure_equivalent_grams REAL NOT NULL,
      price_per_oz REAL NOT NULL,
      direction TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      date TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      direction TEXT NOT NULL,
      mode TEXT NOT NULL,
      from_location TEXT NOT NULL DEFAULT '',
      to_location TEXT NOT NULL DEFAULT '',
      linked_deal_id TEXT,
      date TEXT NOT NULL,
      FOREIGN KEY (linked_deal_id) REFERENCES deals(id)
    );

    CREATE TABLE IF NOT EXISTS prices (
      metal TEXT PRIMARY KEY,
      price_usd REAL NOT NULL,
      prev_close REAL NOT NULL,
      change REAL NOT NULL DEFAULT 0,
      change_pct REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'demo',
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
```

- [ ] **Step 2: Add data.db to .gitignore**

```bash
echo "data.db" >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts .gitignore
git commit -m "feat: add SQLite database layer with schema"
```

---

### Task 4: Demo Prices

**Files:**
- Create: src/lib/prices.ts
- Create: src/app/api/prices/route.ts

- [ ] **Step 1: Create prices module with demo data and live fetch**

Create src/lib/prices.ts:
```ts
import { getDb } from "./db";
import type { Price, MetalSymbol } from "./types";

const DEMO_PRICES: Record<MetalSymbol, { price: number; prev: number }> = {
  XAU: { price: 2341.5678, prev: 2328.42 },
  XAG: { price: 30.245, prev: 29.87 },
  XPT: { price: 982.34, prev: 978.15 },
  XPD: { price: 1024.78, prev: 1018.5 },
};

export function seedDemoPrices(): void {
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO prices (metal, price_usd, prev_close, change, change_pct, source, fetched_at)
    VALUES (?, ?, ?, ?, ?, 'demo', ?)
    ON CONFLICT(metal) DO UPDATE SET
      price_usd = excluded.price_usd, prev_close = excluded.prev_close,
      change = excluded.change, change_pct = excluded.change_pct,
      source = excluded.source, fetched_at = excluded.fetched_at
  `);
  const seed = db.transaction(() => {
    for (const [symbol, data] of Object.entries(DEMO_PRICES)) {
      const change = data.price - data.prev;
      const changePct = (change / data.prev) * 100;
      upsert.run(symbol, data.price, data.prev, change, changePct, now);
    }
  });
  seed();
}

export async function fetchLivePrices(apiKey: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO prices (metal, price_usd, prev_close, change, change_pct, source, fetched_at)
    VALUES (?, ?, ?, ?, ?, 'live', ?)
    ON CONFLICT(metal) DO UPDATE SET
      price_usd = excluded.price_usd, prev_close = excluded.prev_close,
      change = excluded.change, change_pct = excluded.change_pct,
      source = excluded.source, fetched_at = excluded.fetched_at
  `);
  const symbols: MetalSymbol[] = ["XAU", "XAG", "XPT", "XPD"];
  for (const symbol of symbols) {
    try {
      const res = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
        headers: { "x-access-token": apiKey },
      });
      if (!res.ok) continue;
      const data = await res.json();
      upsert.run(symbol, data.price, data.prev_close_price ?? data.open_price, data.ch ?? 0, data.chp ?? 0, now);
    } catch {
      // Keep existing price on failure
    }
  }
}

export function getPrices(): Price[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM prices ORDER BY metal").all() as Price[];
  if (rows.length === 0) {
    seedDemoPrices();
    return db.prepare("SELECT * FROM prices ORDER BY metal").all() as Price[];
  }
  return rows;
}
```

- [ ] **Step 2: Create API route**

Create src/app/api/prices/route.ts:
```ts
import { NextResponse } from "next/server";
import { getPrices } from "@/lib/prices";

export async function GET() {
  const prices = getPrices();
  return NextResponse.json(prices);
}
```

- [ ] **Step 3: Verify endpoint**

Run dev server and curl http://localhost:3000/api/prices — should return JSON array with 4 metal prices.

- [ ] **Step 4: Commit**

```bash
git add src/lib/prices.ts src/app/api/prices/route.ts
git commit -m "feat: add demo prices with live API toggle support"
```

---

### Task 5: Price Ticker Header Component

**Files:**
- Create: src/components/price-ticker.tsx
- Modify: src/app/layout.tsx

- [ ] **Step 1: Create price ticker component**

Create src/components/price-ticker.tsx:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { Price } from "@/lib/types";

const METAL_LABELS: Record<string, string> = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  XPD: "Palladium",
};

export function PriceTicker() {
  const [prices, setPrices] = useState<Price[]>([]);

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then(setPrices)
      .catch(() => {});
  }, []);

  if (prices.length === 0) {
    return (
      <div className="border-b border-white/10 bg-gray-900 px-4 py-2">
        <p className="text-sm text-gray-500">Loading prices...</p>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-gray-900/95 backdrop-blur">
      <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
        {prices.map((p) => {
          const isUp = p.change >= 0;
          return (
            <div key={p.metal} className="bg-gray-900 px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex items-baseline justify-between gap-x-2">
                <span className="text-xs font-medium text-gray-400">
                  {METAL_LABELS[p.metal] ?? p.metal}
                </span>
                <span className={`text-xs font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                  {isUp ? "+" : ""}{p.change_pct.toFixed(2)}%
                </span>
              </div>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
                ${p.price_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-gray-500">
                {p.source === "demo" ? "Demo" : "Live LBMA"} USD/oz
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add price ticker to layout**

Replace src/app/layout.tsx:
```tsx
import type { Metadata } from "next";
import { PriceTicker } from "@/components/price-ticker";
import "./globals.css";

export const metadata: Metadata = {
  title: "NT Precious Metals - MIS Dashboard",
  description: "Real-time profitability dashboard for precious metals trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <PriceTicker />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000 — sticky header with 4 metal prices, 2x2 grid on mobile, 4-column on desktop. Green/red change percentages.

- [ ] **Step 4: Commit**

```bash
git add src/components/price-ticker.tsx src/app/layout.tsx
git commit -m "feat: add sticky price ticker header with demo prices"
```

---

### Task 6: Navigation (Sidebar + Bottom Nav)

**Files:**
- Create: src/components/sidebar-nav.tsx
- Create: src/components/bottom-nav.tsx
- Modify: src/app/layout.tsx

- [ ] **Step 1: Create sidebar navigation (desktop)**

Create src/components/sidebar-nav.tsx:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" },
  { name: "Stock", href: "/stock", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
  { name: "Deals", href: "/deals", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" },
  { name: "Money Flow", href: "/money-flow", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { name: "Reports", href: "/reports", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-60 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-white/10 bg-gray-900 px-6">
        <div className="flex h-16 shrink-0 items-center">
          <span className="text-lg font-bold text-amber-400">NT Metals</span>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="-mx-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold ${
                      isActive ? "bg-white/5 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto pb-4">
            <Link href="/settings" className="group flex gap-x-3 rounded-md p-2 text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create bottom navigation (mobile)**

Create src/components/bottom-nav.tsx:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" },
  { name: "Stock", href: "/stock", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
  { name: "Deals", href: "/deals", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" },
  { name: "Money", href: "/money-flow", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { name: "Reports", href: "/reports", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-gray-900/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} className={`flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10px] font-medium ${isActive ? "text-amber-400" : "text-gray-500"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Update layout to include nav components**

Replace src/app/layout.tsx:
```tsx
import type { Metadata } from "next";
import { PriceTicker } from "@/components/price-ticker";
import { SidebarNav } from "@/components/sidebar-nav";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "NT Precious Metals - MIS Dashboard",
  description: "Real-time profitability dashboard for precious metals trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <SidebarNav />
        <div className="lg:pl-60">
          <PriceTicker />
          <main className="px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:pb-6">{children}</main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify layout**

Check at mobile width (375px): bottom nav visible, no sidebar, price ticker 2x2.
Check at desktop (1280px): sidebar on left, no bottom nav, price ticker 4-column.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar-nav.tsx src/components/bottom-nav.tsx src/app/layout.tsx
git commit -m "feat: add responsive sidebar (desktop) and bottom nav (mobile)"
```

---

### Task 7: Reusable Stat Card Component

**Files:**
- Create: src/components/stat-card.tsx

- [ ] **Step 1: Create stat card**

Create src/components/stat-card.tsx:
```tsx
interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  sublabel?: string;
}

export function StatCard({ label, value, change, changeType = "neutral", sublabel }: StatCardProps) {
  const changeColor = changeType === "positive" ? "text-emerald-400" : changeType === "negative" ? "text-rose-400" : "text-gray-400";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-lg bg-gray-900 px-4 py-6 outline outline-1 outline-white/10 sm:px-6">
      <dt className="text-sm font-medium text-gray-400">{label}</dt>
      {change && <dd className={`text-xs font-medium ${changeColor}`}>{change}</dd>}
      <dd className="w-full flex-none text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</dd>
      {sublabel && <dd className="text-xs text-gray-500">{sublabel}</dd>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/stat-card.tsx
git commit -m "feat: add reusable stat card component"
```

---

### Task 8: Deals API + Deal Form + Deals Page

**Files:**
- Create: src/app/api/deals/route.ts
- Create: src/components/deal-form.tsx
- Create: src/app/deals/page.tsx

- [ ] **Step 1: Create deals API**

Create src/app/api/deals/route.ts:
```ts
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
```

- [ ] **Step 2: Create deal form component**

Create src/components/deal-form.tsx:
```tsx
"use client";

import { useState } from "react";
import type { Metal, Purity, DealDirection, Location } from "@/lib/types";

const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];
const PURITIES: Purity[] = ["18K", "20K", "22K", "24K", "995", "999"];
const DIRECTIONS: DealDirection[] = ["buy", "sell"];
const LOCATIONS: Location[] = ["uae", "hong_kong"];

const selectCls = "col-start-1 row-start-1 w-full appearance-none rounded-md bg-white/5 py-1.5 pr-8 pl-3 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";
const inputCls = "block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

export function DealForm({ onDealCreated }: { onDealCreated?: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metal: form.get("metal"),
        purity: form.get("purity"),
        quantity_grams: parseFloat(form.get("quantity_grams") as string),
        price_per_oz: parseFloat(form.get("price_per_oz") as string),
        direction: form.get("direction"),
        location: form.get("location"),
      }),
    });
    setSaving(false);
    (e.target as HTMLFormElement).reset();
    onDealCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-400">Metal</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="metal" required className={selectCls}>
              {METALS.map((m) => <option key={m} value={m} className="bg-gray-800">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Purity</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="purity" required className={selectCls}>
              {PURITIES.map((p) => <option key={p} value={p} className="bg-gray-800">{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Direction</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="direction" required className={selectCls}>
              {DIRECTIONS.map((d) => <option key={d} value={d} className="bg-gray-800">{d.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Quantity (grams)</label>
          <input name="quantity_grams" type="number" step="0.01" required placeholder="500.00" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Rate (USD/oz)</label>
          <input name="price_per_oz" type="number" step="0.0001" required placeholder="2341.5678" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400">Location</label>
          <div className="mt-1 grid grid-cols-1">
            <select name="location" required className={selectCls}>
              {LOCATIONS.map((l) => <option key={l} value={l} className="bg-gray-800">{l === "uae" ? "UAE" : "Hong Kong"}</option>)}
            </select>
          </div>
        </div>
      </div>
      <button type="submit" disabled={saving} className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50 sm:w-auto">
        {saving ? "Saving..." : "Lock Deal"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create deals page**

Create src/app/deals/page.tsx:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { DealForm } from "@/components/deal-form";
import type { Deal } from "@/lib/types";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const loadDeals = useCallback(() => { fetch("/api/deals").then((r) => r.json()).then(setDeals); }, []);
  useEffect(() => { loadDeals(); }, [loadDeals]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">Deals</h1>
        <p className="mt-1 text-sm text-gray-400">Enter new deals or view recent transactions.</p>
      </div>

      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">New Deal</h2>
        <DealForm onDealCreated={loadDeals} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Deals</h2>
        {/* Mobile: stacked cards */}
        <div className="space-y-3 lg:hidden">
          {deals.map((d) => (
            <div key={d.id} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white capitalize">{d.metal}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>
                  {d.direction.toUpperCase()}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div>Purity: <span className="text-white">{d.purity}</span></div>
                <div>Qty: <span className="text-white">{d.quantity_grams.toFixed(2)}g</span></div>
                <div>Rate: <span className="text-white">${d.price_per_oz.toFixed(4)}/oz</span></div>
                <div>Loc: <span className="text-white">{d.location === "uae" ? "UAE" : "HK"}</span></div>
              </div>
              <p className="mt-2 text-[10px] text-gray-500">{new Date(d.date).toLocaleString()}</p>
            </div>
          ))}
          {deals.length === 0 && <p className="text-sm text-gray-500">No deals yet.</p>}
        </div>
        {/* Desktop: table */}
        <div className="hidden lg:block">
          <div className="overflow-hidden rounded-lg outline outline-1 outline-white/10">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Metal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Dir</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Purity</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Qty (g)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Pure (g)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Rate ($/oz)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deals.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm text-white capitalize">{d.metal}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{d.direction.toUpperCase()}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-300">{d.purity}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">{d.quantity_grams.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">{d.pure_equivalent_grams.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">${d.price_per_oz.toFixed(4)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{d.location === "uae" ? "UAE" : "HK"}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{d.status}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify deal creation**

Open http://localhost:3000/deals, fill form, click "Lock Deal" — deal appears in list.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/deals/route.ts src/components/deal-form.tsx src/app/deals/page.tsx
git commit -m "feat: add deal entry form and deals list page"
```

---

### Task 9: Calculations Library

**Files:**
- Create: src/lib/calculations.ts

- [ ] **Step 1: Create P&L and position calculation functions**

Create src/lib/calculations.ts:
```ts
import { getDb } from "./db";
import type { Deal, Price, Metal } from "./types";
import { GRAMS_PER_TROY_OZ as OZ_GRAMS, METAL_SYMBOLS } from "./types";

export function getStockSummary(prices: Price[]) {
  const db = getDb();
  const metals: Metal[] = ["gold", "silver", "platinum", "palladium"];
  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));

  return metals.map((metal) => {
    const symbol = METAL_SYMBOLS[metal];
    const currentPrice = priceMap.get(symbol) ?? 0;
    const buys = db.prepare("SELECT * FROM deals WHERE metal = ? AND direction = 'buy' AND status != 'sold'").all(metal) as Deal[];
    const totalGrams = buys.reduce((sum, d) => sum + d.pure_equivalent_grams, 0);

    let totalCost = 0;
    for (const d of buys) {
      totalCost += (d.pure_equivalent_grams / OZ_GRAMS) * d.price_per_oz;
    }
    const avgCostPerOz = totalGrams > 0 ? totalCost / (totalGrams / OZ_GRAMS) : 0;
    const marketValueUsd = (totalGrams / OZ_GRAMS) * currentPrice;
    const unrealizedPnl = marketValueUsd - totalCost;

    const byStatus = (status: string) => buys.filter((d) => d.status === status).reduce((s, d) => s + d.pure_equivalent_grams, 0);

    return {
      metal, total_grams: totalGrams, avg_cost_per_oz: avgCostPerOz,
      market_value_usd: marketValueUsd, unrealized_pnl: unrealizedPnl,
      in_uae: byStatus("locked") + byStatus("pending"),
      in_refinery: byStatus("in_refinery"),
      in_transit: byStatus("in_transit"),
      in_hk: byStatus("in_hk"),
    };
  });
}

export function getDailyPnl(date?: string) {
  const db = getDb();
  const targetDate = date ?? new Date().toISOString().split("T")[0];
  const sells = db.prepare("SELECT * FROM deals WHERE direction = 'sell' AND date LIKE ?").all(`${targetDate}%`) as Deal[];
  const byMetal: Record<string, number> = {};
  let realized = 0;

  for (const sell of sells) {
    const avgBuyCost = getAvgBuyCost(sell.metal);
    const revenue = (sell.pure_equivalent_grams / OZ_GRAMS) * sell.price_per_oz;
    const cost = (sell.pure_equivalent_grams / OZ_GRAMS) * avgBuyCost;
    const pnl = revenue - cost;
    realized += pnl;
    byMetal[sell.metal] = (byMetal[sell.metal] ?? 0) + pnl;
  }
  return { realized, unrealized: 0, byMetal: byMetal as Record<Metal, number> };
}

function getAvgBuyCost(metal: string): number {
  const db = getDb();
  const result = db.prepare("SELECT SUM(pure_equivalent_grams) as total_grams, SUM((pure_equivalent_grams / 31.1035) * price_per_oz) as total_cost FROM deals WHERE metal = ? AND direction = 'buy'").get(metal) as { total_grams: number; total_cost: number } | undefined;
  if (!result || result.total_grams === 0) return 0;
  return result.total_cost / (result.total_grams / OZ_GRAMS);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/calculations.ts
git commit -m "feat: add P&L and stock position calculation functions"
```

---

### Task 10: Sample Data Seeder

**Files:**
- Create: src/lib/sample-data.ts
- Modify: src/app/api/prices/route.ts

- [ ] **Step 1: Create sample data generator**

Create src/lib/sample-data.ts:
```ts
import { getDb } from "./db";
import { v4 as uuid } from "uuid";
import { PURE_PURITIES, YIELD_TABLE, type Metal, type Purity } from "./types";

const METALS: Metal[] = ["gold", "silver", "platinum", "palladium"];
const PRICE_RANGES: Record<Metal, { min: number; max: number }> = {
  gold: { min: 2300, max: 2400 },
  silver: { min: 28, max: 32 },
  platinum: { min: 950, max: 1010 },
  palladium: { min: 990, max: 1060 },
};
const PURITIES_WEIGHTED: Purity[] = ["18K", "18K", "22K", "22K", "24K", "24K", "24K", "999", "995"];

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60));
  return d.toISOString();
}

export function seedSampleData(): void {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as c FROM deals").get() as { c: number }).c;
  if (count > 0) return;

  const insDeal = db.prepare("INSERT INTO deals (id,metal,purity,is_pure,quantity_grams,pure_equivalent_grams,price_per_oz,direction,location,status,date,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,'simulator')");
  const insPay = db.prepare("INSERT INTO payments (id,amount,currency,direction,mode,from_location,to_location,linked_deal_id,date) VALUES (?,?,?,?,?,?,?,?,?)");

  db.transaction(() => {
    for (let daysAgo = 2; daysAgo >= 0; daysAgo--) {
      const buyCount = Math.floor(Math.random() * 6) + 10;
      for (let i = 0; i < buyCount; i++) {
        const metal = pick(METALS);
        const purity = pick(PURITIES_WEIGHTED);
        const isPure = PURE_PURITIES.includes(purity);
        const qty = parseFloat(rand(100, 5000).toFixed(2));
        const pureEquiv = parseFloat((qty * YIELD_TABLE[purity]).toFixed(2));
        const range = PRICE_RANGES[metal];
        const price = parseFloat((rand(range.min, range.max) * (1 - rand(0.005, 0.015))).toFixed(4));
        const statuses = isPure ? ["locked", "in_transit", "in_hk"] : ["locked", "in_refinery", "in_transit", "in_hk"];
        const status = pick(statuses);
        const date = randomDate(daysAgo);
        const dealId = uuid();
        insDeal.run(dealId, metal, purity, isPure ? 1 : 0, qty, pureEquiv, price, "buy", "uae", status, date);
        const costUsd = (pureEquiv / 31.1035) * price;
        const curr = pick(["AED", "USD"] as const);
        const amt = curr === "AED" ? costUsd * 3.6725 : costUsd;
        insPay.run(uuid(), parseFloat(amt.toFixed(2)), curr, "sent", "bank", "hong_kong", "uae", dealId, date);
      }
      const sellCount = Math.floor(Math.random() * 4) + 5;
      for (let i = 0; i < sellCount; i++) {
        const metal = pick(METALS);
        const qty = parseFloat(rand(100, 3000).toFixed(2));
        const range = PRICE_RANGES[metal];
        const price = parseFloat((rand(range.min, range.max) * (1 + rand(0.003, 0.008))).toFixed(4));
        const date = randomDate(daysAgo);
        const dealId = uuid();
        insDeal.run(dealId, metal, "24K", 1, qty, qty, price, "sell", "hong_kong", "sold", date);
        const revUsd = (qty / 31.1035) * price;
        const curr = pick(["USD", "HKD", "USDT"] as const);
        const amt = curr === "HKD" ? revUsd * 7.82 : revUsd;
        const mode = curr === "USDT" ? "crypto_exchange" : curr === "HKD" ? "local_dealer" : "bank";
        insPay.run(uuid(), parseFloat(amt.toFixed(2)), curr, "received", mode, "hong_kong", "uae", dealId, date);
      }
    }
  })();
}
```

- [ ] **Step 2: Auto-seed on first API call**

Update src/app/api/prices/route.ts:
```ts
import { NextResponse } from "next/server";
import { getPrices } from "@/lib/prices";
import { seedSampleData } from "@/lib/sample-data";

export async function GET() {
  seedSampleData();
  const prices = getPrices();
  return NextResponse.json(prices);
}
```

- [ ] **Step 3: Verify seeded data**

Run dev, curl /api/prices then /api/deals — should see 45-69 deals.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sample-data.ts src/app/api/prices/route.ts
git commit -m "feat: add sample data seeder with 3 days of realistic transactions"
```

---

### Task 11: Dashboard Home Page

**Files:**
- Modify: src/app/page.tsx

- [ ] **Step 1: Build dashboard with P&L cards**

Replace src/app/page.tsx:
```tsx
"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import type { Deal, Price } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
const METAL_MAP: Record<string, string> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };

export default function DashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);

  useEffect(() => {
    fetch("/api/deals?limit=500").then((r) => r.json()).then(setDeals);
    fetch("/api/prices").then((r) => r.json()).then(setPrices);
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const todayDeals = deals.filter((d) => d.date.startsWith(today));
  const todayBuys = todayDeals.filter((d) => d.direction === "buy");
  const todaySells = todayDeals.filter((d) => d.direction === "sell");
  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));

  let totalBuyValue = 0, totalSellRevenue = 0;
  for (const d of todayBuys) totalBuyValue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
  for (const d of todaySells) totalSellRevenue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;

  const unsold = deals.filter((d) => d.direction === "buy" && d.status !== "sold");
  let stockValue = 0, stockCost = 0;
  for (const d of unsold) {
    const mkt = priceMap.get(METAL_MAP[d.metal]) ?? d.price_per_oz;
    stockValue += (d.pure_equivalent_grams / GRAMS_PER_OZ) * mkt;
    stockCost += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
  }
  const unrealizedPnl = stockValue - stockCost;
  const totalBuyGrams = todayBuys.reduce((s, d) => s + d.quantity_grams, 0);
  const totalSellGrams = todaySells.reduce((s, d) => s + d.quantity_grams, 0);

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtG = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + "g";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400">Today&apos;s MIS overview &mdash; {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Buys" value={fmt(totalBuyValue)} sublabel={`${todayBuys.length} deals | ${fmtG(totalBuyGrams)}`} />
        <StatCard label="Today's Sales" value={fmt(totalSellRevenue)} sublabel={`${todaySells.length} deals | ${fmtG(totalSellGrams)}`} />
        <StatCard label="Stock Value" value={fmt(stockValue)} sublabel={`${unsold.length} positions`} />
        <StatCard label="Unrealized P&L" value={fmt(unrealizedPnl)} change={unrealizedPnl >= 0 ? `+${fmt(unrealizedPnl)}` : fmt(unrealizedPnl)} changeType={unrealizedPnl >= 0 ? "positive" : "negative"} sublabel="vs avg cost" />
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Activity</h2>
        <div className="space-y-2">
          {deals.slice(0, 10).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-900 px-4 py-3 outline outline-1 outline-white/10">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{d.direction.toUpperCase()}</span>
                <span className="text-sm text-white capitalize">{d.metal}</span>
                <span className="text-xs text-gray-400">{d.purity} | {d.quantity_grams.toFixed(0)}g</span>
              </div>
              <span className="text-sm font-medium text-gray-300">${d.price_per_oz.toFixed(2)}/oz</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify dashboard**

Open http://localhost:3000 — 4 stat cards + recent activity list.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add dashboard home page with P&L cards and recent activity"
```

---

### Task 12: Stock In Hand Page

**Files:**
- Create: src/app/stock/page.tsx
- Create: src/components/stock-detail.tsx

- [ ] **Step 1: Create stock detail drill-down**

Create src/components/stock-detail.tsx:
```tsx
import type { Deal } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  in_hk: "bg-blue-400/10 text-blue-400",
  in_transit: "bg-yellow-400/10 text-yellow-400",
  in_refinery: "bg-orange-400/10 text-orange-400",
  locked: "bg-gray-400/10 text-gray-400",
  pending: "bg-gray-400/10 text-gray-400",
};

export function StockDetail({ deals, onClose }: { deals: Deal[]; onClose: () => void }) {
  return (
    <div className="space-y-3">
      <button onClick={onClose} className="text-sm text-amber-400 hover:text-amber-300">&larr; Back to summary</button>
      <div className="space-y-2">
        {deals.map((d) => (
          <div key={d.id} className="rounded-lg bg-gray-800/50 p-3 outline outline-1 outline-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{new Date(d.date).toLocaleDateString()}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[d.status] ?? "bg-gray-400/10 text-gray-400"}`}>{d.status.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
              <div>Purity: <span className="text-gray-200">{d.purity}</span></div>
              <div>Qty: <span className="text-gray-200">{d.quantity_grams.toFixed(2)}g</span></div>
              <div>Pure: <span className="text-gray-200">{d.pure_equivalent_grams.toFixed(2)}g</span></div>
              <div>Cost: <span className="text-gray-200">${d.price_per_oz.toFixed(4)}/oz</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create stock page**

Create src/app/stock/page.tsx:
```tsx
"use client";

import { useEffect, useState } from "react";
import { StockDetail } from "@/components/stock-detail";
import type { Deal, Price, Metal } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
const METAL_SYMBOLS: Record<string, string> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };

export default function StockPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [selectedMetal, setSelectedMetal] = useState<Metal | null>(null);

  useEffect(() => {
    fetch("/api/deals?limit=1000").then((r) => r.json()).then(setDeals);
    fetch("/api/prices").then((r) => r.json()).then(setPrices);
  }, []);

  const priceMap = new Map(prices.map((p) => [p.metal, p.price_usd]));
  const unsold = deals.filter((d) => d.direction === "buy" && d.status !== "sold");
  const metals: Metal[] = ["gold", "silver", "platinum", "palladium"];

  const stockData = metals.map((metal) => {
    const lots = unsold.filter((d) => d.metal === metal);
    const totalGrams = lots.reduce((s, d) => s + d.pure_equivalent_grams, 0);
    let totalCost = 0;
    for (const d of lots) totalCost += (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz;
    const avgCostPerOz = totalGrams > 0 ? totalCost / (totalGrams / GRAMS_PER_OZ) : 0;
    const marketPrice = priceMap.get(METAL_SYMBOLS[metal]) ?? 0;
    const marketValue = (totalGrams / GRAMS_PER_OZ) * marketPrice;
    const unrealizedPnl = marketValue - totalCost;
    const byStatus = (s: string) => lots.filter((d) => d.status === s).reduce((sum, d) => sum + d.pure_equivalent_grams, 0);

    return { metal, totalGrams, avgCostPerOz, marketPrice, marketValue, unrealizedPnl, inUae: byStatus("locked") + byStatus("pending"), inRefinery: byStatus("in_refinery"), inTransit: byStatus("in_transit"), inHk: byStatus("in_hk"), lots };
  });

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (selectedMetal) {
    const data = stockData.find((s) => s.metal === selectedMetal);
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold capitalize text-white">{selectedMetal} &mdash; Lot Details</h1>
        <StockDetail deals={data?.lots ?? []} onClose={() => setSelectedMetal(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Stock In Hand</h1>
        <p className="text-sm text-gray-400">Current positions. Tap a row to see individual lots.</p>
      </div>
      <div className="space-y-3">
        {stockData.map((s) => (
          <button key={s.metal} onClick={() => setSelectedMetal(s.metal)} className="w-full rounded-lg bg-gray-900 p-4 text-left outline outline-1 outline-white/10 transition hover:bg-gray-800/80">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold capitalize text-white">{s.metal}</span>
              <span className={`text-sm font-semibold ${s.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {s.unrealizedPnl >= 0 ? "+" : ""}{fmt(s.unrealizedPnl)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <div><span className="text-gray-500">Total</span><p className="font-medium text-gray-200">{s.totalGrams.toFixed(0)}g</p></div>
              <div><span className="text-gray-500">Avg Cost</span><p className="font-medium text-gray-200">${s.avgCostPerOz.toFixed(2)}/oz</p></div>
              <div><span className="text-gray-500">Market</span><p className="font-medium text-gray-200">${s.marketPrice.toFixed(2)}/oz</p></div>
              <div><span className="text-gray-500">Value</span><p className="font-medium text-gray-200">{fmt(s.marketValue)}</p></div>
            </div>
            <div className="mt-3 flex gap-2">
              {s.inUae > 0 && <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">UAE {s.inUae.toFixed(0)}g</span>}
              {s.inRefinery > 0 && <span className="rounded-full bg-orange-400/10 px-2 py-0.5 text-[10px] text-orange-400">Refinery {s.inRefinery.toFixed(0)}g</span>}
              {s.inTransit > 0 && <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-400">Transit {s.inTransit.toFixed(0)}g</span>}
              {s.inHk > 0 && <span className="rounded-full bg-blue-400/10 px-2 py-0.5 text-[10px] text-blue-400">HK {s.inHk.toFixed(0)}g</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Open /stock — 4 metal cards with totals. Tap gold — see individual lots with status badges. Back button returns.

- [ ] **Step 4: Commit**

```bash
git add src/app/stock/page.tsx src/components/stock-detail.tsx
git commit -m "feat: add stock in hand page with drill-down to lots"
```

---

### Task 13: Payments API + Money Flow Page

**Files:**
- Create: src/app/api/payments/route.ts
- Create: src/app/money-flow/page.tsx

- [ ] **Step 1: Create payments API**

Create src/app/api/payments/route.ts:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const db = getDb();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10);
  const payments = db.prepare("SELECT * FROM payments ORDER BY date DESC LIMIT ?").all(limit);
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = uuid();
  db.prepare("INSERT INTO payments (id,amount,currency,direction,mode,from_location,to_location,linked_deal_id,date) VALUES (?,?,?,?,?,?,?,?,?)").run(id, body.amount, body.currency, body.direction, body.mode, body.from_location ?? "", body.to_location ?? "", body.linked_deal_id ?? null, body.date ?? new Date().toISOString());
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Create money flow page**

Create src/app/money-flow/page.tsx:
```tsx
"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import type { Payment, Currency } from "@/lib/types";

const CURRENCIES: Currency[] = ["USD", "HKD", "AED", "USDT"];
const COLORS: Record<Currency, string> = { USD: "text-emerald-400", HKD: "text-blue-400", AED: "text-amber-400", USDT: "text-cyan-400" };

export default function MoneyFlowPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  useEffect(() => { fetch("/api/payments?limit=500").then((r) => r.json()).then(setPayments); }, []);

  const byCurrency = (curr: Currency) => {
    const sent = payments.filter((p) => p.currency === curr && p.direction === "sent").reduce((s, p) => s + p.amount, 0);
    const received = payments.filter((p) => p.currency === curr && p.direction === "received").reduce((s, p) => s + p.amount, 0);
    return { sent, received, net: received - sent };
  };

  const fmt = (n: number, curr: string) => {
    const pre = curr === "USD" ? "$" : curr === "HKD" ? "HK$" : curr === "AED" ? "AED " : "USDT ";
    return pre + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalSent = payments.filter((p) => p.direction === "sent").reduce((s, p) => s + p.amount, 0);
  const totalReceived = payments.filter((p) => p.direction === "received").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Money Flow</h1>
        <p className="text-sm text-gray-400">Multi-currency settlement overview.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Total Sent" value={`$${totalSent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} changeType="negative" />
        <StatCard label="Total Received" value={`$${totalReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} changeType="positive" />
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">By Currency</h2>
        {CURRENCIES.map((curr) => {
          const data = byCurrency(curr);
          if (data.sent === 0 && data.received === 0) return null;
          return (
            <div key={curr} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className={`text-base font-semibold ${COLORS[curr]}`}>{curr}</span>
                <span className={`text-sm font-semibold ${data.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  Net: {data.net >= 0 ? "+" : "-"}{fmt(data.net, curr)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-gray-500">Sent</span><p className="font-medium text-rose-300">{fmt(data.sent, curr)}</p></div>
                <div><span className="text-gray-500">Received</span><p className="font-medium text-emerald-300">{fmt(data.received, curr)}</p></div>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent Payments</h2>
        <div className="space-y-2">
          {payments.slice(0, 15).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-900 px-4 py-3 outline outline-1 outline-white/10">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.direction === "received" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{p.direction === "received" ? "IN" : "OUT"}</span>
                <span className={`text-sm font-medium ${COLORS[p.currency as Currency] ?? "text-white"}`}>{p.currency}</span>
                <span className="text-xs text-gray-400">{p.mode.replace(/_/g, " ")}</span>
              </div>
              <span className="text-sm font-medium text-gray-300">{fmt(p.amount, p.currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify** — open /money-flow, see currency breakdown + recent payments.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/payments/route.ts src/app/money-flow/page.tsx
git commit -m "feat: add money flow page with multi-currency settlement view"
```

---

### Task 14: Reports Page

**Files:**
- Create: src/app/reports/page.tsx

- [ ] **Step 1: Create reports page**

Create src/app/reports/page.tsx:
```tsx
"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import type { Deal, Metal } from "@/lib/types";

const GRAMS_PER_OZ = 31.1035;
type Period = "daily" | "weekly" | "quarterly" | "yearly";

function getDateRange(period: Period) {
  const now = new Date();
  const end = now.toISOString();
  let start: Date, label: string;
  switch (period) {
    case "daily": start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); label = "Today"; break;
    case "weekly": start = new Date(now); start.setDate(start.getDate() - 7); label = "Last 7 days"; break;
    case "quarterly": start = new Date(now); start.setMonth(start.getMonth() - 3); label = "Last 3 months"; break;
    case "yearly": start = new Date(now); start.setFullYear(start.getFullYear() - 1); label = "Last 12 months"; break;
  }
  return { start: start.toISOString(), end, label };
}

export default function ReportsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [period, setPeriod] = useState<Period>("daily");
  useEffect(() => { fetch("/api/deals?limit=2000").then((r) => r.json()).then(setDeals); }, []);

  const { start, end, label } = getDateRange(period);
  const filtered = deals.filter((d) => d.date >= start && d.date <= end);
  const buys = filtered.filter((d) => d.direction === "buy");
  const sells = filtered.filter((d) => d.direction === "sell");
  const totalBought = buys.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
  const totalSold = sells.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
  const realizedPnl = totalSold - totalBought;

  const metals: Metal[] = ["gold", "silver", "platinum", "palladium"];
  const byMetal = metals.map((m) => {
    const mB = buys.filter((d) => d.metal === m);
    const mS = sells.filter((d) => d.metal === m);
    const bought = mB.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
    const sold = mS.reduce((s, d) => s + (d.pure_equivalent_grams / GRAMS_PER_OZ) * d.price_per_oz, 0);
    return { metal: m, bought, sold, pnl: sold - bought, buyGrams: mB.reduce((s, d) => s + d.quantity_grams, 0), sellGrams: mS.reduce((s, d) => s + d.quantity_grams, 0) };
  });

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const periods: Period[] = ["daily", "weekly", "quarterly", "yearly"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Reports</h1>
        <p className="text-sm text-gray-400">{label} &mdash; P&L summary</p>
      </div>
      <div className="flex gap-2">
        {periods.map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${period === p ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Bought" value={fmt(totalBought)} sublabel={`${buys.length} deals`} />
        <StatCard label="Total Sold" value={fmt(totalSold)} sublabel={`${sells.length} deals`} />
        <StatCard label="Realized P&L" value={fmt(realizedPnl)} changeType={realizedPnl >= 0 ? "positive" : "negative"} change={realizedPnl >= 0 ? `+${fmt(realizedPnl)}` : fmt(realizedPnl)} />
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">By Metal</h2>
        <div className="space-y-2">
          {byMetal.map((m) => (
            <div key={m.metal} className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize text-white">{m.metal}</span>
                <span className={`text-sm font-semibold ${m.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{m.pnl >= 0 ? "+" : ""}{fmt(m.pnl)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-gray-400">
                <div>Bought: <span className="text-gray-200">{fmt(m.bought)} ({m.buyGrams.toFixed(0)}g)</span></div>
                <div>Sold: <span className="text-gray-200">{fmt(m.sold)} ({m.sellGrams.toFixed(0)}g)</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — open /reports, toggle periods, see breakdown.

- [ ] **Step 3: Commit**

```bash
git add src/app/reports/page.tsx
git commit -m "feat: add reports page with period filtering and per-metal breakdown"
```

---

### Task 15: Settings Page + Simulator API

**Files:**
- Create: src/app/settings/page.tsx
- Create: src/app/api/simulator/route.ts

- [ ] **Step 1: Create simulator API**

Create src/app/api/simulator/route.ts:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedSampleData } from "@/lib/sample-data";

export async function POST(req: NextRequest) {
  const { action } = await req.json();
  const db = getDb();
  if (action === "reset") {
    db.exec("DELETE FROM payments");
    db.exec("DELETE FROM deals");
    db.exec("DELETE FROM prices");
    seedSampleData();
    return NextResponse.json({ status: "reset" });
  }
  return NextResponse.json({ status: "ok" });
}
```

- [ ] **Step 2: Create settings page**

Create src/app/settings/page.tsx:
```tsx
"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [liveApi, setLiveApi] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [resetting, setResetting] = useState(false);

  const inputCls = "block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

  async function handleReset() {
    setResetting(true);
    await fetch("/api/simulator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    setResetting(false);
    window.location.reload();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-gray-400">Configure demo behavior.</p>
      </div>
      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Price Feed</h2>
        <p className="mt-1 text-xs text-gray-400">Toggle between demo prices and live LBMA prices.</p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setLiveApi(!liveApi)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${liveApi ? "bg-amber-600" : "bg-gray-700"}`}>
            <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${liveApi ? "translate-x-5.5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-gray-300">{liveApi ? "Live LBMA" : "Demo Prices"}</span>
        </div>
        {liveApi && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-400">goldapi.io API Key</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter API key..." className={`mt-1 ${inputCls}`} />
          </div>
        )}
      </div>
      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Data Management</h2>
        <p className="mt-1 text-xs text-gray-400">Reset all demo data and re-seed with fresh transactions.</p>
        <div className="mt-4">
          <button onClick={handleReset} disabled={resetting} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50">
            {resetting ? "Resetting..." : "Reset All Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify** — open /settings, toggle works, reset clears and re-seeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/app/api/simulator/route.ts
git commit -m "feat: add settings page with API toggle and data reset"
```

---

### Task 16: Verify All Routes

- [ ] **Step 1: Test all routes**

```bash
npm run dev
```

Visit each and confirm no 404:
- http://localhost:3000/
- http://localhost:3000/stock
- http://localhost:3000/deals
- http://localhost:3000/money-flow
- http://localhost:3000/reports
- http://localhost:3000/settings

- [ ] **Step 2: Test mobile view**

Open Chrome DevTools, toggle device toolbar, select iPhone 14. Verify bottom nav appears, sidebar hidden, cards stack vertically.

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: verify all routes and mobile layout"
```

---

### Task 17: Deploy to Nuremberg Server

- [ ] **Step 1: Push to GitHub**

```bash
cd "/Users/ashishkamdar/Projects/niyam turakhia gold"
git push -u origin main
```

- [ ] **Step 2: Check existing nginx pattern on server**

```bash
ssh nuremberg "ls /etc/nginx/sites-enabled/ | head -5"
ssh nuremberg "pm2 list"
```

Note: port numbers used, config naming pattern.

- [ ] **Step 3: Clone and build on server**

```bash
ssh nuremberg "cd /var/www && git clone https://github.com/ashishkamdar/niyam_turakhia.git nt-metals && cd nt-metals && npm install && npm run build"
```

- [ ] **Step 4: Start with PM2 (pick unused port)**

```bash
ssh nuremberg "cd /var/www/nt-metals && PORT=3020 pm2 start npm --name 'nt-metals' -- start && pm2 save"
```

- [ ] **Step 5: Create nginx site config**

```bash
ssh nuremberg "cat > /etc/nginx/sites-available/nt.areakpi.in << 'NGINX'
server {
    listen 80;
    server_name nt.areakpi.in;

    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX"
ssh nuremberg "ln -s /etc/nginx/sites-available/nt.areakpi.in /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
```

- [ ] **Step 6: Add SSL**

```bash
ssh nuremberg "certbot --nginx -d nt.areakpi.in --non-interactive --agree-tos"
```

- [ ] **Step 7: Verify live**

Open https://nt.areakpi.in — should show full dashboard with price ticker, nav, sample data.

---

## Self-Review

- **Spec coverage:** All sections implemented — prices (T4-5), nav (T6), deals (T8), stock (T12), money flow (T13), reports (T14), settings/toggle (T15), deployment (T17).
- **Placeholder scan:** No TBD/TODO. All code blocks complete.
- **Type consistency:** Deal, Payment, Price types from T2 used consistently. GRAMS_PER_TROY_OZ = 31.1035 everywhere.
- **Note:** Full real-time simulator (compressed timeline auto-generation) is a follow-up. The seed data (T10) + reset (T15) provides enough demo data for initial presentation.
