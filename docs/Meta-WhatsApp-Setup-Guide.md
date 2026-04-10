# Meta WhatsApp Business API — Complete Setup Guide

**For:** PrismX (Mr. Niyam Turakhia)
**Prepared by:** Ashish Kamdar, AreaKPI Solutions
**Date:** April 2026

---

## Overview

This guide walks you through connecting your WhatsApp Business number to the PrismX dashboard. Once connected, every WhatsApp message your staff sends and receives will appear in PrismX in real-time. Deals will be captured automatically.

**Time required:** 15-20 minutes
**Cost:** Free (Meta Cloud API free tier)
**What you need:** Your WhatsApp Business phone number, a Facebook account, and a computer with a web browser.

---

## STEP 1: Create a Meta Business Account

This is Meta's (Facebook's) business platform. If you already have a Meta Business Account for PrismX, skip to Step 2.

### 1.1 Go to business.facebook.com

- Open your browser and go to: **https://business.facebook.com**
- Click **"Create an account"** (or "Get Started")

### 1.2 Fill in business details

| Field | What to enter |
|-------|--------------|
| Business name | **PrismX** |
| Your name | **Niyam Turakhia** |
| Business email | Your business email address |
| Business address | Your Dubai office address |
| Business website | (optional — can skip) |
| Business phone | Your business phone number |

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

### Checklist

- [ ] Meta Business Account created for PrismX
- [ ] Developer App created (PrismX Bot)
- [ ] WhatsApp product added to the app
- [ ] Business WhatsApp number connected and verified
- [ ] Webhook configured with PrismX URL
- [ ] "messages" webhook field subscribed
- [ ] Permanent access token generated
- [ ] Tokens entered in PrismX Settings
- [ ] Test message sent and received in PrismX
- [ ] Ashish added as Developer (optional)

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
