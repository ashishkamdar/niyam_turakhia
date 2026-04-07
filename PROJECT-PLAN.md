# Niyam Turakhia — Precious Metals Profitability Dashboard

## Client
- **Name:** Niyam Turakhia (Kutchi businessman, Matunga Gymkhana)
- **Business:** Precious metals dealing (gold, silver, platinum, palladium) — Dubai + Hong Kong operations
- **Contact:** WhatsApp (connected via Ashish's Gymkhana network)

## Business Context

Niyam's precious metals business works like this:

### The Full Operation

1. **Procurement:** Buys scrap precious metals (e.g. 18K gold) from local sellers in **Dubai/UAE**
2. **Refining:** Ships to **Hong Kong factory** where scrap is refined
   - Example: 100gm of 18K gold → 80gm of 24K pure gold (refining with small profit margin)
   - 12KG bricks are cut into 12 x 1KG bars for resale
   - Similar process for all precious metals (silver, platinum, palladium)
3. **Selling:** Sells refined metals primarily in **Hong Kong** market
4. **Pricing:** Based on London Fix prices (LBMA):
   - **AM Fix:** 10:30 AM London time
   - **PM Fix:** 15:30 PM London time
   - Deals are done at **premium or discount** to the London Fix
   - Prices quoted in USD per troy ounce (oscillate between AM/PM fixings)
5. **Money Flow:** Complex multi-currency settlement:
   - Sells in HK → receives HKD or USD
   - Converts via: **Banks (USD)** ↔ **Local dealers (HKD)** ↔ **Exchanges (USD/USDT crypto)**
   - Transfers money back to **UAE/Dubai** to pay local sellers
   - Settlement currencies: **USD, HKD, AED (Dirhams), USDT (crypto)**
6. **Deal Execution (WhatsApp-based):**
   - Clients send buy/sell orders on WhatsApp
   - Orders specify: metal, quantity (kg), purity (e.g. 24k), rate (USD to 4 decimals), direction (buy/sell)
   - The word **"lock"** confirms the deal
   - Example: `12 Kg 24k Gold at USD 2341.5678 buy — lock`
7. **Logging:** After lock, staff enters the transaction into existing special software (Dubai server)
8. **That software** produces accountability reports and trial balance
9. **Profitability reports** are compiled weekly by staff — this is the pain point

### Staff Daily Work
- Enter **purchases and sales** of metals
- Enter **money sent and received** in various modes:
  - USDT (crypto via exchanges)
  - USD (via banks)
  - HKD (via local HK dealers)
  - AED/Dirhams (UAE local payments)
- Track which payments correspond to which deals

## The Problem

Niyam currently sees profitability **once a week** when staff presents a manual report. He wants to see it **in real-time, on the go**, as transactions are entered.

## What We're Really Selling: Real-Time MIS

This is a **Management Information System (MIS)** — not a trading tool, not an accounting system. Niyam already has software for deal entry and trial balance. What he **doesn't have** is a real-time executive overview.

**The pitch is simple:** Real figures. Real time. That's it.

- His staff enter deals and payments into the existing system throughout the day
- Instead of waiting for Friday's manual report, he opens a dashboard and sees **everything — right now**
- P&L by metal, open positions, money flow across currencies, settlement status
- All powered by **live London Fix prices** so unrealized P&L is always current

## The Constraint & Demo Strategy

Niyam is **not keen on giving direct access** to the Dubai server. The data access problem is a **Phase 2 problem** — we solve it after the contract is signed.

**For the demo:** We use **realistic dummy transaction data** combined with **real live precious metal prices**. This lets him see exactly what his daily MIS view will look like — the numbers are illustrative but the prices ticking in the header are real. That's what makes the demo convincing.

### Mobile-First Design (CRITICAL)
This dashboard will be viewed **primarily on mobile**. Every screen must be designed mobile-first:
- Cards stack vertically on mobile, grid on desktop
- Tables become stacked card lists on mobile (no horizontal scroll)
- Price ticker is compact on mobile (scrolling marquee or condensed)
- Touch-friendly: large tap targets, no hover-dependent interactions
- Bottom navigation on mobile (thumb-reachable), sidebar on desktop
- Numbers and P&L figures must be **large and readable** at a glance on phone

### UI Framework
Using **Catalyst Tailwind CSS UI Blocks** (634 production-ready components) — located at `/Users/ashishkamdar/Downloads/Catalyst-tailwind-css-UI-Blocks-634/react/ui-blocks/`

Key blocks to use:
- **Sidebar navigation** — main app shell (application-ui/navigation/sidebar-navigation/)
- **Stats with trending** — KPI cards for P&L (application-ui/data-display/stats/)
- **Tables** — transaction lists, position summary (application-ui/lists/tables/)
- **Form layouts** — deal entry, payment entry (application-ui/forms/)
- **Cards** — section containers (application-ui/layout/cards/)
- **Page headings** — section headers with actions (application-ui/headings/)
- **Badges** — status indicators (application-ui/elements/badges/)
- **Alerts** — notifications (application-ui/feedback/alerts/)
- **Description lists** — deal details (application-ui/data-display/description-lists/)

### Demo Scope

#### 0. Live Price Ticker (Header Bar)
- **Real-time precious metal prices** fetched from London Fix / public APIs
- Metals: Gold (XAU), Silver (XAG), Platinum (XPT), Palladium (XPD)
- Prices in **USD per troy ounce**
- Updates twice daily (AM Fix 10:30, PM Fix 15:30 London time)
- Show: current price, daily change, change %
- Sticky header — always visible as user scrolls

#### 1. Deal Entry Form
- Metal type (Gold, Silver, Platinum, Palladium)
- Purity (24k, 22k, 999, 995, etc.)
- Quantity (kg, with decimals)
- Rate (USD per troy ounce, 4 decimal places)
- Direction: Buy / Sell
- Location: Dubai / Hong Kong / Other
- Timestamp (auto)
- Status: Locked / Pending

#### 2. Payment/Settlement Tracker
- Amount
- Currency: USD / HKD / AED / USDT
- Direction: Sent / Received
- Mode: Bank transfer / Local dealer / Crypto exchange
- From/To location: Dubai / Hong Kong
- Linked deal (optional)
- Timestamp

#### 3. Live P&L Dashboard
- **Running profit/loss** for the day — updates as deals are entered
- Per-metal breakdown (gold P&L, silver P&L, etc.)
- Buy vs sell volume summary
- Average buy rate vs average sell rate per metal
- **Unrealized P&L** based on live London Fix prices
- Currency-wise settlement summary (how much in USD, HKD, AED, USDT)

#### 4. Stock In Hand (MOST IMPORTANT VIEW)
This is Niyam's primary view — what he owns right now and what it's worth.

**Summary Level:**
- Per metal: total grams/kg in hand, weighted average cost, current market value (live Fix), unrealized P&L
- Location breakdown: stock in UAE (pre-ship), in refinery, in transit, in HK (ready to sell)
- Period filters: Daily / Weekly / Quarterly / Yearly
- Total bought vs total sold per period
- Net stock movement per period

**Drill-Down (tap on any metal row):**
Opens detail view showing every individual lot that makes up the current stock:
- Purchase date
- Grams / kg
- Metal type
- Purity at purchase (18K, 22K, 24K etc.)
- Pure equivalent (after refining yield)
- Purchase price (per gram, per ounce, total)
- Current status: In UAE → In Refinery → In Transit → In HK → Sold
- Cost breakdown: purchase + refining + shipping + cutting = total cost per gram

Each row is tappable for full deal details (counterparty, currency paid, linked payments).

#### 5. Money Flow View
- Total money sent to Dubai (by currency)
- Total money received from HK sales (by currency)
- Net settlement position per currency
- Pending settlements

#### 6. Reports View
- Daily P&L summary
- Weekly P&L summary (what his staff currently does manually)
- Filterable by date range, metal type, currency
- Export to PDF/Excel (nice to have for demo)

### Transaction Simulator (Demo Engine)

A background module that **continuously generates realistic transactions** mimicking Niyam's full business cycle. This makes the dashboard feel alive — as if his staff is actively working.

#### The Full Business Cycle It Simulates

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: BUY (UAE)                                                  │
│  Staff buys metal from local sellers in Dubai/UAE                   │
│  - Metal: Gold, Silver, Platinum, Palladium                         │
│  - Purity: IMPURE (18K, 20K, 22K) or PURE (24K, 999)              │
│  - Quantity: 0.5kg - 50kg per deal                                  │
│  - Price: at discount to London Fix (buy cheap)                     │
│  - Currency: AED (Dirhams) or USD                                   │
│  - Pure buys skip refining → go straight to shipping                │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: REFINE (impure only — pure skips to Step 3)                │
│  Impure metal sent to refinery                                      │
│  - Input: e.g. 100gm of 18K gold                                   │
│  - Output: e.g. 75gm of 24K gold (yield depends on input purity)  │
│  - COST: Refining charge per gram (configurable)                    │
│  - Time: 1-3 days turnaround                                        │
│  - Pure purchases (24K/999) skip straight to Step 3                 │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: SHIP TO HONG KONG                                          │
│  Pure metal shipped from UAE to HK                                  │
│  - COST: Shipping/logistics/insurance per kg (configurable)         │
│  - Format: typically 12KG bricks or smaller bars                    │
│  - Time: 1-2 days                                                   │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: BRICK CUTTING (if needed)                                  │
│  Large bricks cut into smaller bars at HK factory                   │
│  - Input: 12KG brick                                                │
│  - Output: 12 x 1KG bars                                           │
│  - COST: Cutting/fabrication charge per kg (configurable)           │
│  - Some buyers want 12KG bricks as-is (skip this step)             │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: SELL (Hong Kong)                                           │
│  Metal sold to HK buyers                                            │
│  - Buyer types: Banks (USD), Local dealers (HKD),                   │
│    Crypto exchanges (USDT)                                          │
│  - Price: at premium to London Fix (sell higher)                    │
│  - Payment received in: USD / HKD / USDT                           │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 6: SETTLE (Money back to UAE)                                 │
│  Money transferred from HK back to Dubai to pay sellers             │
│  - Via banks (USD), local dealers (HKD→AED), exchanges (USDT)      │
│  - Net profit = Sell price - Buy price - Refining - Shipping        │
│                 - Brick cutting - FX conversion costs                │
└─────────────────────────────────────────────────────────────────────┘
```

#### Configurable Cost Inputs (Settings Page in Demo)

| Cost Item | Default | Unit | Notes |
|-----------|---------|------|-------|
| Refining charge (gold) | $1.50 | per gram | Varies by refinery |
| Refining charge (silver) | $0.15 | per gram | Lower for silver |
| Refining charge (platinum) | $3.00 | per gram | Premium metals |
| Shipping UAE→HK | $2.00 | per gram | Insurance included |
| Brick cutting (12KG→1KG) | $0.50 | per gram | HK factory fee |
| Buy discount to Fix | 0.5-1.5% | percentage | How cheap he buys |
| Sell premium to Fix | 0.3-0.8% | percentage | How much he marks up |

#### Yield Table (Refining)

| Input Purity | Output Purity | Yield | Example |
|-------------|--------------|-------|---------|
| 18K (75%) | 24K (99.9%) | ~75% | 100gm in → 75gm out |
| 20K (83.3%) | 24K (99.9%) | ~83% | 100gm in → 83gm out |
| 22K (91.7%) | 24K (99.9%) | ~92% | 100gm in → 92gm out |
| 999 (Silver) | 999 | 100% | Already pure |

#### Key Rule: ALL SALES ARE PURE
- Regardless of what is bought (18K, 20K, 22K, or 24K), **selling is always in pure form** (24K / 999)
- Pure buys → ship directly to HK → sell
- Impure buys → refine first → then ship to HK → sell
- The buy mix (pure vs impure) affects margin: impure is cheaper to buy but has refining cost + yield loss

#### Simulator Behavior
- Generates **5-10 buy transactions per day** (mix of metals, purities — some pure, some impure)
- Triggers refining jobs for impure purchases (with realistic delay)
- Ships refined metal to HK (with delay)
- Generates **sell transactions** as HK inventory arrives
- Creates corresponding **payment entries** in appropriate currencies
- Runs on a **compressed timeline** for demo: 1 real minute = ~2 business hours
  - So in 4 minutes of demo, Niyam sees a full day of activity
- All prices anchored to **real London Fix** with realistic spreads

### Demo Data (Pre-loaded)
In addition to the live simulator, pre-load with 2-3 days of historical transactions:
- Gold: ~10-15 trades/day, rates around USD 2300-2400/oz range (4 decimals)
- Silver: ~5-8 trades/day, rates around USD 28-32/oz range
- Mix of buys (Dubai) and sells (HK) with small spreads
- Corresponding payment entries in USD, HKD, AED, USDT
- Refining entries: 18K scrap → 24K refined (with yield loss)

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **UI Components:** Catalyst Tailwind CSS UI Blocks (React)
- **Styling:** Tailwind CSS — dark theme, clean financial dashboard look
- **Database:** SQLite (for demo simplicity) or PostgreSQL (if planning to reuse on server)
- **Charts:** Recharts or lightweight alternative
- **Price Feed:** Hardcoded realistic prices for demo (toggle to switch to live API when ready — goldapi.io)
- **Deployment:** Self-hosted on Nuremberg server (`ssh nuremberg`), nginx reverse proxy, PM2 process manager
- **Domain:** nt.areakpi.in (subdomain already created)
- **No auth needed** for demo phase

## Data Access Solutions (Post-Demo, For Implementation)

Present these options to Niyam after demo impresses him:

| Option | How it works | Real-time? | Server access needed? |
|--------|-------------|------------|----------------------|
| **A. Scheduled CSV export** | His software exports file every 15-30 min, dashboard picks it up | Near real-time | No — just a file drop |
| **B. Read-only DB view** | Read-only user on specific tables/views | Yes | Minimal — read-only, no risk |
| **C. Software API** | If his software has REST/SOAP API | Yes | No — API credentials only |
| **D. Parallel entry** | Staff enters deals in dashboard too | Yes | No |
| **E. WhatsApp chatbot** | Parse "lock" messages automatically, read & extract | Yes | No — WhatsApp Business API |

**Recommendation:** Start with Option A or D for quick win, pitch Option E (WhatsApp chatbot — he specifically mentioned this) as upgrade.

## Phases

### Phase 1: Demo (WIN THE CONTRACT)
- Build MIS dashboard with realistic demo data + real live prices
- Live price ticker in header
- **Mobile-first** — this is the primary viewing device
- Show him: "This is what your daily view looks like — instead of waiting for Friday's report"
- Timeline: 3-5 days

### Phase 2: MVP (After contract signed)
- Connect to real data (whichever access method he agrees to)
- Staff entry interface (deals + payments)
- Real P&L calculations with actual rates
- Multi-currency settlement tracking
- Basic user auth

### Phase 3: Full Product
- WhatsApp chatbot — read & extract "lock" messages automatically
- Multi-user (Niyam + staff roles)
- Refining tracker (scrap in → pure out, yield tracking)
- Historical analytics and trends
- Alerts (e.g. daily loss exceeds threshold, large settlement pending)
- HK factory inventory tracking (12KG brick → 1KG bars)
- Mobile app or PWA

## Pricing Guidance

- This is specialized financial software for a precious metals business
- Similar dashboards for commodity traders cost Rs 5-15L+
- Niyam is Kutchi — value-conscious but pays for clear ROI
- **Don't quote in the demo meeting.** Show the demo, then send a phased proposal.
- Anchor around Rs 3-5L for Phase 1+2, with Phase 3 as ongoing maintenance

## Key Selling Points

1. **MIS in real-time:** "You see what your staff sees — but summarized, live, on your phone." Weekly → real-time. That's the entire pitch.
2. **Real prices, real positions:** London Fix ticking in the header + his open positions = he knows his exposure at a glance.
3. **Multi-currency treasury view:** USD, HKD, AED, USDT — all money flows in one place, not scattered across WhatsApp messages and Excel sheets.
4. **Nothing changes for his staff:** They keep using the same software. This is a **view layer on top** — zero disruption.
5. **SEBI credential:** "I built surveillance systems for SEBI India" — financial domain trust.
6. **Proximity:** You're at Gymkhana daily. Support is a conversation away.
7. **Privacy:** Data stays on HIS infrastructure. We're building the MIS view, not touching his core system.
8. **WhatsApp chatbot (future):** Deals captured automatically from chat — staff workload reduced.

## Files to Create

```
niyam turakhia gold/
├── PROJECT-PLAN.md              ← this file
├── src/
│   ├── app/
│   │   ├── page.tsx             ← dashboard home (P&L overview)
│   │   ├── layout.tsx           ← app shell with sidebar + price ticker header
│   │   ├── globals.css          ← styles
│   │   ├── deals/
│   │   │   └── page.tsx         ← deal entry + transaction list
│   │   ├── payments/
│   │   │   └── page.tsx         ← payment/settlement tracker
│   │   ├── positions/
│   │   │   └── page.tsx         ← open positions + unrealized P&L
│   │   ├── money-flow/
│   │   │   └── page.tsx         ← multi-currency money flow view
│   │   ├── reports/
│   │   │   └── page.tsx         ← daily/weekly P&L reports
│   │   ├── settings/
│   │   │   └── page.tsx         ← configurable costs (refining, shipping, cutting, spreads)
│   │   └── api/
│   │       ├── prices/
│   │       │   └── route.ts     ← fetch live London Fix prices
│   │       └── simulator/
│   │           └── route.ts     ← trigger/control the transaction simulator
│   ├── components/
│   │   ├── price-ticker.tsx     ← live precious metal prices header
│   │   ├── sidebar-nav.tsx      ← main navigation (Catalyst sidebar)
│   │   ├── bottom-nav.tsx       ← mobile bottom navigation
│   │   ├── deal-form.tsx        ← buy/sell entry form
│   │   ├── payment-form.tsx     ← payment/settlement entry
│   │   ├── pnl-card.tsx         ← live P&L display cards
│   │   ├── position-table.tsx   ← open positions table
│   │   ├── money-flow-summary.tsx ← currency-wise flow
│   │   ├── pipeline-tracker.tsx ← visual: buy→refine→ship→cut→sell pipeline
│   │   └── chart.tsx            ← P&L chart
│   └── lib/
│       ├── simulator.ts         ← transaction simulator engine (full business cycle)
│       ├── sample-data.ts       ← pre-loaded 2-3 days of historical transactions
│       ├── calculations.ts      ← P&L, weighted avg, position math, currency conversion
│       ├── costs.ts             ← configurable cost defaults (refining, shipping, cutting)
│       ├── prices.ts            ← fetch live precious metal prices
│       └── types.ts             ← TypeScript interfaces
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```
