# Niyam Turakhia — Precious Metals MIS Dashboard

## Client
- **Name:** Niyam Turakhia (Kutchi businessman, Matunga Gymkhana)
- **Business:** Precious metals dealing (gold, silver, platinum, palladium) — Dubai + Hong Kong operations
- **Contact:** WhatsApp (connected via Ashish's Gymkhana network)

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
| **Dashboard** | `/` | Today's P&L cards (Buys, Sales, Stock Value, Unrealized P&L), WhatsApp Locked Deals section, recent activity feed |
| **Stock In Hand** | `/stock` | Per-metal summary cards (total grams, avg cost, market value, unrealized P&L, location badges). Tap any metal → drill-down to individual lots with purchase date, purity, qty, status |
| **Deals** | `/deals` | Deal entry form + transaction list. WhatsApp Locked Deals section at top. Mobile: stacked cards. Desktop: full table |
| **WhatsApp** | `/whatsapp` | Simulated WhatsApp chat interface with 5 pre-built contacts. Contact list with last message preview. Chat thread with message bubbles. "Start Chats" toggle to simulate negotiations. Lock detection highlights deals in amber. LOCKED badge on contacts |
| **Money Flow** | `/money-flow` | Multi-currency settlement overview. Total sent/received. Per-currency breakdown (USD/HKD/AED/USDT) with net position. Recent payments list |
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

#### Components Built

| Component | File | Description |
|-----------|------|-------------|
| Price Ticker | `price-ticker.tsx` | Sticky header, 2x2 mobile / 4-col desktop, 4 decimal prices, Demo/Live label. Top bar with NT Metals branding (mobile) / Live Prices label (desktop), settings gear icon + logout icon (with spacing) |
| Sidebar Nav | `sidebar-nav.tsx` | Desktop left sidebar (hidden on mobile), 6 nav items + Settings + Logout |
| Bottom Nav | `bottom-nav.tsx` | Mobile bottom tab bar (hidden on desktop), 5 tabs: Home, Stock, Deals, WhatsApp, Money |
| Auth Gate | `auth-gate.tsx` | Wraps entire app, checks session cookie, shows PIN pad if locked |
| PIN Pad | `pin-pad.tsx` | 6-digit numeric keypad with dot indicators, error feedback |
| Stat Card | `stat-card.tsx` | Reusable KPI card (Catalyst stats-with-trending pattern) |
| Deal Form | `deal-form.tsx` | Buy/sell entry form with dropdowns and number inputs |
| Stock Detail | `stock-detail.tsx` | Drill-down lot list with status badges (UAE/Refinery/Transit/HK) |
| Contact List | `contact-list.tsx` | WhatsApp contact list split into Active (top) and Locked Deals (bottom) sections. Lock icons per deal (multiple locks = multiple icons). Contacts move back to Active when new incoming messages arrive after a lock. Outgoing confirmations don't count as new activity. |
| Chat Thread | `chat-thread.tsx` | Chat bubbles with lock keyword highlighting in amber, manual message input. iOS-safe (16px font prevents Safari auto-zoom). |
| Locked Deals | `locked-deals.tsx` | Auto-refreshing card showing WhatsApp-captured deals (used on Dashboard + Deals pages) |

#### Library Modules

| Module | File | Purpose |
|--------|------|---------|
| Types | `types.ts` | All TypeScript interfaces: Deal, Payment, Price, WhatsAppMessage, WhatsAppContact, StockSummary. Constants: YIELD_TABLE, METAL_SYMBOLS, GRAMS_PER_TROY_OZ, PURE_PURITIES |
| Database | `db.ts` | SQLite (better-sqlite3) singleton. WAL mode. 6 tables: deals, payments, prices, settings, whatsapp_messages, schema_version. **Versioned migration system** — each migration runs once, tracked in schema_version table. Safe for both fresh DBs and existing ones. Never deletes data. |
| Prices | `prices.ts` | Demo prices (Gold $2,341.5678, Silver $30.2450, Platinum $982.3400, Palladium $1,024.7800). Live fetch via goldapi.io (toggle) |
| Calculations | `calculations.ts` | Stock summary, weighted avg cost, daily P&L, avg buy cost per metal |
| Sample Data | `sample-data.ts` | Seeds 3 days of realistic transactions: 10-15 buys/day + 5-8 sells/day with corresponding payments |
| Chat Scripts | `chat-scripts.ts` | 5 pre-built negotiation scripts (Mr. Chang, Karim & Co., Shah Brothers, Li Wei Trading, Patel Exports) |

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
- MIS dashboard with realistic demo data + hardcoded prices
- Live price ticker in header (4 metals, 4 decimal places)
- Mobile-first design with bottom nav
- PIN lock screen
- WhatsApp chat simulator with lock detection
- Locked deals auto-capture and display
- Deployed at https://nt.areakpi.in

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
- **2026-04-07 (Monday):** Met Niyam 10:00-11:30 AM at Gymkhana. Demo built same day.
- **2026-04-07 evening:** Sent WhatsApp: "Niyam bhai, great meeting today. I understood your business well. My team and I will work on something and get back to you in a few days."
- **2026-04-09 or 2026-04-10 (Wed/Thu):** SHOW THE DEMO. Don't show earlier — he'll think it was too easy and undervalue the work.
- **Day after demo:** Send phased proposal (don't quote in the demo meeting).

### Why Wait 2-3 Days
- "Too fast = too cheap" — if he knows it took half a day, he'll negotiate the price down hard
- "My team and I" sets the perception of serious effort
- He needs time to sit with his pain (weekly reports, no visibility) before seeing the solution
- Anticipation makes the demo more impressive

### Demo Flow (5-7 minutes, then STOP)

1. **PIN pad** → "This is secured, only you can access it"
2. **Dashboard** → "This is your daily MIS — live, right now"
3. **Price ticker** → "London Fix prices, real-time. Gold, Silver, Platinum, Palladium"
4. **Stock In Hand** → "Your entire inventory across UAE and HK. Tap gold to see every lot"
5. **WhatsApp tab** → Start Chats → "Watch — your staff is negotiating deals on WhatsApp"
6. **Lock happens** → "See? Mr. Chang just locked 10kg gold. Deal captured automatically. Zero manual entry."
7. **Back to Dashboard** → "The locked deal is already here on your main screen"
8. **Money Flow** → "All your currencies — USD, Dirham, HKD, USDT — one view"
9. **STOP.** Don't oversell. Let him ask questions.

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
    │       └── simulator/route.ts  (POST reset)
    ├── components/
    │   ├── auth-gate.tsx           (session check → PIN pad or app)
    │   ├── pin-pad.tsx             (6-digit numeric keypad)
    │   ├── price-ticker.tsx        (sticky header: 4 metals + logout)
    │   ├── sidebar-nav.tsx         (desktop nav: 6 items + settings + logout)
    │   ├── bottom-nav.tsx          (mobile nav: 5 tabs)
    │   ├── stat-card.tsx           (reusable KPI card)
    │   ├── deal-form.tsx           (buy/sell entry form)
    │   ├── stock-detail.tsx        (lot drill-down with status badges)
    │   ├── contact-list.tsx        (WhatsApp contacts with LOCKED badge)
    │   ├── chat-thread.tsx         (chat bubbles + lock highlighting + input)
    │   └── locked-deals.tsx        (auto-refreshing WhatsApp deal cards)
    └── lib/
        ├── types.ts                (Deal, Payment, Price, WhatsAppMessage, WhatsAppContact, constants)
        ├── db.ts                   (SQLite singleton, schema init, migrations)
        ├── prices.ts               (demo prices + goldapi.io live fetch)
        ├── calculations.ts         (stock summary, P&L, weighted avg cost)
        ├── sample-data.ts          (3-day seeder: deals + payments)
        └── chat-scripts.ts         (5 negotiation scripts for WhatsApp simulator)
```
