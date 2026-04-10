# Meta WhatsApp Business API — Complete Setup Guide

**For:** PrismX (Mr. Niyam Turakhia)
**Prepared by:** Ashish Kamdar, AreaKPI Solutions
**Date:** April 2026

---

## Overview

This guide walks you through connecting your WhatsApp Business number to the PrismX dashboard. Once connected, every WhatsApp message your staff sends and receives will appear in PrismX in real-time. Deals will be captured automatically.

**Time required:** 15-20 minutes for Steps 1-9 (first message flowing). Business Verification (Step 10) runs in parallel and takes 2-4 weeks at Meta's end.
**Cost:** Free (Meta Cloud API free tier)

**What you need:**

- Your WhatsApp Business phone number (must be on WhatsApp Business, not regular WhatsApp)
- A Facebook account
- A computer with a web browser
- **A business email on your own domain** (e.g., `niyam@prismx.org`) — Meta will **reject** Gmail, Yahoo, or personal addresses when verifying the account
- **Your live business website** — `https://prismx.org` (already live)
- **Your UAE Trade License / Certificate of Incorporation** (PDF, for Business Verification in Step 10)
- **VAT / Tax Registration certificate** (PDF, for Business Verification in Step 10)
- **Two-factor authentication enabled** on the WhatsApp Business number (details in Step 4.2)

> **Two phases:** Steps 1-9 get messages flowing into PrismX with the unverified (sandbox) tier — good for testing and internal use. Step 10 (Business Verification) unlocks production limits, the green verified badge, and is **required before you can use the bot to talk to buyers** (the Phase 2 auto-negotiator). Start Step 10 as early as possible — it's a slow review at Meta's end, so run it in the background.

---

## STEP 1: Create a Meta Business Account

This is Meta's (Facebook's) business platform. If you already have a Meta Business Account for PrismX, skip to Step 2.

### 1.1 Go to business.facebook.com

- Open your browser and go to: **https://business.facebook.com**
- Click **"Create an account"** (or "Get Started")

### 1.2 Fill in business details

> **IMPORTANT:** The values you enter here must exactly match your **UAE Trade License** (or Certificate of Incorporation). Meta will cross-check this against the documents you upload in Step 10 (Business Verification). A mismatch is the #1 reason verification gets rejected.

| Field | What to enter |
|-------|--------------|
| Business name | **The exact legal name on your Trade License** (e.g., *PrismX Group Trading LLC* — whatever appears on the license, verbatim, with the same punctuation and suffix like LLC / FZE / DMCC) |
| Your name | **Niyam Turakhia** |
| Business email | **A business email on your own domain** — e.g., `niyam@prismx.org` or `admin@prismx.org`. **Do NOT use Gmail, Yahoo, or personal addresses** — Meta will reject them at the verification stage. |
| Business address | Your Dubai office address **exactly as it appears on your Trade License** |
| Business website | **https://prismx.org** (required — do not skip) |
| Business phone | Your business phone number (same one as on the Trade License if possible) |

> **If you don't yet have an email on prismx.org**, set one up before filling this form. Options: Zoho Mail (free tier, 5 users, takes 10 minutes), Google Workspace (paid), or your domain registrar's email forwarding. Using Gmail here means starting over after verification.

### 1.3 Verify your email

- Meta will send a verification email
- Click the link in the email to confirm
- Your Meta Business Account is now active

---

## STEP 2: Create a Developer App

This is where you create the "app" that connects WhatsApp to PrismX.

### 2.1 Go to developers.facebook.com

- Open: **https://developers.facebook.com**
- Log in with the same Facebook account you used for the Business Account
- If this is your first time, click **"Get Started"** and accept the terms

### 2.2 Create a new App

1. Click **"My Apps"** (top right corner)
2. Click **"Create App"**
3. Select app type: **"Business"**
4. Click **"Next"**

### 2.3 Fill in App details

| Field | What to enter |
|-------|--------------|
| App name | **PrismX Bot** (or any name you prefer) |
| App contact email | Your email |
| Business Account | Select **PrismX** (the account you created in Step 1) |

5. Click **"Create App"**
6. You may be asked to enter your Facebook password — enter it

### 2.4 Your App Dashboard opens

You'll see a page with various products you can add. We need WhatsApp.

---

## STEP 3: Add WhatsApp Product

### 3.1 Add WhatsApp to your App

1. On the App Dashboard, scroll down to find **"WhatsApp"**
2. Click **"Set Up"** next to WhatsApp
3. WhatsApp is now added to your app

### 3.2 You'll see the WhatsApp Getting Started page

This page shows:
- **Temporary Access Token** (we'll need this — copy it)
- **Phone Number ID** (we'll need this — copy it)
- **WhatsApp Business Account ID**

**IMPORTANT:** Copy and save these somewhere safe:
- **Phone Number ID** — looks like: `1234567890123456`
- **Access Token** — looks like: `EAABsbCS1iHgB...` (very long string)

---

## STEP 4: Connect Your WhatsApp Business Number

### 4.1 Add your business phone number

1. In the left sidebar, click **WhatsApp** → **Getting Started**
2. Under "Send and receive messages", you'll see a test phone number
3. Click **"Add Phone Number"** to add your real WhatsApp Business number
4. Select your country code (UAE: +971)
5. Enter your WhatsApp Business phone number
6. Choose verification method: **SMS** or **Phone call**
7. Enter the verification code you receive
8. Your number is now connected

### 4.2 Important notes

- This number must already be registered as **WhatsApp Business** (not regular WhatsApp)
- If it's currently on WhatsApp Business App, it will be migrated to the API
- **Your staff can continue using WhatsApp Web** — the API works alongside it (coexistence mode)
- All existing chats are preserved
- **Two-factor authentication MUST be enabled** on this number before Business Verification (Step 10). Turn it on now: WhatsApp → **Settings** → **Account** → **Two-step verification** → **Turn On**. Set a 6-digit PIN you'll remember and add a recovery email. Meta will block verification if 2FA isn't active on the onboarded number.

---

## STEP 5: Configure the Webhook

This is how PrismX receives your WhatsApp messages.

### 5.1 Go to WhatsApp Configuration

1. In the left sidebar, click **WhatsApp** → **Configuration**
2. You'll see a **Webhook** section

### 5.2 Set up the Webhook

1. Click **"Edit"** next to Webhook
2. Enter these details:

| Field | Value |
|-------|-------|
| **Callback URL** | `https://nt.areakpi.in/api/whatsapp/webhook` |
| **Verify Token** | `prismx_webhook_verify` |

3. Click **"Verify and Save"**
4. If successful, you'll see a green checkmark — the webhook is connected

### 5.3 Subscribe to Webhook Fields

After saving the webhook, you need to subscribe to message events:

1. Under the webhook section, find **"Webhook Fields"**
2. Click **"Subscribe"** next to: **messages**
3. This tells Meta to send all WhatsApp messages to PrismX

**That's it — messages will now flow to PrismX automatically.**

---

## STEP 6: Generate a Permanent Access Token

The temporary token from Step 3 expires in 24 hours. We need a permanent one.

### 6.1 Create a System User

1. Go to **business.facebook.com**
2. Click **Business Settings** (gear icon)
3. In the left sidebar: **Users** → **System Users**
4. Click **"Add"**

| Field | Value |
|-------|-------|
| System User Name | **PrismX API** |
| Role | **Admin** |

5. Click **"Create System User"**

### 6.2 Assign the WhatsApp App

1. Click on the system user you just created (**PrismX API**)
2. Click **"Add Assets"**
3. Select **Apps** → Select **PrismX Bot** (the app you created)
4. Toggle **Full Control** to ON
5. Click **"Save Changes"**

### 6.3 Generate the Token

1. Click **"Generate New Token"**
2. Select the App: **PrismX Bot**
3. Select permissions — check these:
   - **whatsapp_business_management**
   - **whatsapp_business_messaging**
4. Click **"Generate Token"**
5. **COPY THIS TOKEN IMMEDIATELY** — it won't be shown again
6. Save it somewhere safe — this is your permanent access token

---

## STEP 7: Add Ashish as a Developer

This gives me technical access to manage the API integration without accessing your business data.

### 7.1 Add Developer to the App

1. Go to **developers.facebook.com**
2. Click **"My Apps"** → Select **PrismX Bot**
3. In the left sidebar, click **App Settings** → **Basic**
4. Scroll down to **"App Roles"** section
5. Or go to: **App Roles** → **Roles** in the left sidebar
6. Click **"Add People"**

| Field | Value |
|-------|-------|
| Search | Enter Ashish's Facebook profile name or email |
| Role | **Developer** |

7. Click **"Submit"**
8. Ashish will receive an invitation and needs to accept it

### 7.2 What the Developer role can do

| Permission | Can Do? |
|-----------|---------|
| View App Dashboard and settings | Yes |
| View API credentials and tokens | Yes |
| Test WhatsApp API | Yes |
| Modify webhook configuration | Yes |
| Delete the app | **No** |
| Access your Meta Business Account | **No** |
| See your personal Facebook data | **No** |
| Remove you as owner | **No** |

**You remain the owner.** The Developer role is purely technical — I can configure the API but cannot change ownership or access your business account.

### 7.3 Alternative: Share credentials directly

If you prefer not to add me to the app, you can simply share:
1. Phone Number ID
2. Permanent Access Token
3. App Secret (found in App Settings → Basic → App Secret → click "Show")

I'll enter these in PrismX Settings → Meta WhatsApp config section.

---

## STEP 8: Enter Tokens in PrismX

### 8.1 Open PrismX Settings

1. Go to **nt.areakpi.in** on your phone or computer
2. Enter PIN: **639263**
3. Tap the **gear icon** (⚙️) in the top right
4. Scroll down to **"Meta WhatsApp Business API"** section

### 8.2 Enter the credentials

| Field | Where to find it |
|-------|-----------------|
| Verify Token | `prismx_webhook_verify` (already filled) |
| Meta App Secret | developers.facebook.com → App Settings → Basic → App Secret |
| Phone Number ID | developers.facebook.com → WhatsApp → Getting Started |
| Access Token | The permanent token from Step 6.3 |

5. Click **"Save WhatsApp Config"**

### 8.3 Test it

1. Send a test message to the WhatsApp Business number from any phone
2. Open PrismX → WhatsApp tab
3. The message should appear within a few seconds

---

## STEP 9: Verify Everything Works

### Checklist (Phase 1 — Sandbox / Test Messaging)

- [ ] Meta Business Account created (with legal entity name matching Trade License)
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

At this point, you're in the **sandbox tier**: messages flow into PrismX, you can receive all incoming messages, and you can send replies to a small set of test numbers. This is enough to build and test the PrismX integration. The next step unlocks production.

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
| Live business website at prismx.org branded "PrismX Group" | Already live ✓ (confirmed April 10, 2026) | ✅ Ready |
| UAE Trade License (PDF) for the legal entity | Your UAE accountant / mainland authority / free zone | ⏳ Niyam to upload |
| VAT / Tax Registration certificate (PDF) | FTA UAE portal | ⏳ Niyam to upload |
| Certificate of Incorporation / Establishment Card (PDF) | Whichever document shows the legal entity name + address | ⏳ Niyam to upload |
| Optional: Utility bill or bank statement at the business address | For address proof if Meta asks | ⏳ Keep ready |
| Domain-matched email active | e.g., `niyam@prismx.org` | ⏳ Niyam to set up |
| Two-factor auth on the WhatsApp Business number | Step 4.2 above | ⏳ Niyam to enable |
| Exact match between Trade License name and Meta Business Account name (Step 1.2) | Cross-check now — edit the Business Account name if wrong | ⏳ Verify |

> **The #1 cause of verification rejection** is the legal name on the documents not matching the Business Account name exactly — including LLC / FZE / DMCC suffixes, commas, spacing, and punctuation. Check this before submitting.

### 10.2 Submit Business Verification

1. Go to **business.facebook.com**
2. Click the **gear icon** (Business Settings) in the left sidebar
3. Go to **Security Center** (left sidebar → Security Center)
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

Alongside Business Verification, you'll verify that you own `prismx.org`:

1. In **Business Settings** → **Brand Safety** → **Domains**, click **"Add"**
2. Enter: `prismx.org`
3. Meta will show you one of two options:
   - **DNS TXT record** (recommended): Meta provides a line like `facebook-domain-verification=abc123xyz...`. Add this as a TXT record in your DNS settings at whoever hosts prismx.org DNS (likely your domain registrar — GoDaddy, Namecheap, Cloudflare, etc.). Wait 15 minutes for propagation, then click "Verify."
   - **HTML file upload**: Meta provides an `.html` file. Upload it to the root of prismx.org so it's reachable at `https://prismx.org/the-file-name.html`. Click "Verify."
4. If you need help with the DNS record, Ashish can walk you through it.

### 10.4 Display Name approval

This is a separate review specifically for the name that appears as the sender on every WhatsApp message you send through the API.

1. In **business.facebook.com** → **WhatsApp Accounts** → your PrismX WhatsApp Business Account
2. Find the phone number → **Settings** → **Profile** → **Display Name**
3. Enter one of:
   - **PrismX** (shorter, cleaner — preferred if prismx.org hero says "PrismX")
   - **PrismX Group** (matches the website hero — also acceptable)
4. Click **Submit**
5. Meta reviews typically within **24-48 hours** once Business Verification is complete
6. The name must match your website branding — **prismx.org already displays both "PrismX" and "PrismX Group" prominently**, so both options should be approved

> **Display name rules** (to avoid rejection): Cannot contain full personal names ("Niyam Turakhia" would be rejected), generic words, geographic locations as the primary name, or slogans. "PrismX" and "PrismX Group" both pass these rules.

### 10.5 Typical timeline (from submission to fully approved)

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
- **Do not start the buyer-facing negotiator bot** (Phase 2) until full verification is done. Replying to buyers on an unverified tier risks the account being flagged.

### 10.7 Common rejection reasons and fixes

| Rejection reason | Fix |
|------------------|-----|
| "Business name doesn't match documents" | Your Meta Business Account name must match the Trade License **exactly** — every word, every punctuation mark, LLC/FZE suffix |
| "We couldn't verify the domain" | DNS TXT record not yet propagated — wait 30 minutes and retry, or switch to HTML file method |
| "Business website insufficient" | prismx.org must clearly show business name, services, contact info — the current site at prismx.org already passes this bar |
| "Unable to reach business phone" | Meta occasionally calls the listed business number — make sure it's a number someone will actually answer in business hours |
| "Display name doesn't match branding" | Check that "PrismX" or "PrismX Group" appears visibly on prismx.org (it does) and that you picked a name that matches |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Webhook verification fails | Check that the Callback URL is exactly `https://nt.areakpi.in/api/whatsapp/webhook` and Verify Token is `prismx_webhook_verify` |
| Messages not appearing | Check that you subscribed to the "messages" webhook field in Step 5.3 |
| Token expired | The temporary token lasts 24 hours — use the permanent token from Step 6 |
| Number already registered | Your number may already be on WhatsApp Business API via another provider — contact Meta support |
| "Phone number not eligible" | The number must be on WhatsApp Business App first. Convert from regular WhatsApp if needed. |

---

## Support

If you need help at any step, contact:

**Ashish Kamdar**
Email: connect@areakpi.com
Cell: 98198 00214
Available at Matunga Gymkhana for in-person assistance.

---

*This document is confidential and prepared exclusively for PrismX.*
