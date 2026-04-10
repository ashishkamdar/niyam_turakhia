# Meta WhatsApp Setup Guide — Addendum (April 10, 2026)

This addendum adds the Business Verification phase that was missing from the original guide. Open your `Meta-WhatsApp-Setup-Guide.pages` in Apple Pages and paste these sections into the indicated locations, then re-export the PDF.

---

## ✏️ EDIT 1 — Overview section, replace the "What you need" line

**Find this in the Overview section:**

> **What you need:** Your WhatsApp Business phone number, a Facebook account, and a computer with a web browser.

**Replace with:**

> **Time required:** 15-20 minutes for Steps 1-9 (first message flowing). Business Verification (Step 10) runs in parallel and takes 2-4 weeks at Meta's end.
>
> **What you need:**
>
> - Your WhatsApp Business phone number (must be on WhatsApp Business, not regular WhatsApp)
> - A Facebook account
> - A computer with a web browser
> - **A business email on your own domain** (e.g., `niyam@prismx.org`) — Meta will reject Gmail, Yahoo, or personal addresses
> - **Your live business website** — `https://prismx.org` (already live)
> - **Your UAE Trade License / Certificate of Incorporation** (PDF, for Business Verification in Step 10)
> - **VAT / Tax Registration certificate** (PDF, for Business Verification in Step 10)
> - **Two-factor authentication enabled** on the WhatsApp Business number
>
> **Two phases:** Steps 1-9 get messages flowing into PrismX with the unverified (sandbox) tier — good for testing and internal use. Step 10 (Business Verification) unlocks production limits, the green verified badge, and is required before the bot can talk to buyers (the Phase 2 auto-negotiator). Start Step 10 as early as possible — it's a slow review at Meta's end, so run it in the background.

---

## ✏️ EDIT 2 — Step 1.2, replace the business details table

**Find this table in Step 1.2:**

| Field | What to enter |
|-------|--------------|
| Business name | **PrismX** |
| Your name | **Niyam Turakhia** |
| Business email | Your business email address |
| Business address | Your Dubai office address |
| Business website | (optional — can skip) |
| Business phone | Your business phone number |

**Replace with:**

> **IMPORTANT:** The values below must exactly match your **UAE Trade License**. Meta cross-checks these against the documents you upload in Step 10 (Business Verification). A mismatch is the #1 reason verification gets rejected.

| Field | What to enter |
|-------|--------------|
| Business name | **The exact legal name on your Trade License** (e.g., *PrismX Group Trading LLC* — verbatim, including LLC / FZE / DMCC suffix and punctuation) |
| Your name | **Niyam Turakhia** |
| Business email | **A business email on your own domain** — e.g., `niyam@prismx.org`. **Do NOT use Gmail or personal addresses** |
| Business address | Your Dubai office address **exactly as it appears on your Trade License** |
| Business website | **https://prismx.org** (required — do not skip) |
| Business phone | Your business phone number |

> **If you don't yet have an email on prismx.org**, set one up before filling this form. Options: Zoho Mail (free tier, 5 users, 10 minutes to set up), Google Workspace (paid), or your domain registrar's email forwarding.

---

## ✏️ EDIT 3 — Step 4.2, add a bullet point

**Find this bullet list in Step 4.2:**

> - This number must already be registered as **WhatsApp Business** (not regular WhatsApp)
> - If it's currently on WhatsApp Business App, it will be migrated to the API
> - **Your staff can continue using WhatsApp Web** — the API works alongside it (coexistence mode)
> - All existing chats are preserved

**Add this bullet at the bottom:**

> - **Two-factor authentication MUST be enabled** on this number before Business Verification (Step 10). Turn it on now: WhatsApp → **Settings** → **Account** → **Two-step verification** → **Turn On**. Set a 6-digit PIN and add a recovery email. Meta will block verification if 2FA isn't active on the onboarded number.

---

## ✏️ EDIT 4 — Replace the Step 9 checklist

**Find the Step 9 Checklist and replace with:**

### Checklist (Phase 1 — Sandbox / Test Messaging)

- [ ] Meta Business Account created (legal entity name matching Trade License)
- [ ] Business email on the `prismx.org` domain (not Gmail)
- [ ] Developer App created (PrismX Bot)
- [ ] WhatsApp product added to the app
- [ ] Business WhatsApp number connected and verified
- [ ] Two-factor authentication enabled on the WhatsApp Business number
- [ ] Webhook configured with PrismX URL
- [ ] "messages" webhook field subscribed
- [ ] Permanent access token generated
- [ ] Tokens entered in PrismX Settings
- [ ] Test message sent and received in PrismX
- [ ] Ashish added as Developer (optional)

At this point, you're in the **sandbox tier**: messages flow into PrismX and you can send replies to a small set of test numbers. This is enough to build and test the PrismX integration. The next step unlocks production.

---

## ✏️ EDIT 5 — Insert a new STEP 10 between Step 9 and the Troubleshooting section

**Paste this entire section after the Step 9 checklist and before the "Troubleshooting" heading:**

---

## STEP 10: Business Verification & Display Name Approval

This is a **separate, multi-day review by Meta** that unlocks:

- Sending messages to **any customer** (not just test numbers)
- Higher messaging rate tiers
- The **green verified business badge** on your WhatsApp chats
- The ability to use **"PrismX"** (or "PrismX Group") as the sender display name on every message
- **Phase 2 of the PrismX engagement**: the buyer-facing auto-negotiator bot

Start this step as soon as possible — it runs in the background at Meta's end, so you can work on Steps 1-9 in parallel. Typical timeline: **2 to 4 weeks** from submission to full approval.

### 10.1 Pre-flight checklist

Before you click "Start Verification", make sure you have all of these ready:

| Item | Where it comes from | Status |
|------|---------------------|--------|
| Live business website at prismx.org branded "PrismX Group" | Already live ✓ | ✅ Ready |
| UAE Trade License (PDF) for the legal entity | Your UAE accountant / mainland authority / free zone | ⏳ To upload |
| VAT / Tax Registration certificate (PDF) | FTA UAE portal | ⏳ To upload |
| Certificate of Incorporation / Establishment Card (PDF) | Whichever document shows the legal entity name + address | ⏳ To upload |
| Optional: Utility bill or bank statement at the business address | For address proof if Meta asks | ⏳ Keep ready |
| Domain-matched email active | e.g., `niyam@prismx.org` | ⏳ To set up |
| Two-factor auth on the WhatsApp Business number | Step 4.2 above | ⏳ To enable |
| Exact match between Trade License name and Meta Business Account name | Cross-check now — edit the Business Account name if wrong | ⏳ Verify |

> **The #1 cause of verification rejection** is the legal name on the documents not matching the Business Account name exactly — including LLC / FZE / DMCC suffixes, commas, spacing, and punctuation. Check this before submitting.

### 10.2 Submit Business Verification

1. Go to **business.facebook.com**
2. Click the **gear icon** (Business Settings) in the left sidebar
3. Go to **Security Center**
4. Under **Business Verification**, click **"Start Verification"**
5. Fill in the business information:
   - Legal business name (must match Trade License exactly)
   - Business address (must match Trade License exactly)
   - Business phone number (must be reachable — Meta may call)
   - Business website: `https://prismx.org`
6. Upload documents:
   - Trade License (primary)
   - VAT / Tax Registration
   - (Optional) Utility bill or bank statement as secondary address proof
7. Click **Submit**
8. Meta will review — typically **2 to 7 business days**

### 10.3 Domain verification

Alongside Business Verification, verify ownership of `prismx.org`:

1. In **Business Settings** → **Brand Safety** → **Domains**, click **"Add"**
2. Enter: `prismx.org`
3. Meta will show you one of two options:
   - **DNS TXT record** (recommended): Meta provides a line like `facebook-domain-verification=abc123xyz...`. Add this as a TXT record in your DNS settings at your domain registrar. Wait 15 minutes for propagation, then click "Verify."
   - **HTML file upload**: Meta provides an `.html` file. Upload it to the root of prismx.org so it's reachable at `https://prismx.org/the-file-name.html`. Click "Verify."
4. If you need help with the DNS record, Ashish can walk you through it.

### 10.4 Display Name approval

1. In **business.facebook.com** → **WhatsApp Accounts** → your PrismX WhatsApp Business Account
2. Find the phone number → **Settings** → **Profile** → **Display Name**
3. Enter one of:
   - **PrismX** (shorter, cleaner — preferred if prismx.org hero says "PrismX")
   - **PrismX Group** (matches the website hero — also acceptable)
4. Click **Submit**
5. Meta reviews typically within **24-48 hours** once Business Verification is complete
6. **prismx.org already displays both "PrismX" and "PrismX Group" prominently**, so both options should be approved

> **Display name rules:** Cannot contain full personal names ("Niyam Turakhia" would be rejected), generic words, geographic locations as the primary name, or slogans. "PrismX" and "PrismX Group" both pass these rules.

### 10.5 Typical timeline

| Stage | Meta's review time |
|-------|--------------------|
| Business Verification | 2-7 business days |
| Domain Verification | Instant (once DNS propagates) |
| Phone Number API approval | 1-5 business days |
| Display Name approval | 24-48 hours (after Business Verification passes) |
| Official Business Account (green badge) | 2-14 business days |
| **Total end-to-end** | **2-4 weeks** |

### 10.6 What to do while verification is pending

- **Keep working.** Steps 1-9 get you a sandbox tier that's more than enough for PrismX to parse staff messages, OCR screenshots, and generate the Bullion Sales Order Excel during development and internal testing.
- **Niyam's staff can keep using WhatsApp Business App on their phones** exactly as before — the API works alongside it.
- **Do not start the buyer-facing negotiator bot** (Phase 2) until full verification is done.

### 10.7 Common rejection reasons and fixes

| Rejection reason | Fix |
|------------------|-----|
| "Business name doesn't match documents" | Meta Business Account name must match Trade License **exactly** — every word, every punctuation mark, LLC/FZE suffix |
| "We couldn't verify the domain" | DNS TXT record not yet propagated — wait 30 minutes and retry, or switch to HTML file method |
| "Business website insufficient" | prismx.org must clearly show business name, services, contact info — the current site already passes this bar |
| "Unable to reach business phone" | Meta occasionally calls the listed business number — make sure someone will answer in business hours |
| "Display name doesn't match branding" | "PrismX" or "PrismX Group" must appear visibly on prismx.org (it does) |

---

*End of addendum. After pasting into Pages, re-export the PDF and send the updated version to Niyam.*
