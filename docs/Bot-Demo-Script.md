# PrismX Bot Demo Script

**For:** Niyam Turakhia
**Prepared by:** Ashish Kamdar
**Version:** April 10, 2026 — Phase A (Maker-Checker Review Pipeline)

---

## What to say first (30 seconds)

> "Niyam bhai, the bot is ready. Let me show you how it works in 3 minutes. It's live on the same link you already have — nt.areakpi.in. I'm testing it with my own Meta business number right now because your verification will take 2-4 weeks to come through, but the same code will plug straight into your number the day your verification is done. Nothing will need to change on our side."

---

## The 4-step walkthrough

### Step 1 — Open the bot on your phone (30 seconds)

1. On your phone, open **https://nt.areakpi.in** in the browser
2. Enter PIN **639263**
3. Tap the **Review** tab at the bottom (the circle-with-checkmark icon, second from the left)

> "This is the new Review tab. Every locked deal your staff post will land here first, before it goes into SBS or OroSoft. You approve or reject each one. Nothing writes to your accounting system until you click Approve — this is your safety net."

**Point at:** the "Live" indicator in the top-right of the header with the pulsing green dot and "Xs ago" counter.

> "See this green dot? The page is live. It checks for new deals every 3 seconds. You don't have to refresh."

---

### Step 2 — Send a deal code from your personal WhatsApp (60 seconds)

Have Niyam pull out his own phone, open WhatsApp, and type the following into a new message **to the test number** `+1 555 629 9466`:

```
#NTP SELL 5KG GOLD 24K @2567.15 -0.1 NIYAM
```

Tell him:

> "I'm going to show you the code format staff will use. The code has 7 parts, and your staff can type it in a few seconds once they've done it a couple of times. Watch what happens when you hit send."

Have him send. Wait 3-5 seconds.

**The card appears on the /review screen automatically.** No refresh needed.

> "There it is. Your deal is now in the review queue. Notice the PAKKA badge in the top right — the system understood this is a Pakka deal because you started with `#NTP`. If you'd used `#NTK` it would say Kachha. If you'd used just `#NT` it would ask me to classify at the bottom."

**Point at:** the parsed fields.

> "Look — the bot read 'sell', '5kg', 'Gold 24K', '$2567.15 per ounce', '-0.1 premium', and 'NIYAM' as the party. All seven fields, correctly. And it shows the original message up top so there's no ambiguity about what was sent."

---

### Step 3 — Approve the deal (30 seconds)

Have Niyam tap the green **Approve** button on the card.

The card disappears from Pending and moves to the **Approved** tab.

> "Done. One tap. The deal is now marked approved. In the next version, tapping Approve will also automatically:
> - For Pakka deals: send the deal directly to OroSoft via API
> - For Kachha deals: append a row to your Bullion Sales Order Excel file, ready for SBS upload
>
> Right now it just marks it approved — the SBS Excel writer comes next week, and the OroSoft API writer after I meet their technical team on Monday. You have full visibility into the queue at every step."

---

### Step 4 — Show the unclassified flow (60 seconds)

Have Niyam send a second message to the same test number:

```
#NT BUY 2KG SILVER 999 @71.85 +1.2 SAPAN
```

Wait 3-5 seconds.

> "This time I used `#NT` with no K or P suffix. Sometimes your staff won't know at the moment of the deal whether it's Kachha or Pakka — maybe they're still waiting for you to decide. So they just use `#NT` and you pick later."

Point to the amber "Approve as" picker box on the new card with two green buttons: **Kachha (SBS)** and **Pakka (OroSoft)**.

> "Notice the card is highlighted amber and it's showing Unclassified. You have three choices: tap Kachha, tap Pakka, or tap Reject. Tapping either of the green buttons classifies it AND approves it in one action. You don't need to classify first and then approve — that's two taps we don't want to waste."

Have him tap **Kachha (SBS)**. Card goes to Approved tab with a Kachha badge.

> "Done. That's the whole workflow. For every deal your 15-20 staff post during the day, you get one card, tap one button, and it's routed to the right accounting system. You'll never manually type another deal again."

---

## What to say next (closing)

> "Three things coming next:
> 1. **Next week**: the Kachha Excel writer. Every Kachha deal you approve will automatically get appended to the Bullion Sales Order.xlsx file you gave me. One file per day, downloadable from the dashboard. Your staff uploads that file to SBS manually, the same way they do today.
> 2. **After Monday's OroSoft meeting**: the Pakka API path. Every Pakka deal goes straight into OroSoft Neo Financials the moment you approve it. No manual step.
> 3. **When your Meta verification comes through**: we switch the bot from my test number to your PrismX business number. Same bot, same screen, same behaviour — we just point the webhook at your number instead of mine. Takes 10 minutes."

> "Your staff never see any of this complexity. They just type one line into WhatsApp. The bot does the rest."

---

## If Niyam asks "how do staff learn the code format?"

Print or photograph this card and give it to them:

```
┌──────────────────────────────────────────────────┐
│  PrismX Lock Code Format                         │
│                                                  │
│  #NTK  ... for Kachha (off-books)                │
│  #NTP  ... for Pakka (official)                  │
│  #NT   ... if you're not sure                    │
│                                                  │
│  Then: BUY or SELL                               │
│  Then: quantity + KG (or G or OZ)                │
│  Then: metal (GOLD, SILVER, PLATINUM, PALLADIUM) │
│  Then: purity (24K / 999 / 22K etc.)             │
│  Then: @ followed by the rate                    │
│  Then: + or − premium                            │
│  Then: party name                                │
│                                                  │
│  Example:                                        │
│  #NTP SELL 10KG GOLD 24K @2566.80 -0.1 TAKFUNG   │
│                                                  │
│  The code is case-insensitive. Spaces are fine.  │
│  You can put multiple deals in one message,      │
│  each on its own line.                           │
└──────────────────────────────────────────────────┘
```

---

## If Niyam asks "what if staff make a mistake?"

Show him a deliberately broken message:

```
#NT BUY GOLD @2566
```

Send it. The card appears with a **red "Parse errors" panel** listing the two errors (`Invalid quantity: "GOLD"`, `Missing party/counterparty`), plus as much information as could be extracted.

> "If staff type a bad code, the bot still captures it but flags the errors in red. You can see what went wrong and either reject it (and ask them to resend) or, in the next version, edit it in place to fix the typo. Nothing is silently lost."

---

## If Niyam asks "can multiple people use this at the same time?"

> "Yes. You can be on your phone reviewing deals, your team in Dubai can be on the desktop, and your assistant can be on a second phone. All three screens update within 3 seconds of each other. No conflict. Each person sees the same queue, and when someone approves a deal, it disappears from everyone's screen."

---

## If Niyam asks "is my data safe?"

> "Yes. Three layers:
> 1. **Only you have the PIN** — 639263 — to access the dashboard and review screen.
> 2. **The server is in Germany**, encrypted with SSL. I'm the only one with access.
> 3. **Kachha deals stay local** — I'm going to use local OCR for Kachha screenshots so nothing sensitive ever leaves our server. Pakka deals can use cloud AI for better accuracy because those are official anyway."

---

## What NOT to say

- **Don't mention the Monday OroSoft meeting details** unless he brings it up — he may not know they're his vendor's problem, not ours.
- **Don't promise a specific go-live date** — say "next week for Kachha Excel, Monday's meeting decides Pakka timing".
- **Don't mention the quote** — the bot is part of the engagement he already committed to. Show him the thing working, don't re-sell him on it.
- **Don't mention Meta verification timing** unless he asks — it's his task to upload docs, and we don't want to look like we're waiting on him.

---

*This script is a guide, not a rehearsal. Adapt to Niyam's mood — if he's in a rush, skip to Step 2 and let the live demo speak for itself. If he's curious, go deep on Step 4 (the unclassified flow) because that's the part he'll use the most.*
