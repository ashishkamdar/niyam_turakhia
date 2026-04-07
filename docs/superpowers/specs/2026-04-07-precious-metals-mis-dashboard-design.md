# Precious Metals MIS Dashboard — Design Spec

## Overview

A real-time Management Information System for Niyam Turakhia's precious metals business. The demo uses hardcoded realistic prices and a transaction simulator to show what his daily MIS view will look like. Mobile-first.

**Domain:** nt.areakpi.in
**Deployment:** Nuremberg server (ssh nuremberg), nginx reverse proxy, PM2
**Repo:** github.com/ashishkamdar/niyam_turakhia

## Architecture

```
Next.js App Router (TypeScript)
├── Server Components (pages, layouts)
├── Client Components (price ticker, charts, simulator, forms)
├── API Routes
│   ├── /api/prices     → returns hardcoded or live prices (toggle)
│   ├── /api/deals      → CRUD for buy/sell transactions
│   ├── /api/payments   → CRUD for settlements
│   └── /api/simulator  → start/stop/reset the demo engine
├── SQLite (better-sqlite3)
│   ├── deals, payments, prices, settings tables
└── Catalyst UI Blocks (Tailwind CSS, dark theme)
```

No Vercel. No Vercel packages. Pure Next.js self-hosted.

## Pages & Navigation

Mobile: bottom nav (5 tabs, thumb-reachable). Desktop: sidebar nav.

| Tab | Route | Purpose |
|-----|-------|---------|
| Dashboard | `/` | Today's P&L cards, quick stats, price ticker |
| Stock | `/stock` | Stock in hand per metal, avg cost, market value, drill-down to lots |
| Deals | `/deals` | Transaction list + deal entry form |
| Money Flow | `/money-flow` | Currency settlements (USD/HKD/AED/USDT), sent vs received |
| Reports | `/reports` | Daily/weekly/quarterly/yearly P&L, filterable |

Settings (gear icon, not a tab): cost config, simulator controls, price API toggle.

Persistent header on all pages: price ticker bar.

## Data Model

### deals

| Field | Type | Notes |
|-------|------|-------|
| id | text (uuid) | primary key |
| metal | text | gold, silver, platinum, palladium |
| purity | text | 18K, 20K, 22K, 24K, 995, 999 |
| is_pure | integer | 1 if purity is 24K/999/995, else 0 |
| quantity_grams | real | weight as purchased |
| pure_equivalent_grams | real | after yield (= quantity if already pure) |
| price_per_oz | real | USD, 4 decimal places |
| direction | text | buy, sell |
| location | text | uae, hong_kong |
| status | text | pending, in_refinery, in_transit, in_hk, sold, locked |
| date | text | ISO datetime |
| created_by | text | simulator, manual |

### payments

| Field | Type | Notes |
|-------|------|-------|
| id | text (uuid) | primary key |
| amount | real | |
| currency | text | USD, HKD, AED, USDT |
| direction | text | sent, received |
| mode | text | bank, local_dealer, crypto_exchange |
| from_location | text | |
| to_location | text | |
| linked_deal_id | text | nullable FK to deals |
| date | text | ISO datetime |

### prices

| Field | Type | Notes |
|-------|------|-------|
| metal | text | XAU, XAG, XPT, XPD |
| price_usd | real | per troy ounce |
| prev_close | real | previous close price |
| change | real | price - prev_close |
| change_pct | real | percentage |
| source | text | demo, live |
| fetched_at | text | ISO datetime |

### settings

| Field | Type | Notes |
|-------|------|-------|
| key | text | primary key |
| value | text | JSON-encoded |

## Price Ticker Header

- Sticky bar at top of every page
- Shows: Gold, Silver, Platinum, Palladium — USD/oz + daily change (green/red)
- Compact on mobile: horizontal scroll or two-row grid
- Source label: "Demo" or "Live LBMA"
- Default: hardcoded realistic prices (Gold ~$2,340, Silver ~$30, Platinum ~$980, Palladium ~$1,020)
- Toggle in settings to switch to live API (goldapi.io) when ready

## Stock In Hand (Primary MIS View)

### Summary Level
- Per metal row: total grams in hand, weighted avg cost, current market value (from ticker), unrealized P&L
- Location breakdown: In UAE, In Refinery, In Transit, In HK
- Period filters: Daily / Weekly / Quarterly / Yearly
- Total bought vs total sold per period

### Drill-Down (tap metal row)
- Every individual lot making up current stock
- Fields: purchase date, grams, metal, purity, pure equivalent, purchase price, current status, cost breakdown
- Each lot tappable for full deal details

## Transaction Simulator

Generates the full business cycle automatically:

1. **Buy (UAE):** Mix of pure (24K/999/995) and impure (18K/20K/22K), various metals, realistic quantities
2. **Refine (impure only):** Yield loss per purity table, refining cost applied, 1-3 day simulated delay
3. **Ship to HK:** All pure metal, shipping cost, 1-2 day simulated delay
4. **Brick cutting (occasional):** 12KG → 12x1KG, fabrication cost
5. **Sell (HK):** To banks (USD), local dealers (HKD), crypto exchanges (USDT) at premium to fix price
6. **Payments:** Generated to match deals in appropriate currencies

Yield table:
| Input | Output | Yield |
|-------|--------|-------|
| 18K | 24K | ~75% |
| 20K | 24K | ~83% |
| 22K | 24K | ~92% |
| 24K/999/995 | as-is | 100% |

Compressed timeline: 1 real minute ≈ 2 business hours. Toggle on/off in settings.

All sales are always in pure form regardless of what was purchased.

## Deal Entry Form

For manual entry (in addition to simulator):
- Metal type (Gold, Silver, Platinum, Palladium)
- Purity (18K, 20K, 22K, 24K, 995, 999)
- Quantity (grams/kg)
- Rate (USD/oz, 4 decimals)
- Direction (Buy/Sell)
- Location (UAE/Hong Kong)
- Status defaults to Locked

## Money Flow View

- Total sent to Dubai by currency (AED, USD)
- Total received from HK by currency (USD, HKD, USDT)
- Net position per currency
- Pending settlements
- Links to related deals

## Reports

- Daily / Weekly / Quarterly / Yearly P&L
- Filterable by metal type, date range
- Shows: total bought, total sold, realized P&L, costs breakdown
- Export to PDF/Excel (nice to have)

## UI Framework

Catalyst Tailwind CSS UI Blocks (React), dark theme. Key blocks:
- Sidebar nav + bottom nav (mobile)
- Stats with trending (KPI cards)
- Tables with drill-down
- Form layouts
- Cards, badges, alerts

Source: `/Users/ashishkamdar/Downloads/Catalyst-tailwind-css-UI-Blocks-634/react/ui-blocks/`

## Tech Stack

- Next.js App Router, TypeScript
- Tailwind CSS (dark theme)
- SQLite via better-sqlite3
- Recharts for charts
- PM2 for process management
- Nginx reverse proxy on Nuremberg server
- No Vercel, no Vercel packages
- No auth for demo phase

## Mobile-First Design Rules

- Cards stack vertically on mobile, grid on desktop
- Tables become stacked card lists on mobile
- Price ticker compact (scroll or two-row)
- Bottom nav on mobile, sidebar on desktop
- Large, readable P&L numbers
- Touch-friendly tap targets
- No hover-dependent interactions
