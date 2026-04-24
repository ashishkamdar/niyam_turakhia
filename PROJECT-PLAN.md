# Niyam Turakhia — Precious Metals MIS Dashboard

## Client
- **Name:** Niyam Turakhia (Kutchi businessman, Matunga Gymkhana)
- **Company:** PrismX
- **Business:** Precious metals dealing (gold, silver, platinum, palladium) — Dubai + Hong Kong operations
- **HQ:** Dubai (staff connects via FortiGate VPN from Mumbai)
- **Mumbai office:** Matunga
- **Contact:** WhatsApp (connected via Ashish's Gymkhana network)
- **Status:** Demo shown April 9, 2026. Positive response. App link + PIN shared. Dubai visit invited. Awaiting next meeting at Gymkhana. **Phase A (maker-checker pipeline) + Phase B (full trade lifecycle, named users, daily opening stock, outbox dispatch, financial-year scoping) shipped by April 11, 2026.**

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

## 🎯 CURRENT BUILD STATUS — April 12, 2026

**Phase A (Maker-Checker Review Pipeline), Phase B (Lifecycle Completion + Financial Year), and Phase C (Polish + Concurrency + Roles) are all SHIPPED and ready to demo to Niyam.** Phase A landed Apr 10. Phase B landed Apr 11 (lifecycle, FY, Demo/Live splits, outbox, users). Phase C landed Apr 12 (super_admin role hierarchy, theme toggle, rich Live dashboard, dispatch lock for concurrency visibility, keyboard PIN entry, user identity cards, WhatsApp inbound-only mode, audit trail, party master, dispatch sync log, SBS API-flow visual, installation guide + scripts). Everything below reflects the Apr 12 state. A companion document [`TECHNICAL-SPECIFICATION.md`](TECHNICAL-SPECIFICATION.md) contains the reference-style details (full DB schema, API surface, component catalog, auth/FY/concurrency models, deployment config).

### Scope change in one paragraph

Instead of building a bot that parses free-text WhatsApp chatter and tries to infer which messages are deals (the original plan), **staff will post a structured lock code into a single internal WhatsApp group** whenever they close a deal. The bot listens to that group, parses each code line into a deal record, and routes it through a **maker-checker review screen** before the deal is written to the downstream accounting systems. There are **two downstream systems**: **SBS** for Kachha (off-the-books) deals, and **OroSoft Neo Financials** for Pakka (official/invoiced) deals. The bot decides which path a deal takes based on the trigger the maker used — or the checker picks at review time.

### The lock code format (finalised)

Staff post one of three trigger variants:

| Trigger | Meaning |
|---|---|
| `#NTK` | Explicit Kachha (black / SBS) |
| `#NTP` | Explicit Pakka (white / OroSoft) |
| `#NT` | Unclassified — checker picks K or P in the review UI |

Grammar: `<TRIGGER> <BUY\|SELL> <QTY><UNIT> <METAL> [<PURITY>] @<RATE> [<PREMIUM>] <PARTY>`

Real-world examples (all tested end-to-end April 10):

```
#NTP SELL 10KG GOLD 24K @2566.80 -0.1 TAKFUNG
#NTK BUY 50KG SILVER 999 @70.51 +1.2 SAPAN
#NTP SELL 2KG PLATINUM 999 @979.25 -4 SHAH
#NT SELL 1KG PALLADIUM 999 @1021.50 -15 CHANG
#NTP BUY 5KG GOLD 22K @2556.40 -0.2% PATEL
#NTK SELL 100 OZ SILVER 999 @71.85 +1.0 KARIM
#NTp sell 25kg gold 24k @2567.15 -0.15 LIWEI
```

Parser is case-insensitive on the trigger, direction, purity, and metal. Unit normalisation handles KG / KGS / G / GRAMS / OZ (troy ounces → grams via 31.1035). Premium accepts absolute (`-4`) or percent (`-0.2%`). Party alias is free-form alphanumeric. Multiple deals can be **batched in one WhatsApp message** (line-separated) — the webhook splits on newlines and creates one pending row per line.

### The maker-checker pipeline (live)

```
Internal staff WhatsApp group (#NTK / #NTP / #NT codes)
        │
  Meta Cloud API webhook → https://nt.areakpi.in/api/whatsapp/webhook
        │
  Parse each line → pending_deals table (status='pending')
        │
  /review screen shows cards in real time (3-second auto-refresh)
  Niyam or a designated checker reviews each deal:
    · For #NTK / #NTP: tap Approve or Reject
    · For #NT (unclassified): tap "Approve as Kachha" or "Approve as Pakka"
      (one-tap atomic classify + approve)
        │
  ┌──────────────────────┬─────────────────────┐
  APPROVED Kachha         APPROVED Pakka       REJECTED
  ↓                       ↓                    ↓
  Append to SBS Excel     Push to OroSoft API  Marked, audit-logged
  (⏳ next build chunk)   (⏳ gated on         (implicit now)
                          Monday Apr 13
                          OroSoft meeting)
```

### What's live at nt.areakpi.in right now (Apr 10-11, 2026)

**Core review pipeline:**

| Feature | Status | URL / file |
|---|---|---|
| `#NTK` / `#NTP` / `#NT` deal code parser (pure function, 9 test fixtures) | ✅ Live | `src/lib/deal-code-parser.ts` |
| Meta Cloud API webhook (inbound only) — receives text + image messages | ✅ Live | `src/app/api/whatsapp/webhook/route.ts` |
| Webhook handler splits batched messages on newlines → one row per deal line | ✅ Live | Same file |
| `pending_deals` table (migration v6) | ✅ Live | `src/lib/db.ts` |
| Review API (list, counts, approve, reject, patch) | ✅ Live | `/api/review`, `/api/review/[id]` |
| Deal Review screen — mobile-first cards, one-tap classify+approve for `#NT` | ✅ Live | https://nt.areakpi.in/review |
| Auto-refresh polling every 3 seconds with visible pulsing "Live" indicator | ✅ Live | `/review` header |
| Mobile overflow protection (`overflow-x-hidden`, `<pre>` block wrapping) | ✅ Live | `/review` cards never push wider than viewport |
| 4-tab filter strip: Pending / Approved / Rejected / **Ignored** | ✅ Live | Ignored holds in-memory non-deal messages (100-entry ring buffer) |
| Ignored messages buffer (in-memory, not persisted) | ✅ Live | `src/lib/ignored-messages.ts` |
| Per-card **Edit toggle** — inline form for all 9 writable fields | ✅ Live | Works on Pending AND Rejected cards; approved cards stay immutable |
| Re-approve rejected deals ("Approve anyway" button) | ✅ Live | Rejected → Approved in one click |
| Atomic classify+approve for `#NT` unclassified cards | ✅ Live | Green "Approve as Kachha" / "Approve as Pakka" buttons |
| Parse errors panel on malformed deal codes | ✅ Live | Red error panel with specific field reasons |

**Screenshot OCR pipeline (Phase C — shipped Apr 10):**

| Feature | Status | Details |
|---|---|---|
| Image download via Meta Graph API | ✅ Live | Uses configured access token, 500ms-1s per image |
| Local Tesseract OCR (English + Chinese + Arabic) | ✅ Live | Runs via `execFileSync` with 15-30s timeout, multi-pass fallback |
| Image save to disk (`<cwd>/screenshots/<uuid>.ext`) | ✅ Live | Persistent on Nuremberg VPS filesystem, `.gitignore`'d |
| `/api/screenshots/[filename]` route with UUID validation + caching | ✅ Live | Strict regex blocks path traversal; `Cache-Control: public, max-age=3600, immutable` |
| Caption linking — image with `#NT` caption creates deal + OCR attached | ✅ Live | One-shot atomic flow |
| Reply linking (Case A) — text `#NT` reply to earlier image attaches orphan's OCR | ✅ Live | Via Meta's `msg.context.id` reply mechanism |
| Reply linking (Case B) — image reply to earlier text deal updates that deal | ✅ Live | Updates existing `pending_deals` row's `screenshot_ocr` + `screenshot_url` |
| Orphan buffer (Case C) — image with no caption/reply held in memory 1h | ✅ Live | `src/lib/orphaned-attachments.ts` (50-entry ring, auto-expire) |
| Sky-blue OCR panel on review card — thumbnail + extracted fields + raw text | ✅ Live | Placed directly under raw message, above parsed fields |
| Image thumbnail (`max-h-48`, tap-to-expand in new tab) | ✅ Live | Served from `/api/screenshots/<uuid>.jpg` |

**Branding / PWA:**

| Feature | Status | Details |
|---|---|---|
| PrismX logo in sidebar, price ticker, PIN login, favicon, PWA home-screen | ✅ Live | Source JPG processed to transparent PNG via Pillow script; Next.js auto-generates `icon.png` + `apple-icon.png` |
| PWA manifest with standalone display, PrismX icons (192×192, 512×512, "any" + "maskable") | ✅ Live | `src/app/manifest.ts` — iOS "Add to Home Screen" + Android "Install" prompts work |
| Sidebar + bottom-nav count badges on Review, Deals, Chats | ✅ Live | Review badge is amber (work queue), Deals/Chats are rose (informational); Review badge stays visible even on active tab |

**Meta credentials — configured in `meta_config` table (Apr 10):**

| Key | Value | Notes |
|---|---|---|
| `phone_number_id` | `835944509608655` | Test Number (+1 555 629 9466) |
| `access_token` | Permanent System User token, 60-day expiry | Generated Apr 10 via business.facebook.com → System Users → ashishkamdar |
| `verify_token` | `prismx_webhook_verify` | Matches Meta's webhook configuration |
| `ocr_provider` | `tesseract` | Local, free, unlimited |
| `app_secret` | **CLEARED** (see Known Issues) | HMAC signature verification currently disabled |

### What's NEXT (as of April 10, planned — mostly superseded by Phase B below)

> **Note:** this table was written at the end of Phase A. Most items have since shipped in Phase B or been re-scoped. The current roadmap is in **"What's NEXT (Apr 11 → Apr 13 meeting)"** inside the Phase B section further down. This table is kept as historical context.

| Phase | Status | Blocked on |
|---|---|---|
| **Kachha → SBS REST API writer** | ✅ Simulated in Phase B `/outbox`; SBS vendor agreed to REST APIs Apr 11, Excel path obsoleted. Real HTTP swap is ~50 lines once endpoint details are confirmed. | SBS vendor IT meeting Apr 11 |
| **Pakka → OroSoft API writer** | ⏳ Still blocked on Monday April 13 meeting | Simulated in Phase B `/outbox`; real HTTP swap is ~50 lines |
| **HMAC signature verification fix** | ⏳ Still outstanding | Requires re-populating App Secret with temporary logging |
| **Niyam's own Meta Business Verification** | ⏳ 2-4 weeks (Meta-side review) | Trade License + Business Verification documents |
| **Switch webhook from Ashish's test app to Niyam's verified PrismX number** | ⏳ Awaiting Niyam's Meta verification | ~10-minute endpoint swap |
| **Claude / GPT-4o-mini Vision OCR** (upgrade from Tesseract) | 💡 Optional polish | Tesseract works well enough for text-heavy payment screenshots |
| **Bot Phase 4 — Auto-negotiator** | 🔒 Deferred | Requires Phase A + B stable AND Niyam's Meta verification complete |

### Known Issues / Pending Fixes (Apr 10, 2026)

| # | Issue | Impact | Workaround | Fix |
|---|---|---|---|---|
| 1 | **HMAC signature verification fails with the saved App Secret** | All webhook POSTs returned HTTP 401 when `app_secret` was populated in `meta_config`. Meta retried 5× with exponential backoff, all rejected. | `app_secret` has been **cleared** — webhook now accepts unsigned POSTs as before. No functional impact on deal flow. | Investigate: (a) whether the pasted App Secret had whitespace or was the wrong field, (b) whether `verifyWebhookSignature()` in `src/lib/meta-whatsapp.ts` computes the HMAC correctly. Add temporary logging of expected-vs-received signature to diagnose. Likely one-line fix once the mismatch is identified. |
| 2 | Access token has a **60-day expiry** instead of "never expires" | Token will stop working around **mid-June 2026** without action. Webhook + inbound still work (inbound doesn't need token), but image OCR stops until token is regenerated. | Regenerate via the same Playwright flow used on Apr 10 (`business.facebook.com → System Users → ashishkamdar → Generate token`). Takes ~2 minutes. | Next time the System User token wizard opens, explicitly click "Never" in the expiry step before the wizard auto-advances. |
| 3 | `whatsapp_messages` legacy log still uses our UUID as primary key instead of Meta's wamid | Old free-text bot path can't be used for reply-linking. Not relevant to new structured-code path. | None needed — the new pipeline uses `pending_deals.whatsapp_message_id` with Meta's real wamid. | Leave as-is; legacy table can be dropped later if needed. |
| 4 | Old test data in `pending_deals` | Earlier test rows (pre-screenshot feature) have `screenshot_url = null` even though their `screenshot_ocr` may be populated. Thumbnails won't render on those cards. | None — new messages populate both fields correctly. | Optional: backfill old rows manually or just let them age out of the demo queue. |

---

## 🚀 PHASE B — Lifecycle Completion + Financial Year (Apr 11, 2026)

Phase A left the story at "approved deals sit in `pending_deals.status='approved'` and nothing happens next." Phase B closes that loop end-to-end and also answers the meta-questions Niyam asked when he saw Phase A working: "Who's logged in?", "How do I see a proper trades register?", "How do I set opening stock?", "Where's my financial year?".

### One-sentence summary per page

- **`/review`** — fixed a double `lg:pl-60` wrapper bug that cramped desktop layout. No functional change otherwise.
- **`/deals`** — top pill toggle **Demo ↔ Live**. Demo keeps the original purchase/sale entry forms. **Live** is a wide tabular register of every approved WhatsApp trade with period pills (Today/Monthly/Quarterly/Yearly/Custom), Kachha/Pakka filter, summary stat cards, and a Share/Export CSV/Print action bar. Filters combine with the global FY window.
- **`/stock`** — same Demo↔Live toggle. Demo keeps the original per-metal cards. **Live** is split into three sections: a collapsible **Opening Stock editor** (per-metal fine grams), a horizontal **Stock In Hand bar** (4 cards with delta-from-opening and market value), and the existing all-time register table below. Opening stock rolls forward from yesterday's closing automatically on first page view of each day.
- **`/outbox`** — brand new page. Shows approved trades waiting to ship to OroSoft (Pakka, via simulated REST API) or SBS (Kachha, via Excel export). Two side-by-side destination panels with animated flow visuals (traveling particles + 4-stage checklist for OroSoft, live-updating Excel sheet for SBS), a unified dispatch history timeline, and a real CSV download sized to the SBS Bullion Sales Order 14-column template.
- **`/users`** — brand new page. Live list of currently logged-in sessions grouped by (PIN label, IP) with session counts, device fingerprint, and Kick/Revoke buttons. Collapsible PIN management panel with add/rename/rotate/**Lock**/delete per row. Print/Share/CSV export with `ReportLetterhead`.
- **`/reports`** — unchanged functionally but gained the FY filter + letterhead subtitle.
- **`/settings`** — new **Financial Year** section with month/day pickers, live preview of the derived FY window, and a Save button that updates the global provider in place.
- **Top bar** — new global **FY dropdown** (current + 5 prior years, newest first, "Current" badge) visible on every page. Mobile shows it in the PriceTicker strip; desktop gets a new thin strip above the price grid (replacing the mobile-only chrome that used to sit there).

### Feature table — everything shipped in Phase B

**Named users + sessions (was: single hardcoded PIN `639263`)**

| Feature | Status | Details |
|---|---|---|
| `auth_pins` table (id, label, pin, role, locked, created_at) | ✅ Live | Migration v7 seeds 4 defaults: Niyam `639263` (admin), Ashish `520125` (admin), Admin `999999` (admin), Staff `111111` (staff) |
| `auth_sessions` table (id, pin_id, ip, user_agent, created_at, last_seen) | ✅ Live | Session id is the cookie value; ON DELETE CASCADE from auth_pins |
| `POST /api/auth` with `{pin}` → validates against auth_pins, creates session row, sets UUID cookie | ✅ Live | Records client IP via `x-forwarded-for` / `x-real-ip` (nginx-set headers only) and `user-agent` |
| `GET /api/auth` heartbeat — updates `last_seen` every request | ✅ Live | Invalid / orphaned cookies are cleared silently and flip the AuthGate to PIN pad |
| `AuthGate` heartbeat (30 s interval) | ✅ Live | Kicked sessions flip to PIN pad within 30 s of revoke — no WebSocket plumbing required |
| `/api/sessions` — GET returns active + last-24h sessions with PIN label | ✅ Live | Display filter only — session rows are NEVER auto-deleted. Past bug: a 24h sweep was causing unexpected logouts; fixed by moving the window to a SELECT clause. |
| `/api/sessions` — `DELETE ?id=...` kicks one session, `DELETE ?label=...&ip=...` kicks a whole group | ✅ Live | Group kick used by the "Kick all N" button when multiple staff share a PIN from the same WiFi |
| `/api/pins` — GET list, POST create, PUT update, DELETE | ✅ Live | PIN CRUD for the Users page admin panel |
| `locked` column on `auth_pins` (migration v8) | ✅ Live | When true, login returns the same "Wrong PIN" error as a missing PIN — no info leak about which labels exist. Locking does NOT revoke existing sessions; admins use Kick separately. |
| `/users` page with ReportLetterhead, grouped active table, recent sessions, collapsible PIN manager, Print/Share | ✅ Live | Auto-polls every 5 s |
| Unlimited login guarantee | ✅ Live | Cookie MAX_AGE = 365 days, sessions never auto-expire, no idle timeout. Only explicit logout / kick / PIN delete ends a session. |

**Outbox dispatch (was: approved deals had no next step)**

| Feature | Status | Details |
|---|---|---|
| Dispatch lifecycle columns on `pending_deals` | ✅ Live | Migration v9: `dispatched_at`, `dispatched_to` (`orosoft`/`sbs`), `dispatch_response`, `dispatch_batch_id` |
| `GET /api/dispatch` — split by target (pakka_outbox / kachha_outbox) + last 50 history | ✅ Live | Only approved, not-yet-dispatched rows appear in the outbox |
| `POST /api/dispatch { target, ids? }` — atomically stamps selected deals as dispatched | ✅ Live | `ids` optional so "Send all" works without enumerating. Server re-filters eligibility in SQL — a stale UI tab cannot double-dispatch. |
| `GET /api/dispatch/export?batch=...&target=sbs` — CSV sized to the SBS Bullion Sales Order 14-column template | ✅ Live | Gross-to-fine via purity factor, `SALES`/`PURCHASE` bill type from direction, `Remarks` tagged with `PrismX #<id>` for reconciliation |
| `/outbox` page with two destination panels side-by-side | ✅ Live | OroSoft emerald accent, SBS sky accent |
| Animated OroSoft flow visual (PrismX → REST API → OroSoft Neo) | ✅ Live | Traveling particles with staggered delays, pulsing source/destination rings, 4-stage pipeline checklist (Authenticate → Format → POST /sales → Confirm) — keyframes in `globals.css` |
| Animated SBS flow visual (PrismX → REST API → SBS) | ✅ Live | **Updated Apr 12:** Excel spreadsheet visual replaced with same API pipeline animation as OroSoft, using `ApiFlowVisual` with sky accent. SBS vendor confirmed REST API access on Apr 11. |
| Unified **Recent Dispatches** timeline | ✅ Live | Cross-destination history with target pill, deal summary, amount, party, response string, timestamp |
| Dispatch is **simulated** for the demo | ✅ Live | OroSoft API doesn't exist yet (Monday Apr 13 meeting gates that). SBS column schema has 9 open blockers, so the real writer is pending. The simulated pipeline uses the exact UI + DB flow the real wire-up will use — swap is ~50 lines. |

**Deals Live register**

| Feature | Status | Details |
|---|---|---|
| Demo ↔ Live pill toggle at the top of `/deals` | ✅ Live | Demo keeps the original purchase/sale forms + recent cards. Live is the new tabular register. |
| `GET /api/deals/live?from=&to=&limit=` | ✅ Live | Returns approved pending_deals in the window with precomputed `amount_usd` per row and aggregate totals (buy/sell count + USD). Filter is on `COALESCE(reviewed_at, received_at)` because "today's deals" means "finalized today". |
| `GET /api/deals/live/export?from=&to=&label=&type=K|P` | ✅ Live | 13-column CSV tuned for PrismX's own audit trail (party first, reviewer, dispatch status). Distinct from the SBS-shaped `/api/dispatch/export`. |
| Period filter pills: Today / Monthly / Quarterly / Yearly / Custom From–To | ✅ Live | Custom opens `<input type="date">` fields |
| Kachha / Pakka filter pills (All / Kachha / Pakka) | ✅ Live | Client-side filter over the already-fetched window — instant, no re-fetch. Totals recompute via `useMemo` so stat cards always match what the table shows. Export respects the filter server-side. |
| Auto-refresh every 10 seconds | ✅ Live | Long demos show newly approved trades without manual reload |
| ReportLetterhead + Share / Export CSV / Print action bar | ✅ Live | Share uses `navigator.share` on mobile, clipboard fallback on desktop |

**Stock Live + Opening/Closing register**

| Feature | Status | Details |
|---|---|---|
| Demo ↔ Live pill toggle at the top of `/stock` | ✅ Live | Demo keeps the original per-metal cards with drill-down lots |
| `GET /api/stock/live?from=&to=` — all-time register aggregated by metal | ✅ Live | One row per metal with buy/sell counts, bought/sold fine grams, net-in-hand, avg cost, market rate, market value, unrealized P&L. Clamped at zero (you can't hold negative bullion). |
| `GET /api/stock/live/export?filter=&from=&to=` | ✅ Live | 13-column CSV for accountants |
| Metal filter pills: All / Gold / Silver / Platinum / Palladium / Other | ✅ Live | Client-side filter + totals recomputation |
| **Daily opening stock** — `stock_opening` table (date, metal, grams, set_by, set_at, auto_rolled) | ✅ Live | Migration v10. PK `(date, metal)`. Date is YYYY-MM-DD in **IST** so business-day boundaries land at 00:00 Mumbai time, not UTC. |
| `GET /api/stock/opening` — returns today's opening + today's bought/sold per metal + live in-hand + market value | ✅ Live | Lazy roll-forward walks from the latest stored opening to today computing each intervening day's closing. `INSERT OR IGNORE` means user-set opening can never be overwritten. No cron — a multi-day gap catches up on first page view. |
| `POST /api/stock/opening` — upserts today's opening per metal | ✅ Live | Records `set_by` (from the current session's PIN label), `set_at`, clears `auto_rolled` |
| **Opening Stock panel** (collapsible) on `/stock` Live | ✅ Live | Auto-expands when today's opening was auto-rolled so Niyam verifies the numbers. 4 per-metal inputs in fine grams with live kg preview, atomic batch save. |
| **Stock In Hand bar** (always visible) on `/stock` Live | ✅ Live | Horizontal strip of 4 metal cards above the filter pills. Each card: in-hand grams, delta from opening with up/down arrows, market value. Total value + delta in the header. |
| Copy subtitle: "becomes today's closing at EOD" | ✅ Live | In-hand IS the projected closing — same number, two framings, so we don't render it twice |
| Single-scan day bucketing returns net/bought/sold in one DB query | ✅ Live | No N+1 per-metal re-queries |

**Reports**

| Feature | Status | Details |
|---|---|---|
| ReportLetterhead component | ✅ Live | Reusable branded header: PrismX logo, "Precious Metals Trading" tagline, Confidential stamp, date/time, title, subtitle. Dark on screen, white paper in print. |
| Print variants across all report-like pages | ✅ Live | `@media print` rules in `globals.css` flip dark → white, preserve colors via `-webkit-print-color-adjust`, tighten spacing, A4 sizing |
| Reports page print output overflow fix | ✅ Live | StatCard values shrink from `text-3xl` → `print:text-lg` with `tabular-nums`, tighter print padding so 7-figure amounts fit the 3-column grid on A4 |

**Financial Year (global)**

| Feature | Status | Details |
|---|---|---|
| `src/lib/financial-year.ts` — pure functions, server + client share | ✅ Live | `parseFyStart`, `deriveFy`, `listFinancialYears`, `intersectFy`. IST-aligned midnight boundaries (`istMidnightIso`). |
| `GET /api/settings` — generic key/value store backed by existing `settings` table | ✅ Live | Returns defaults so the client never sees a loading dance |
| `PUT /api/settings` — per-key validation | ✅ Live | `financial_year_start` must round-trip parse as MM-DD |
| `FyProvider` React context mounted in root layout | ✅ Live | Fetches `/api/settings` once, derives 6 FYs (current + 5 prior), persists selection to `localStorage` (`prismx_selected_fy_v1`), exposes `{fy, fys, fyStart, setFy, refresh}` via `useFy()` |
| `FySelector` dropdown component | ✅ Live | Compact button with outside-click dismiss, Escape-to-close, "Current" badge on FY[0], `print:hidden` |
| Top-bar integration | ✅ Live | Mobile: next to Settings/Logout in the PriceTicker top strip. Desktop: new thin strip above the price grid (restores an always-visible header row). |
| **Deals Live** FY integration | ✅ Live | `intersectFy` clamps period-pill window to selected FY; letterhead subtitle, share text, CSV export label all carry the FY name |
| **Stock Live** FY integration | ✅ Live | All-time register + export filter by FY window on `COALESCE(reviewed_at, received_at)`. Daily Opening/In-Hand section deliberately NOT FY-filtered (today is always in the current FY). |
| **Reports** FY integration | ✅ Live | `intersectFy` clamps period dates; letterhead shows FY |
| **Settings** editor — month + day `<select>`s with live preview | ✅ Live | Save PUTs `/api/settings` and calls `refreshFy()` so the top-bar dropdown rebuilds without a reload |

**UX / layout fixes (Apr 11)**

| Fix | Status | What it was |
|---|---|---|
| `/review` desktop double-wrap | ✅ Live | Page had its own `lg:pl-60 min-h-screen bg-gray-950` wrapper on top of what `layout.tsx` already provides, producing a 480 px sidebar offset on desktop. Fixed by removing the duplicate outer wrapper. |
| Mobile More overflow menu | ✅ Live | Bottom nav only had 5 tabs (Home/Review/Stock/Deals/Chats). Reports/Users/Money Flow/Bot/Settings were unreachable from phone. Added a 6th "More" tab that opens a bottom-sheet overlay with the overflow items + Logout. |
| Desktop top bar cleanup | ✅ Live | Mobile header chrome (PrismX logo + Settings/Logout icons) was rendering on desktop even though the sidebar already has all three. Wrapped the whole top bar in `lg:hidden`. |
| Sessions never auto-expire | ✅ Live | `GET /api/sessions` used to `DELETE` rows older than 24 h, silently logging out anyone who closed their tab for a day. Moved the window to a SELECT-clause display filter; session rows are now only deleted by logout / kick / PIN delete. |

### New / changed files (Phase B)

**New files**

```
src/lib/financial-year.ts                          (pure FY math)
src/components/fy-provider.tsx                     (context + localStorage persistence)
src/components/fy-selector.tsx                     (dropdown)
src/components/report-letterhead.tsx               (shared branded header)
src/app/api/settings/route.ts                      (key/value settings store)
src/app/api/sessions/route.ts                      (active/recent sessions + kick)
src/app/api/pins/route.ts                          (PIN CRUD + lock)
src/app/api/dispatch/route.ts                      (outbox GET/POST)
src/app/api/dispatch/export/route.ts               (SBS-shaped CSV)
src/app/api/deals/live/route.ts                    (approved register + aggregates)
src/app/api/deals/live/export/route.ts             (PrismX-shaped CSV)
src/app/api/stock/live/route.ts                    (all-time per-metal register)
src/app/api/stock/live/export/route.ts             (accountant CSV)
src/app/api/stock/opening/route.ts                 (daily opening + in-hand + roll-forward)
src/app/outbox/page.tsx                            (dispatch page)
src/app/users/page.tsx                             (logged-in users + PIN manager)
```

**Touched files**

```
src/lib/db.ts                                      (migrations v7 / v8 / v9 / v10)
src/app/api/auth/route.ts                          (rewritten to use sessions)
src/app/layout.tsx                                 (FyProvider wrap)
src/app/deals/page.tsx                             (Demo/Live toggle + Live register)
src/app/stock/page.tsx                             (Demo/Live toggle + Opening/In-Hand + Live register)
src/app/reports/page.tsx                           (FY filter + letterhead)
src/app/settings/page.tsx                          (Financial Year section)
src/components/auth-gate.tsx                       (heartbeat ping)
src/components/price-ticker.tsx                    (lg:hidden mobile chrome + FY selector strip)
src/components/sidebar-nav.tsx                     (Users + Outbox nav items)
src/components/bottom-nav.tsx                      (6-tab + More overflow sheet + nav items)
src/app/globals.css                                (dispatch animation keyframes + print rules)
```

### Database migrations (current version: **10**)

| Version | Description | Ship date |
|---|---|---|
| 1 | Add `contact_name` to `deals` | earlier |
| 2 | Add `refining_cost_per_gram` + `total_cost_usd` to `deals` | earlier |
| 3 | Add `deliveries` + `settlements` tables | earlier |
| 4 | Add `parsed_deals` (legacy bot) | earlier |
| 5 | Add `meta_config` | earlier |
| 6 | Add `pending_deals` (maker-checker queue) | Apr 10 |
| **7** | Add `auth_pins` + `auth_sessions` and seed 4 default PINs | Apr 11 |
| **8** | Add `locked` column to `auth_pins` | Apr 11 |
| **9** | Add dispatch columns to `pending_deals` (`dispatched_at`, `dispatched_to`, `dispatch_response`, `dispatch_batch_id`) | Apr 11 |
| **10** | Add `stock_opening` table (daily opening/closing register) | Apr 11 |

### Phase B technical notes

- **Timezone consistency**: every new feature that bucketed a date (FY boundaries, stock_opening business days, Deals Live "today" pill) uses IST (+05:30) midnight, never UTC. A trade at 11:55 PM March 31 IST stays in FY X-Y; 12:01 AM April 1 IST moves to FY Y-Z. Single constant (`IST_OFFSET_MS`) duplicated across files for clarity rather than imported, which makes each endpoint self-contained.
- **Lazy roll-forward over cron**: the daily opening-stock roll isn't on a cron. Instead, `GET /api/stock/opening` walks forward from the latest stored opening to today computing each intervening day's closing and inserting it as the next day's opening, all in one SQLite transaction. A server that was down over a long weekend catches up on first page view. `INSERT OR IGNORE` makes the walk idempotent so concurrent requests can't duplicate rows.
- **Client-side filter, server-side export**: Deals Live and Stock Live both filter in-memory for pill UX (instant, no round-trip) but push filters to SQL for CSV export (scales to thousands of rows). Client and server share the same predicate function so they can't drift.
- **Unlimited login**: the 24h sweep in `/api/sessions` was the single biggest footgun in Phase A — it silently logged users out after a day of inactivity. Phase B moved the 24h window to a display filter (`WHERE last_seen >= cutoff` in the SELECT) so session rows are only deleted by explicit logout / admin kick / PIN delete / cascade on PIN deletion. Cookies remain valid for 365 days.
- **Force-logout without push**: kicking a session just deletes the DB row. The victim's `AuthGate` heartbeat (30 s interval) gets `authenticated: false` on the next tick and flips to the PIN pad. No WebSocket, no SSE — the existing polling is the push channel.
- **Locked PIN returns "Wrong PIN"**: deliberate. An attacker who tried `111111` and got a "locked" response would learn 111111 is a real PIN. Same response as a truly wrong PIN preserves zero information.
- **Grouped active table on `/users`**: sessions are grouped client-side by `(label, ip)` so 15 staff sharing the "Staff" PIN on the same office WiFi collapse to one row with `2 sessions` instead of 15 noisy lines. Grouping happens in the browser (over the already-fetched list); the `/api/sessions` endpoint stays a flat list for easy testing and future reuse.
- **Dispatch simulation is honest**: both destinations stamp `dispatched_at` on the DB row and return a fake-but-plausible response string. When OroSoft's API and the SBS template are finalized, the swap is literally "replace the `setTimeout` choreography with `await fetch(orosoftUrl, {...})` and pipe the response into `dispatch_response`." The DB schema, the UI states, the audit trail all survive untouched.

---

### What's NEXT from Phase B's perspective (superseded by Phase C below)

| Phase | Status | Blocked on |
|---|---|---|
| **Monday Apr 13, 11:15 AM meeting with OroSoft** | ⏳ Gating item | Everything Pakka-output is blocked on this. See `project_orosoft_monday_meeting.md` in memory for the 26 prepared questions and integration brief. |
| **Kachha → SBS REST API writer** | ⏳ Ready to build | SBS vendor agreed to REST APIs on Apr 11 (Excel path obsoleted). Template + endpoint details still TBD. |
| **Pakka → OroSoft API writer (real HTTP, not simulated)** | ⏳ Blocked on Monday meeting | Swap is ~50 lines once we have API credentials |
| **HMAC signature verification fix** | ⏳ Investigation needed | Requires re-populating `meta_config.app_secret` with temporary logging of expected-vs-received HMAC |
| **Niyam's Meta Business Verification** | ⏳ 2-4 weeks (Meta-side review) | Trade License + Business Verification documents |
| **Switch webhook from Ashish's test app to Niyam's verified PrismX number** | ⏳ Awaiting Niyam's Meta verification | ~10-minute endpoint swap |
| **Reports page switch from Demo deals → Live (approved pending_deals)** | 💡 Optional next chunk | Would make Reports' FY filter reflect real WhatsApp-sourced data instead of the demo `deals` table. Deals Live register already does this — Reports can reuse the same math. |
| **Money Flow FY integration** | 💡 Optional next chunk | The page doesn't currently scope by FY. Low priority until real money-movement data lands. |
| **Bot Phase 4 — Auto-negotiator** | 🔒 Deferred | Requires Phase A + B stable AND Niyam's Meta verification complete. Multi-week build. |

---

## 🎯 PHASE C — Polish + Concurrency + Roles (Apr 12, 2026)

Phase C rounds the edges off Phase B into something that genuinely feels like a product. It's smaller in scope than A or B (no new major pages) but touches the entire surface — theme, identity, dashboard, concurrency coordination, keyboard polish, WhatsApp scope.

### One-sentence summary per area

- **Super Admin role** — a third tier above Admin, with hard safeguards against deleting/downgrading the last super_admin. Niyam is promoted via migration v11; Ashish also promoted for co-admin resilience. Rules enforced server-side with granular `canCreateRole` / `canModifyPin` / `canKickRole` helpers shared by `/api/pins` and `/api/sessions`.
- **Light/dark theme toggle** — sun/moon button in the top bar, `localStorage`-persisted. Palette inversion via CSS variables in `.light` scope so no component files need rewriting — existing `bg-gray-950` / `text-white` / `bg-white/5` classes all flip automatically. Defaults to dark; respects `prefers-color-scheme` on first visit.
- **Current user card in nav** — avatar (1-2 initials) + label + role pill in the desktop sidebar footer and the mobile More sheet. Colour-coded per role (violet/amber/gray).
- **Keyboard PIN entry** — lock screen now accepts physical digits 0-9, Backspace, and Escape on desktop. Click-only before.
- **Rich Live Dashboard** — the Home page got a Demo/Live toggle defaulting to Live. Live view has 8+ card groups including operational queue (pending review, outbox, dispatched today, active users), today's activity, stock-in-hand strip, FY analytics (Kachha/Pakka split, metal volume, top counterparties), and a recent trades feed. **Trading P&L block is role-gated** — only Admin+ sees revenue/cost/realized/unrealized cards and $ amounts in the recent-trades table.
- **Dispatch lock + global banner** — concurrency visibility. When any operator clicks "Send all" on `/outbox`, a 3-second lock is written to the settings KV. A global `DispatchBanner` mounted in the layout polls `/api/dispatch` every 2s and shows a pulsing "Niyam is pushing 4 deals to OroSoft…" strip on every other operator's screen. Send buttons disable + the server returns 409 if a POST comes in during another user's lock. **This is the answer to the 10-15 concurrent users question**: SQLite+better-sqlite3+PM2-fork was already correctness-safe; Phase C adds the visibility layer.
- **Demo/Live defaults** — `/deals` and `/stock` now default to **Live**. Demo is still one click away via the toggle.
- **WhatsApp outbound disabled (demo mode)** — the chat compose input on `/whatsapp` is replaced with a read-only notice. All the backend plumbing (`sendTextMessage`, `wamid`/`send_status`/`send_error` columns from migration v12, red-bubble error state in `ChatThread`) stays wired up and ready — only the UI trigger is removed. Reason: the System User token currently has zero asset permissions on Meta's Business Manager (confirmed via `/tmp/diag-meta.sh` showing empty `assigned_whatsapp_business_accounts`). Real outbound waits on Niyam's Meta Business Verification completing and a fresh token being minted from a correctly-assigned System User.

### Feature table — everything shipped in Phase C

**Role hierarchy — super_admin > admin > staff**

| Feature | Status | Details |
|---|---|---|
| Migration v11 | ✅ Live | Promotes `pin_niyam.role = 'super_admin'`. Idempotent UPDATE; `role` column was already TEXT so no schema change needed. |
| Ashish promoted via direct SQL | ✅ Live | Two super_admins for co-admin resilience. Last-super_admin safeguard still enforced even with two. |
| `src/lib/auth-context.ts` | ✅ Live | `getCurrentUser(req)`, `normalizeRole`, `canCreateRole`, `canModifyPin`, `canKickRole`, `countSuperAdmins` — single source of truth for the hierarchy, imported by both `/api/pins` and `/api/sessions`. |
| `/api/pins` POST hardening | ✅ Live | 401 if not signed in, 403 for staff, 403 if non-super_admin tries to create a super_admin PIN. |
| `/api/pins` PUT hardening | ✅ Live | Blocks admin from touching super_admin rows, blocks role-escalation via PUT, blocks downgrading the last super_admin. |
| `/api/pins` DELETE hardening | ✅ Live | Same gates + hard refusal to delete the last super_admin. |
| `/api/sessions` DELETE hardening | ✅ Live | Id-based and group-based (`?label=&ip=`) kicks both check target roles. Group kick refuses if ANY matching label belongs to a super_admin and the caller isn't one. |
| `/users` page UI | ✅ Live | Role pills colour-coded (violet=super_admin, amber=admin, gray=staff). Add/Edit role dropdowns filtered by `roleOptionsFor(currentRole)`. Lock/Edit/Delete buttons disabled with explanatory tooltips on super_admin rows when viewed by an admin. Revoke/Kick buttons disabled on super_admin sessions for admins. Staff see a "read-only" notice instead of the Manage PINs panel. |

**Light/dark theme toggle**

| Feature | Status | Details |
|---|---|---|
| `ThemeProvider` | ✅ Live | React context + `localStorage` (`prismx_theme_v1`). Applies `.dark` or `.light` class to `<html>`. Defaults to dark; first-visit check of `prefers-color-scheme: light` for new users. |
| `ThemeToggle` | ✅ Live | Sun/moon button with crossfade + rotation. Mounted in PriceTicker mobile strip + desktop FY row. |
| `.light` palette override in `globals.css` | ✅ Live | `@custom-variant dark (&:where(.dark, .dark *))` enables class-based dark variant. `.light` scope redefines `--color-gray-950` through `--color-gray-50` + `--color-white` so every existing `bg-gray-950` / `text-white` / `bg-white/5` class flips automatically without rewriting components. |
| Tuned palette (post-feedback) | ✅ Live | Body `#f4f5f7` (soft cool-neutral), cards pure `#ffffff` — matches GitHub/Linear/Stripe light modes. Avoids the "too white" stark look. |

**Dashboard Live view**

| Feature | Status | Details |
|---|---|---|
| Demo/Live toggle (defaults Live) | ✅ Live | Same pattern as `/deals` and `/stock`. Demo view preserved unchanged in a `DemoView` sub-component. |
| Welcome bar | ✅ Live | Avatar (role-coloured) + "Welcome back, {name}" + role pill + FY + date/time. |
| Operational Queue row | ✅ Live | 4 cards, all roles: Pending Review (turns rose when > 0), In Outbox, Dispatched Today, Active Users. |
| Today's Activity row | ✅ Live | 4 cards, all roles: Deals Today, Buys Today (grams), Sells Today (grams), FY Deals total with Kachha/Pakka split. |
| Stock In Hand strip | ✅ Live | 4 per-metal mini cards reusing `/api/stock/opening` data. Delta from today's opening with ↑↓ arrows. |
| **Trading P&L row** (ADMIN+ ONLY) | ✅ Live | 8 cards gated on `role === 'admin' || role === 'super_admin'`: Today's Revenue / Cost / Realized P&L / FY Realized P&L / Unrealized P&L / Stock Value / Cost Basis / Avg Deal Size. Violet "Admin only" badge next to the heading. |
| FY Analytics row | ✅ Live | 3 cards, all roles: Kachha vs Pakka split (percent bars), Volume by Metal (grams-only — no $), Top Counterparties (deal count only — no $). |
| Recent Trades feed | ✅ Live | Last 10 FY deals. Amount column only renders when viewer is admin+ (staff see qty only). |
| Parallel endpoint fetch | ✅ Live | 7 endpoints hit in `Promise.all()` every 10 seconds. No new `/api/dashboard` aggregator — the page composes existing endpoints. |

**Concurrency — dispatch lock + global banner**

| Feature | Status | Details |
|---|---|---|
| Dispatch lock in settings KV | ✅ Live | Stored under key `dispatch_lock` with shape `{started_at, started_by, target, deal_count, expires_at}`. 3-second display window (`LOCK_DURATION_MS`). Auto-cleared on GET when `expires_at` has passed. |
| `POST /api/dispatch` acquires lock | ✅ Live | Written BEFORE the UPDATE so concurrent POSTs see it. Own-user re-POST allowed; other-user POST returns 409 with `{error, lock}` in body. |
| `GET /api/dispatch` returns lock | ✅ Live | Every consumer (banner, `/outbox`, dashboard) sees the same view. Stale locks are cleared in the same query. |
| `DispatchBanner` component | ✅ Live | Mounted in layout below PriceTicker so it appears on every page. Polls `/api/dispatch` every 2s. Resolves current user's label via `/api/auth` so own dispatches don't trigger the banner. Colour-coded (emerald for OroSoft, sky for SBS). Pulsing dot + text + "Other operations paused" subtitle. `print:hidden`. |
| `/outbox` Send buttons disabled on other-user lock | ✅ Live | Both panels disabled regardless of target — "one dispatch at a time across the whole app" rule. Inline amber explainer above the disabled button. |
| Hard guard in `sendAll()` | ✅ Live | Early return if `blocked` before POST, so a stale UI state can't trigger a doomed request. |
| 10-15 concurrent users readiness confirmed | ✅ Documented | SQLite WAL mode + better-sqlite3 synchronous writes + PM2 fork single-instance were already correctness-safe. Lock adds the visibility layer. |

**Identity + UX polish**

| Feature | Status | Details |
|---|---|---|
| `src/lib/user-display.ts` | ✅ Live | `initialsFromLabel`, `roleLabel`, `roleAccentClass` — shared helpers for the user card rendering. |
| Current user card in SidebarNav | ✅ Live | Above Settings. Avatar + label + role. Fetches `/api/auth` once on mount. |
| Current user card in BottomNav More sheet | ✅ Live | Below drag handle. Identical shape. |
| PIN pad desktop keyboard | ✅ Live | `useEffect` on `document` `keydown` maps 0-9 → digit, Backspace/Delete → pop, Escape → clear. Uses functional `setPin` form to avoid stale-closure state. Numeric keys `preventDefault` so Safari's in-page find doesn't steal them. Non-numeric keys pass through so `⌘R` / `⌘W` still work. |
| `/deals` + `/stock` default to Live | ✅ Live | Demo still one click away via the toggle. |

**WhatsApp — inbound-only demo mode**

| Feature | Status | Details |
|---|---|---|
| Migration v12 | ✅ Live | Adds `wamid`, `send_status`, `send_error` columns to `whatsapp_messages` so successful and failed outbound sends can be tracked distinctly. |
| `sendTextMessage` helper returns `SendResult` | ✅ Live | `{ok:true, wamid}` or `{ok:false, error}` with Meta's raw error message surfaced. No more silent `Promise<void>`. |
| `POST /api/whatsapp` on direction='outgoing' | ✅ Wired up, behind UI feature flag | Resolves contact → phone from `pending_deals.sender_phone` (case-insensitive, whitespace-trimmed), calls `sendTextMessage`, persists `wamid`/`send_status`/`send_error`. The POST path is live and tested; only the UI trigger is disabled. |
| `ChatThread` compose input disabled | ✅ Live | Replaced with an amber "Read-only — outbound sending paused until WhatsApp Business account verified" notice. Re-enabling is a one-file revert (component still has `DeliveryTicks` / `FailedIndicator` rendering). |
| `/tmp/diag-meta.sh` on server | ✅ Live | Diagnostic script that runs `debug_token`, `/me/businesses`, phone-number GET, and `assigned_whatsapp_business_accounts` lookup so asset-assignment state can be verified in one pass after any Business Manager change. |

**Small polish**

| Change | Status | Details |
|---|---|---|
| Removed "Why this page matters" callout from `/outbox` | ✅ Live | Demo-copy cleanup. |
| Message timestamp "0" bug on `/whatsapp` | ✅ Fixed | `hasLock && "..."` short-circuited to literal number 0 because SQLite returns INTEGER, not boolean. Fixed with `Boolean(m.is_lock)` coercion + ternary. |
| Failed WhatsApp send rows cleaned up on server | ✅ Done | Two leftover "test"/"ok" rows from outbound debugging deleted so demo chat shows no red bubbles. |

**Audit Trail (migration v13)**

| Feature | Status | Details |
|---|---|---|
| `audit_log` table (migration v13) | ✅ Live | Immutable mutation log — columns: id (UUID), actor (PIN label), action (e.g. `approve`, `reject`, `edit`, `dispatch`, `party_create`, `party_update`, `party_deactivate`), target_type (e.g. `deal`, `party`), target_id, before (JSON snapshot), after (JSON snapshot), created_at. |
| `src/lib/audit.ts` — `logAudit()` helper | ✅ Live | Single call-site helper for all mutation endpoints. Writes immutable rows; no UPDATE/DELETE on audit_log. |
| Wired into review approve/reject/edit | ✅ Live | Every maker-checker action writes an audit row with before/after snapshots of the pending_deal. |
| Wired into dispatch | ✅ Live | Dispatch POST logs the batch with deal IDs and target. |
| Wired into party CRUD | ✅ Live | Party create, update, and soft-deactivate each logged. |
| `GET /api/audit` with filters | ✅ Live | Query params: `from`, `to`, `actor`, `action`, `target_id`. Returns audit rows newest-first. |
| `/audit` page | ✅ Live | FY-aware timeline with expandable before/after JSON diffs. Actor + action filter dropdowns at the top. Integrates with `useFy()` for date scoping. |

**Party Master (migration v14)**

| Feature | Status | Details |
|---|---|---|
| `parties` table (migration v14) | ✅ Live | Columns: id (UUID), short_code (unique), name, sbs_party_code, orosoft_party_code, aliases (JSON array), notes, active (INTEGER, default 1), created_at, updated_at. Dual vendor codes for both downstream systems. |
| `GET /api/parties` — search + filter | ✅ Live | Query params: `q` (searches short_code, name, aliases), `active` (0/1). Returns all matching parties. |
| `POST /api/parties` — create | ✅ Live | Validates required fields, checks short_code uniqueness. Audit-logged. |
| `PUT /api/parties` — update | ✅ Live | Partial update by id. Audit-logged with before/after. |
| `DELETE /api/parties` — soft deactivate | ✅ Live | Sets `active=0` instead of deleting the row. Audit-logged. |
| `POST /api/parties/upload` — CSV bulk import | ✅ Live | Upsert by `short_code` — existing parties are updated, new ones created. Returns counts of created/updated/skipped. |
| `GET /api/parties/template` — blank CSV template | ✅ Live | Downloads a CSV with column headers only, for staff to fill and upload. |
| `GET /api/parties/sync?target=sbs\|orosoft` — stub | ✅ Stub (501) | Returns HTTP 501 with a message listing vendor requirements. Ready for real sync once vendor APIs are available. |
| `/parties` page | ✅ Live | Searchable table with inline add/edit forms, CSV upload button, sync buttons (with 501 toast), print via ReportLetterhead. |
| Nav items: Parties + Audit | ✅ Live | Added to both SidebarNav and BottomNav More overflow menu. |

**Dispatch Sync Log (migration v15)**

| Feature | Status | Details |
|---|---|---|
| `dispatch_log` table (migration v15) | ✅ Live | `INTEGER PRIMARY KEY AUTOINCREMENT` for sequential SYNC-NNNN numbers. Columns: id (auto), timestamp, target, deal_count, deal_ids (JSON), batch_id, request_summary, http_status, response_body, status, error_message, sent_by. |
| `POST /api/dispatch` writes sync log | ✅ Live | Every dispatch POST inserts a `dispatch_log` row with all context: who sent, which deals, what target, simulated HTTP status + response. |
| `GET /api/dispatch` returns `sync_log` | ✅ Live | Response now includes `sync_log` (last 50 entries) alongside the existing outbox + history. |
| `/outbox` Sync Log section | ✅ Live | New section below Recent Dispatches with a table: Sync # | Time | Target | Deals | Status | Response | Sent By. |

**SBS panel updated to API flow visual**

| Feature | Status | Details |
|---|---|---|
| SBS destination panel redesign | ✅ Live | The Excel spreadsheet visual (mini XLSX window with rows sliding in) has been replaced with the same PrismX-to-HTTPS-REST animated pipeline used by the OroSoft panel. Title changed "SBS Excel" to "SBS"; acronym changed "XLS" to "API". |
| `OrosoftVisual` renamed to `ApiFlowVisual` | ✅ Live | Now accepts `destLabel` and `accentColor` props so both panels reuse the same component. `FlowNode` accepts "sky" colour alongside the existing "emerald". |
| SBS vendor agreed to REST APIs | ✅ Confirmed | Apr 11 meeting with Niyam + SBS vendor IT team confirmed REST API access. The Excel-based pipeline is no longer the plan. |

**Installation guide + scripts**

| Feature | Status | Details |
|---|---|---|
| `INSTALL.md` | ✅ Live | Comprehensive installation guide covering Ubuntu/Debian, RHEL, and Windows. Includes prerequisites, step-by-step setup, PM2 configuration, nginx reverse proxy, SSL, and Meta webhook setup. |
| `scripts/install-ubuntu.sh` | ✅ Live | Automated installer for Ubuntu/Debian — installs Node.js, PM2, Tesseract, clones repo, builds, and configures PM2. |
| `scripts/diagnose-meta.sh` | ✅ Live | Meta diagnostic script (moved from `/tmp/diag-meta.sh` on server to repo). Runs `debug_token`, `/me/businesses`, phone-number GET, and `assigned_whatsapp_business_accounts` lookup. |
| Repo hygiene | ✅ Done | `.playwright-mcp/` deleted, root images deleted, `.gitignore` updated. MacBook is source-code only; nuremberg is pre-prod. |

### New / changed files (Phase C)

**New files**

```
src/components/theme-provider.tsx                  (theme context + localStorage)
src/components/theme-toggle.tsx                    (sun/moon button)
src/components/dispatch-banner.tsx                 (global in-progress banner)
src/lib/auth-context.ts                            (role helpers for route handlers)
src/lib/user-display.ts                            (initials + role formatting)
src/lib/audit.ts                                   (logAudit() helper for immutable audit log)
src/app/audit/page.tsx                             (audit trail page — FY-aware timeline)
src/app/parties/page.tsx                           (party master — searchable table + CRUD)
src/app/api/audit/route.ts                         (audit log GET with filters)
src/app/api/parties/route.ts                       (party CRUD — GET/POST/PUT/DELETE)
src/app/api/parties/upload/route.ts                (CSV bulk import)
src/app/api/parties/template/route.ts              (blank CSV template download)
src/app/api/parties/sync/route.ts                  (stub — 501 with vendor requirements)
INSTALL.md                                         (comprehensive installation guide)
scripts/install-ubuntu.sh                          (automated Ubuntu/Debian installer)
scripts/diagnose-meta.sh                           (Meta diagnostic — moved from /tmp)
TECHNICAL-SPECIFICATION.md                         (new reference doc, repo root)
```

**Touched files**

```
src/lib/db.ts                                      (migrations v11, v12, v13, v14, v15)
src/lib/meta-whatsapp.ts                           (sendTextMessage → SendResult)
src/app/layout.tsx                                 (ThemeProvider + DispatchBanner)
src/app/globals.css                                (.light palette + dark custom variant)
src/app/page.tsx                                   (Demo/Live toggle + rich Live dashboard)
src/app/deals/page.tsx                             (default Live)
src/app/stock/page.tsx                             (default Live)
src/app/users/page.tsx                             (role-aware UI, violet super_admin pills)
src/app/outbox/page.tsx                            (dispatch lock + sync log section + API flow visual)
src/app/api/dispatch/route.ts                      (lock acquire/read/expire + sync log write + sync_log in GET)
src/app/api/review/[id]/route.ts                   (audit log wired into approve/reject/edit)
src/app/api/pins/route.ts                          (role-gated POST/PUT/DELETE)
src/app/api/sessions/route.ts                      (role-gated DELETE, group-kick guard)
src/app/api/whatsapp/route.ts                      (outbound send wiring, disabled in UI)
src/components/sidebar-nav.tsx                     (current user card + Parties/Audit nav items)
src/components/bottom-nav.tsx                      (current user card in More sheet + Parties/Audit)
src/components/price-ticker.tsx                    (ThemeToggle in both mobile + desktop strips)
src/components/pin-pad.tsx                         (keyboard listener)
src/components/chat-thread.tsx                     (compose input → read-only notice)
.gitignore                                         (cleaned up — .playwright-mcp/, root images)
PROJECT-PLAN.md                                    (this file — Phase C section)
```

### Database migrations (current version: **15**)

| Version | Description | Ship date |
|---|---|---|
| 1 | Add `contact_name` to `deals` | earlier |
| 2 | Add `refining_cost_per_gram` + `total_cost_usd` to `deals` | earlier |
| 3 | Add `deliveries` + `settlements` tables | earlier |
| 4 | Add `parsed_deals` (legacy bot) | earlier |
| 5 | Add `meta_config` | earlier |
| 6 | Add `pending_deals` (maker-checker queue) | Apr 10 |
| 7 | Add `auth_pins` + `auth_sessions` and seed 4 default PINs | Apr 11 |
| 8 | Add `locked` column to `auth_pins` | Apr 11 |
| 9 | Add dispatch columns to `pending_deals` | Apr 11 |
| 10 | Add `stock_opening` table (daily opening/closing register) | Apr 11 |
| **11** | Promote seeded Niyam PIN to `super_admin` role | Apr 12 |
| **12** | Add `wamid` / `send_status` / `send_error` columns to `whatsapp_messages` | Apr 12 |
| **13** | Add `audit_log` table (immutable mutation log) | Apr 12 |
| **14** | Add `parties` table (party master with dual vendor codes + aliases) | Apr 12 |
| **15** | Add `dispatch_log` table (sequential SYNC-NNNN sync log) | Apr 12 |

**Standard application features (Apr 12, late)**

| Feature | Status | Details |
|---|---|---|
| Change Own PIN (self-service) | ✅ Live | `POST /api/auth/change-pin` + inline form in sidebar footer. Verifies current PIN before accepting. Audit-logged. |
| Brute-force protection | ✅ Live | 5 failed attempts from same IP → 15-minute lockout (HTTP 429). In-memory counter, clears on PM2 restart. |
| Health check endpoint | ✅ Live | `GET /api/health` — no auth, returns status + version + uptime + memory + db_ok. < 10ms response. |
| Version info | ✅ Live | "PrismX v1.0 · Apr 2026" in sidebar footer |
| Custom 404 + 500 error pages | ✅ Live | Branded error pages replacing Next.js defaults |
| Backup & Restore page | ✅ Live | `/backup` — create/list/download/delete/restore. Optional AES-256-GCM encryption. Audit-logged. |
| OCR non-blocking fix | ✅ Live | Tesseract moved from `execFileSync` to async `execFile` — event loop stays free during 15-30s OCR runs |
| Notifications / Bell Icon | ✅ Live | Migration v16. notifications table + `/api/notifications` + bell icon in top bar with unread badge. Auto-generated on deal approve/reject + dispatch. Polls every 5s. Mark-read + mark-all-read. |
| Global Search (⌘K / Ctrl+K) | ✅ Live | `/api/search` queries across deals + parties + audit. Modal with debounced search, grouped results, arrow-key navigation. Trigger button in top bar for mobile. |
| Privacy Policy page | ✅ Live | `/privacy` — required by Meta for WhatsApp app setup |
| Staff Training Guide | ✅ Live | `docs/PrismX-Staff-Training-Guide.html` — branded HTML document with AREA KPI letterhead |

**Niyam's WhatsApp Business API — GO LIVE (Apr 21)**

| Milestone | Status | Details |
|---|---|---|
| Meta Developer account for Niyam | ✅ Done | Verified via debit card (phone SMS was rate-limited). App name: `NTWattsapp`, App ID: `1846937332664508` |
| Facebook Page created | ✅ Done | "Jinyi Gold HK" page in Meta Business Suite |
| WhatsApp product added to app | ✅ Done | Privacy policy at `https://nt.areakpi.in/privacy` satisfied Meta's requirement |
| Test number assigned | ✅ Done | `+1 555 653 5708`, Phone Number ID: `1134616856395015`, WABA ID: `605885604541511` |
| Permanent System User token | ✅ Done | Never-expiring token via `prismx_bot` System User with `whatsapp_business_messaging` + `whatsapp_business_management` scopes |
| Webhook verified + messages subscribed | ✅ Done | Callback URL `https://nt.areakpi.in/api/whatsapp/webhook`, verify token `prismx_webhook_verify` |
| **First real trades received** | ✅ Done | Two test trades from Niyam ("Nt") received and visible on `/review` — Apr 21, 2026 |
| Old test2WattsApp app retired | ✅ Done | Ashish's test app (app ID 1184960910192872, +1 555 629 9466) no longer connected to PrismX |
| Demo data cleared | ✅ Done | All 17 data tables cleared, system tables (auth, settings, meta_config) preserved |
| meta_config corruption fixed | ✅ Done | `verify_token` was `pris...rify` (truncated), `ocr_provider` was `tess...ract`. Root cause: Settings UI displayed truncated values and someone saved the form. Fixed directly in DB. |

**Known issue:** The PrismX Settings page (`/settings`) displays truncated values for long config strings and will OVERWRITE the DB with truncated values if saved. **Do not edit meta_config from the Settings UI** — use direct SQL or a future fix to the display logic.

---

### Deferred — to be built next

| Feature | Priority | Scope estimate |
|---|---|---|
| **Keyboard shortcuts** | Medium | Ctrl+Enter to approve, arrow keys in review queue. |
| **Data retention policy** | Medium | Admin setting: archive old audit/dispatch logs. |
| **Email notifications** | Low | Requires SMTP/SendGrid setup. |
| **2FA (TOTP)** | Low | Time-based OTP alongside PIN for high-value operations. |
| **In-app changelog** | Low | "What's new" modal. |
| **Localization** | Low | Hindi/Gujarati/Arabic support. |
| **Fix Settings page truncation bug** | Medium | The meta_config display truncates long values. Saving overwrites DB with truncated strings. |

---

### Meta Business Verification — In Progress (Apr 22)

| Event | Date | Status |
|---|---|---|
| WABA account restricted by Meta (automated, false positive) | Apr 21, 2:22 PM PST | ⚠️ Restriction on outbound. Inbound unaffected. |
| Appeal submitted via Business Support Home | Apr 22 | ⏳ Under review (24-48 hrs expected) |
| Business Verification documents submitted | Apr 22 | ❌ Rejected — wrong document types |
| **Rejection reasons:** | | |
| 1. Legal business name document — wrong type | | Need: CI, BR, or bank statement showing `JINYI GOLD HK LIMITED` |
| 2. Business address document — wrong type | | Need: document showing company name + `Unit 1712, 17/F Peninsula Square, 18 Sung On Street, Kowloon` |
| 3. Business phone document — wrong type | | Need: document showing company name + `+852 6946 9274` together. Bank confirmation letter is the best option. |
| **Resubmission** | ⏳ Pending | Niyam gathering correct documents (CI, BR, bank statement/letter). See `docs/Meta-Business-Verification-Guide.html` for full requirements. |

**Documents created for this process:**
- `docs/WABA-Restriction-Resolution-Guide.html` — appeal instructions + impact assessment + contingency plans
- `docs/Meta-Business-Verification-Guide.html` — document requirements for resubmission + action checklist

**Key insight:** The phone number `+852 6946 9274` is the hardest to verify — most official documents (CI, BR) don't include phone numbers. If it's a personal number not registered under the company, a bank confirmation letter listing it as the company's contact number is the best path. Or change the business phone in the form to one that IS on a company document.

---

### What's NEXT (Apr 24 onwards)

| Phase | Status | Blocked on |
|---|---|---|
| **Meta Business Verification resubmission** | ⏳ Niyam gathering documents | Need correct document types (CI/BR/bank statement). See `docs/Meta-Business-Verification-Guide.html` |
| **WABA restriction appeal** | ⏳ Under Meta review | Submitted Apr 22. Expected resolution: 24-48 hours. Likely auto-lifts once Business Verification completes. |
| **OroSoft Neo Financials UI credentials** | ⏳ Email sent to Avdhesh (Apr 24) | Need login to visually verify trades in OroSoft's web UI |
| **OroSoft silver stock codes** | ⏳ Requested from OroSoft | Silver (XAG) not set up in demo 2026 FY. Only gold (XAU) works currently. |
| **SBS REST API credentials** | ⏳ Waiting on SBS vendor | SBS vendor agreed to REST APIs on Apr 11. |
| **Kachha → SBS API writer (real HTTP)** | ⏳ Blocked on SBS credentials | Same pattern as OroSoft integration |
| **Niyam's dedicated HK/Indian number** | ⏳ Niyam buying a new number | Will replace the US test number (+1 555 653 5708). Staff messages the new number. |
| **Real party alias mapping** | ⏳ Niyam to confirm | Lock code aliases (TAKFUNG, SAPAN, etc.) → OroSoft account codes. Currently using demo accounts with fallback. |
| **Fix Settings page truncation bug** | Medium | The meta_config display truncates long values. |
| **Reports page switch from Demo → Live** | 💡 Optional | Reuse `/api/deals/live` math |
| **WhatsApp outbound re-enable** | 💡 After real number + WABA restriction lifted | Re-enable compose input in ChatThread |

---

## 🎯 PHASE D — Trade Desk + OroSoft Integration + Cloudflare Access (Apr 23-24, 2026)

### Trade Desk (standalone staff interface)

Built a completely separate trade entry interface at `https://nt.areakpi.in/nt/staff/trade/` — standalone HTML served by nginx, zero connection to PrismX. Staff sees only a simple trade entry form; they have no idea PrismX exists.

| Feature | Status | File |
|---|---|---|
| Standalone HTML page (no Next.js) | ✅ Live | `public/nt/staff/trade/index.html` |
| Professional light theme with dark header | ✅ Live | CSS redesign Apr 24 |
| PIN pad login (sends `source: "trade_desk"`) | ✅ Live | Same `/api/auth` endpoint |
| Trade code entry with validate-then-send flow | ✅ Live | Client-side parser mirrors server |
| Demo Seed buttons (Pakka + Kachha) | ✅ Live | 10 random gold trades per click |
| Recent entries list (last 15) | ✅ Live | Polls `/api/trade-entry` |
| `trade_desk` role — can only login to Trade Desk, blocked from mother app | ✅ Live | Auth route checks `source` field |
| nginx redirect `/staff/trade` → `/nt/staff/trade/` | ✅ Live | Prevents PrismX layout leak |

### Cloudflare Zero Trust Access

Entire `nt.areakpi.in` domain behind Cloudflare Access with toggle control from PrismX.

| Feature | Status | File |
|---|---|---|
| Cloudflare Access covers full domain | ✅ Live | Was `/nt/staff` only, expanded Apr 23 |
| Toggle enforce/bypass from Users page | ✅ Live | `src/app/api/cloudflare-access/route.ts` |
| Session duration selector (24h/1w/1m/1y) | ✅ Live | Updates Access Application via API |
| Auto-sync emails on user create/lock/delete | ✅ Live | `src/lib/cloudflare-access.ts` |
| Email field on all users (for Cloudflare OTP) | ✅ Live | Migration v17, `auth_pins.email` column |
| Currently **bypassed** (PIN-only auth) | ✅ | Flip toggle when ready to go live |

### User Management Enhancements

| Feature | Status | File |
|---|---|---|
| `trade_desk` role (4th role in hierarchy) | ✅ Live | `super_admin > admin > staff > trade_desk` |
| Country flag + name under IP on Users page | ✅ Live | Captures `CF-IPCountry` header at login |
| Horizontally scrollable tables on mobile | ✅ Live | `overflow-x-auto` + `min-w-[640px]` |
| Mobile bottom nav reordered | ✅ Live | Home → Review → Outbox → Users → Settings |

### OroSoft NeoConnect API Integration (Pakka Deals) — LIVE

**This is the biggest delivery of Phase D.** OroSoft provided demo API access (email from Avdhesh Sharma, Apr 24). Built full integration in one session.

| Feature | Status | File |
|---|---|---|
| OroSoft API client (JWT auth + token caching) | ✅ Live | `src/lib/orosoft-client.ts` |
| Field mapper (pending_deals → FixingTrade) | ✅ Live | `src/lib/orosoft-mapper.ts` |
| Real dispatch replaces simulation | ✅ Live | `src/app/api/dispatch/route.ts` (behind `orosoft_enabled` flag) |
| Sequential visual cards wired to real API calls | ✅ Live | Authenticate → Format → POST → Confirm |
| Red X on failed step, green only for passed | ✅ Live | No fake timers, real progress |
| Dry-run validation (pre-flight without sending) | ✅ Live | `POST /api/dispatch { dry_run: true }` |
| OroSoft test endpoint | ✅ Live | `GET /api/orosoft/test` |
| Party sync from OroSoft AccountsList | ✅ Live | `GET /api/parties/sync?target=orosoft` — 23 accounts synced |
| Default fallback account (OC0001) | ✅ Live | Unmapped parties use demo account |
| OroSoft Balances section on Outbox | ✅ Live | Live stock inventory + customer account positions |
| Developer Info section on Outbox | ✅ Live | Field mapping table, customer accounts, stock codes |
| Dispatched Trades log per target | ✅ Live | Collapsible, doc # highlighted as first column |
| Migration v19: OroSoft credentials | ✅ Live | Seeded in settings KV table |
| `orosoft_enabled` toggle | ✅ Live | Currently **enabled** |

**Verified against live OroSoft demo:** 3 trades successfully posted — FCT/2026/000010, FCT/2026/000011, FCT/2026/000012.

**API endpoints discovered and integrated:**
- Auth: `POST https://auth.neofinancials.com/v1_2/auth/token`
- FixingTrade: `POST /v1_2/api/document/FixingTrade`
- StockBalances: `GET /v1_2/api/reports/StockBalances`
- AccountBalances: `GET /v1_2/api/reports/AccountBalances`
- AccountsList: `GET /v1_2/api/details/AccountsList`
- FixingStocks: `GET /v1_2/api/details/FixingStocks`
- Locations: `GET /v1_2/api/details/Locations`

**Key findings during integration:**
- Stock codes in FixingTrade use NO spaces (`KG4X9`) but FixingStocks API returns them WITH spaces (`KG 4X9`)
- `docDate` required in yyyyMMdd format, must fall within OroSoft's current financial year
- Demo FY is 2026 — only gold (XAU) stock codes exist, silver/platinum/palladium not set up
- Response wraps doc number in `{"result":{"EXID":"FCT/2026/000012"}}`
- OroSoft demo has 16 customers, 7 suppliers, 2 locations

### New files (Phase D)

| File | Purpose |
|---|---|
| `src/lib/orosoft-client.ts` | OroSoft NeoConnect API client |
| `src/lib/orosoft-mapper.ts` | Field mapping + party resolution |
| `src/lib/cloudflare-access.ts` | Cloudflare Zero Trust API client |
| `src/app/api/orosoft/test/route.ts` | OroSoft connectivity test |
| `src/app/api/orosoft/balances/route.ts` | Stock + account balances proxy |
| `src/app/api/cloudflare-access/route.ts` | Cloudflare toggle + session duration |

### Schema migrations (Phase D)

| Version | Description |
|---|---|
| v17 | Add `email` column to `auth_pins` for Cloudflare Access |
| v18 | Add `country` column to `auth_sessions` for geo display |
| v19 | Seed OroSoft NeoConnect demo credentials in settings |

**Current operational status (Apr 24):**
- ✅ **OroSoft Pakka dispatch LIVE** — real API, real document numbers
- ✅ **Trade Desk operational** — staff can enter trades at `/nt/staff/trade/`
- ✅ **Cloudflare Access ready** — toggle to enforce when going live
- ✅ **Inbound trades working** — WhatsApp + Trade Desk → Review → Approve → Dispatch
- ✅ **Full pipeline end-to-end** — trade entry → review → dispatch to OroSoft → doc number back → balances visible
- ⏳ **OroSoft UI credentials** — email sent to verify trades visually
- ⏳ **Silver/platinum support** — waiting on OroSoft to set up stock codes
- ⏳ **SBS/Kachha integration** — waiting on SBS vendor credentials
- ❌ **WhatsApp outbound** — WABA still restricted

The original "WhatsApp Bot" section below (Phase 1/2/3 with 63 historical deals, free-text parsing, multi-language negotiation detection) describes an earlier architecture that was obsoleted by the April 10 scope change. Key obsolete elements:

- **Free-text "lock" keyword parsing** — replaced by structured `#NT` trigger. The old `/bot` tab still exists as an archive of the 63 historical deals but is **not** the production path.
- **Multilingual deal-keyword extraction (Chinese, Arabic)** — not needed for structured codes. Party names may still be non-English but the code syntax is ASCII.
- **Watching all customer-facing WhatsApp chats** — replaced by listening to one internal staff group only. Customer chats are no longer parsed.
- **Bot Phase 4 (auto-negotiator)** — still on the roadmap but **deferred** until Phase A + B + C ship and the maker-checker flow is stable.

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
| **Review** | `/review` | **Maker-checker queue for WhatsApp lock codes (Phase A, Apr 10-11, 2026).** **4-tab filter strip:** Pending / Approved / Rejected / **Ignored** (Ignored holds non-deal text messages in an in-memory ring buffer, 100 entries max, cleared on restart — proof the bot is listening to everything). **Card-based list** of pending_deals ordered newest-first. **Header per card:** sender name, timestamp, Edit toggle (iOS-style slider), Type badge (Kachha/Pakka/Unclassified). **Raw message** in monospace code block. **Screenshot OCR panel** (sky-blue, sits directly under raw message) — shows thumbnail of the attached image (tap to open full-size in new tab), OCR-extracted fields (amount, currency, wallet addresses, tx hash, date), and collapsible "Show raw text" pre block. **Parsed fields grid:** Direction, Metal, Quantity, Rate, Premium, Party. **Action buttons:** Approve + Reject for classified cards; "Approve as Kachha" + "Approve as Pakka" atomic picker for unclassified cards; Save + Cancel when editing. **Edit mode** (toggle on per card) — inline form with 9 editable fields (type, direction, metal, purity, qty in kg, rate, premium + premium type, party alias) — draft state is isolated per card and survives polling without clobbering. **Edit also works on rejected cards** (rescue flow) with "Approve anyway" button. **Parse errors panel** (red) on malformed deals with per-field error messages. **Pulsing "Live" indicator** in top-right header with "Xs ago" counter ticking every second. **3-second polling auto-refresh.** **Mobile-first layout** with `overflow-x-hidden` safety net and `<pre>` blocks for long text wrapping. |
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
| `/api/whatsapp/webhook` | GET, POST | **Meta Cloud API webhook endpoint.** GET handles Meta verification handshake (challenge/response). POST receives inbound messages. For **text** messages: splits on newlines, parses each line with `parseDealCode`, and inserts one pending_deals row per valid deal line (batched messages supported). Non-deal text → Ignored buffer. For **image** messages: downloads via Graph API, saves to `<cwd>/screenshots/<uuid>.ext`, runs Tesseract OCR, then routes via one of four attachment-linking cases (caption with deal code → atomic insert; image with no context → orphan buffer; text reply to orphan → attach OCR to new deal; image reply to earlier text deal → update that deal). HMAC signature verification is gated on `meta_config.app_secret` being populated (currently cleared — see Known Issues). Legacy free-text "lock" keyword branch still runs as a fallback for old bot path. |
| `/api/whatsapp/config` | GET, POST | Stores Meta WhatsApp credentials (phone_number_id, access_token, app_secret, verify_token, ocr_provider) in the `meta_config` table |
| `/api/review` | GET | **Lists pending_deals with status filter** (`?status=pending\|approved\|rejected\|ignored\|all`), returns counts per status for nav badges. Parses `screenshot_ocr` JSON blob server-side so clients receive a native object. `?status=ignored` returns the in-memory ignored buffer shaped like deal rows with null fields. |
| `/api/review/[id]` | PATCH, POST | **Maker-checker mutations.** PATCH updates any of the 10 writable fields (deal_type, direction, qty_grams, metal, purity, rate_usd_per_oz, premium_type, premium_value, party_alias, reviewer_notes). POST with `{action:"approve"}` approves; POST with `{action:"approve",deal_type:"K"\|"P"}` atomically classifies + approves in one transaction (used by unclassified `#NT` cards); POST with `{action:"reject"}` rejects. Re-approve of an already-rejected deal is supported (no intermediate pending state). |
| `/api/screenshots/[filename]` | GET | **Serves WhatsApp payment screenshots** saved by the webhook. Strict filename validation against UUID v4 + extension regex (`.jpg\|.jpeg\|.png\|.webp`) blocks path traversal before the filesystem is touched. Returns the file with correct Content-Type and `Cache-Control: public, max-age=3600, immutable`. Files live in `<cwd>/screenshots/` (gitignored, persistent across deploys on Nuremberg VPS). |
| `/api/simulator` | POST | Reset all data and re-seed |
| `/api/deliveries` | GET, POST | Delivery CRUD (filter by status). Tracks shipments to HK with buyer info, weight, shipping cost, status |
| `/api/settlements` | GET, POST | Settlement CRUD (filter by status). Tracks payment received → transfer to Dubai → seller payment |

#### Components Built

| Component | File | Description |
|-----------|------|-------------|
| Price Ticker | `price-ticker.tsx` | Sticky header, 2x2 mobile / 4-col desktop, 4 decimal prices, Demo/Live label. Top bar with **PrismX logo (h-5 mobile, h-6 desktop + "· Live Prices" subtitle on desktop)**, settings gear icon + logout icon |
| Sidebar Nav | `sidebar-nav.tsx` | Desktop left sidebar (hidden on mobile), **8 nav items** (Dashboard, **Review**, Stock, Deals, WhatsApp, Bot, Money Flow, Reports) + Settings + Logout. **PrismX logo as header** (h-8 transparent PNG, replacing the old text). **Count badges** on Review (amber, stays visible on active tab), Deals (rose), Chats (rose) — polls every 3 seconds |
| Bottom Nav | `bottom-nav.tsx` | Mobile bottom tab bar (hidden on desktop), **5 tabs:** Home, **Review**, Stock, Deals, Chats. **Amber Review badge** (queue counter, stays visible even on active tab); **rose Deals/Chats badges** (hide on own active tab). Polls every 3 seconds. |
| Auth Gate | `auth-gate.tsx` | Wraps entire app, checks session cookie, shows PIN pad if locked |
| PIN Pad | `pin-pad.tsx` | 6-digit numeric keypad with dot indicators, error feedback. **PrismX logo centred above "Enter PIN to continue"** |
| Review Page | `src/app/review/page.tsx` | Main maker-checker screen. Components defined inline: `DealCard` (with edit state, approve/reject/cancel actions), `OcrSection` (sky-blue panel with thumbnail + extracted fields + collapsible raw text), `IgnoredCard` (muted grey, no actions), `EditToggle` (iOS-style amber slider), `DealEditForm` (9-field form with pill selectors, native selects, number/text inputs), `PillSelect`, `SelectField`, `TextField`, `NumberField`, `LiveIndicator` (emerald pulsing dot + "Xs ago" ticker), `TypeBadge` (Kachha/Pakka/Unclassified), `Field` (read-only field renderer) |
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
| Database | `db.ts` | SQLite (better-sqlite3) singleton. WAL mode. **15 tables:** deals, payments, prices, settings, whatsapp_messages, deliveries, settlements, schema_version, parsed_deals (legacy bot), meta_config, pending_deals, auth_pins, auth_sessions, stock_opening, **audit_log** (v13), **parties** (v14), **dispatch_log** (v15), plus indexes. **Versioned migration system** (currently v15) — each migration runs once, tracked in schema_version table. Safe for both fresh DBs and existing ones. Never deletes data. |
| Deal Code Parser | `deal-code-parser.ts` | **Pure function** that extracts structured fields from a WhatsApp lock-code message. Accepts `#NTK` / `#NTP` / `#NT` trigger variants (case-insensitive), parses direction (BUY/SELL), quantity + unit (kg/g/oz with normalisation to grams via 31.1035), metal (gold/silver/platinum/palladium with aliases XAU/XAG/XPT/XPD/PD/PT), purity (18K/20K/22K/24K/995/999/9999/4N with defaults), rate (USD per troy oz), premium (absolute or percent), and party alias. Returns `{is_deal_code, parsed, fields, errors}`. Validated against 9 test fixtures covering happy paths, edge cases, and a deliberately malformed input. |
| Ignored Messages Buffer | `ignored-messages.ts` | **In-memory ring buffer** (max 100 entries) for WhatsApp text messages that arrive at the webhook but contain no `#NT` deal code trigger. Not persisted to the database — cleared on server restart. Shown in the `/review` **Ignored tab** as proof the bot is listening to everything and not silently dropping junk. Module-scoped state works because PM2 runs nt-metals as a single fork-mode instance. |
| Orphaned Attachments Buffer | `orphaned-attachments.ts` | **In-memory ring buffer** (max 50 entries, 1-hour TTL) for WhatsApp image attachments that arrive without a matching deal context (no caption, no reply). When a later text message arrives as a reply to one of these orphans (via Meta's `msg.context.id`), the webhook attaches the orphan's OCR + screenshot_url to the new pending_deal and drops the orphan from the buffer. Auto-prunes expired entries on every push/find. |
| Meta WhatsApp Helpers | `meta-whatsapp.ts` | `verifyWebhookSignature(payload, signature, appSecret)` — HMAC-SHA256 signature verification per Meta's spec (currently disabled in practice — see Known Issues). `downloadMedia(mediaId, accessToken)` — two-step Graph API flow (GET media URL → GET media bytes) returning a Buffer. `sendTextMessage()`, `markAsRead()` — outbound message helpers (not yet used). `getMetaConfig(db)` / `setMetaConfig(db, key, value)` — reads/writes the meta_config key-value store. |
| Image OCR | `image-ocr.ts` | **Multi-provider OCR** with 4 backends: (1) Google Cloud Vision, (2) Claude Vision, (3) GPT-4o-mini, (4) **Tesseract (local, free, default)** via `execFileSync` with 15-30s timeout. The Tesseract path runs 3 passes: English first (fastest), then English+Chinese+Arabic with auto page segmentation, then digits-only as a last resort. `parseOcrText()` post-processes raw text to extract USDT/HKD/USD amounts, TRC-20 wallet addresses, tx hashes, timestamps, weights, and bar counts. Returns a structured `OcrResult`. `analyzeImage()` is the main entry point — picks the provider based on `meta_config.ocr_provider`. |
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
| **Database** | SQLite via better-sqlite3 | WAL mode, **17 tables** at schema v15: `deals`, `payments`, `prices`, `settings`, `whatsapp_messages`, `deliveries`, `settlements`, `schema_version`, `parsed_deals` (legacy bot), `meta_config`, `pending_deals` (maker-checker queue, with dispatch lifecycle columns), `auth_pins`, `auth_sessions` (named users), `stock_opening` (daily opening/closing register), `audit_log` (immutable mutation log), `parties` (party master with dual vendor codes), `dispatch_log` (sequential sync log). File: `data.db` |
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

> **⚠️ SUPERSEDED April 10, 2026.** The architecture in this section reflects the pre-April-10 plan (free-text parsing with lock keyword detection). It has been replaced by the Maker-Checker Review Pipeline — see the "CURRENT BUILD STATUS — April 10, 2026" section at the top of this document. The content below is preserved for historical context and because the Meta webhook infrastructure (Bot Phase 2) was reused wholesale by the new architecture.

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
| **Bot Phase 1** | Chat Parser + Bot Tab | Read WhatsApp text, extract deals, classify buy/sell/locked/cancelled/working/settled. Bot tab with filters (source, metal, status, sort). **Built — 63 real deals from Niyam's chats.** | Done |
| **Bot Phase 2** | WhatsApp Webhook + Image OCR | Meta Cloud API webhook receives real-time messages. Auto deal detection on every message. Image OCR reads payment screenshots (4 providers: Tesseract free, Google Vision 1000 free/month, Claude, GPT-4o-mini). **Built — webhook live, OCR ready.** | Done |
| **Bot Phase 3** | Live WhatsApp Connection | Connect Niyam's WhatsApp Business number to Meta Cloud API. Messages flow into PrismX in real-time. Deals auto-captured. Payments auto-read from screenshots. **Waiting for Niyam's Meta setup.** | 1-2 days after Meta setup |
| **Bot Phase 4** | Auto-Negotiator | AI replies to buyers on WhatsApp, negotiates price within Niyam's boundaries, locks deals automatically. 24/7 operation across time zones. | 4-6 weeks |

#### What's Built & Deployed (Bot Infrastructure)

| Component | Status | URL/Details |
|-----------|--------|-------------|
| Bot tab | Live | /bot — 63 deals parsed from real chats, filterable by source/metal/status/sort |
| Webhook endpoint | Live | https://nt.areakpi.in/api/whatsapp/webhook — Meta verification working |
| Config API | Live | /api/whatsapp/config — stores Meta tokens securely |
| Image OCR | Ready | 4 providers: Tesseract (free local), Google Vision (1000 free/month), Claude, GPT-4o-mini |
| Settings UI | Live | Meta WhatsApp config section + OCR provider selector with pros/cons |
| Chat parser | Tested | 63 deals extracted from 2 real WhatsApp exports |
| Deal detection | Ready | Runs on every incoming webhook message |

#### Key Findings From Real Chats
- **15+ participants** across 2 groups. Roles: Dealer, Trader, Calculator (Gusini), Treasury, Logistics.
- **Languages:** 65-85% English, 15-30% Chinese. Bot needs bilingual.
- **Price:** Spot + premium (silver: "+1"). Fix +/- discount (gold: "-4", "-0.2%"). Per troy ounce.
- **Formula:** `(price ± premium) / 31.1035 * weight_grams = USDT_amount`
- **Lock keywords:** "Locked", "鎖價". Payment: USDT on TRC-20 (Tron). Wallets rotate.
- **Metals:** Gold (XAU), Silver (balls/珠子), Platinum (PT), Palladium (PD)
- **"k" = kg** (10k = 10kg = 10,000g). "LB" = London bar (~12.5kg).
- **OroSoft** = their existing ERP (Mumbai-based, AWS-hosted). May have API access.

#### Meta WhatsApp API — Safety & Costs

**Is there a risk of getting blacklisted by Meta?** No. We are using Meta's official Cloud API for its intended purpose (reading business messages). This is what Salesforce, HubSpot, Zoho, and 200M+ business accounts do.

| Action | Risk | Applies to us? |
|--------|------|---------------|
| Sending spam | High risk | No — we're a silent listener |
| Bulk marketing without opt-in | High risk | No — we don't send marketing |
| Unofficial/hacked WhatsApp APIs | Instant ban | No — official Meta Cloud API |
| Scraping WhatsApp Web | Ban | No — using official webhook |
| Too many messages sent | Rate limit | No — we send almost nothing |

**The only risk** is if Niyam's WhatsApp Business number gets reported for spam by users — that's about his business behavior, not our API connection.

**API Costs for Silent Listening:**

| Action | Cost |
|--------|------|
| Receiving webhook notifications (all messages) | FREE — unlimited |
| Reading message content | FREE — unlimited |
| Reading images/media | FREE — unlimited |
| Staff sends 5,000 messages/day on WhatsApp Web | FREE to us — we just listen |
| Niyam sends a few messages via our bot | FREE — 1,000 replies/month free tier |
| **Total monthly cost** | **$0.00** |

**Can the webhook URL be changed after approval?** Yes — anytime, no re-approval. Just change it in Meta Dashboard. The approval is for the WhatsApp Business number, not the URL.

#### Next Steps — Getting Meta Approval

Niyam needs to:
1. Go to **business.facebook.com** → Create Meta Business Account (as PrismX)
2. Go to **developers.facebook.com** → Create App (Business type) → Add WhatsApp product
3. In WhatsApp → Getting Started → Connect his business WhatsApp number
4. Share with us: Phone Number ID + Access Token
5. Configure webhook URL: `https://nt.areakpi.in/api/whatsapp/webhook`
6. Subscribe to `messages` webhook field

After that, messages flow into PrismX automatically. Staff changes nothing — they keep using WhatsApp Web.

#### Staff Deal Entry Format

Once live, staff can type a structured code for 100% accurate deal capture:
```
LOCK BUY 50KG GOLD -20
LOCK SELL 10KG SILVER +1.2
LOCK BUY 3KG PLATINUM -0.2%
LOCK SELL 100KG PD -33
```
Format: `LOCK [BUY/SELL] [QTY] [METAL] [PREMIUM/DISCOUNT]`

The bot also detects natural language deals from ongoing conversations (existing parser handles English + Chinese + Arabic).

#### Quotation Sent
- **Document:** docs/PrismX-Quotation.docx
- **Total:** Rs 2,25,000 one-time (4 modules)
- **Maintenance:** Rs 50,000/year (Year 1 free)
- **Payment:** 50% advance + 50% on go-live
- **Timeline:** 4 weeks
- **Dashboard (Module 1) included free** — already demo'd
- **Phase 3 (AI auto-negotiator) quoted separately** when needed

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
