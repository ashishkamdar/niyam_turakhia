# PrismX — Installation Guide

Install PrismX on any server: Ubuntu/Debian cloud VPS, RHEL/CentOS, or a client's on-premise Windows Server. The app is a self-contained Next.js application with SQLite — no external databases, no Redis, no Docker required.

---

## Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| **Node.js** | 18 LTS | 22 LTS or latest |
| **npm** | 9+ | (ships with Node) |
| **PM2** | 5+ | Latest (`npm install -g pm2`) |
| **RAM** | 512 MB | 1 GB+ |
| **Disk** | 500 MB (app + deps) | 2 GB+ (room for screenshots + DB growth) |
| **OS** | Ubuntu 20.04+ / Debian 11+ / RHEL 8+ / Windows Server 2019+ | Ubuntu 22.04 LTS |
| **Reverse proxy** | nginx or Apache (for HTTPS) | nginx with Let's Encrypt |
| **Git** | 2.x | Latest |

**Not required:** Docker, PostgreSQL, MySQL, Redis, Kubernetes, cloud services.

---

## Quick Install (Ubuntu/Debian)

Run the automated script:

```bash
# 1. Clone the repo
git clone https://github.com/ashishkamdar/niyam_turakhia.git /opt/prismx
cd /opt/prismx

# 2. Run the installer
sudo bash scripts/install-ubuntu.sh

# 3. Configure your domain (optional — skip for IP-only access)
#    Edit /etc/nginx/sites-available/prismx and replace YOUR_DOMAIN
sudo nano /etc/nginx/sites-available/prismx
sudo nginx -t && sudo systemctl reload nginx

# 4. Get HTTPS (optional — requires a domain)
sudo certbot --nginx -d your-domain.com
```

The installer handles everything: Node.js, PM2, nginx, build, firewall rules, and PM2 startup persistence. After it completes, the app is live on port 3020 (direct) or port 80/443 (via nginx).

---

## Manual Install (step by step)

### 1. Install Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should print v22.x
```

**RHEL/CentOS/Amazon Linux:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs
```

**Windows Server:**
Download the MSI installer from https://nodejs.org and run it. Ensure "Add to PATH" is checked.

### 2. Install PM2

```bash
sudo npm install -g pm2
```

**Windows:** Run from an elevated (Administrator) PowerShell:
```powershell
npm install -g pm2
```

### 3. Clone the repository

```bash
git clone https://github.com/ashishkamdar/niyam_turakhia.git /opt/prismx
cd /opt/prismx
```

**Windows:**
```powershell
git clone https://github.com/ashishkamdar/niyam_turakhia.git C:\prismx
cd C:\prismx
```

### 4. Install dependencies

```bash
npm install
```

This installs `better-sqlite3` (which compiles a native C addon), `next`, `react`, `recharts`, `tesseract.js`, `uuid`, and their transitive dependencies.

**Build tools note:** `better-sqlite3` requires a C compiler. On Ubuntu, `sudo apt-get install -y build-essential python3` provides this. On Windows, install the Visual C++ Build Tools from https://visualstudio.microsoft.com/visual-cpp-build-tools/ or run `npm install --global windows-build-tools` from an elevated prompt.

### 5. Build the application

```bash
npm run build
```

This compiles TypeScript, bundles the Next.js app, and produces the `.next/` directory. Takes 30-90 seconds depending on CPU.

### 6. Create the screenshots directory

```bash
mkdir -p screenshots
```

The webhook saves WhatsApp payment images here. Without this directory, image OCR will fail with a write error.

### 7. Start with PM2

```bash
# Start the app on port 3020
PORT=3020 pm2 start npm --name prismx -- start

# Save the PM2 process list so it survives reboots
pm2 save

# Set up PM2 to start on boot
pm2 startup
# (follow the printed command — it will ask you to run something with sudo)
```

**Windows (PM2 as a service):**
```powershell
npm install -g pm2-windows-startup
pm2-startup install
PORT=3020 pm2 start npm --name prismx -- start
pm2 save
```

### 8. Verify

```bash
curl http://localhost:3020
# Should return HTML containing "PrismX"
```

Open `http://<server-ip>:3020` in a browser. You should see the PIN pad.

### 9. Set up nginx reverse proxy (recommended)

Create `/etc/nginx/sites-available/prismx`:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or _ for IP-only access

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

        # Allow large file uploads (WhatsApp images can be up to 16MB)
        client_max_body_size 20M;
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/prismx /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 10. Get HTTPS with Let's Encrypt (recommended)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot auto-renews via a systemd timer. Test renewal:
```bash
sudo certbot renew --dry-run
```

---

## Configuration after install

### Default PINs

| Label | PIN | Role |
|---|---|---|
| Niyam | 639263 | super_admin |
| Ashish | 520125 | super_admin |
| Admin | 999999 | admin |
| Staff | 111111 | staff |

Change these immediately from `/users` after first login.

### Financial year

Default: April 1 (Indian fiscal calendar). Change from `/settings` → Financial Year section.

### WhatsApp webhook

If connecting to Meta Cloud API:
1. Go to `/settings` → Meta WhatsApp Business API section
2. Set `phone_number_id`, `access_token`, `verify_token`
3. In Meta Developer Console, set the webhook URL to `https://your-domain.com/api/whatsapp/webhook`
4. Meta will send a verification GET request — the app handles it automatically

### Tesseract OCR (optional, for WhatsApp image processing)

The app uses Tesseract for local OCR. On Ubuntu:
```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-sim tesseract-ocr-ara
```

On Windows: Download and install from https://github.com/UB-Mannheim/tesseract/wiki. Add the install directory to your PATH.

---

## Updating

```bash
cd /opt/prismx
git pull
npm install        # in case new dependencies were added
npm run build
pm2 restart prismx
```

Or use the included `deploy.sh` (designed for the nuremberg pre-prod server but works anywhere):
```bash
bash deploy.sh
```

**Database migrations run automatically** on the first request after restart. No manual SQL is ever needed. The migration system is append-only and never drops data. See `TECHNICAL-SPECIFICATION.md` §5 for details.

---

## Backup & restore

### Backup

```bash
cp /opt/prismx/data.db /opt/prismx/data.db.bak.$(date +%Y%m%d_%H%M%S)
```

The `deploy.sh` script does this automatically before every deploy.

### Restore

```bash
pm2 stop prismx
cp /opt/prismx/data.db.bak.TIMESTAMP /opt/prismx/data.db
pm2 start prismx
```

### Full database reset (⚠️ destroys all data)

```bash
pm2 stop prismx
rm /opt/prismx/data.db
pm2 start prismx
# The app recreates all tables + seeds default PINs on first request
```

---

## Windows Server notes

PrismX runs on Windows Server without modification. Key differences:

1. **Path separator:** Replace `/opt/prismx` with `C:\prismx` in all examples
2. **PM2 service:** Use `pm2-windows-startup` instead of `pm2 startup`
3. **nginx alternative:** Use IIS as the reverse proxy with URL Rewrite module, or install nginx for Windows from https://nginx.org/en/docs/windows.html
4. **Build tools:** Install Visual C++ Build Tools for `better-sqlite3`'s native compilation
5. **Firewall:** Open port 3020 (or 80/443 if using a reverse proxy) in Windows Firewall

### IIS reverse proxy (alternative to nginx)

1. Install IIS + URL Rewrite Module + Application Request Routing
2. Create a new site → Binding: port 80/443
3. URL Rewrite → Add Rule → Reverse Proxy → `http://localhost:3020`
4. Set `preserveHostHeader` to true in `web.config`

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `npm install` fails on `better-sqlite3` | Install build tools: `sudo apt-get install build-essential python3` (Ubuntu) or Visual C++ Build Tools (Windows) |
| App starts but shows blank page | Check `npm run build` completed without errors. Check PM2 logs: `pm2 logs prismx` |
| Port 3020 not accessible | Check firewall: `sudo ufw allow 3020` (Ubuntu) or Windows Firewall rules |
| WhatsApp webhook verification fails | Ensure `verify_token` in `/settings` matches what's configured in Meta Developer Console |
| OCR not working on images | Install Tesseract: `sudo apt-get install tesseract-ocr` |
| Database locked errors | Only one PM2 instance should run. Check: `pm2 list` — should show exactly 1 `prismx` process |
| `EACCES` permission errors | Don't run PM2 as root for the app process. Use a dedicated user or fix ownership: `chown -R $USER /opt/prismx` |

---

## Architecture overview

```
Client browser
    │
    │ HTTPS (:443)
    ▼
nginx (or IIS)
    │
    │ HTTP (:3020)
    ▼
PM2 → Node.js (Next.js 16)
    │
    ├── SQLite (data.db)     ← all application data
    ├── screenshots/          ← WhatsApp image files
    └── .next/                ← compiled app (from npm run build)
```

No external services required. The entire application runs on a single server with a single SQLite file as the database. Backups are just file copies.

---

*For the complete technical reference (all tables, APIs, components, auth model, concurrency), see [`TECHNICAL-SPECIFICATION.md`](TECHNICAL-SPECIFICATION.md).*
