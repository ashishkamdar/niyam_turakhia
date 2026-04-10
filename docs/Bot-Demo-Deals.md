# PrismX Bot Demo Deals

**For:** Niyam Turakhia walkthrough
**Test number:** `+1 555 629 9466`
**Prepared:** April 10, 2026

Three lots of dummy deal codes designed to demonstrate the maker-checker review pipeline at increasing complexity. Paste each lot as-is into a WhatsApp message, send to the test number, and watch `nt.areakpi.in/review` on your phone.

---

## Before you start

- **Make sure the bot review tab is already open** on Niyam's phone (or yours) at `https://nt.areakpi.in/review` with PIN `639263`.
- **Watch the "Live" indicator** in the top-right header — the emerald dot should be pulsing. Timestamp cycles between "just now" and "3s ago".
- **Use Niyam's own phone** to send if possible — it makes the demo feel personal. If his number isn't on the test number's allowed senders list, add it first under **developers.facebook.com → WhatsApp → API Setup → Manage phone number list**.
- **Keep a 5-second gap between lots** so each batch is clearly distinguishable on the review tab.

---

## LOT 1 — Single deal (warm-up)

**Tests:** basic webhook → parser → review card flow. One-message, one-deal is the simplest case.

```
#NTP SELL 5KG GOLD 24K @2568.40 -0.1 TAKFUNG
```

**Expected on the review tab (within 3 seconds):**
- 1 new Pakka card
- Direction `SELL` (amber), Metal `Gold 24K`, Quantity `5 kg`, Rate `$2568.4000/oz`, Premium `-0.1`, Party `TAKFUNG`

**What to say to Niyam:** *"This is the simplest case. One deal, one message. You see it on your phone within 3 seconds. Tap Approve and it's recorded."*

---

## LOT 2 — 3 deals in one message (tests batching)

**Tests:** the webhook splits multi-line messages into separate review cards. This is the single most important workflow improvement — staff can batch 3-10 locked deals in one WhatsApp message instead of sending them individually.

```
#NTP SELL 10KG GOLD 24K @2567.85 -0.1 TAKFUNG
#NTK BUY 50KG SILVER 999 @30.18 -0.80 KARIMCO
#NTP SELL 2KG PLATINUM 999 @979.50 -4 SHAH
```

**Expected on the review tab (within 3 seconds):**
- **3 separate cards** appearing together
- Mix of badges: 2 Pakka + 1 Kachha
- Mix of metals: gold, silver, platinum
- Mix of directions: 2 sells (to HK buyers) + 1 buy (from UAE seller)

**What to say to Niyam:** *"Your staff can type 3, 5, or 10 locked deals in one WhatsApp message with each deal on its own line. The bot splits them and creates separate review cards for each one. No one has to send 10 messages."*

---

## LOT 3 — 15 deals (realistic trading day)

**Tests:** volume handling, all three trigger variants, all four metals, unit normalisation (ounces → grams), percent premiums, impure purities, and the one-tap classify-and-approve flow for Unclassified deals.

```
#NTK BUY 15KG SILVER 999 @30.15 -0.75 KARIMCO
#NTP BUY 8KG GOLD 22K @2561.20 -15 PATELBROS
#NTK BUY 3KG GOLD 18K @2562.50 -25 AMIRTR
#NTK BUY 25KG SILVER 999 @30.10 -0.90 DXBMETALS
#NT BUY 5KG GOLD 22K @2562.00 -18 NEWVENDOR
#NTP SELL 10KG GOLD 24K @2568.75 -0.1 TAKFUNG
#NTP SELL 5KG PLATINUM 999 @980.25 -0.3% LINXIN
#NTK SELL 20KG SILVER 999 @30.28 +1.1 OEJEWEL
#NTP SELL 25KG GOLD 24K @2569.40 -0.1 TAKFUNG
#NTK SELL 30KG SILVER 999 @30.32 +1.2 ANGELBOSS
#NTP SELL 1KG PALLADIUM 999 @1023.50 -18 HKBANK
#NT SELL 2KG PLATINUM 999 @980.80 -4 GUSINI
#NTK BUY 12KG SILVER 999 @30.20 -0.80 LOCALDLR
#NTP SELL 15KG GOLD 24K @2569.15 -0.1 8HKGOLD
#NTK SELL 100 OZ SILVER 999 @30.30 +1.0 HKLOCAL
```

**What each row is doing:**

| # | Type | Why this one is in the set |
|---|---|---|
| 1 | NTK BUY silver | Happy path Kachha scrap buy from UAE |
| 2 | NTP BUY 22K gold | **Tests impure purity (22K)** + absolute discount for refining economics |
| 3 | NTK BUY 18K gold | **Tests another impure purity (18K)** — different yield |
| 4 | NTK BUY silver | Bulk Kachha silver, different UAE party |
| 5 | **NT BUY** 22K gold | **Tests the Unclassified picker** — staff wasn't sure, checker decides at review time |
| 6 | NTP SELL gold | Textbook Pakka gold sell to Tak Fung at fix (−0.1) |
| 7 | NTP SELL platinum | **Tests the percent premium (−0.3%)** instead of absolute |
| 8 | NTK SELL silver | Kachha silver sell with positive premium |
| 9 | NTP SELL gold | Larger Pakka gold sell (25 kg) — shows the "big day" number |
| 10 | NTK SELL silver | Bulk Kachha silver to HK |
| 11 | NTP SELL palladium | **Tests palladium** (4th metal) |
| 12 | **NT SELL** platinum | **Second Unclassified** — tests the picker twice |
| 13 | NTK BUY silver | Afternoon UAE buy, different party |
| 14 | NTP SELL gold | Afternoon Pakka sell |
| 15 | NTK SELL silver **100 OZ** | **Tests ounces-to-kg normalisation** — 100 oz → displays as 3.110 kg |

**Expected on the review tab (within 3 seconds):**
- **15 new cards**, review badge jumps to 15
- 6 Pakka + 7 Kachha + **2 Unclassified** (with amber pickers)
- All four metals represented
- The 100 oz silver deal displays as **3.110 kg** (normalised)
- The percent platinum deal displays as **−0.3%**

**What to say to Niyam:** *"This is roughly what a trading day looks like. 15 deals, your 15 staff doing their normal job. Look — 2 of them are Unclassified because staff wasn't sure, so you classify them at review time with one tap. The rest are already pre-classified so you just approve or reject. You're making 15 decisions in about 30 seconds instead of spending an hour on the phone reconciling. This is your real day, compressed into one screen."*

**Scroll advice:** don't approve all 15. Approve 3-5 live to show the flow, then tell Niyam *"the rest are still sitting here waiting for you — they don't go anywhere until you decide"*. That's the maker-checker *safety* message, which is the core value prop. The rest can be approved after the meeting.

---

## After the demo

- Leave the approved/rejected cards in place. Next time Niyam opens the bot, he'll see the history in the Approved and Rejected tabs.
- If you need to reset the queue before the next demo, run:
  ```bash
  ssh nuremberg "cd /var/www/nt-metals && sqlite3 data.db 'DELETE FROM pending_deals'"
  ```
- Or just let the data accumulate — it's realistic practice for Niyam.

---

## What these deals are NOT meant to test

- **Economic validity** — the bot doesn't check whether the rate makes sense vs market. That's the checker's job. Niyam approves based on his judgment.
- **Stock levels** — the bot doesn't check whether Niyam actually has 30 kg of silver before approving a sell. (Phase B could add this.)
- **Payment verification** — no screenshots attached. Image OCR comes in the next build chunk.
- **Duplicate detection** — if Niyam accidentally sends LOT 3 twice, all 30 cards will appear. Dedup logic comes later if needed.
