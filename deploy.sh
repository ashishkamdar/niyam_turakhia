#!/bin/bash
# Safe deploy script — ALWAYS backs up the database before deploying
# Usage: bash deploy.sh

set -e

echo "=== NT Metals Safe Deploy ==="

echo "1. Backing up database on server..."
ssh nuremberg "cd /var/www/nt-metals && cp -f data.db data.db.bak.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo 'No existing DB to back up'"

echo "2. Pushing to GitHub..."
git push

echo "3. Pulling on server..."
ssh nuremberg "cd /var/www/nt-metals && git pull"

echo "4. Building..."
ssh nuremberg "cd /var/www/nt-metals && npm run build"

echo "5. Restarting..."
ssh nuremberg "cd /var/www/nt-metals && pm2 restart nt-metals"

echo ""
echo "=== Deploy complete ==="
echo "Database backed up. If anything breaks, restore with:"
echo "  ssh nuremberg 'cd /var/www/nt-metals && cp data.db.bak.TIMESTAMP data.db && pm2 restart nt-metals'"
echo ""
echo "To restore from seed SQL:"
echo "  ssh nuremberg 'cd /var/www/nt-metals && sqlite3 data.db < seed-backup.sql && pm2 restart nt-metals'"
