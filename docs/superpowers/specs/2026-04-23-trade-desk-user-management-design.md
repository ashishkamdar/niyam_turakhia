# Trade Desk User Management

**Date:** 2026-04-23
**Status:** Approved

## Problem

Staff who use the Trade Desk (`/nt/staff/trade/`) currently share the same user pool as the mother app. We need:
1. Users who can ONLY access Trade Desk, not the mother app
2. Cloudflare Access integration — add/remove allowed emails from the mother app
3. When a trader leaves, block them from both the PIN login AND the Cloudflare gate

## Design

### New role: `trade_desk`

Fourth role in the hierarchy: `super_admin > admin > staff > trade_desk`

- `trade_desk` users can log into `/nt/staff/trade/` (Trade Desk) only
- The mother app's `/api/auth` rejects `trade_desk` role at login
- Admin and super_admin can create/manage `trade_desk` users

### Database: migration v17

Add `email` column to `auth_pins`:
```sql
ALTER TABLE auth_pins ADD COLUMN email TEXT;
```
- Nullable — only required for `trade_desk` role users
- Used to sync with Cloudflare Access email list

### Auth enforcement

**Mother app** (`/api/auth` POST):
- After matching PIN, check role. If `trade_desk`, return error "Access restricted to Trade Desk only"

**Trade Desk** (`/nt/staff/trade/`):
- No change. Accepts all roles including `trade_desk`

### Cloudflare Access integration

**Stored config** (settings KV table on server):
- `cloudflare_api_token` — already stored
- `cloudflare_account_id` — `cd870d0adbb55ef5d1b6ce24c765c0af`
- `cloudflare_access_app_id` — `661d3638-2011-47f3-a4fa-3dcd9df76ced`
- `cloudflare_access_policy_id` — `01116de4-b5a2-4460-906d-d21577c91ec4`

**API operations** (`src/lib/cloudflare-access.ts`):
- `getAccessEmails()` — GET current policy, extract email list
- `addAccessEmail(email)` — PUT policy with email appended to include list
- `removeAccessEmail(email)` — PUT policy with email removed from include list

**Policy update** uses `PUT /accounts/{id}/access/apps/{app_id}/policies/{policy_id}` with updated `include` array.

### Users page — Trade Desk Users section

New section below existing PIN management:
- Lists all `trade_desk` role users: name, PIN, email, locked status
- **Add**: name + PIN + email → create PIN row + add email to Cloudflare
- **Lock/Unlock**: lock PIN row + remove/re-add email in Cloudflare
- **Delete**: delete PIN row + remove email from Cloudflare
- Admin and super_admin only

### API changes (`/api/pins`)

- POST (create): if role is `trade_desk` and email provided, sync to Cloudflare
- PUT (update): if locking a `trade_desk` user, remove from Cloudflare; if unlocking, re-add
- DELETE: if `trade_desk` user, remove email from Cloudflare

## What stays the same

- Existing staff/admin/super_admin users unchanged
- Trade Desk HTML unchanged
- Review pipeline unchanged
- Trade Desk entries in pending_deals unchanged
