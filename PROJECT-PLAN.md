# Niyam Turakhia — Precious Metals MIS Dashboard

## Client
- **Name:** Niyam Turakhia (Kutchi businessman, Matunga Gymkhana)
- **Company:** PrismX
- **Business:** Precious metals dealing (gold, silver, platinum, palladium) — Dubai + Hong Kong operations
- **HQ:** Dubai (staff connects via FortiGate VPN from Mumbai)
- **Mumbai office:** Matunga
- **Contact:** WhatsApp (connected via Ashish's Gymkhana network)
- **Status:** Demo shown April 9, 2026. Positive response. App link + PIN shared. Dubai visit invited. Awaiting next meeting at Gymkhana.

## Business Context

### The Full Operation

1. **Procurement:** Buys scrap precious metals (e.g. 18K gold) or pure metals from local sellers in **Dubai/UAE**
2. **Refining:** Ships impure metal to **Hong Kong factory** where scrap is refined
   - Example: 100gm of 18K gold → 75gm of 24K pure gold (refining with small profit margin)
   - 12KG bricks are cut into 12 x 1KG bars for resale
   - Similar process for all precious metals (silver, platinum, palladium)
   - Pure purchases (24K, 999, 995) skip refining → ship directly
3. **Selling:** Sells refined metals (always in pure form) primarily in **Hong Kong** market
4. **Pricing:** Based on London Fix prices (LBMA):
   - **AM Fix:** 10:30 AM London time (GMT winter, BST summer)
   - **PM Fix:** 15:30 PM London time
   - Gold & Silver: LBMA; Platinum & Palladium: LPPM
   - Deals done at **premium or discount** to the London Fix
   - Prices quoted in USD per troy ounce (31.1035 grams)
5. **Money Flow:** Complex multi-currency settlement:
   - Sells in HK → receives HKD or USD
   - Converts via: **Banks (USD)** ↔ **Local dealers (HKD)** ↔ **Exchanges (USD/USDT crypto)**
   - Transfers money back to **UAE/Dubai** to pay local sellers
   - Settlement currencies: **USD, HKD, AED (Dirhams), USDT (crypto)**
6. **Deal Execution (WhatsApp-based):**
   - Clients send buy/sell orders on WhatsApp
   - Orders specify: metal, quantity (kg), purity, rate (USD to 4 decimals), direction (buy/sell)
   - The word **"lock"** confirms the deal
   - Example: `10 Kg 24K Gold at USD 2338.7500 buy — lock`
7. **Logging:** After lock, staff enters the transaction into existing special software (Dubai server)

### Key Business Rules
- **All sales are pure** — regardless of what is bought (18K, 20K, 22K, 24K), selling is always in pure form (24K/999/995)
- **Yield table:** 18K→75%, 20K→83.3%, 22K→91.7%, 24K/999/995→100%
- **Purity types:** 18K, 20K, 22K, 24K, 995, 999

---

## What We Built: Real-Time MIS Dashboard

**Live at: https://nt.areakpi.in**

A **Management Information System (MIS)** — a real-time executive overview layer. The demo uses realistic dummy transaction data combined with hardcoded precious metal prices (with a toggle for live API when ready).

### What's Deployed (Phase 1 — Complete)

#### Authentication
- **PIN pad lock screen** with 6-digit numeric keypad
- **PIN: `639263`**
- Cookie-based session, stays logged in for **365 days**
- Header bar (top-right): Settings gear icon + Logout icon (with gap between them), visible on all screens

#### Pages Built

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | **Portfolio bar** (total AED value + per-metal stock in hand with low stock warnings below 5kg). **Start Demo button** (seeds 50kg opening stock, runs 25 WhatsApp chats for 10 min with live stats: messages/negotiating/locked). **Hero profit card** (today's realized P&L). **Weekly P&L bar chart** (7-day Recharts). **WhatsApp Deals** section (negotiating count + locked count + deal cards). **4 stat cards** (Buys, Sales, Stock Value, Unrealized P&L). **Funds Received from HK** (HKD/USD/USDT with FX rates to AED + "Transfer to Dubai Account" button → ADCB bank receipt). **Delivery pipeline** (preparing/in transit/pending). **Recent activity** with metal colors. All auto-refreshes every 3 seconds + instant refresh on deal lock via dealTick. |
| **Stock In Hand** | `/stock` | Per-metal summary cards (total grams, avg cost, market value, unrealized P&L, location badges). Tap any metal → drill-down to individual lots with purchase date, purity, qty, status |
| **Purchase & Sales** | `/deals` | Two tabs: **Purchase** (metal, purity, qty, rate + refining section auto-shows for impure metals with yield%, wastage, refining cost, effective cost per oz/gram) and **Sale** (always 24K, buyer name, warns if selling at/below avg cost with red confirmation). WhatsApp Locked Deals at top. Recent Purchases (with REFINED badge) and Recent Sales below. |
| **WhatsApp** | `/whatsapp` | Simulated WhatsApp chat interface with 5 pre-built contacts. Contact list with last message preview. Chat thread with message bubbles. "Start Chats" toggle to simulate negotiations. Lock detection highlights deals in amber. LOCKED badge on contacts |
| **Delivery & Payment** | `/money-flow` | Full 3-tab module covering the complete post-sale cycle. **Deliveries tab:** create shipments to HK (buyer type: Individual/Firm/Bank/Crypto Exchange, weight, shipping cost, auto-shows expected payment currency), status tracking (Preparing→In Transit→Delivered). **Received tab:** record payments from HK buyers in HKD/USD/USDT. **Settlement tab:** full HK→Dubai flow — amount received in HK, transfer channel (Wire/Crypto/Local Dealer/Cash/Hawala), amount sent to Dubai, seller payment in AED. Summary cards: preparing, in transit, pending settlements, total shipping cost. |
| **Reports** | `/reports` | Period selector (Daily/Weekly/Quarterly/Yearly). Total bought/sold/realized P&L. Per-metal breakdown |
| **Settings** | `/settings` | **Data Source selector** (4 options with pros/cons: Excel Upload, Live Data Bridge, Scheduled Auto-Export, Secure VPN Access — each with advantages, considerations, frequency, and setup effort). Price feed toggle (Demo/Live LBMA). Reset All Data button. Accessible via gear icon in header. |

#### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth` | GET, POST | PIN verification, session cookie, logout |
| `/api/prices` | GET | Returns metal prices (demo or live). Auto-seeds demo data on first call |
| `/api/deals` | GET, POST | Deal CRUD with filtering (direction, metal, status, limit). Auto-calculates pure equivalent on create |
| `/api/payments` | GET, POST | Payment/settlement CRUD |
| `/api/whatsapp` | GET, POST | WhatsApp messages. GET returns contacts summary or messages for a contact. POST stores message + auto-creates deal if "lock" detected |
| `/api/simulator` | POST | Reset all data and re-seed |
| `/api/deliveries` | GET, POST | Delivery CRUD (filter by status). Tracks shipments to HK with buyer info, weight, shipping cost, status |
| `/api/settlements` | GET, POST | Settlement CRUD (filter by status). Tracks payment received → transfer to Dubai → seller payment |

#### Components Built

| Component | File | Description |
|-----------|------|-------------|
| Price Ticker | `price-ticker.tsx` | Sticky header, 2x2 mobile / 4-col desktop, 4 decimal prices, Demo/Live label. Top bar with NT Metals branding (mobile) / Live Prices label (desktop), settings gear icon + logout icon (with spacing) |
| Sidebar Nav | `sidebar-nav.tsx` | Desktop left sidebar (hidden on mobile), 6 nav items + Settings + Logout |
| Bottom Nav | `bottom-nav.tsx` | Mobile bottom tab bar (hidden on desktop), 5 tabs: Home, Stock, Deals, WhatsApp, Money |
| Auth Gate | `auth-gate.tsx` | Wraps entire app, checks session cookie, shows PIN pad if locked |
| PIN Pad | `pin-pad.tsx` | 6-digit numeric keypad with dot indicators, error feedback |
| Stat Card | `stat-card.tsx` | Reusable KPI card (Catalyst stats-with-trending pattern) |
| Purchase Form | `purchase-form.tsx` | Buy form with refining section: metal, purity, qty, rate. Auto-shows refining for impure (18K/20K/22K) with yield %, wastage, cost per gram, effective cost per oz. Live calculation summary. |
| Sale Form | `sale-form.tsx` | Sell form (always 24K): metal, qty, rate, buyer name. Fetches avg buy cost and shows profit/loss. Red warning + confirmation required when selling at or below cost. |
| Deal Form | `deal-form.tsx` | Legacy buy/sell entry form (still used by WhatsApp API for lock-created deals) |
| Stock Detail | `stock-detail.tsx` | Drill-down lot list with status badges (UAE/Refinery/Transit/HK) |
| Contact List | `contact-list.tsx` | WhatsApp contact list split into Active (top) and Locked Deals (bottom) sections. Lock icons per deal (multiple locks = multiple icons). Contacts move back to Active when new incoming messages arrive after a lock. Outgoing confirmations don't count as new activity. |
| Chat Thread | `chat-thread.tsx` | Chat bubbles with lock keyword highlighting in amber, manual message input. iOS-safe (16px font prevents Safari auto-zoom). |
| Locked Deals | `locked-deals.tsx` | "WhatsApp Deals" section — shows negotiating count (blue) + locked count (amber) + deal cards. Auto-refreshes 3s. |
| Demo Engine | `demo-engine.tsx` | React Context provider. Runs 25 chat scripts globally (survives page navigation). Seeds opening stock. Tracks dealTick for instant dashboard refresh. |
| Demo Mode | `demo-mode.tsx` | Start/Stop button + live stats panel (messages/negotiating/locked/timer). Uses DemoEngine context. |
| Demo Indicator | `demo-indicator.tsx` | Floating pill "X locked \| Y live" visible on all pages during demo. |
| Funds Received | `funds-received.tsx` | Funds from HK grouped by currency (HKD/USD/USDT) with FX rates to AED. "Transfer to Dubai Account" button → ADCB bank receipt with conversion details. |
| Deal Toast | `deal-toast.tsx` | Slide-in notification on any page when a WhatsApp deal locks. Shows contact, metal, qty, rate. |

#### Library Modules

| Module | File | Purpose |
|--------|------|---------|
| Database | `db.ts` | SQLite (better-sqlite3) singleton. WAL mode. **8 tables:** deals, payments, prices, settings, whatsapp_messages, deliveries, settlements, schema_version. **Versioned migration system** (currently v3) — each migration runs once, tracked in schema_version table. Safe for both fresh DBs and existing ones. Never deletes data. |
| Types | `types.ts` | All interfaces: Deal (with refining_cost, total_cost, contact_name), Payment, Price, Delivery (buyer_type, shipping_cost, status), Settlement (amount_received, currency, channel, seller_paid), WhatsAppMessage, WhatsAppContact, StockSummary. Types: BuyerType, DeliveryStatus, SettlementStatus. Constants: YIELD_TABLE, METAL_SYMBOLS, GRAMS_PER_TROY_OZ, PURE_PURITIES |
| Prices | `prices.ts` | Demo prices (Gold $2,341.5678, Silver $30.2450, Platinum $982.3400, Palladium $1,024.7800). Live fetch via goldapi.io (toggle) |
| Calculations | `calculations.ts` | Stock summary, weighted avg cost, daily P&L, avg buy cost per metal |
| Sample Data | `sample-data.ts` | Seeds 3 days of realistic transactions: 10-15 buys/day + 5-8 sells/day with corresponding payments |
| Chat Scripts | `chat-scripts.ts` | ChatScript interface with buyer_type, payment_currency, delay_seconds |
| Demo Scripts | `demo-scripts.ts` | 25 contacts: 8 HK sells (Individuals→HKD, Banks→USD, Crypto→USDT), 12 UAE buys (small qty, staggered 2-5 min delay), 3 walk-aways, 2 from original scripts. All profitable. |

#### WhatsApp Chat Simulator

Pre-built negotiation scripts with realistic multi-message flows:

| Contact | Location | Metal | Qty | Result |
|---------|----------|-------|-----|--------|
| Mr. Chang | Hong Kong | Gold 24K | 10kg | Locks at $2,338.75/oz after price negotiation |
| Karim & Co. | UAE | Silver 999 | 50kg | Locks at $29.985/oz after haggling |
| Shah Brothers | UAE | Platinum 999 | 2kg | Quick lock at $979.25/oz |
| Li Wei Trading | Hong Kong | Gold 24K | 5kg | **Walks away** — no lock (realistic) |
| Patel Exports | UAE | Palladium 999 | 1kg | Urgent fast lock at $1,021.50/oz |

Messages arrive every 3-8 seconds (random via setTimeout chain). Multiple conversations interleave. Lock detection uses `/\block\b/i` regex. When lock is detected, deal is auto-created with `created_by: "whatsapp"` and contact name.

#### Contact List Behavior
- **Active section (top, green label):** Contacts with no locks, OR contacts who have new incoming messages after their last lock (they're back for more)
- **Locked Deals section (bottom, amber label):** Contacts whose last activity ended on a lock — no new incoming messages since
- **Lock icons:** Small amber lock icon next to name for each locked deal (2 deals = 2 icons)
- **Movement logic:** Outgoing confirmation messages ("Locked. Deal confirmed.") don't count as new activity — only new **incoming** messages from the contact move them back to Active
- **Example flow:** Mr. Chang negotiates → locks deal → moves to Locked (1 lock icon) → sends "I need more gold" → moves back to Active (1 lock icon visible) → locks again → moves to Locked (2 lock icons)

---

## Tech Stack (What's Actually Running)

| Layer | Technology | Details |
|-------|-----------|---------|
| **Framework** | Next.js 16.2.2 | App Router, TypeScript, Turbopack |
| **UI Components** | Catalyst Tailwind CSS UI Blocks | 634 React components, dark theme. Used: stats-with-trending (KPI cards), sidebar-navigation (nav), tables (deal lists), form-layouts (deal entry), badges (status indicators) |
| **Styling** | Tailwind CSS v4 | Dark theme (`bg-gray-950`), amber accent (`text-amber-400`), emerald for positive, rose for negative |
| **Database** | SQLite via better-sqlite3 | WAL mode, 5 tables (deals, payments, prices, settings, whatsapp_messages). File: `data.db` |
| **Charts** | Recharts | Installed but charts not yet implemented in demo |
| **Auth** | Cookie-based PIN | `nt_session` cookie, httpOnly, secure, 365-day expiry |
| **IDs** | uuid v4 | All primary keys are UUIDs |

## Deployment Details

| Item | Value |
|------|-------|
| **Server** | Nuremberg (`ssh nuremberg`, root access) |
| **Domain** | https://nt.areakpi.in |
| **SSL** | Let's Encrypt via certbot (auto-renew, expires 2026-07-06) |
| **Reverse Proxy** | nginx (`/etc/nginx/sites-enabled/nt.areakpi.in`) |
| **Process Manager** | PM2 (process name: `nt-metals`, id: 29) |
| **Port** | 3020 (internal, proxied by nginx) |
| **App Directory** | `/var/www/nt-metals` |
| **Database File** | `/var/www/nt-metals/data.db` |
| **Git Repo** | https://github.com/ashishkamdar/niyam_turakhia |
| **Node.js** | Server's installed version |
| **PM2 Instances** | 1 (fork mode) |

### Deploy Command (for updates)

**Always use the safe deploy script:**
```bash
bash deploy.sh
```

This script:
1. Backs up `data.db` on the server with a timestamp (e.g. `data.db.bak.20260407_180000`)
2. Pushes to GitHub
3. Pulls on server
4. Builds
5. Restarts PM2

**NEVER** delete `data.db` on the server. If you need to restore:
```bash
# From timestamped backup:
ssh nuremberg "cd /var/www/nt-metals && cp data.db.bak.TIMESTAMP data.db && pm2 restart nt-metals"

# From seed SQL (last resort — loses any data added since the dump):
ssh nuremberg "cd /var/www/nt-metals && sqlite3 data.db < seed-backup.sql && pm2 restart nt-metals"
```

### Database Migration System

The app uses a **versioned migration system** (in `src/lib/db.ts`) that safely handles schema changes:

1. `CREATE TABLE IF NOT EXISTS` — creates tables only if they don't exist (fresh DB)
2. `schema_version` table — tracks which migrations have run
3. Each migration runs **once and only once** — checked by version number
4. Migrations only **add** columns — never drop, rename, or modify existing ones
5. `addColumnIfNotExists()` helper — safe even if migration runs on a DB that already has the column

**To add a new column in the future:**
```ts
// In db.ts, add to the migrations array:
{
  version: 3,
  description: "Add shipping_cost to deals",
  up: () => {
    addColumnIfNotExists(db, "deals", "shipping_cost", "REAL DEFAULT 0");
  },
},
```

This approach means: **deploy freely, the DB is never at risk.**

### Backup Files
- `seed-backup.sql` — full SQL dump in the repo (61 deals, 61 payments, 4 prices). Can recreate demo data from scratch.
- `data.db.bak.*` — timestamped backups on the server, created by `deploy.sh`

---

## Data Bridge — Getting Real Data Into The Dashboard

### The Infrastructure Reality

```
Mumbai Office (Staff)  ──VPN──>  Dubai Server (Software + Database)
                                        │
                                        │  Data lives HERE
                                        │
                               Nuremberg Server (Our Dashboard — nt.areakpi.in)
```

- Staff work from **Mumbai**, connected to **Dubai server** via VPN
- All data (deals, payments, reports) lives on the **Dubai server**
- Niyam is **protective of the Dubai server** — reluctant to give direct access
- His current software is likely a **Windows application** (VB6/.NET era)
- Database is probably: **MS Access**, **SQL Server Express**, or **flat/proprietary files**
- The software has **backup/restore** — the backup reveals the database type
- Unlikely to have an API

### Data Bridge Options (Ranked by Practicality)

#### Option 1: Staff Exports Excel Daily (START HERE)
- Staff already uses the software daily via VPN from Mumbai
- At end of day (or twice a day): Export → Excel from the software
- Upload the Excel to our dashboard (drag & drop on `/upload` page)
- Or: save to a shared folder on Dubai server, our script picks it up

| Pros | Cons |
|------|------|
| Zero installation on Dubai server | Not real-time |
| Staff already knows how to export | Manual step — staff might forget |
| Gets him using the dashboard immediately | Need a sample Excel to build the parser |
| Lowest friction to start | |

**This is Phase 1 of real data.** Gets him addicted to seeing his numbers daily.

**What we build:** `/upload` page — drag & drop Excel, parser maps columns to our deals/payments tables. Need a sample export from his software first.

#### Option 2: Read-Only Script on Dubai Server (THE GOAL)
- Install a small Python/Node script on the Dubai server
- Runs as a Windows service, reads database every 15-30 min
- POSTs JSON to `https://nt.areakpi.in/api/import`
- Read-only — never writes to his database

| Pros | Cons |
|------|------|
| Fully automatic | Needs one-time install on Dubai server |
| Near real-time (15-30 min) | He's protective of that server |
| Staff does nothing — just works | Need to identify database type first |

**How to pitch it:** "We install a small read-only program on your server. It only reads data, never writes. Like a CCTV camera for your data — you see everything, nothing is touched."

**What we build:** Small Windows service/script (Python + pyinstaller or Node + pkg). Reads his DB schema, extracts deals/payments, pushes to our API. Runs as scheduled task or Windows service.

#### Option 3: VPN Access for Our Script
- Niyam gives us VPN credentials (read-only user)
- Our script on Nuremberg connects to Dubai via VPN
- Reads the database directly over the VPN tunnel

| Pros | Cons |
|------|------|
| No installation on Dubai server | He's reluctant to give access |
| We control the script entirely | VPN from external server is a harder sell |
| | Network latency Dubai→Nuremberg |

#### Option 4: Backup File Parsing
- His software creates backups (he mentioned backup/restore for admins)
- Staff uploads backup file, or saves to a shared location
- We parse the backup to extract data

| Pros | Cons |
|------|------|
| Uses existing backup workflow | Backups may be weekly, not daily |
| No new software on server | Not real-time |

#### Option 5: WhatsApp Business Bot
- Parse "lock" messages from real WhatsApp automatically
- Captures new deals as they happen (real-time for NEW deals)
- Doesn't solve historical data or existing software data

| Pros | Cons |
|------|------|
| Real-time for new deals | Only captures WhatsApp deals, not all data |
| Already demo'd and built | Need WhatsApp Business number + BSP |
| | Doesn't replace the Excel/DB bridge for full data |

### Recommended Phased Approach

```
Week 1-2 (After contract):
  └── Staff exports Excel daily → uploads to /upload page
      Gets him using the dashboard with REAL data immediately

Week 3-4:
  └── Get VPN login, explore the Dubai server
      Find the database file, understand the schema
      Identify: MS Access? SQL Server? Flat files?

Month 2:
  └── Build read-only sync script for Dubai server
      Install as Windows service
      Data syncs every 15-30 min automatically
      Niyam sees near-real-time MIS

Month 3+:
  └── Add WhatsApp Business bot for new deal capture
      Real-time lock detection from actual WhatsApp messages
      Combined: DB sync for historical + WhatsApp for live deals
```

**Key strategy:** Start with Excel export (easy, no risk) to get him addicted to the dashboard. Once he sees the value daily, he'll happily give server access to make it automatic.

---

## Phases

### Phase 1: Demo (COMPLETE)
- MIS dashboard with real-time portfolio, profit, stock tracking
- Live price ticker in header (4 metals, 4 decimal places)
- Mobile-first design with bottom nav + settings gear + logout
- PIN lock screen (639263, 365-day cookie session)
- **Demo Mode:** Start Demo button on dashboard seeds 50kg opening stock per metal, runs 25 WhatsApp chats (8 sells to HK, 12 buys from UAE, 3 walk-aways, 2 already in old scripts). Sells fire first (stock depletes), buys staggered at 2-5 minutes (stock replenishes). Low stock warning (<5kg) with red alert. All deals profitable. 10-minute auto-stop.
- **Real-time updates:** Dashboard, Stock In Hand, Funds Received all poll every 3 seconds + instant refresh via dealTick context when deals lock
- WhatsApp chat simulator with lock detection + text parsing for manual messages
- Locked deals auto-capture with buyer type: Individuals→HKD, Banks→USD, Crypto Exchanges→USDT
- **Funds Received from HK:** Per-currency cards with FX rates. "Transfer to Dubai Account" button → 2s spinner → ADCB bank receipt showing AED conversion with reference number
- Purchase form with refining calculations (AED). Sale form with loss warning.
- Delivery & Payment module (3 tabs: Deliveries, Received, Settlement)
- Data source selector in Settings (Excel Upload, Live Data Bridge, Scheduled Export, VPN Access — each with pros/cons)
- Deal toast notifications on any page when deals lock
- Floating demo indicator ("X locked | Y live") visible on all pages
- Weekly P&L bar chart (Recharts)
- Nav badges (deal count on Deals tab, contact count on Chats tab)
- **Reset All Data:** Clears everything to zero (0 positions, 0 deals). Start Demo seeds opening stock.
- Deployed at https://nt.areakpi.in

### WhatsApp Bot (Niyam's Priority — Quote Expected)

Niyam asked to start WhatsApp automation on April 9 (1 hour after demo). He provided 2 real WhatsApp chat exports. His business runs on **WhatsApp Business**. He expects a formal quote.

#### What We Analyzed
- **Chat 1 (SAPAN-HK):** 301 lines, silver deals, 28 images. 3 deals extracted (2 locked, 1 cancelled).
- **Chat 2 (Tak Fung Gold/PD/USDT):** 16,560 lines, gold + palladium deals, 3,259 images. 60 deals extracted.
- **Full analysis:** docs/chat-analysis.md

#### Image Types Found in Chats
- **USDT payment confirmations** (TronScan/Tether) — amount, sender/receiver wallet, tx hash, date
- **Physical metal photos** — silver balls, gold bars with weight labels
- **HKD cash photos** — banknotes for delivery fees
- **Weighing/bar list photos** — scale readings, serial numbers
- **Compliance documents** — Account opening forms, KYC

#### Bot Quote Structure (3 Phases)

| Phase | Feature | Description | Timeline |
|-------|---------|-------------|----------|
| **Bot Phase 1** | Chat Parser | Read WhatsApp text, extract deals, classify buy/sell/locked/cancelled. Bot tab. **Built and tested — 63 real deals extracted.** | Done |
| **Bot Phase 2** | Image Reader | Read payment screenshots (USDT amounts, wallets, tx IDs), match to deals. Bilingual (EN + CN). | 2-3 weeks |
| **Bot Phase 3** | Auto-Negotiator | AI replies to buyers, negotiates within price boundaries, locks deals. 24/7. | 4-6 weeks |

#### Key Findings From Real Chats
- **15+ participants** across 2 groups. Roles: Dealer, Trader, Calculator (Gusini), Treasury, Logistics.
- **Languages:** 65-85% English, 15-30% Chinese. Bot needs bilingual.
- **Price:** Spot + premium (silver: "+1"). Fix +/- discount (gold: "-4", "-0.2%"). Per troy ounce.
- **Formula:** `(price ± premium) / 31.1035 * weight_grams = USDT_amount`
- **Lock keywords:** "Locked", "鎖價". Payment: USDT on TRC-20 (Tron). Wallets rotate.
- **Metals:** Gold (XAU), Silver (balls/珠子), Platinum (PT), Palladium (PD)
- **"k" = kg** (10k = 10kg = 10,000g). "LB" = London bar (~12.5kg).
- **OroSoft** = their existing ERP (Mumbai-based, AWS-hosted). May have API access.

### Phase 2: Real WhatsApp Integration (NEXT)
Connect the demo to real WhatsApp messages:

1. **WhatsApp Business API** via a BSP (Business Solution Provider):
   - **Recommended: WATI** (popular in India/Dubai, good pricing) or **Twilio**
   - Register a WhatsApp Business number
   - Webhook fires on every incoming message → hits our `/api/whatsapp` endpoint
   - Our lock detection logic is already built — works identically with real messages
   - Cost: ~$0.005-0.05 per conversation/day

2. **Alternative: WhatsApp Business Cloud API** (direct from Meta):
   - Free tier: 1,000 conversations/month
   - More setup work but zero recurring cost for low volume

3. **What needs to change in our code:**
   - Add webhook verification endpoint (`GET /api/whatsapp/webhook` for Meta's challenge)
   - Add webhook receiver (`POST /api/whatsapp/webhook` to receive real messages)
   - Map WhatsApp phone numbers to contact names
   - Everything else (lock detection, deal creation, dashboard display) works as-is

### Phase 3: AI Negotiation Bot (FUTURE)
An AI-powered sales agent that negotiates precious metal deals automatically on WhatsApp:

#### How It Works
```
Buyer messages on WhatsApp: "What's your price for 1kg 24K gold?"
        │
  WhatsApp Business API webhook
        │
  Our server → AI Agent (Claude/GPT) checks:
  ├── Inventory: Do we have 1kg gold? Yes
  ├── Floor price: $2,338/oz (London Fix + minimum margin)
  ├── Opening offer: $2,345/oz (markup for negotiation room)
        │
Bot replies: "1kg 24K gold available at $2,345.00/oz"
        │
Buyer: "Too high. I can do $2,335."
        │
  AI Agent: $2,335 is BELOW floor → counter above floor
        │
Bot: "Best I can do is $2,340.50/oz for 1kg."
        │
Buyer: "Deal. Lock it."
        │
  AI detects "lock" → creates deal → updates inventory
        │
Bot: "Locked. 1 Kg 24K Gold at USD 2340.5000."
```

#### Configuration (Settings Page)
| Setting | Example |
|---------|---------|
| Available inventory | Gold: 2kg, Silver: 7kg, Platinum: 500g |
| Floor price per metal | London Fix + minimum margin % |
| Opening markup | 0.3% above floor (negotiation room) |
| Negotiation style | Aggressive / Moderate / Flexible |
| Max rounds before "final offer" | 3 counter-offers |
| Auto-lock or human approval | Auto for small deals, ping Niyam for large |
| Deal size limit | Above X kg → "let me check with my team" |
| Languages | English, Hindi, Arabic |

#### Safeguards
- **Hard floor price** — bot cannot agree below it, ever
- **Inventory lock** — once negotiating, quantity is reserved (no double-selling)
- **Human override** — Niyam or staff can take over any conversation
- **Deal size limits** — large deals escalate to human
- **Full audit trail** — every message and price quote logged (already built)

#### Tech
- **Claude API** or GPT-4 as negotiation brain (system prompt with inventory, prices, rules)
- **WhatsApp Business API** for communication (Phase 2 prerequisite)
- **Our existing dashboard** for inventory, deal capture, monitoring
- Cost: ~$0.01-0.05 per negotiation conversation in API calls

### Phase 4: Full Product
- Connect to Niyam's real data (whichever access method he agrees to)
- Multi-user (Niyam + staff roles)
- Refining tracker (scrap in → pure out, yield tracking)
- HK factory inventory tracking (12KG brick → 1KG bars)
- Historical analytics and trends
- Alerts (daily loss exceeds threshold, large settlement pending)
- Live London Fix prices (goldapi.io integration — toggle already built)
- Export to PDF/Excel
- Mobile app or PWA

---

## Demo Strategy & Timing

### Timeline
- **2026-04-07 (Monday):** Met Niyam 10:00-11:30 AM at Gymkhana. Understood his business. Demo built same day.
- **2026-04-07 evening:** Sent WhatsApp: "Niyam bhai, great meeting today. I understood your business well. My team and I will work on something and get back to you in a few days."
- **2026-04-08 (Tuesday):** Niyam confirmed: "Sure". Continued polishing the demo. Rebranded to PrismX (his company name).
- **2026-04-09 (Wednesday):** Demo at Niyam's Matunga office, Mumbai.

### Demo Outcome (April 9)
- **Positive.** Niyam was evaluating Ashish as a person more than the software — watching the presenter, not the screen. This is typical for a Kutchi businessman — trust in the person first.
- **Asked for the app link (nt.areakpi.in) and PIN (639263)** — wants to explore himself or show his Dubai team.
- **"We will meet at Gymkhana again"** — wants to continue the conversation informally.
- **Asked if Ashish is ready to come to Dubai** — strong buying signal. Wants to show the actual operation (server, software, staff workflow).
- **Did NOT discuss pricing** — as planned. Let the app do the talking.

### What Happens Next
- **Don't chase him.** He has the app. Let him play with it.
- **Keep nt.areakpi.in live and working** — he or his Dubai team may check it anytime.
- **Gymkhana meeting** — when he initiates, go casual. Tea and talk. No documents.
- **Dubai trip** — this is where the contract closes. See the server, the existing software, the staff workflow. Understand the data bridge requirement firsthand.
- **Don't send the proposal document** unless he asks — let the app speak.
- **If someone from Dubai contacts you** about the app — that's the buying signal. He showed it to his team.

### Earlier Strategy (Pre-Demo)
#### Why We Waited 2 Days
- "Too fast = too cheap" — if he knows it took half a day, he'll negotiate the price down hard
- "My team and I" sets the perception of serious effort
- He needed time to sit with his pain (weekly reports, no visibility) before seeing the solution
- Anticipation made the demo more impressive

### Demo Flow (8-10 minutes)

**Before Niyam arrives:**
1. Settings → Reset All Data (everything goes to zero)
2. Back to Dashboard — confirm 0 positions, $0 profit, empty

**When ready:**
1. **PIN pad** → "This is secured, only you can access it" (639263)
2. **Dashboard** → "This is your MIS. Right now it's empty — let me start the day."
3. **Tap Start Demo** → Stock appears (50kg each metal). "You start the day with this inventory."
4. **Watch the dashboard** → "Your staff is on WhatsApp negotiating with buyers in Hong Kong."
   - WhatsApp Deals section shows: "3 negotiating" → "1 locked" → numbers grow
   - Today's Profit ticks up with each sale
   - Stock In Hand goes DOWN as sells happen
   - Toast notifications slide in: "Deal Locked — Mr. Chang, 10kg Gold"
5. **Scroll down** → "Funds are coming in — HK Dollars from individuals, US Dollars from banks, USDT from crypto exchanges."
   - Funds Received section shows growing HKD/USD/USDT amounts with FX rates
6. **Tap Transfer to Dubai Account** → Spinner → ADCB bank receipt: "AED 5.9M received. That's your money in your bank."
7. **Stock drops low** → "See? Platinum is at 3kg — that's low. Your staff is already buying to replenish."
   - Red LOW warning appears, then buy deals start locking
8. **Go to Stock In Hand tab** → "Tap Gold — see every lot, purchase price, where it is"
9. **Go to WhatsApp tab** → "Here are all the conversations. See the negotiations happening."
10. **Go to Purchase & Sales** → "Your staff can also enter deals manually here. Refining costs calculated."
11. **STOP.** Let him ask questions.

**Key moments to point out:**
- Stock going down with sells, up with buys (real-time)
- Low stock warning appearing
- Toast notifications on any page
- Funds building up in 3 currencies
- The ADCB bank receipt (money in his bank)
- Everything updates without refreshing — live data

### What NOT To Do In The Demo
- Don't explain the technology (Next.js, SQLite, etc.) — he doesn't care
- Don't show Settings page — that's internal
- Don't quote a price — say "I'll send you a proposal with phases"
- Don't show it on desktop — show on YOUR phone (that's how he'll use it)
- Don't demo for more than 7 minutes — leave him wanting more

### After The Demo
- Say: "This is Phase 1 — the view layer. Phase 2 connects to your real data. Phase 3 adds the AI bot that negotiates deals automatically."
- Don't quote a price. Say: "I'll send you a detailed proposal tomorrow."
- **ASK THESE QUESTIONS** (critical for pricing and data bridge):
  1. "What software do you use for daily entries?" (get the name and version)
  2. "Can your staff export to Excel?" (most software has this)
  3. "Where does the backup go?" (reveals the database type)
  4. "How quickly do you need to see new deals — real-time, every 30 minutes, or daily?"
  5. "What do you pay for the current software?" (anchors his budget expectation)

### Before The Demo (Polish Checklist)
- [ ] Test every screen on mobile (your phone)
- [ ] Reset data fresh (Settings → Reset All Data)
- [ ] Start chat simulator, let it run through all scripts, verify locked deals appear correctly
- [ ] Practice the 5-7 minute flow above at least twice
- [ ] Make sure PIN works (639263)
- [ ] Check that price ticker shows all 4 metals properly
- [ ] Verify Stock In Hand drill-down works (tap metal → see lots → back)

---

## Pricing Guidance

### Reality Check
- Niyam already pays for software that handles daily entries + trial balance + reports
- He considers his current software "expensive" — so his budget expectation is LOW
- Our dashboard is a **view layer / add-on** to his existing system — not a replacement
- The hard part (and our differentiator) is the **data bridge** — getting data out of his software into our dashboard
- Rs 3-5L for an add-on dashboard is likely too high for him
- **Don't quote in the demo meeting.** Ask the 5 questions above first.

### His Current Software (Unknown — Find Out)
- Likely a Windows-based application (VB6/.NET era)
- Probably uses: SQL Server Express, MS Access (.mdb/.accdb), or flat files
- Has backup/restore for admins — the backup reveals the database type
- Unlikely to have an API — we'll need to build a data bridge
- Could be: Tally (has XML API), Busy, Marg, or custom software

### Data Bridge Options
| Approach | Complexity | How it works |
|----------|-----------|-------------|
| **Excel/CSV export** | Easiest | Staff exports daily, we import. Semi-manual. |
| **Read database directly** | Medium | If MS Access or SQL Server, connect read-only. Need to identify the DB file on his Dubai server. |
| **Watch backup folder** | Medium | His software backs up regularly. We parse the backup file automatically. |
| **Screen scrape / OCR** | Hard | If software is proprietary with no data access at all. Last resort. |
| **Parallel entry** | Easiest but annoying | Staff enters in both systems. He won't like this long-term. |

**Recommendation:** First identify the software and database. Then pick the easiest bridge.

### Revised Pricing Options

| Option | Setup | Monthly | What he gets |
|--------|-------|---------|-------------|
| **A. Dashboard + manual sync** | Rs 50K-1L | Rs 5-10K/month | Dashboard works, staff exports Excel daily, we import |
| **B. Dashboard + auto data bridge** | Rs 1.5-2.5L | Rs 10-15K/month | Fully automatic MIS — data syncs from his software |
| **C. Full system replacement** | Rs 5-8L | Rs 15-25K/month | Replace his current software entirely + dashboard |

**Recommended pitch: Option B** — this is where the value is. The data bridge is the moat. Once you crack his data, he's locked into your service. Monthly recurring is better than one-time.

### Pitch Strategy
- Show demo (free — this is the hook)
- Quote Option A as the "starter" (low barrier)
- Recommend Option B as the "real solution"
- Mention Option C only if he's frustrated with his current software
- The monthly fee is key — positions this as a service, not a one-time project
- "I maintain the system, keep it updated, add features" justifies the monthly

## Key Selling Points

1. **MIS in real-time:** "You see what your staff sees — but summarized, live, on your phone." Weekly → real-time.
2. **WhatsApp integration:** Deals captured automatically the moment "lock" is typed — zero manual entry, zero delay.
3. **AI negotiation bot (future):** A tireless salesman who knows your exact margins, never makes a mistake, and handles all buyer negotiations automatically.
4. **Real prices, real positions:** London Fix ticking in the header + open positions = exposure at a glance.
5. **Multi-currency treasury view:** USD, HKD, AED, USDT — all money flows in one place.
6. **Nothing changes for staff:** They keep using the same software. This is a view layer on top — zero disruption.
7. **SEBI credential:** "I built surveillance systems for SEBI India" — financial domain trust.
8. **Proximity:** You're at Gymkhana daily. Support is a conversation away.
9. **Privacy:** Data stays on HIS infrastructure. We're building the MIS view, not touching his core system.

---

## Actual File Structure (as built)

```
niyam turakhia gold/
├── PROJECT-PLAN.md
├── package.json                    (nt-precious-metals-mis)
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── data.db                         (SQLite — gitignored)
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   ├── 2026-04-07-precious-metals-mis-dashboard-design.md
│       │   └── 2026-04-07-whatsapp-bot-design.md
│       └── plans/
│           ├── 2026-04-07-precious-metals-mis.md
│           └── 2026-04-07-whatsapp-bot.md
└── src/
    ├── app/
    │   ├── layout.tsx              (root layout: AuthGate → SidebarNav + PriceTicker + BottomNav)
    │   ├── page.tsx                (dashboard: P&L cards + LockedDeals + recent activity)
    │   ├── globals.css             (Tailwind v4, dark theme, overflow-x:hidden)
    │   ├── stock/page.tsx          (stock in hand: metal cards → drill-down lots)
    │   ├── deals/page.tsx          (deal form + list + LockedDeals)
    │   ├── whatsapp/page.tsx       (chat simulator: contacts + thread + Start/Stop toggle)
    │   ├── money-flow/page.tsx     (multi-currency settlements)
    │   ├── reports/page.tsx        (period P&L: daily/weekly/quarterly/yearly)
    │   ├── settings/page.tsx       (price toggle + data reset)
    │   └── api/
    │       ├── auth/route.ts       (PIN verify + session cookie + logout)
    │       ├── prices/route.ts     (GET prices + auto-seed)
    │       ├── deals/route.ts      (GET/POST deals with filtering)
    │       ├── payments/route.ts   (GET/POST payments)
    │       ├── whatsapp/route.ts   (GET/POST messages + lock detection + deal creation)
    │       ├── simulator/route.ts  (POST reset)
    │       ├── deliveries/route.ts (GET/POST deliveries to HK)
    │       └── settlements/route.ts (GET/POST settlements HK→Dubai)
    ├── components/
    │   ├── auth-gate.tsx           (session check → PIN pad or app)
    │   ├── pin-pad.tsx             (6-digit numeric keypad)
    │   ├── price-ticker.tsx        (sticky header: 4 metals + logout)
    │   ├── sidebar-nav.tsx         (desktop nav: 6 items + settings + logout)
    │   ├── bottom-nav.tsx          (mobile nav: 5 tabs)
    │   ├── stat-card.tsx           (reusable KPI card)
    │   ├── purchase-form.tsx       (buy form with refining calculations)
    │   ├── sale-form.tsx           (sell form with loss warning)
    │   ├── deal-form.tsx           (legacy form, used by WhatsApp API)
    │   ├── stock-detail.tsx        (lot drill-down with status badges)
    │   ├── contact-list.tsx        (WhatsApp contacts with LOCKED badge)
    │   ├── chat-thread.tsx         (chat bubbles + lock highlighting + input)
    │   ├── locked-deals.tsx        (WhatsApp Deals section: negotiating + locked)
    │   ├── demo-engine.tsx        (React Context: global demo simulator engine)
    │   ├── demo-mode.tsx          (Start/Stop button + stats panel)
    │   ├── demo-indicator.tsx     (floating "X locked | Y live" pill)
    │   ├── funds-received.tsx     (HK funds by currency + Transfer to Dubai button + ADCB receipt)
    │   └── deal-toast.tsx         (slide-in lock notification on any page)
    └── lib/
        ├── types.ts                (Deal, Payment, Price, WhatsAppMessage, WhatsAppContact, constants)
        ├── db.ts                   (SQLite singleton, schema init, migrations)
        ├── prices.ts               (demo prices + goldapi.io live fetch)
        ├── calculations.ts         (stock summary, P&L, weighted avg cost)
        ├── sample-data.ts          (3-day seeder: deals + payments)
        ├── chat-scripts.ts         (ChatScript interface + original 5 scripts)
        └── demo-scripts.ts         (25 demo contacts with buyer types, payment currencies, staggered delays)
```
