#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# PrismX — Automated installer for Ubuntu/Debian servers
#
# Usage:
#   sudo bash scripts/install-ubuntu.sh
#
# What it does:
#   1. Installs Node.js 22 LTS (if not present)
#   2. Installs PM2 globally (if not present)
#   3. Installs build-essential + python3 (for better-sqlite3 native build)
#   4. Installs Tesseract OCR + language packs (for WhatsApp image processing)
#   5. Installs nginx (if not present)
#   6. Runs npm install + npm run build
#   7. Creates the screenshots/ directory
#   8. Starts the app under PM2 on port 3020
#   9. Writes an nginx site config (you edit the domain name)
#  10. Opens firewall ports 80 + 443
#  11. Sets up PM2 to restart on boot
#
# Idempotent: safe to re-run. Already-installed components are skipped.
#
# After running:
#   - Edit /etc/nginx/sites-available/prismx to set your domain
#   - Run: sudo certbot --nginx -d your-domain.com  (for HTTPS)
#   - Open https://your-domain.com and log in with PIN 639263
# ─────────────────────────────────────────────────────────────────────

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="prismx"
APP_PORT=3020
NODE_MAJOR=22

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  PrismX Installer"
echo "  App directory: $APP_DIR"
echo "══════════════════════════════════════════════════════════════"
echo ""

# ── Check root ──────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root (sudo bash scripts/install-ubuntu.sh)"
  exit 1
fi

# ── 1. Node.js ──────────────────────────────────────────────────────
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  echo "✓ Node.js already installed: $NODE_VER"
else
  echo "→ Installing Node.js $NODE_MAJOR LTS..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
  echo "✓ Node.js $(node --version) installed"
fi

# ── 2. Build tools (for better-sqlite3 native compilation) ─────────
echo "→ Ensuring build-essential + python3..."
apt-get install -y -qq build-essential python3 2>/dev/null || true
echo "✓ Build tools ready"

# ── 3. PM2 ──────────────────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  echo "✓ PM2 already installed: $(pm2 --version)"
else
  echo "→ Installing PM2..."
  npm install -g pm2
  echo "✓ PM2 $(pm2 --version) installed"
fi

# ── 4. Tesseract OCR ───────────────────────────────────────────────
if command -v tesseract &>/dev/null; then
  echo "✓ Tesseract already installed"
else
  echo "→ Installing Tesseract OCR + language packs..."
  apt-get install -y -qq tesseract-ocr tesseract-ocr-eng \
    tesseract-ocr-chi-sim tesseract-ocr-ara 2>/dev/null || true
  echo "✓ Tesseract installed"
fi

# ── 5. nginx ────────────────────────────────────────────────────────
if command -v nginx &>/dev/null; then
  echo "✓ nginx already installed"
else
  echo "→ Installing nginx..."
  apt-get install -y -qq nginx
  systemctl enable nginx
  systemctl start nginx
  echo "✓ nginx installed and started"
fi

# ── 6. npm install + build ─────────────────────────────────────────
echo "→ Installing npm dependencies..."
cd "$APP_DIR"
npm install --production=false 2>&1 | tail -3
echo "✓ Dependencies installed"

echo "→ Building the application (this takes 30-90 seconds)..."
npm run build 2>&1 | tail -5
echo "✓ Build complete"

# ── 7. Screenshots directory ──────────────────────────────────────
mkdir -p "$APP_DIR/screenshots"
echo "✓ Screenshots directory ready"

# ── 8. Start with PM2 ─────────────────────────────────────────────
# Stop any existing instance first (idempotent).
pm2 delete "$APP_NAME" 2>/dev/null || true

echo "→ Starting PrismX on port $APP_PORT..."
cd "$APP_DIR"
PORT=$APP_PORT pm2 start npm --name "$APP_NAME" -- start
pm2 save
echo "✓ PrismX running on port $APP_PORT"

# ── 9. nginx site config ──────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
if [ ! -f "$NGINX_CONF" ]; then
  echo "→ Writing nginx config..."
  cat > "$NGINX_CONF" << 'NGINX_EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN;  # <-- EDIT THIS: e.g. prismx.example.com or _ for any

    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
NGINX_EOF

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  echo "✓ nginx config written at $NGINX_CONF"
  echo "  ⚠️  EDIT $NGINX_CONF to replace YOUR_DOMAIN with your actual domain"
else
  echo "✓ nginx config already exists at $NGINX_CONF (not overwritten)"
fi

# ── 10. Firewall ──────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
  ufw allow $APP_PORT/tcp 2>/dev/null || true
  echo "✓ Firewall ports 80, 443, $APP_PORT opened"
fi

# ── 11. PM2 startup persistence ───────────────────────────────────
echo "→ Configuring PM2 to start on boot..."
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
pm2 save
echo "✓ PM2 will restart PrismX after reboot"

# ── Done ──────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✅ PrismX installation complete!"
echo ""
echo "  App URL:     http://$(hostname -I | awk '{print $1}'):$APP_PORT"
echo "  App dir:     $APP_DIR"
echo "  Database:    $APP_DIR/data.db (created on first request)"
echo "  Screenshots: $APP_DIR/screenshots/"
echo "  PM2 name:    $APP_NAME"
echo "  PM2 logs:    pm2 logs $APP_NAME"
echo ""
echo "  Next steps:"
echo "  1. Edit $NGINX_CONF to set your domain"
echo "  2. sudo certbot --nginx -d your-domain.com  (for HTTPS)"
echo "  3. Open the app and log in with PIN 639263"
echo "  4. Change PINs immediately from /users"
echo "══════════════════════════════════════════════════════════════"
echo ""
