# Precious Metals MIS — Executive Overview

**Prepared for:** Niyam Turakhia Trading LLC, Dubai
**Prepared by:** Ashish Kamdar, AreaKPI Solutions
**Date:** April 2026
**Confidential**

---

## The Challenge

Your business generates profitability data throughout the day — purchases in Dubai, refining, shipments to Hong Kong, sales to banks, dealers, and crypto exchanges, and multi-currency settlements. Today, you see a consolidated picture only when staff presents a weekly report.

By then, decisions are retrospective. You're reacting to numbers that are already a week old.

## What We've Built

A secure, mobile-first Management Information System that gives you a live view of your entire operation — as transactions happen.

**Live demo:** nt.areakpi.in (PIN-protected, accessible from your phone or desktop)

### What You See on Your Phone

**Portfolio Overview**
- Total portfolio value in AED, updated in real-time
- Stock in hand per metal — Gold, Silver, Platinum, Palladium — in kilograms
- Low stock alerts when any metal falls below threshold

**Today's Activity**
- Running profit for the day (realized from completed sales)
- Number of deals in progress and completed
- Buy vs. sell volume and value

**WhatsApp Deal Capture**
- Your staff continues to negotiate on WhatsApp as they do today
- The moment a deal is confirmed with the word "lock", it appears on your dashboard instantly
- No manual re-entry. No delay. No errors.
- Each deal shows: contact name, metal, quantity, rate, and whether it's a buy or sell

**Funds Flow**
- Money received from Hong Kong buyers, broken down by currency:
  - **HK Dollars** from individual buyers and firms
  - **US Dollars** from banks via SWIFT
  - **USDT** from crypto exchanges
- Each amount shown with the applicable exchange rate to AED
- One-tap transfer to your UAE bank account with full conversion details

**Seller Payments**
- Complete list of local UAE sellers awaiting payment
- Amount payable per seller in AED
- After all sellers are paid, remaining balance = your net profit

**Precious Metal Prices**
- London Fix prices (LBMA) for Gold, Silver, Platinum, Palladium
- Displayed in USD per troy ounce with daily change
- Prices shown to 4 decimal places as per industry standard

---

## How It Connects to Your Existing Software

Your staff currently enters transactions into your Dubai server software. We do not replace that system. Our dashboard reads data from it and presents the executive view.

We've designed four connection methods. You choose what you're comfortable with:

### Option 1: Excel Upload
Your staff exports a file from the existing software and uploads it to the dashboard. Works immediately. No changes to your server.

- Best for: Getting started quickly
- Frequency: Once or twice a day
- Effort: Zero installation

### Option 2: Live Data Bridge
A small, read-only program sits on your Dubai server alongside the existing software. Every 15-30 minutes, it reads the latest data and sends it to the dashboard. Your existing software is completely untouched.

- Best for: Automatic updates without staff involvement
- Frequency: Every 15-30 minutes
- Effort: One-time 2-3 hour setup

### Option 3: Scheduled Auto-Export
If your existing software supports automatic scheduled exports, we configure it to export a file at regular intervals. Our system picks it up and imports it automatically.

- Best for: Software that already has export scheduling
- Frequency: Every 30-60 minutes
- Effort: Configure once in existing software

### Option 4: Secure VPN Access
We connect to your Dubai server through the same secure VPN your Mumbai staff uses, with read-only credentials. Our system reads the data directly.

- Best for: Real-time data
- Frequency: Every 5-15 minutes
- Effort: Provide VPN credentials and a read-only database user

**Our recommendation:** Start with Option 1 (Excel upload) to see value immediately. Move to Option 2 (Live Data Bridge) within the first month for full automation.

---

## WhatsApp Integration

Your business runs on WhatsApp. Deals are negotiated, confirmed, and locked through messages. We integrate directly with this workflow.

### How It Works

1. You convert your WhatsApp to WhatsApp Business (free, takes 2 minutes, preserves all existing chats)
2. We register it with Meta's official Cloud API
3. Your staff continues using WhatsApp on their phones exactly as they do today — nothing changes
4. In the background, our system reads every message
5. When a deal is confirmed with the word "lock", it is captured automatically

### What This Means

- Staff doesn't need to re-enter deals anywhere
- You see locked deals on your dashboard within seconds
- Every deal has an audit trail — who, what, when, at what price
- Works with your existing WhatsApp number — no need for a second number

### Future: AI-Assisted Negotiation

When you're ready, we can add an AI assistant that responds to buyers on WhatsApp automatically:

- Knows your current inventory and floor prices
- Opens with your standard markup
- Negotiates within the boundaries you set
- Cannot go below your minimum price under any circumstances
- Escalates large deals to your team for approval
- Works 24/7 across time zones

This is a Phase 3 addition — we build it after the core system is running with real data.

---

## Delivery & Settlement Tracking

The dashboard tracks the complete post-sale cycle:

**Delivery**
- Physical shipments from Dubai to Hong Kong by air freight
- Buyer name, metal, weight, shipping cost
- Status tracking: Preparing → In Transit → Delivered

**Payment Receipt**
- Automatic recording when buyers pay
- Currency-specific: HKD from locals, USD from banks, USDT from crypto exchanges
- Exchange rate conversion to AED

**Seller Settlement**
- Transfer funds from Hong Kong to your ADCB Dubai account
- Pay off local UAE sellers in Dirhams
- Net profit calculated after all settlements

---

## Purchase & Refining

For purchases of impure metal (18K, 20K, 22K), the system calculates:

- Purchase cost in AED
- Refining charge per gram (configurable per metal)
- Yield after refining (18K → 75%, 20K → 83%, 22K → 92%)
- Wastage loss in grams
- **Effective cost per troy ounce of pure metal** — the number that matters for your margin

For pure metal purchases (24K, 999, 995), refining is skipped and the cost is straightforward.

The system also alerts when you attempt to sell below your average purchase cost — requiring explicit confirmation before proceeding.

---

## Security

- PIN-protected access (6-digit numeric keypad)
- Encrypted HTTPS connection (SSL certificate)
- Session stays active for extended period — no repeated logins
- Data hosted on a secure European server
- No access to your Dubai server without your explicit permission

---

## Proposed Engagement

### Phase 1: Dashboard with Demo Data (Complete)
What you've seen in the demo. Ready to use with real data the moment we connect.

### Phase 2: Real Data Connection + WhatsApp Integration
- Connect to your existing software (Option 1 or 2)
- WhatsApp Business API integration
- Staff training (30-minute walkthrough)
- Timeline: 2-3 weeks after your approval

### Phase 3: AI Assistant + Advanced Features
- AI-powered WhatsApp negotiation bot
- Multi-user access (you + staff with different permissions)
- Historical analytics and trend reports
- Custom alerts (daily P&L threshold, low stock, large unsettled amounts)
- Timeline: 1-2 months after Phase 2

---

## About AreaKPI Solutions

Built by Ashish Kamdar — financial technology specialist with experience building surveillance and compliance systems for SEBI (Securities and Exchange Board of India). Deep understanding of trading systems, real-time data processing, and regulatory requirements in financial markets.

Based locally in Mumbai. Available at Matunga Gymkhana for face-to-face support.

---

## Next Steps

1. You confirm which data connection method you prefer (we recommend starting with Excel upload)
2. We schedule a 30-minute session with your staff to set up the export
3. Within 48 hours, you're seeing your real data on the dashboard
4. We move to automatic data bridge within the first month

---

*This document is confidential and prepared exclusively for Niyam Turakhia Trading LLC.*
*AreaKPI Solutions | Mumbai | ashish@areakpi.in*
