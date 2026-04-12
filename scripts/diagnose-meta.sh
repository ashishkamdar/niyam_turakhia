#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# PrismX — Meta WhatsApp Cloud API diagnostic
#
# Checks whether the current access_token + phone_number_id in
# meta_config can actually reach the WhatsApp Business API.
#
# Usage (run on the PrismX server):
#   bash scripts/diagnose-meta.sh
#
# What it checks:
#   1. Token validity + scopes (debug_token)
#   2. Phone number accessibility (GET /phone_number_id)
#   3. Business access (/me/businesses)
#   4. Assigned WhatsApp Business Accounts
#
# If step 4 returns {"data":[]}, the System User has zero WABA
# permissions — see INSTALL.md for the Business Manager fix.
# ─────────────────────────────────────────────────────────────────────

set -e

# Find the app directory — either CWD or the script's parent
if [ -f "data.db" ]; then
  APP_DIR="."
elif [ -f "$(dirname "$0")/../data.db" ]; then
  APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
else
  echo "ERROR: Cannot find data.db. Run this script from the PrismX app directory."
  exit 1
fi

TOKEN=$(sqlite3 "$APP_DIR/data.db" "SELECT value FROM meta_config WHERE key='access_token';")
PNID=$(sqlite3 "$APP_DIR/data.db" "SELECT value FROM meta_config WHERE key='phone_number_id';")

if [ -z "$TOKEN" ]; then
  echo "ERROR: No access_token found in meta_config. Set it in Settings → Meta WhatsApp Business API."
  exit 1
fi

echo "Token prefix: $(echo "$TOKEN" | cut -c1-8)...$(echo "$TOKEN" | rev | cut -c1-4 | rev)  length: ${#TOKEN}"
echo "Phone ID: $PNID"
echo

echo "=== 1. debug_token (who is this token?) ==="
curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$TOKEN&access_token=$TOKEN"
echo
echo

echo "=== 2. GET phone number info ==="
curl -s "https://graph.facebook.com/v21.0/$PNID?access_token=$TOKEN"
echo
echo

echo "=== 3. /me/businesses ==="
curl -s "https://graph.facebook.com/v21.0/me/businesses?access_token=$TOKEN"
echo
echo

echo "=== 4. Assigned WhatsApp Business Accounts ==="
USER_ID=$(curl -s "https://graph.facebook.com/v21.0/me?access_token=$TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "System user id: $USER_ID"
curl -s "https://graph.facebook.com/v21.0/$USER_ID/assigned_whatsapp_business_accounts?access_token=$TOKEN"
echo
