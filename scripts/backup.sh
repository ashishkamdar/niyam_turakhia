#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# PrismX — Full backup (database + screenshots)
#
# Usage (run on the PrismX server):
#   bash scripts/backup.sh
#   bash scripts/backup.sh /path/to/backup/dir    # custom backup location
#
# Creates:
#   <backup_dir>/prismx-backup-YYYYMMDD-HHMMSS/
#     ├── data.db              (SQLite database copy)
#     └── screenshots/         (all payment screenshots)
#
# Safe to run while the app is running — SQLite WAL mode ensures a
# consistent copy. No need to stop PM2.
#
# For daily automated backups, add a cron entry:
#   0 2 * * * cd /opt/prismx && bash scripts/backup.sh /backups/prismx
# ─────────────────────────────────────────────────────────────────────

set -e

# Find the app directory (where data.db lives)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$APP_DIR/data.db" ]; then
  echo "ERROR: data.db not found in $APP_DIR"
  echo "Run this script from the PrismX app directory or ensure data.db exists."
  exit 1
fi

# Backup destination
BACKUP_ROOT="${1:-$APP_DIR}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/prismx-backup-$TIMESTAMP"

echo "PrismX Backup"
echo "  Source:      $APP_DIR"
echo "  Destination: $BACKUP_DIR"
echo ""

mkdir -p "$BACKUP_DIR"

# 1. Database (SQLite WAL-safe copy)
echo "→ Copying database..."
cp "$APP_DIR/data.db" "$BACKUP_DIR/data.db"
DB_SIZE=$(du -h "$BACKUP_DIR/data.db" | cut -f1)
echo "  ✓ data.db ($DB_SIZE)"

# 2. Screenshots
if [ -d "$APP_DIR/screenshots" ] && [ "$(ls -A "$APP_DIR/screenshots" 2>/dev/null)" ]; then
  echo "→ Copying screenshots..."
  cp -r "$APP_DIR/screenshots" "$BACKUP_DIR/screenshots"
  SCREENSHOT_COUNT=$(ls "$BACKUP_DIR/screenshots" | wc -l)
  SCREENSHOT_SIZE=$(du -sh "$BACKUP_DIR/screenshots" | cut -f1)
  echo "  ✓ screenshots/ ($SCREENSHOT_COUNT files, $SCREENSHOT_SIZE)"
else
  echo "  ⊘ No screenshots to back up"
fi

# Summary
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Backup complete: $BACKUP_DIR"
echo "  Total size: $TOTAL_SIZE"
echo ""
echo "  To restore:"
echo "    pm2 stop prismx"
echo "    cp $BACKUP_DIR/data.db $APP_DIR/data.db"
echo "    cp -r $BACKUP_DIR/screenshots/ $APP_DIR/screenshots/"
echo "    pm2 start prismx"
echo "═══════════════════════════════════════════════"
