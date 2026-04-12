#!/bin/bash
# Safe deploy script — ALWAYS backs up the database + screenshots before deploying
# Usage: bash deploy.sh

set -e

echo "=== PrismX Safe Deploy ==="

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "1. Backing up database on server..."
ssh nuremberg "cd /var/www/nt-metals && cp -f data.db data.db.bak.$TIMESTAMP 2>/dev/null || echo 'No existing DB to back up'"

echo "2. Backing up screenshots on server..."
ssh nuremberg "cd /var/www/nt-metals && if [ -d screenshots ] && [ \"\$(ls -A screenshots 2>/dev/null)\" ]; then tar czf screenshots.bak.$TIMESTAMP.tar.gz screenshots/; echo \"Screenshots backed up (\$(ls screenshots/ | wc -l) files)\"; else echo 'No screenshots to back up'; fi"

echo "3. Pushing to GitHub..."
git push

echo "4. Pulling on server..."
ssh nuremberg "cd /var/www/nt-metals && git pull"

echo "5. Building..."
ssh nuremberg "cd /var/www/nt-metals && npm run build"

echo "6. Restarting..."
ssh nuremberg "cd /var/www/nt-metals && pm2 restart nt-metals"

echo ""
echo "=== Deploy complete ==="
echo ""
echo "Backups created:"
echo "  Database:    data.db.bak.$TIMESTAMP"
echo "  Screenshots: screenshots.bak.$TIMESTAMP.tar.gz"
echo ""
echo "To restore database:"
echo "  ssh nuremberg 'cd /var/www/nt-metals && cp data.db.bak.$TIMESTAMP data.db && pm2 restart nt-metals'"
echo ""
echo "To restore screenshots:"
echo "  ssh nuremberg 'cd /var/www/nt-metals && tar xzf screenshots.bak.$TIMESTAMP.tar.gz'"
echo ""
echo "To migrate to a new server (full copy):"
echo "  scp nuremberg:/var/www/nt-metals/data.db /path/to/new/server/data.db"
echo "  scp -r nuremberg:/var/www/nt-metals/screenshots/ /path/to/new/server/screenshots/"
