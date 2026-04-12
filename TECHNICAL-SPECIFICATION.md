# PrismX — Technical Specification

**Reference document for PrismX (Niyam Turakhia precious-metals MIS).** Companion to [`PROJECT-PLAN.md`](PROJECT-PLAN.md). The plan doc is the narrative (what shipped, why, in what order); this doc is the lookup (schemas, routes, components, architecture, deployment).

**Last updated:** 2026-04-12 (Phase C)
**Live at:** https://nt.areakpi.in
**Repo:** https://github.com/ashishkamdar/niyam_turakhia

**Maintenance rule:** Every feature ship, schema migration, or architectural change must update BOTH this doc and `PROJECT-PLAN.md` in the same commit. See `feedback_maintain_docs.md` in memory for the rationale.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Database Schema](#4-database-schema)
5. [Migration System](#5-migration-system)
6. [API Surface](#6-api-surface)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Financial Year Model](#8-financial-year-model)
9. [Concurrency Model](#9-concurrency-model)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Theme System](#11-theme-system)
12. [WhatsApp Integration](#12-whatsapp-integration)
13. [Dispatch Pipeline](#13-dispatch-pipeline)
14. [Deployment & Operations](#14-deployment--operations)
15. [Known Limitations](#15-known-limitations)

---

## 1. Overview

PrismX is a real-time Management Information System (MIS) for a precious-metals trading business. It ingests WhatsApp-based deal "lock codes" from operator phones, routes them through a maker-checker review pipeline, and dispatches approved trades to downstream accounting systems (OroSoft Neo for Pakka deals, SBS Excel for Kachha deals). It also provides dashboards for stock-in-hand tracking, FY-scoped trade registers, role-based user management, and concurrent-operator coordination.

**Audience:** A bullion trading desk with 10-15 concurrent operators — 2-3 admins (Niyam, Ashish) + staff placing/reviewing trades. The app is designed mobile-first for field staff and desktop-friendly for admin work.

**Deployment target:** Self-hosted on a VPS (`nuremberg`), behind nginx + Let's Encrypt, run under PM2 fork-mode. Not cloud-native — there is no Vercel, no Kubernetes, no managed Postgres. SQLite + Node.js + PM2 is the entire runtime stack.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 16.2.2 | App Router, TypeScript strict, Turbopack dev |
| Runtime | Node.js | (server default) | Single PM2 fork-mode instance |
| Language | TypeScript | 5.x | `strict: true` throughout |
| Styling | Tailwind CSS | v4 | `@import "tailwindcss"`, class-based dark variant |
| Database | SQLite | (via better-sqlite3 12.x) | WAL mode, single-file `data.db` |
| UI Kit | Catalyst Tailwind blocks | — | Dark theme palette, StatCard pattern |
| Charts | Recharts | — | Only used on the Demo dashboard (weekly P&L bar chart) |
| Auth | Cookie-based session | — | `nt_session` cookie, 365-day `maxAge` |
| IDs | UUID v4 | `uuid` package + `crypto.randomUUID()` | All PKs except seed PINs + settings keys |
| OCR | Tesseract.js | 5.x | Local binary via `execFileSync`, 3-pass fallback (eng → eng+chi+ara → digits-only) |
| Process Manager | PM2 | — | Fork mode, 1 instance, process name `nt-metals` |
| Reverse Proxy | nginx | — | Port 3020 upstream → HTTPS via certbot |

**Deliberate omissions:**
- No Redis/Memcached — in-memory state lives in Node module-scoped variables (ignored-messages ring buffer, orphaned-attachments buffer), safe because PM2 is single-instance fork mode.
- No ORM — raw SQL via better-sqlite3's prepared statements. Prepared statements are cached by better-sqlite3 itself.
- No Vercel — see `feedback_no_vercel.md` in memory. The vercel-plugin hook fires false positives on unrelated keywords; ignore all `vercel:*` skill suggestions.
- No WebSockets/SSE — concurrency coordination uses the dispatch lock + 2-second polling. See [§9](#9-concurrency-model).
- No Docker — deployed as a raw Node.js app managed by PM2. The `deploy.sh` script is the entire CI/CD.

---

## 3. Architecture

### Process Model

```
                         ┌──────────────────────────┐
                         │ Meta WhatsApp Cloud API   │
                         │ (inbound webhook target)  │
                         └────────────┬──────────────┘
                                      │
                                      │ HTTPS
                                      ▼
                         ┌──────────────────────────┐
        Users ─── HTTPS ▶│          nginx           │
        (browsers)       │ (:443, Let's Encrypt)    │
                         └────────────┬──────────────┘
                                      │
                                      │ HTTP :3020
                                      ▼
                         ┌──────────────────────────┐
                         │   PM2 fork-mode process  │
                         │   Next.js 16 / Node.js   │
                         │   process name:          │
                         │   nt-metals (single)     │
                         └────────────┬──────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
                  ┌─────────────┐         ┌─────────────────┐
                  │ SQLite WAL  │         │ Node.js memory  │
                  │ data.db     │         │ (ignored msgs,  │
                  │             │         │  orphan buffer) │
                  └─────────────┘         └─────────────────┘
```

**Key properties:**

1. **Single Node process.** PM2 runs 1 fork-mode instance, so all requests funnel through the same process. No cross-instance concurrency issues, no need for distributed locks or shared caches.
2. **All writes serialize.** `better-sqlite3` is synchronous — every `db.prepare(...).run(...)` runs to completion before the next one starts. Two concurrent API handlers can never interleave their writes mid-transaction.
3. **Webhook isolation.** Meta posts to `/api/whatsapp/webhook`. The handler parses and inserts into `pending_deals` synchronously; the `/review` page polls and picks up the new row on its next 3-second tick.
4. **No background workers.** There are no cron jobs, no bull queues, no setInterval timers running server-side. Everything is request-driven. Stock opening roll-forward, session sweep, dispatch lock expiry — all happen lazily inside GET handlers.

### Request Flow (illustrative)

**Inbound deal:**
```
Operator phone → WhatsApp → Meta Cloud API → POST /api/whatsapp/webhook
  → parseDealCode() → insert pending_deals (status=pending)
  → /review page (polling 3s) → render new card
  → checker clicks Approve → POST /api/review/[id] {action:"approve"}
  → UPDATE pending_deals SET status='approved'
  → /outbox page (polling 4s) → shows in queue
```

**Outbound dispatch:**
```
Checker clicks "Send all to OroSoft" on /outbox
  → POST /api/dispatch {target:"orosoft"}
  → readLock() → any lock held by another user? → 409 if yes
  → writeLock({started_by, target, deal_count, expires_at: now+3000ms})
  → UPDATE pending_deals SET dispatched_at=now, dispatched_to='orosoft', dispatch_batch_id=...
  → return {ok:true, batch_id, deals, lock}
  → client animates 2-second staged pipeline → flip to "done" state
  → other operators' DispatchBanner polls /api/dispatch
  → sees lock from another user → renders pulsing strip for ≤3 seconds
  → lock expires → next GET clears it → banner disappears
```

### File Structure (key directories)

```
src/
├── app/
│   ├── layout.tsx                   # Root layout: ThemeProvider > AuthGate > FyProvider > DemoProvider
│   ├── globals.css                  # Tailwind import + .light palette override + print rules + animations
│   ├── page.tsx                     # Dashboard (Demo/Live toggle)
│   ├── deals/page.tsx               # Deals (Demo/Live with FY + Kachha/Pakka filters)
│   ├── stock/page.tsx               # Stock (Demo/Live with Opening Stock + In Hand bar)
│   ├── outbox/page.tsx              # Dispatch outbox + animated flow visuals
│   ├── users/page.tsx               # Sessions list + PIN management
│   ├── review/page.tsx              # Maker-checker queue
│   ├── reports/page.tsx             # P&L reports with ReportLetterhead print
│   ├── whatsapp/page.tsx            # Chat simulator (compose disabled)
│   ├── settings/page.tsx            # Financial Year editor + Meta config + data source selector
│   ├── money-flow/                  # Deliveries + settlements
│   ├── bot/                         # Legacy bot archive
│   └── api/
│       ├── auth/route.ts            # POST login/logout, GET authenticated+label+role + heartbeat
│       ├── deals/route.ts           # Legacy Demo deals CRUD
│       ├── deals/live/route.ts      # FY-aware approved trades register + aggregates
│       ├── deals/live/export/route.ts  # 13-column CSV export
│       ├── stock/live/route.ts      # Per-metal stock register
│       ├── stock/live/export/route.ts  # 13-column stock CSV export
│       ├── stock/opening/route.ts   # Daily opening + today's activity + live in-hand
│       ├── dispatch/route.ts        # Outbox GET + POST + dispatch lock
│       ├── dispatch/export/route.ts # SBS 14-column Bullion Sales Order CSV
│       ├── review/route.ts          # Pending deals list with status filter
│       ├── review/[id]/route.ts     # Maker-checker approve/reject/patch
│       ├── pins/route.ts            # PIN CRUD (role-gated)
│       ├── sessions/route.ts        # Active + recent sessions + kick (role-gated)
│       ├── settings/route.ts        # Key-value settings store
│       ├── prices/route.ts          # Demo + live LBMA prices
│       ├── deliveries/route.ts      # Deliveries CRUD
│       ├── settlements/route.ts     # Settlements CRUD
│       ├── payments/route.ts        # Payments CRUD
│       ├── whatsapp/route.ts        # WhatsApp messages CRUD + outbound send (UI-disabled)
│       ├── whatsapp/config/route.ts # Meta credentials CRUD
│       ├── whatsapp/webhook/route.ts # Meta Cloud API webhook (inbound)
│       ├── screenshots/[filename]/route.ts  # Secure file serve for payment screenshots
│       ├── ocr-test/route.ts        # OCR diagnostic endpoint
│       ├── simulator/route.ts       # Reset + re-seed demo data
│       └── bot/route.ts             # Legacy bot endpoint
├── components/
│   ├── auth-gate.tsx                # Session-gate wrapper, heartbeat poll
│   ├── pin-pad.tsx                  # 6-digit click+keyboard PIN entry
│   ├── sidebar-nav.tsx              # Desktop sidebar with current user card
│   ├── bottom-nav.tsx               # Mobile 6-tab nav + More overflow sheet
│   ├── price-ticker.tsx             # Top price ticker + FY selector + theme toggle
│   ├── demo-engine.tsx              # Demo context provider
│   ├── demo-mode.tsx                # Start Demo button
│   ├── demo-indicator.tsx           # Floating demo progress pill
│   ├── deal-toast.tsx               # Slide-in deal-locked toast
│   ├── locked-deals.tsx             # Demo locked deals list
│   ├── funds-received.tsx           # HKD/USD/USDT → AED funds panel
│   ├── delivery-pipeline.tsx        # HK deliveries summary
│   ├── stock-detail.tsx             # Per-lot drill-down
│   ├── stat-card.tsx                # Catalyst-style KPI card
│   ├── purchase-form.tsx            # Demo buy entry form
│   ├── sale-form.tsx                # Demo sell entry form
│   ├── deal-form.tsx                # Legacy deal form
│   ├── contact-list.tsx             # WhatsApp contact list with active/locked split
│   ├── chat-thread.tsx              # WhatsApp chat bubbles + delivery ticks + compose (disabled)
│   ├── report-letterhead.tsx        # Shared branded header for printable reports
│   ├── fy-provider.tsx              # Financial year context + localStorage
│   ├── fy-selector.tsx              # FY dropdown
│   ├── theme-provider.tsx           # Light/dark theme context
│   ├── theme-toggle.tsx             # Sun/moon button
│   └── dispatch-banner.tsx          # Global "someone is dispatching" banner
├── lib/
│   ├── db.ts                        # SQLite singleton + schema + migrations
│   ├── types.ts                     # All interfaces + YIELD_TABLE + METAL_SYMBOLS
│   ├── prices.ts                    # Demo + live price feed
│   ├── calculations.ts              # Stock summary, weighted avg cost, P&L math
│   ├── sample-data.ts               # Demo data seeder
│   ├── chat-scripts.ts              # Chat simulator script type
│   ├── demo-scripts.ts              # 25 demo chat scripts
│   ├── deal-code-parser.ts          # #NT deal code parser (pure function)
│   ├── ignored-messages.ts          # In-memory ring buffer for non-deal texts
│   ├── orphaned-attachments.ts      # In-memory ring buffer for unmatched images
│   ├── meta-whatsapp.ts             # Meta API helpers (HMAC verify, send, download, getConfig)
│   ├── image-ocr.ts                 # Multi-provider OCR dispatcher
│   ├── financial-year.ts            # Pure FY math (deriveFy, listFinancialYears, intersectFy)
│   ├── auth-context.ts              # getCurrentUser + role helpers (canCreateRole etc.)
│   └── user-display.ts              # initialsFromLabel + role labels + accent classes
└── utils/                           # (none currently — all shared code is in lib/)

public/
├── prismx-logo.png                  # Transparent logo for sidebar / PIN pad / reports
├── icon.png                         # Favicon / PWA icon
├── apple-icon.png                   # iOS home-screen icon
└── *.svg                            # Misc static assets

data.db                              # SQLite (gitignored, on server)
screenshots/                         # WhatsApp payment screenshots (gitignored, on server)
deploy.sh                            # Backup → push → pull → build → restart
```

---

## 4. Database Schema

Single SQLite file at `data.db`, opened in WAL mode via `better-sqlite3`. Schema version is tracked in the `schema_version` table; current version is **12**. All tables use `CREATE TABLE IF NOT EXISTS` so fresh DBs get the full schema at boot, while existing DBs get column additions via the migration runner (see [§5](#5-migration-system)).

### 4.1 `deals` (legacy Demo trades)

Holds deals generated by the Home "Start Demo" button. Used by the Demo mode of `/deals`, `/stock`, `/reports`, and the Home dashboard. **Not** used by the Live views — Live data lives in `pending_deals`.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT | — | Primary key, UUID v4 |
| `metal` | TEXT | — | `gold`/`silver`/`platinum`/`palladium` |
| `purity` | TEXT | — | `18K`/`20K`/`22K`/`24K`/`995`/`999` |
| `is_pure` | INTEGER | 0 | 1 if already pure (skips refining) |
| `quantity_grams` | REAL | — | Gross grams |
| `pure_equivalent_grams` | REAL | — | After purity factor |
| `price_per_oz` | REAL | — | USD/troy oz |
| `refining_cost_per_gram` | REAL | 0 | Added by migration v2 |
| `total_cost_usd` | REAL | 0 | Added by migration v2 |
| `direction` | TEXT | — | `buy`/`sell` |
| `location` | TEXT | — | `uae`/`hong_kong` |
| `status` | TEXT | `locked` | `locked`/`pending`/`in_refinery`/`in_transit`/`in_hk`/`sold` |
| `date` | TEXT | — | ISO timestamp |
| `created_by` | TEXT | `manual` | `manual`/`whatsapp`/`simulator` |
| `contact_name` | TEXT | `''` | Added by migration v1 |

### 4.2 `payments`

Demo payments, used by `/money-flow` Demo view and Funds Received panel on Dashboard.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT | — | Primary key |
| `amount` | REAL | — | Currency-native |
| `currency` | TEXT | — | `USD`/`HKD`/`USDT`/`AED` |
| `direction` | TEXT | — | `received`/`sent` |
| `mode` | TEXT | — | `bank`/`local_dealer`/`crypto_exchange`/`cash`/`hawala` |
| `from_location` | TEXT | `''` | — |
| `to_location` | TEXT | `''` | — |
| `linked_deal_id` | TEXT | — | FK → `deals.id` |
| `date` | TEXT | — | ISO timestamp |

### 4.3 `prices`

Current and previous-close prices for the four metals. Seeded by `src/lib/prices.ts` on first GET.

| Column | Type | Default | Notes |
|---|---|---|---|
| `metal` | TEXT | — | PK, one of `XAU`/`XAG`/`XPT`/`XPD` |
| `price_usd` | REAL | — | Current mid |
| `prev_close` | REAL | — | Previous close for `change` calc |
| `change` | REAL | 0 | `price_usd - prev_close` |
| `change_pct` | REAL | 0 | `(change / prev_close) * 100` |
| `source` | TEXT | `demo` | `demo`/`live` |
| `fetched_at` | TEXT | — | ISO timestamp |

### 4.4 `settings`

Key-value store for app-wide config. Generic string-to-string.

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT | Primary key |
| `value` | TEXT | Free-form string; callers serialize JSON as needed |

**Known keys:**
- `financial_year_start` — MM-DD string, default `04-01`. Consumed by `/api/settings` GET and the FY provider.
- `dispatch_lock` — JSON `{started_at, started_by, target, deal_count, expires_at}`. See [§9](#9-concurrency-model).

### 4.5 `whatsapp_messages`

Chat history for the simulator + inbound flow. Written by the webhook on real inbound, and by the chat simulator for demo scripts.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT | — | Primary key |
| `contact_name` | TEXT | — | Free text; may match `pending_deals.sender_name` |
| `contact_location` | TEXT | — | `uae`/`hong_kong` |
| `direction` | TEXT | — | `incoming`/`outgoing` |
| `message` | TEXT | — | Body |
| `is_lock` | INTEGER | 0 | Matches `/\block\b/i` |
| `linked_deal_id` | TEXT | — | FK → `deals.id` if lock auto-created a deal |
| `timestamp` | TEXT | — | ISO |
| `wamid` | TEXT | — | Meta message id (added v12) — only populated on real outbound |
| `send_status` | TEXT | — | `sent`/`failed`/null (added v12) |
| `send_error` | TEXT | — | Meta error string on failure (added v12) |

### 4.6 `deliveries`

Shipments to HK. Migration v3.

| Column | Type | Default |
|---|---|---|
| `id` | TEXT | — |
| `linked_deal_id` | TEXT | — |
| `buyer_type` | TEXT | `firm` |
| `buyer_name` | TEXT | `''` |
| `metal` | TEXT | — |
| `weight_grams` | REAL | — |
| `shipping_cost_usd` | REAL | 0 |
| `destination` | TEXT | `hong_kong` |
| `status` | TEXT | `preparing` |
| `date` | TEXT | — |

### 4.7 `settlements`

Post-delivery payment tracking. Migration v3.

| Column | Type | Default |
|---|---|---|
| `id` | TEXT | — |
| `linked_delivery_id` | TEXT | — |
| `amount_received` | REAL | 0 |
| `currency_received` | TEXT | `USD` |
| `payment_method` | TEXT | `''` |
| `amount_sent_to_dubai` | REAL | 0 |
| `currency_sent` | TEXT | `AED` |
| `channel` | TEXT | `''` |
| `seller_paid` | TEXT | `''` |
| `seller_amount` | REAL | 0 |
| `status` | TEXT | `pending` |
| `date` | TEXT | — |

### 4.8 `schema_version`

Single-column table tracking which migrations have run.

| Column | Type |
|---|---|
| `version` | INTEGER (PK) |

### 4.9 `parsed_deals` (legacy bot)

Migration v4. Holds the output of the old free-text bot parser. Kept for the `/bot` archive view; not used by current code paths.

### 4.10 `meta_config`

Migration v5. Key-value store for Meta WhatsApp Cloud API credentials.

| Column | Type |
|---|---|
| `key` | TEXT (PK) |
| `value` | TEXT |

**Known keys:**
- `phone_number_id` — Meta phone number ID (currently `835944509608655`, Ashish's test2WattsApp test number)
- `access_token` — System User token from Business Manager
- `verify_token` — Webhook verify token (`prismx_webhook_verify`)
- `app_secret` — **Currently cleared.** HMAC signature verification is disabled until the root cause of Apr 10 failures is fixed. See Known Limitations.
- `ocr_provider` — `tesseract`/`anthropic`/`google`/`openai`
- `anthropic_api_key`, `google_api_key`, `openai_api_key` — Optional OCR provider keys

### 4.11 `pending_deals`

Migration v6 + extended by v9. **The heart of the system** — every inbound WhatsApp lock code lands here and flows through the maker-checker pipeline.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT | — | Primary key |
| `whatsapp_message_id` | TEXT | — | Meta `wamid` for reply-linking |
| `sender_phone` | TEXT | — | E.164 from Meta (e.g. `919819800214`) |
| `sender_name` | TEXT | — | Meta profile name |
| `raw_message` | TEXT | — | Full original text as received |
| `received_at` | TEXT | — | ISO timestamp (Meta-side or webhook-side) |
| `deal_type` | TEXT | — | `K` (Kachha) / `P` (Pakka) / null (unclassified) |
| `direction` | TEXT | — | `buy`/`sell` |
| `qty_grams` | REAL | — | Gross grams |
| `metal` | TEXT | — | — |
| `purity` | TEXT | — | — |
| `rate_usd_per_oz` | REAL | — | — |
| `premium_type` | TEXT | — | `absolute`/`percent` |
| `premium_value` | REAL | — | — |
| `party_alias` | TEXT | — | Free-form counterparty name |
| `parse_errors` | TEXT | — | JSON array of per-field error strings |
| `status` | TEXT | `pending` | `pending`/`approved`/`rejected` |
| `reviewed_by` | TEXT | — | PIN label of the checker |
| `reviewed_at` | TEXT | — | ISO timestamp |
| `reviewer_notes` | TEXT | — | Optional |
| `screenshot_url` | TEXT | — | `/api/screenshots/<uuid>.ext` |
| `screenshot_ocr` | TEXT | — | JSON of extracted OCR fields |
| `dispatched_at` | TEXT | — | Set by `/api/dispatch` POST (v9) |
| `dispatched_to` | TEXT | — | `orosoft`/`sbs` (v9) |
| `dispatch_response` | TEXT | — | Human-readable response string (v9) |
| `dispatch_batch_id` | TEXT | — | UUID shared by all rows in one POST (v9) |

**Indexes:**
- `idx_pending_deals_status ON (status)` — filter in /review + /outbox
- `idx_pending_deals_received ON (received_at)` — sort

### 4.12 `auth_pins`

Migration v7 + v8. Named PINs for login, replacing the single hardcoded PIN.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT | — | Primary key (seeded: `pin_niyam`, `pin_ashish`, `pin_admin`, `pin_staff`; new ones are UUIDs) |
| `label` | TEXT | — | Display name |
| `pin` | TEXT | — | 4-8 digit string |
| `role` | TEXT | `staff` | `super_admin`/`admin`/`staff` |
| `locked` | INTEGER | 0 | (v8) 1 = login refused |
| `created_at` | TEXT | — | ISO |

**Seed data (migration v7 + v11 promotion):**

| id | label | pin | role (post-v11) |
|---|---|---|---|
| `pin_niyam` | Niyam | 639263 | super_admin |
| `pin_ashish` | Ashish | 520125 | super_admin (promoted via direct SQL on Apr 12) |
| `pin_admin` | Admin | 999999 | admin |
| `pin_staff` | Staff | 111111 | staff |

**Index:** `idx_auth_pins_pin ON (pin)` — lookup on login

### 4.13 `auth_sessions`

Migration v7. One row per active/historical session. Session id is the cookie value.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT | — | Primary key, UUID v4, written to `nt_session` cookie |
| `pin_id` | TEXT | — | FK → `auth_pins.id` (ON DELETE CASCADE) |
| `ip` | TEXT | — | From `x-forwarded-for` / `x-real-ip` (nginx-set) |
| `user_agent` | TEXT | `''` | From request header |
| `created_at` | TEXT | — | Login timestamp |
| `last_seen` | TEXT | — | Updated on every GET /api/auth heartbeat |

**Indexes:**
- `idx_auth_sessions_last_seen ON (last_seen)` — active window query
- `idx_auth_sessions_pin_id ON (pin_id)` — counts per PIN

**Note:** Sessions are **never auto-swept**. Rows are only deleted by explicit logout, admin kick, or PIN cascade. The 24-hour window on `/api/sessions` is a display filter only (`WHERE last_seen >= cutoff`), never a `DELETE`. See [§7.3](#73-session-lifecycle) for rationale.

### 4.14 `stock_opening`

Migration v10. Daily opening stock per metal, with lazy roll-forward from yesterday's closing.

| Column | Type | Default | Notes |
|---|---|---|---|
| `date` | TEXT | — | YYYY-MM-DD string in **IST** (PK pt 1) |
| `metal` | TEXT | — | `gold`/`silver`/`platinum`/`palladium`/... (PK pt 2) |
| `grams` | REAL | — | Fine grams (pure equivalent) |
| `set_by` | TEXT | — | PIN label if user-set, null if auto-rolled |
| `set_at` | TEXT | — | ISO timestamp |
| `auto_rolled` | INTEGER | 0 | 1 = computed from previous day's closing |

**Primary key:** `(date, metal)`
**Index:** `idx_stock_opening_date ON (date)`

See [§8](#8-financial-year-model) and [§13.2](#132-stock-opening-roll-forward) for the IST + roll-forward details.

---

## 5. Migration System

Migrations live in `src/lib/db.ts` as an array of `{version, description, up}` objects. On every DB connection (`getDb()`), the runner:

1. Reads `MAX(version)` from `schema_version`
2. Iterates `migrations` array in order
3. For each migration where `version > currentVersion`:
   - Calls `up()`
   - Writes the version to `schema_version`

### 5.1 Rules

1. **Never drop, rename, or modify an existing column.** Only ADD.
2. **Use `addColumnIfNotExists(db, table, column, definition)`** for idempotency. Safe to re-run on a DB that already has the column.
3. **Every new table must also be in the `CREATE TABLE IF NOT EXISTS` block** at the top of `initSchema()`, so fresh DBs get it without running migrations.
4. **Never delete data in an `up()` function.** Migrations are data-preserving by contract. Data cleanup is a separate, explicit operation.
5. **Each migration runs exactly once** — idempotency is a safety net, not a feature to depend on.
6. **The migration array is append-only.** Modifying an earlier migration's description or `up()` body is forbidden after deploy — the version number has already been recorded.

### 5.2 Current migrations

| Version | Description | Ships code change |
|---|---|---|
| 1 | Add `contact_name` to `deals` | `addColumnIfNotExists` |
| 2 | Add `refining_cost_per_gram` + `total_cost_usd` to `deals` | `addColumnIfNotExists` |
| 3 | Add `deliveries` + `settlements` tables | no-op (new tables via CREATE IF NOT EXISTS) |
| 4 | Add `parsed_deals` table | no-op |
| 5 | Add `meta_config` table | no-op |
| 6 | Add `pending_deals` table | no-op |
| 7 | Add `auth_pins` + `auth_sessions` + seed 4 default PINs | INSERT seeds conditionally |
| 8 | Add `locked` column to `auth_pins` | `addColumnIfNotExists` |
| 9 | Add dispatch columns to `pending_deals` | `addColumnIfNotExists` × 4 |
| 10 | Add `stock_opening` table | no-op |
| 11 | Promote `pin_niyam` to `super_admin` role | `UPDATE auth_pins SET role='super_admin' WHERE id='pin_niyam'` |
| 12 | Add `wamid` / `send_status` / `send_error` columns to `whatsapp_messages` | `addColumnIfNotExists` × 3 |

### 5.3 Adding a new migration

```typescript
{
  version: 13,
  description: "Add foo column to bar table",
  up: () => {
    addColumnIfNotExists(db, "bar", "foo", "TEXT");
  },
},
```

Append to the end of the array in `src/lib/db.ts`, ship, done. Never insert into the middle.

---

## 6. API Surface

Complete list of HTTP routes. All routes are under `/api/`. Unless otherwise noted, every route is behind `AuthGate` (client-side) but the API handlers themselves check session cookies directly for endpoints that mutate.

### 6.1 Authentication

| Method | Path | Body/Query | Purpose |
|---|---|---|---|
| `POST` | `/api/auth` | `{pin}` or `{action:"logout"}` | Login (creates session row) / logout (deletes session row) |
| `GET` | `/api/auth` | — | Returns `{authenticated, label?, role?}`. Also updates `last_seen` heartbeat. |

**Login response:**
```json
{"ok": true, "label": "Niyam", "role": "super_admin"}
```
Sets cookie `nt_session=<uuid>; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000; Path=/`.

**Login error (bad / locked / unknown PIN):** `{"ok": false, "error": "Wrong PIN"}` with status 401. Locked PINs return the same error to prevent information leak.

### 6.2 Review (maker-checker)

| Method | Path | Query/Body | Purpose |
|---|---|---|---|
| `GET` | `/api/review` | `?status=pending\|approved\|rejected\|ignored\|all&limit=N` | List pending_deals + counts map. `status=ignored` returns the in-memory ring buffer. |
| `PATCH` | `/api/review/[id]` | partial deal fields | Edit a pending deal before approval |
| `POST` | `/api/review/[id]` | `{action:"approve"\|"reject", deal_type?:"K"\|"P", notes?}` | Maker-checker action. `deal_type` can be passed to atomically classify+approve an `#NT` deal. |

### 6.3 Live Deals Register

| Method | Path | Query | Purpose |
|---|---|---|---|
| `GET` | `/api/deals/live` | `?from=ISO&to=ISO&limit=N` | Approved deals in window with computed `amount_usd` per row and aggregate totals |
| `GET` | `/api/deals/live/export` | `?from=&to=&label=&type=K\|P` | CSV download (13 columns) |

**Response shape:**
```json
{
  "deals": [{"id":"...", "amount_usd": 123456.78, ...}],
  "count": 42,
  "totals": {"buy_count": 20, "sell_count": 22, "buy_usd": ..., "sell_usd": ...},
  "generated_at": "2026-04-12T..."
}
```

### 6.4 Stock

| Method | Path | Query | Purpose |
|---|---|---|---|
| `GET` | `/api/stock/live` | `?from=&to=` | Per-metal all-time register (buys/sells/net/cost basis/market value/P&L) |
| `GET` | `/api/stock/live/export` | `?filter=all\|gold\|silver\|platinum\|palladium\|other&from=&to=` | CSV |
| `GET` | `/api/stock/opening` | — | Today's opening + today's activity + in-hand per metal. Lazy roll-forward from yesterday's closing. |
| `POST` | `/api/stock/opening` | `{metal, grams}` or `{metals:[{metal,grams},...]}` | Upsert today's opening for one or more metals |

### 6.5 Dispatch (Outbox)

| Method | Path | Body | Purpose |
|---|---|---|---|
| `GET` | `/api/dispatch` | — | Outbox split by target (pakka/kachha) + last 50 history + current `lock` |
| `POST` | `/api/dispatch` | `{target:"orosoft"\|"sbs", ids?:string[]}` | Acquire lock, UPDATE rows as dispatched, return batch id + deals + lock |
| `GET` | `/api/dispatch/export` | `?batch=<id>&target=sbs` | 14-column SBS Bullion Sales Order CSV |

**Lock semantics:** See [§9.2](#92-dispatch-lock) and [§13.1](#131-dispatch-pipeline).

### 6.6 Pins (role-gated)

| Method | Path | Body/Query | Auth |
|---|---|---|---|
| `GET` | `/api/pins` | — | any logged-in user |
| `POST` | `/api/pins` | `{label, pin, role}` | admin+ (super_admin to create super_admin) |
| `PUT` | `/api/pins` | `{id, label?, pin?, role?, locked?}` | admin+ (can't touch super_admin rows unless super_admin) |
| `DELETE` | `/api/pins?id=...` | — | admin+ (can't delete last super_admin) |

### 6.7 Sessions (role-gated)

| Method | Path | Query | Auth |
|---|---|---|---|
| `GET` | `/api/sessions` | — | any logged-in user |
| `DELETE` | `/api/sessions?id=...` | kick one session | admin+ (can't kick super_admin unless super_admin) |
| `DELETE` | `/api/sessions?label=...&ip=...` | kick all sessions matching | admin+ (refuses if any matching label is super_admin and caller isn't) |

### 6.8 Settings

| Method | Path | Body | Purpose |
|---|---|---|---|
| `GET` | `/api/settings` | — | All settings + defaults (`financial_year_start`) |
| `PUT` | `/api/settings` | `{key, value}` | Upsert a single key (per-key validation) |

### 6.9 WhatsApp

| Method | Path | Body/Query | Purpose |
|---|---|---|---|
| `GET` | `/api/whatsapp` | `?contact=name` or — | Contacts summary (no contact) or messages for a specific contact |
| `POST` | `/api/whatsapp` | message fields | Insert + (if direction=outgoing) attempt Meta send. Outgoing UI disabled — endpoint still wired up. |
| `GET` | `/api/whatsapp/webhook` | `?hub.*` | Meta verification handshake |
| `POST` | `/api/whatsapp/webhook` | Meta event payload | Parse lock code → insert pending_deals; OCR image attachments |
| `GET` | `/api/whatsapp/config` | — | Return meta_config key-value map |
| `POST` | `/api/whatsapp/config` | key-value object | Update meta_config |

### 6.10 Screenshots

| Method | Path | Query | Purpose |
|---|---|---|---|
| `GET` | `/api/screenshots/[filename]` | — | Serve a saved image. **Strict UUID + extension regex filename validation** to block path traversal. Sets `Cache-Control: public, max-age=3600, immutable`. |

### 6.11 Demo / legacy

| Method | Path | Purpose |
|---|---|---|
| `GET`/`POST` | `/api/deals` | Legacy Demo deals CRUD |
| `GET`/`POST` | `/api/deliveries` | Deliveries CRUD |
| `GET`/`POST` | `/api/settlements` | Settlements CRUD |
| `GET`/`POST` | `/api/payments` | Payments CRUD |
| `GET` | `/api/prices` | Prices (demo or live) |
| `POST` | `/api/simulator` | Reset + re-seed demo data |
| `GET`/`POST` | `/api/bot` | Legacy bot archive endpoint |
| `POST` | `/api/ocr-test` | Run OCR on an uploaded image (diagnostic) |

---

## 7. Authentication & Authorization

### 7.1 PIN-based login

- Login flow: user enters a 4-8 digit PIN into `PinPad` → POST `/api/auth` → server looks up `auth_pins WHERE pin = ? AND locked = 0` → if match, inserts into `auth_sessions`, sets `nt_session` cookie with the new session id.
- **Failed login** returns the same error regardless of whether the PIN is wrong, non-existent, or locked — prevents information leak about which PINs exist.
- **Multiple PINs can have the same value** (intentional — e.g. a shared "Staff" PIN used by 15 people). The server takes the first non-locked match. Individual staff are distinguished in `auth_sessions` by IP + user-agent.

### 7.2 Cookie + heartbeat

- Cookie: `nt_session=<session_id>; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000 (365 days); Path=/`
- `AuthGate` in the root layout mounts, calls `GET /api/auth` once on mount, and then every 30 seconds (`HEARTBEAT_INTERVAL_MS`)
- GET `/api/auth` does three things:
  1. Resolves the session row by cookie
  2. Updates `last_seen = now` (heartbeat)
  3. Returns `{authenticated, label, role}` for consumers like the sidebar user card
- If the cookie references a session that no longer exists (revoked, cascaded from PIN delete), the GET clears the cookie via `Set-Cookie: nt_session=; Max-Age=0` and returns `{authenticated: false}`. The AuthGate flips the user to the PIN pad within 30 seconds.

### 7.3 Session lifecycle

**Sessions are never auto-expired.** The cookie Max-Age is 365 days, and the server only deletes session rows in these explicit cases:

1. **Logout** — `POST /api/auth {action:"logout"}` deletes the row
2. **Admin kick** — `DELETE /api/sessions?id=...` or `?label=&ip=` deletes rows (with role gating)
3. **PIN cascade** — `DELETE /api/pins?id=...` triggers `ON DELETE CASCADE` on `auth_sessions.pin_id`
4. **Fresh stale sessions** — the 24h window on `/api/sessions` is a **display filter** (`WHERE last_seen >= cutoff`), NEVER a `DELETE`. Old sessions stay in the DB until explicitly removed.

**Why never auto-expire:** A 24h sweep was tried in Phase A and caused a regression where users who closed their tab for a day were silently kicked out. The lazy sweep is architecturally incompatible with "unlimited login" — any DELETE on session rows breaks the cookie → session mapping and forces re-auth. Moved to a display filter in Phase B.

### 7.4 Role hierarchy

```
super_admin  >  admin  >  staff
```

Resolved via `src/lib/auth-context.ts`:

```typescript
type Role = "super_admin" | "admin" | "staff";

getCurrentUser(req): { pin_id, label, role } | null
normalizeRole(raw): Role   // fallback to "staff" on unknowns
canCreateRole(actor, target): boolean
canModifyPin(actor, target): boolean
canKickRole(actor, target): boolean
countSuperAdmins(db): number
```

### 7.5 Role gating rules

| Action | super_admin | admin | staff |
|---|:---:|:---:|:---:|
| Create super_admin PIN | ✅ | ❌ | ❌ |
| Create admin / staff PIN | ✅ | ✅ | ❌ |
| Edit / lock / unlock super_admin PIN | ✅ | ❌ | ❌ |
| Edit / lock / unlock admin / staff PIN | ✅ | ✅ | ❌ |
| Delete super_admin PIN | ✅ (except last) | ❌ | ❌ |
| Delete admin / staff PIN | ✅ | ✅ | ❌ |
| Kick super_admin session | ✅ | ❌ | ❌ |
| Kick admin / staff session | ✅ | ✅ | ❌ |
| Escalate any PIN → super_admin via PUT | ✅ | ❌ | ❌ |

**Safeguards:**
- Deleting the last super_admin is **hard-refused** by the server (`countSuperAdmins(db) <= 1`). Without this, the system could end up in a state where no one can ever create a super_admin again.
- Downgrading the last super_admin via role PUT is refused for the same reason.
- Group kick via `(label, ip)` refuses the whole batch if ANY matching pin row is super_admin and the caller isn't — conservative rather than partial-kicking.

### 7.6 Where role gating lives

Both the server handlers and the `/users` page UI consult the same `canCreateRole` / `canModifyPin` / `canKickRole` predicates (duplicated for the UI side in `src/app/users/page.tsx` since it can't import the server lib directly). The server is authoritative; the UI mirrors for optimistic disabling but never trusts its own checks.

On other pages (`/deals`, `/stock`, `/dashboard`), role gating is **UI-level only**. Staff can still hit `/api/deals/live` directly and see $ amounts — the role gate just hides the Trading P&L row on the dashboard and the $ column on the recent trades feed. Data-level isolation (staff can never see $ anywhere) is a deferred improvement.

---

## 8. Financial Year Model

### 8.1 Core concepts

- **FY start** is a `MM-DD` string stored in `settings.financial_year_start`. Default `04-01` (India's April-March fiscal year).
- **FY boundaries are IST-aligned** (+05:30). A trade at 11:55 PM on March 31 IST stays in FY X-Y; 12:01 AM April 1 IST moves to FY Y-Z.
- **FY labels** follow the Indian convention: `FY 2025-26`, `FY 2026-27`.
- **List of FYs** is the current + 5 prior, newest first.

### 8.2 Library

`src/lib/financial-year.ts` exports pure functions, shared between server routes and client components so derivation can never drift:

```typescript
parseFyStart(mmDd): { month, day }
deriveFy(mmDd, reference?): { label, startYear, fromIso, toIso }
listFinancialYears(mmDd, count = 6, reference?): FinancialYear[]
intersectFy(fy, periodFrom, periodTo): { from: string, to: string }
```

`deriveFy` implementation: shift reference by +5.5h to get IST calendar date, compare `(refMonth, refDay) >= (fyStartMonth, fyStartDay)` to pick the `startYear`, then build `fromIso` and `toIso` via `istMidnightIso(year, month, day)` which converts `Date.UTC(y, m-1, d) - IST_OFFSET_MS` to an ISO Z string. SQLite string comparison on `pending_deals.reviewed_at` handles the window correctly without timezone gymnastics.

### 8.3 Client-side plumbing

- `FyProvider` (context) mounted in `layout.tsx` fetches `/api/settings` once on mount, derives the FY list via `listFinancialYears`, reads the user's last-selected FY from `localStorage` (`prismx_selected_fy_v1`), and exposes `{fy, fys, fyStart, setFy, refresh}` via `useFy()`.
- `FySelector` (component) is a compact dropdown rendered in the PriceTicker top strip (both mobile and desktop).
- When Settings saves a new `financial_year_start`, it calls `refreshFy()` to rebuild the FY list in place without a page reload.

### 8.4 Where FY is consumed

| Page | FY-aware? | How |
|---|:---:|---|
| Dashboard (Live) | ✅ | `useFy()` → passes `fy.fromIso` / `fy.toIso` to `/api/deals/live` and `/api/stock/live` |
| Deals (Live) | ✅ | `intersectFy(fy, periodFrom, periodTo)` clamps the period pill window to the selected FY |
| Stock (Live all-time register) | ✅ | FY bounds pushed to `/api/stock/live` |
| Stock (Opening / In Hand) | ❌ | Today is always in the current FY — FY dropdown doesn't affect this section |
| Reports | ✅ | `intersectFy` clamps the period |
| Outbox | ❌ | Live queue — not historical |
| Users | ❌ | Session data — not historical |
| Settings FY editor | N/A | Edits the FY start itself |

### 8.5 CSV exports include FY label

Every CSV filename generated from a FY-scoped page includes the period label: `prismx-live-deals-monthly-2026-04-12.csv`, `prismx-sbs-batch-abc12345.csv`, etc.

---

## 9. Concurrency Model

### 9.1 Correctness layer (already safe by construction)

1. **SQLite WAL mode** allows many concurrent readers and a single writer. 10-15 users is two orders of magnitude below the ceiling.
2. **better-sqlite3 synchronous API** means every `.run()` / `.get()` / `.all()` call runs to completion before the next JavaScript statement. Two API handlers executing on the same event loop cannot interleave their DB operations — the first runs to return before the second starts.
3. **PM2 fork mode = 1 Node process.** All requests funnel through the same event loop. No cross-process races, no need for Redis locks.
4. **Critical writes filter in SQL**, not in JS: the dispatch UPDATE's eligibility SELECT includes `AND dispatched_at IS NULL`, so a second dispatcher racing in behind the first sees zero eligible rows and no-ops.

### 9.2 Dispatch lock

Correctness is not enough — operators also need to **see** that another operator is mid-dispatch. Phase C adds a coordination layer:

**Storage:** single row in `settings` under key `dispatch_lock`, value is a JSON:
```json
{
  "started_at": "2026-04-12T15:30:00.000Z",
  "started_by": "Niyam",
  "target": "orosoft",
  "deal_count": 4,
  "expires_at": "2026-04-12T15:30:03.000Z"
}
```

**Acquisition:** `POST /api/dispatch` calls `readLock(db)` first. If a non-stale lock exists AND it's held by a different user, the POST returns `409 Conflict` with `{ok:false, error, lock}`. Otherwise it calls `writeLock(db, newLock)` with `expires_at = now + 3000ms` before doing the UPDATE.

**Why 3 seconds:** long enough for every client's 2-second poll to see the lock at least once. Actual DB work is ~50ms, but the lock stays "held" (displayed) for 3 seconds to guarantee visibility.

**Release:** there is no explicit release. The lock **expires naturally** when `expires_at` passes. `readLock(db)` transparently clears stale locks on every read, so every GET response is authoritative.

**Why lazy expiry instead of try/finally release:** if the client crashes, the tab closes, or the network drops mid-dispatch, an explicit release would never fire and the lock would orphan the whole app. A time-based lease is the standard answer to "distributed systems with unreliable clients."

### 9.3 Dispatch banner

`src/components/dispatch-banner.tsx` mounts in `layout.tsx` below the PriceTicker. It:

1. Fetches `/api/auth` once on mount to learn the current user's label
2. Polls `/api/dispatch` every 2 seconds
3. When the response carries a non-null `lock` AND `lock.started_by !== currentLabel`, renders a sticky pulsing strip with `"{Name} is pushing N deals to {Target}…"`
4. Suppresses itself when the lock belongs to the current user (they already see their own `/outbox` animation)
5. Colour-coded: emerald for OroSoft, sky for SBS
6. `print:hidden` so it never leaks into printed reports

### 9.4 Other polling intervals

| Page | Endpoints polled | Interval |
|---|---|---|
| AuthGate | `/api/auth` | 30s |
| Dashboard Live | 7 endpoints in parallel | 10s |
| Deals Live | `/api/deals/live` | 10s |
| Stock Live | `/api/stock/live` + `/api/stock/opening` | 10s |
| Outbox | `/api/dispatch` | 2s |
| Review | `/api/review?status=pending` | 3s |
| Users | `/api/sessions` + `/api/pins` + `/api/auth` | 5s |
| DispatchBanner | `/api/dispatch` | 2s |
| Home Demo | 4 endpoints | 3s |
| WhatsApp | `/api/whatsapp` | 2s |
| Price ticker badge counts | `/api/review` + `/api/deals` + `/api/whatsapp` | 3s |

**Total load at 15 users:** roughly 10-15 req/sec average across all endpoints. SQLite handles this trivially; Next.js is never CPU-bound.

---

## 10. Frontend Architecture

### 10.1 Layout tree

```
<html class={dark|light}>
  <body>
    <ThemeProvider>           // localStorage + .dark/.light class toggle
      <AuthGate>              // GET /api/auth, show PinPad if unauthenticated
        <FyProvider>          // /api/settings once, derive FY list
          <DemoProvider>      // Demo engine state (dealTick, running stats)
            <DealToast />
            <DemoIndicator />
            <SidebarNav />    // Desktop left sidebar
            <div lg:pl-60>
              <PriceTicker /> // Sticky top: prices + FY selector + theme toggle
              <DispatchBanner /> // Shows when another user is dispatching
              <main>
                {children}    // The current page
              </main>
            </div>
            <BottomNav />     // Mobile bottom tab bar + More overflow sheet
          </DemoProvider>
        </FyProvider>
      </AuthGate>
    </ThemeProvider>
  </body>
</html>
```

### 10.2 Context providers

| Provider | State | Persistence | Consumers |
|---|---|---|---|
| `ThemeProvider` | `theme: "dark"\|"light"` | `localStorage.prismx_theme_v1` | `ThemeToggle`, passive (applies class to html) |
| `AuthGate` | `status: loading\|locked\|unlocked` | cookie | (wraps children) |
| `FyProvider` | `{fy, fys, fyStart}` | `localStorage.prismx_selected_fy_v1` | All FY-aware pages via `useFy()` |
| `DemoProvider` | `{dealTick, running, stats}` | in-memory | Dashboard, Deals, Stock demo views |

### 10.3 Polling + state conventions

1. Pages define a `load()` callback via `useCallback`, mounted in `useEffect` with a `setInterval(load, N)` and cleanup.
2. `load()` issues fetches via `Promise.all()` when multiple endpoints are needed.
3. State is typed with TypeScript interfaces mirroring the API response shapes.
4. On network error, keep stale state silently — the next poll will catch up.
5. Filtering happens client-side for UX responsiveness (pill clicks feel instant); exports push the same filter to SQL.
6. `useMemo` wraps any derived view (e.g. filtered deal list + recomputed totals) so re-renders from unrelated state don't recompute.

### 10.4 Catalog of key components

| Component | File | Purpose |
|---|---|---|
| `AuthGate` | `auth-gate.tsx` | Session gate, heartbeat, renders PinPad when locked |
| `PinPad` | `pin-pad.tsx` | 6-digit entry with click + keyboard |
| `SidebarNav` | `sidebar-nav.tsx` | Desktop nav + current user card |
| `BottomNav` | `bottom-nav.tsx` | Mobile 6-tab + More overflow sheet |
| `PriceTicker` | `price-ticker.tsx` | Top price grid + mobile chrome + FY + theme toggle |
| `DispatchBanner` | `dispatch-banner.tsx` | Global concurrency indicator |
| `ReportLetterhead` | `report-letterhead.tsx` | Branded header for printable reports |
| `StatCard` | `stat-card.tsx` | Catalyst KPI card |
| `FySelector` | `fy-selector.tsx` | FY dropdown |
| `ThemeToggle` | `theme-toggle.tsx` | Sun/moon button |
| `ChatThread` | `chat-thread.tsx` | Chat bubbles + delivery ticks (compose disabled) |
| `ContactList` | `contact-list.tsx` | Active/locked split |
| `DemoMode` | `demo-mode.tsx` | Start Demo button |
| `DemoIndicator` | `demo-indicator.tsx` | Floating demo progress pill |
| `DealToast` | `deal-toast.tsx` | Slide-in on deal lock |
| `FundsReceived` | `funds-received.tsx` | HKD/USD/USDT panel |
| `DeliveryPipeline` | `delivery-pipeline.tsx` | HK shipment summary |
| `StockDetail` | `stock-detail.tsx` | Drill-down lot list |
| `PurchaseForm`, `SaleForm`, `DealForm` | — | Manual entry forms for Demo mode |

### 10.5 Library modules

| Module | File | Purpose |
|---|---|---|
| DB singleton + migrations | `lib/db.ts` | — |
| Types + constants | `lib/types.ts` | `Deal`, `Price`, `Metal`, `YIELD_TABLE`, `GRAMS_PER_TROY_OZ` |
| Deal code parser | `lib/deal-code-parser.ts` | Pure function, 9 test fixtures |
| Prices feed | `lib/prices.ts` | Demo + optional live LBMA |
| Calculations | `lib/calculations.ts` | Stock summary, avg cost, P&L |
| Sample data | `lib/sample-data.ts` | Demo seeder |
| Chat scripts | `lib/chat-scripts.ts` + `lib/demo-scripts.ts` | 25 demo chat flows |
| Ignored messages | `lib/ignored-messages.ts` | In-memory ring buffer (100 entries, cleared on restart) |
| Orphaned attachments | `lib/orphaned-attachments.ts` | In-memory ring buffer (50 entries, 1h TTL) |
| Meta WhatsApp helpers | `lib/meta-whatsapp.ts` | HMAC verify, sendTextMessage, downloadMedia, getMetaConfig |
| Image OCR | `lib/image-ocr.ts` | Tesseract + Claude/GPT/Google fallbacks |
| Financial year | `lib/financial-year.ts` | Pure FY math |
| Auth context | `lib/auth-context.ts` | Role helpers for route handlers |
| User display | `lib/user-display.ts` | `initialsFromLabel`, `roleLabel`, `roleAccentClass` |

---

## 11. Theme System

### 11.1 Design decision

Dark mode is the star. Light mode is an opt-in. Instead of rewriting every component with `dark:` variants, Phase C uses **palette inversion via CSS variables** in a `.light` scope so existing `bg-gray-950` / `text-white` / `bg-white/5` classes automatically resolve to light values when the user toggles.

### 11.2 Setup in `globals.css`

```css
@import "tailwindcss";

/* Enable class-based dark variant */
@custom-variant dark (&:where(.dark, .dark *));

:root { color-scheme: dark; }

body { @apply bg-gray-950 text-white antialiased; }

.light {
  color-scheme: light;

  /* Surface scale — body off-white, cards pure white so they pop */
  --color-gray-950: #f4f5f7;
  --color-gray-900: #ffffff;
  --color-gray-800: #f0f1f4;
  --color-gray-700: #e4e6ea;
  --color-gray-600: #d1d5db;

  /* Mid-tone muted text — inverts so muted reads correctly on light bg */
  --color-gray-500: #9ca3af;
  --color-gray-400: #6b7280;
  --color-gray-300: #4b5563;
  --color-gray-200: #374151;
  --color-gray-100: #1f2937;
  --color-gray-50:  #111827;

  /* "white" in this codebase = primary text. Flip to near-black. */
  --color-white: #0f172a;
}
```

### 11.3 How Tailwind v4 picks this up

Tailwind v4 compiles color utilities to `background-color: var(--color-gray-950)` etc. Overriding the variable in a cascading scope (`.light`) flips every usage at once without touching any component JSX.

### 11.4 Edge cases

1. **`text-white` on colored buttons** (e.g. `bg-amber-600 text-white`): in light mode, text-white resolves to near-black. Amber-600 is still vivid enough to carry dark text, so these buttons remain readable. Alternative would have been to keep `--color-white: #fff` and migrate every page-title `text-white` manually — rejected as too much work for too little gain.
2. **`bg-white/5` overlays**: flip to `bg-dark/5` (subtle dark tint on light bg). Semantically correct — a subtle light overlay on dark bg becomes a subtle dark overlay on light bg.
3. **First-paint flash**: `html:not(.light)` in `globals.css` + `<html class="dark">` in `layout.tsx` means returning dark users see no flash. Returning light users see a one-frame dark flash before the effect reconciles — can be fixed with an inline pre-hydration script if it becomes annoying.
4. **Literal white needed**: rare, but any component can escape with `text-[#fff]` or `bg-[#fff]` arbitrary values.

---

## 12. WhatsApp Integration

### 12.1 Inbound (webhook → pending_deals)

```
Operator phone (e.g. +91 9819800214)
  → WhatsApp message to +1 555 629 9466 (test number)
  → Meta Cloud API POST → /api/whatsapp/webhook
  → parseDealCode(body)
    ├── text with #NTK / #NTP / #NT → insert pending_deals(status='pending')
    │     (multi-line messages split into one row per line)
    ├── text without trigger → push to ignoredMessages ring buffer
    └── image → downloadMedia() → save to <cwd>/screenshots/<uuid>.ext
               → analyzeImage() → OCR fields
               → one of 4 linking cases:
                   a. caption has #NT → atomic insert with screenshot_url + screenshot_ocr
                   b. reply to earlier text deal → update existing pending_deal row
                   c. text reply to earlier image → link orphan from buffer
                   d. no context → push to orphanedAttachments buffer (1h TTL)
  → /review page polls every 3s and renders the new card
```

HMAC signature verification via `verifyWebhookSignature()` is **currently disabled** — see [§15.3](#153-hmac-signature-verification-disabled).

### 12.2 Lock code grammar

```
<TRIGGER> <BUY|SELL> <QTY><UNIT> <METAL> [<PURITY>] @<RATE> [<PREMIUM>] <PARTY>
```

Case-insensitive. Examples:
```
#NTP SELL 10KG GOLD 24K @2566.80 -0.1 TAKFUNG
#NTK BUY 50KG SILVER 999 @70.51 +1.2 SAPAN
#NT SELL 1KG PALLADIUM 999 @1021.50 -15 CHANG
#NTp sell 25kg gold 24k @2567.15 -0.15 LIWEI
```

Unit normalisation: KG/KGS/G/GRAMS/OZ (troy oz × 31.1035 = grams). Premium: absolute (`-4`) or percent (`-0.2%`). Multiple deals in one message: line-separated. Parser is `src/lib/deal-code-parser.ts`, returns `{is_deal_code, parsed, fields, errors}`. 9 test fixtures cover happy paths + edge cases + deliberately malformed input.

### 12.3 Outbound (UI-disabled, backend-ready)

- `POST /api/whatsapp {direction: "outgoing", ...}` resolves the contact name → phone number via `resolveContactPhone(db, contactName)` which queries the most recent `pending_deals.sender_phone` matching `sender_name`.
- Calls `sendTextMessage(phoneNumberId, accessToken, phone, text)` which returns `{ok: true, wamid}` on success or `{ok: false, error}` on failure.
- Persists `wamid` / `send_status` / `send_error` on the `whatsapp_messages` row so the UI can differentiate sent from failed on reload.
- `ChatThread.tsx` renders delivery ticks (double tick SVG) for sent rows, red `!` with error subtitle for failed rows.
- **Compose input is currently replaced with an amber read-only notice** because the Meta System User token has zero asset permissions on Business Manager (see [§15.2](#152-whatsapp-outbound-disabled)).

### 12.4 OCR pipeline

`src/lib/image-ocr.ts` dispatches to one of four providers based on `meta_config.ocr_provider`:

1. **Tesseract** (default, local, free) — three-pass fallback: English → English+Chinese+Arabic with auto page segmentation → digits-only. `execFileSync` with 15-30s timeout.
2. **Google Cloud Vision** — requires `google_api_key`
3. **Claude Vision** — requires `anthropic_api_key`
4. **GPT-4o-mini** — requires `openai_api_key`

`parseOcrText()` post-processes raw text to extract USDT/HKD/USD amounts, TRC-20 wallet addresses, tx hashes, timestamps, weights, and bar counts, returning a structured `OcrResult`.

---

## 13. Dispatch Pipeline

### 13.1 Dispatch flow

```
[approved pending_deal]
   ↓
POST /api/dispatch {target: "orosoft" | "sbs", ids?: string[]}
   ↓
1. Validate target
2. Get current user via getCurrentUser(req)
3. readLock() — 409 if another user holds non-stale lock
4. SELECT eligible rows (status='approved' AND dispatched_at IS NULL AND deal_type=?)
5. writeLock({started_by, target, deal_count, expires_at: now+3000ms})
6. UPDATE rows: dispatched_at=now, dispatched_to=target, dispatch_response=..., dispatch_batch_id=uuid
7. SELECT updated rows for the response
   ↓
{ok: true, batch_id, dispatched, deals, response, lock}
   ↓
Client /outbox page:
   - setTimeout-chained staged animation (4 stages, ~500ms each)
   - flip to "done" state showing batch summary + Download CSV (for SBS)
   ↓
Other clients:
   - DispatchBanner sees lock on next 2s poll → shows pulsing strip
   - /outbox panels disable Send buttons while othersLock is non-null
   - Lock expires 3s after acquisition → next GET clears it → banner disappears
```

### 13.2 Stock opening roll-forward

```
GET /api/stock/opening called
  ↓
today = istTodayPrefix()   // YYYY-MM-DD in IST
latest = MAX(date) FROM stock_opening
  ↓
if (!latest):
    seed today with 0 for each canonical metal (auto_rolled=1)
    → return
  ↓
while (latest < today):
    day = latest
    openings = SELECT * FROM stock_opening WHERE date = day
    activity = signed net fine grams per metal from pending_deals
               reviewed_at within [day 00:00 IST, day+1 00:00 IST)
    for each metal:
        closing[metal] = max(0, opening + activity)
    insert closing as next day's opening (auto_rolled=1, INSERT OR IGNORE)
    latest = next_day
  ↓
return today's opening + bucketed activity + in_hand + market value
```

**Key properties:**
- `INSERT OR IGNORE` means a user-set opening (`auto_rolled=0`) is never clobbered by roll-forward
- Single SQLite transaction wraps the whole walk
- Multi-day gaps catch up on first page view — no cron needed
- IST-aligned so business days land at 00:00 Mumbai, not UTC

### 13.3 CSV export formats

**Deals Live export** (`/api/deals/live/export`): 13 columns for PrismX's own audit trail:
```
Approved At, Received At, Type, Direction, Party, Metal, Purity, Qty (g),
Rate (USD/oz), Premium, Amount (USD), Reviewer, Dispatched To
```

**Dispatch export** (`/api/dispatch/export?target=sbs`): 14 columns shaped like the SBS Bullion Sales Order template:
```
Entry Date, Bill Type, Buyer Party, Product, Stock Unit, Gross Weight (g),
Purity, Fine Weight (g), Rate Type, Rate (USD/oz), Premium, Amount (USD),
Currency, Remarks
```

**Stock Live export** (`/api/stock/live/export`): 13 columns for accountants:
```
Metal, Buy Deals, Sell Deals, Bought Fine (g), Sold Fine (g), Net In Hand (g),
Net In Hand (kg), Avg Buy Rate (USD/oz), Avg Sell Rate (USD/oz), Cost Basis (USD),
Market Rate (USD/oz), Market Value (USD), Unrealized P&L (USD)
```

---

## 14. Deployment & Operations

### 14.1 Server layout

| Item | Value |
|---|---|
| Host | `nuremberg` (configured in local SSH config) |
| App directory | `/var/www/nt-metals` |
| Database file | `/var/www/nt-metals/data.db` |
| Screenshots | `/var/www/nt-metals/screenshots/` (gitignored, persistent) |
| PM2 process name | `nt-metals` |
| PM2 mode | fork, 1 instance |
| Upstream port | 3020 |
| nginx site | `/etc/nginx/sites-enabled/nt.areakpi.in` |
| TLS | Let's Encrypt via certbot (auto-renew) |
| Domain | https://nt.areakpi.in |

### 14.2 Deploy script

`deploy.sh` in the repo root. Always use it:

```bash
bash deploy.sh
```

Sequence:
1. `ssh nuremberg "cd /var/www/nt-metals && cp -f data.db data.db.bak.$(date +%Y%m%d_%H%M%S)"`
2. `git push`
3. `ssh nuremberg "cd /var/www/nt-metals && git pull"`
4. `ssh nuremberg "cd /var/www/nt-metals && npm run build"`
5. `ssh nuremberg "cd /var/www/nt-metals && pm2 restart nt-metals"`

### 14.3 Backup & restore

Every deploy creates a timestamped backup at `/var/www/nt-metals/data.db.bak.YYYYMMDD_HHMMSS`. Restore:

```bash
ssh nuremberg "cd /var/www/nt-metals && cp data.db.bak.TIMESTAMP data.db && pm2 restart nt-metals"
```

From seed SQL (last resort — loses anything since the seed):
```bash
ssh nuremberg "cd /var/www/nt-metals && sqlite3 data.db < seed-backup.sql && pm2 restart nt-metals"
```

### 14.4 Never-delete rule

**NEVER delete `data.db` on the server.** Always back up first. The production database contains both demo data AND real approved WhatsApp trades; losing it would lose everything. See `feedback_never_delete_db.md` in memory.

### 14.5 Common ops tasks

| Task | Command |
|---|---|
| Check current schema version | `ssh nuremberg 'cd /var/www/nt-metals && sqlite3 data.db "SELECT MAX(version) FROM schema_version;"'` |
| List PINs | `ssh nuremberg 'cd /var/www/nt-metals && sqlite3 data.db "SELECT label, pin, role FROM auth_pins;"'` |
| Count active sessions | `ssh nuremberg 'cd /var/www/nt-metals && sqlite3 data.db "SELECT COUNT(*) FROM auth_sessions WHERE last_seen > datetime(\"now\",\"-2 minutes\");"'` |
| Diagnose Meta token | `ssh nuremberg 'bash /tmp/diag-meta.sh'` |
| View PM2 logs | `ssh nuremberg 'pm2 logs nt-metals --lines 100'` |
| Restart without redeploy | `ssh nuremberg 'pm2 restart nt-metals'` |

### 14.6 Database migration safety

The migration system (§5) means `deploy.sh` is always safe — fresh DBs get `CREATE TABLE IF NOT EXISTS`, existing DBs get the incremental `up()` calls. No manual SQL is ever needed for a schema change. Every migration is idempotent via `addColumnIfNotExists` / `INSERT OR IGNORE`.

---

## 15. Known Limitations

### 15.1 OroSoft API not yet wired

The outbox dispatch for Pakka deals is **simulated locally**. The `POST /api/dispatch` handler stamps the `dispatched_at` column and generates a fake response string, but no actual HTTP call goes to OroSoft. This blocks on Niyam's Monday April 13 meeting with OroSoft where the real API contract (auth, endpoints, payload shape) will be settled. Once that's known, the swap is ~50 lines in `src/app/api/dispatch/route.ts`:

```typescript
if (target === "orosoft") {
  const response = await fetch(orosoftUrl, { /* real request */ });
  // persist response.body into dispatch_response
}
```

The DB schema, UI states, animation choreography, and audit trail all survive the cutover unchanged.

### 15.2 WhatsApp outbound disabled

Backend is fully wired (see [§12.3](#123-outbound-ui-disabled-backend-ready)) but the UI trigger is replaced with a read-only notice. Root cause: the Meta System User token has zero asset permissions on Business Manager. The diagnostic at `/tmp/diag-meta.sh` on the server confirms `assigned_whatsapp_business_accounts` returns `data: []` for the `ashishkamdar` System User. Business Manager's "Add Assets" dialog silently fails to save the grant (empty `user.name` in the success dialog indicates the React context loses the target user reference). Fix requires either creating a new System User from the detail panel (not the list page) or switching to Niyam's verified WABA once Meta Business Verification completes.

Re-enabling is a one-file revert of `src/components/chat-thread.tsx` — restore the `<input>` block over the read-only notice. No server changes.

### 15.3 HMAC signature verification disabled

Meta webhook signatures are **not** currently verified. `meta_config.app_secret` is cleared. When the App Secret was populated on April 10, all webhook POSTs started returning 401 with Meta retrying 5× — root cause unknown, possibly a whitespace issue or a mismatch in the HMAC computation. `verifyWebhookSignature()` in `src/lib/meta-whatsapp.ts` uses the standard SHA-256 algorithm per Meta docs. Fix requires adding temporary logging of expected vs received signatures, identifying the mismatch, and re-populating the App Secret.

### 15.4 Access token has a 60-day expiry

The current System User token was generated with a 60-day expiry instead of "never". It will stop working around mid-June 2026. Regeneration takes ~2 minutes via the same Playwright flow used on Apr 10, but must be done before expiry. The Meta token generation wizard tends to auto-advance past the expiry selector — explicitly click "Never" before moving forward next time.

### 15.5 Data-level role isolation is partial

Role gating on `/users`, `/api/pins`, and `/api/sessions` is enforced at the API level. Role gating on `/dashboard`, `/deals`, and `/stock` is **UI-level only** — staff can still hit `/api/deals/live` directly and receive $ amounts. Full data-level isolation (staff can never see $ anywhere) is deferred because it would require adding role checks to every data-returning route and potentially splitting response shapes by role. Not a blocker for the current demo audience.

### 15.6 Reports page still uses Demo data

The `/reports` page pulls from the legacy `deals` table (Demo mode) rather than `pending_deals.status='approved'` (Live). Adding a Demo/Live toggle here is a small follow-up — reuse the `/api/deals/live` math and swap in the same FY-aware query. Not blocking the demo but worth doing before handoff.

### 15.7 Money Flow is not FY-aware

`/money-flow` doesn't yet consult `useFy()`. Low priority until real money-movement data lands (currently mostly Demo).

### 15.8 Bot Phase 4 (auto-negotiator) deferred

The original plan had a Phase 4 where PrismX would respond to counterparties automatically with price quotes. Completely deferred until Phase A+B+C are stable AND Niyam's Meta Business Verification is complete AND outbound messaging actually works.

### 15.9 Old `whatsapp_messages` rows don't have `wamid`

Rows inserted before migration v12 have `wamid=null` even for outgoing messages. The `ChatThread` renders legacy rows (null `send_status`) with the same double-tick indicator as new successful sends, so they don't look broken — but they can't be traced back to a Meta message id for reconciliation.

### 15.10 `whatsapp_messages.contact_name` is free text

There's no foreign key to a contacts table. Two different insert paths could write "Ashish Kamdar" and "ashish kamdar" and they'd appear as separate contacts on `/whatsapp`. `resolveContactPhone` uses `LOWER(TRIM(...))` matching to be robust to this, but a normalized contacts table would be the proper fix.

---

## Appendix A — Quick Reference

### A.1 Key URLs

- **Live app:** https://nt.areakpi.in
- **Repo:** https://github.com/ashishkamdar/niyam_turakhia
- **Webhook endpoint:** https://nt.areakpi.in/api/whatsapp/webhook
- **Default PIN:** `639263` (Niyam, super_admin)

### A.2 Role hierarchy at a glance

```
super_admin  (Niyam 639263, Ashish 520125)    — can do anything, except delete last super_admin
admin        (Admin 999999)                    — can manage admin+staff, can't touch super_admins
staff        (Staff 111111)                    — read-only for pins/sessions, dashboard trading P&L hidden
```

### A.3 Seed PINs (can be changed from `/users` after login)

| Label | PIN | Role |
|---|---|---|
| Niyam | 639263 | super_admin |
| Ashish | 520125 | super_admin |
| Admin | 999999 | admin |
| Staff | 111111 | staff |

### A.4 Tech stack one-liner

Next.js 16 App Router + TypeScript + Tailwind v4 + SQLite (better-sqlite3 WAL) + PM2 fork + nginx + Let's Encrypt, deployed to `nuremberg` VPS via `bash deploy.sh`.

### A.5 Things to NEVER do

1. **Never delete `data.db`.** Always back up first.
2. **Never modify an existing migration's `up()` body** after deploy. Append a new migration.
3. **Never drop/rename a column.** Only add.
4. **Never suggest Vercel.** The project is not on Vercel. Ignore `vercel:*` plugin suggestions.
5. **Never skip hooks** (`--no-verify`) or force-push without explicit user approval.
6. **Never commit access tokens** to the repo. Store in `meta_config` via the Settings UI.

---

*End of TECHNICAL-SPECIFICATION.md. See PROJECT-PLAN.md for the narrative phase history and upcoming work.*
