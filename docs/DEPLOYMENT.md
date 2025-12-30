# Deployment Guide

Complete deployment guide for Sai Songs across different platforms.

## Table of Contents
- [GitHub Environments & Secrets](#github-environments--secrets)
  - [Oracle Wallet Setup](#oracle-wallet-setup)
- [Local Development Deployment](#local-development-deployment)
- [Production Deployment](#production-deployment)
- [VPS Deployment](#vps-deployment)
- [GitHub Pages (Frontend Only)](#github-pages)
- [Common Issues](#common-issues)

---

## GitHub Environments & Secrets

Sai Songs uses **GitHub Environments** to securely manage secrets for different deployment targets. This keeps all sensitive configuration out of the codebase.

### Why GitHub Environments?

| Feature | Benefit |
|---------|---------|
| **No local secrets** | Secrets never touch your local machine |
| **Environment isolation** | Different values for local vs production |
| **Protection rules** | Require approvals before deploying to production |
| **Audit trail** | GitHub logs who accessed/changed secrets |
| **Easy rotation** | Update secrets in one place |

### Setting Up Environments

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Environments**
3. Create two environments: `local` and `production`

### Required Secrets by Environment

#### Both Environments (local & production)

| Secret | Description |
|--------|-------------|
| `ORACLE_USER` | Oracle database username |
| `ORACLE_PASSWORD` | Oracle database password |
| `ORACLE_CONNECT_STRING` | TNS connection string |
| `ORACLE_WALLET_PASSWORD` | Wallet password (if using Oracle Cloud) |
| `SESSION_SECRET` | Session cookie signing secret (min 32 chars) |
| `BREVO_API_KEY` | Brevo (Sendinblue) API key for email OTP |
| `BREVO_SENDER_EMAIL` | Email sender address |
| `BREVO_SENDER_NAME` | Email sender name |

#### Production Environment Only

| Secret | Description |
|--------|-------------|
| `SSH_PRIVATE_KEY` | SSH private key for server access |
| `REMOTE_IP` | Production server IP address |
| `REMOTE_USER` | SSH username (e.g., `ubuntu`) |
| `REMOTE_PATH` | Deployment path (e.g., `/var/www/saisongs`) |

### Protection Rules (Recommended for Production)

1. Go to **Settings** → **Environments** → **production**
2. Enable **Required reviewers** - add yourself or team members
3. Enable **Wait timer** (optional) - e.g., 5 minutes
4. Restrict to **Selected branches** - only `main`

### How Secrets Are Used

**GitHub Actions workflows** automatically inject these secrets:

```yaml
# deploy-remote.yml uses production environment
jobs:
  deploy:
    environment: production  # ← Loads production secrets
    steps:
      - run: |
          # Secrets available as: ${{ secrets.SSH_PRIVATE_KEY }}
```

```yaml
# deploy-local.yml uses local environment
jobs:
  deploy:
    environment: local  # ← Loads local secrets
    runs-on: self-hosted
```

### Local Development (Without GitHub Actions)

For local development without using GitHub Actions, create a `.env.local` file:

```bash
# Copy the example file
cp .env.example .env.local

# Edit with your values
nano .env.local
```

**Note:** `.env.local` is in `.gitignore` and will never be committed.

### Oracle Wallet Setup

The Oracle wallet contains SSL certificates for secure database connections. Unlike secrets, **the wallet is stored as files** and must be copied manually to each environment.

#### Wallet Locations

| Environment | Path | How It Gets There |
|-------------|------|-------------------|
| **Local Dev** | `./wallet/` | Already present (in `.gitignore`) |
| **Production** | `/var/www/saisongs/wallet` | Manual one-time copy |

#### Why Not Store Wallet in GitHub Secrets?

- Wallet files are binary and would need base64 encoding
- Multiple files to manage (7 files)
- Adds complexity with little benefit
- Wallet expires in 2030 - rarely needs updating

#### First-Time Production Setup

Copy your local wallet to the production server:

```bash
# Copy wallet directory to server
scp -i ~/.ssh/your-deploy-key -r wallet/ ubuntu@YOUR_SERVER_IP:/var/www/saisongs/

# SSH in and secure the files
ssh -i ~/.ssh/your-deploy-key ubuntu@YOUR_SERVER_IP
chmod 600 /var/www/saisongs/wallet/*
chmod 700 /var/www/saisongs/wallet
```

#### Wallet Contents

| File | Purpose |
|------|---------|
| `cwallet.sso` | Auto-login wallet (no password needed) |
| `tnsnames.ora` | Connection string definitions |
| `sqlnet.ora` | Network configuration |
| `keystore.jks` | Java keystore |
| `truststore.jks` | Trusted certificates |
| `ojdbc.properties` | JDBC driver properties |
| `README` | Wallet info and expiry date |

#### Wallet Expiry

Your current wallet expires **2030-11-25**. Set a calendar reminder to download a new wallet before then from the Oracle Cloud Console.

---

## Local Development Deployment

Deploy to your local Mac using the GitHub Actions self-hosted runner.

### Prerequisites

1. **Self-hosted GitHub Actions runner** installed and running on your Mac
2. **local** environment configured in GitHub with required secrets

### Triggering a Local Deploy

1. Go to **Actions** → **Deploy to Local Mac**
2. Click **Run workflow**
3. Select deployment type:
   - `full` - Deploy frontend and backend
   - `backend-only` - Deploy only backend
   - `frontend-only` - Deploy only frontend
4. Click **Run workflow**

### What Happens

The workflow will:
1. Checkout the latest code
2. Install dependencies
3. Build frontend/backend as selected
4. Restart the backend using PM2
5. Run health checks

### Manual Local Development

For day-to-day development without GitHub Actions:

```bash
# Start services
./deploy/local/dev.sh start

# Check status
./deploy/local/dev.sh status

# View logs
./deploy/local/dev.sh logs -f

# Stop services
./deploy/local/dev.sh stop
```

See [Local Development README](../deploy/local/README.md) for full documentation.

---

## Production Deployment

**Current Production Server:**
- **URL:** https://YOUR_DOMAIN
- **Server:** Ubuntu 22.04.5 LTS
- **IP:** YOUR_SERVER_IP
- **SSH:** `ssh -i /path/to/your/ssh-key.key ubuntu@YOUR_SERVER_IP`

### Quick Deploy

```bash
cd /Users/ssett2/Documents/github.com/srse369/saisongs
./deploy/remote/deploy.sh production
```

### First-Time Server Setup

**1. SSH into server:**
```bash
ssh -i /path/to/your/ssh-key.key ubuntu@YOUR_SERVER_IP
```

**2. Run setup script:**
```bash
bash deploy/remote/server-setup.sh
```

This installs:
- Node.js 20.x
- PM2 process manager
- Nginx web server
- Oracle Instant Client 21.13

**3. Configure Nginx:**
```bash
sudo cp deploy/remote/nginx.conf /etc/nginx/sites-available/saisongs
sudo ln -s /etc/nginx/sites-available/saisongs /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**4. Setup environment variables:**
```bash
nano /var/www/saisongs/.env
```

Required variables:
```bash
NODE_ENV=production
PORT=3111
HOST=0.0.0.0

# Oracle Database
ORACLE_USER=your_username
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_connection_string
ORACLE_WALLET_PASSWORD=your_wallet_password

# Admin access
ADMIN_PASSWORD=your_admin_password

# Database pool
DB_POOL_MIN=0
DB_POOL_MAX=2
DB_POOL_INCREMENT=1

# URLs
APP_URL=https://YOUR_DOMAIN
API_URL=https://YOUR_DOMAIN/api
CORS_ORIGIN=https://YOUR_DOMAIN

# Oracle Client
LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13
```

**5. Copy Oracle wallet to server:**
```bash
scp -i /path/to/your/ssh-key.key -r wallet ubuntu@YOUR_SERVER_IP:/var/www/saisongs/
```

**6. Deploy application:**
```bash
./deploy/remote/deploy.sh production
```

### Deployment Process

The `deploy.sh` script automatically:
1. Builds frontend with correct base path
2. Builds backend for production
3. Creates deployment package
4. Transfers to server via SCP
5. Installs dependencies
6. Restarts application with PM2
7. Runs health checks

### Server Architecture

```
Internet → Nginx (Port 443 HTTPS / 80 HTTP)
              ↓
         Static Files (React Frontend)
              ↓
         Express Backend (Port 3111) → Oracle Database
```

### Managing the Application

**Check status:**
```bash
pm2 status
pm2 logs saisongs
pm2 logs saisongs --lines 100
```

**Restart application:**
```bash
pm2 restart saisongs
```

**View logs:**
```bash
pm2 logs saisongs --lines 50
pm2 logs saisongs --err  # Errors only
```

**Nginx management:**
```bash
sudo systemctl status nginx
sudo systemctl reload nginx
sudo nginx -t  # Test configuration
```

### SSL/HTTPS Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d YOUR_DOMAIN

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

---

## VPS Deployment

For deploying to other VPS servers (Oracle Linux, Ubuntu, etc.)

### Prerequisites
- Ubuntu 20.04/22.04 or Oracle Linux 8/9
- Root/sudo access
- Node.js 20+
- Oracle Instant Client

### Quick Start

**1. Update deploy script with your server IP:**
Edit `deploy/remote/deploy.sh`:
```bash
REMOTE_HOST="your_server_ip"
REMOTE_USER="ubuntu"  # or "opc" for Oracle Linux
```

**2. Deploy:**
```bash
./deploy/remote/deploy.sh production
```

### Oracle Linux Specifics

For Oracle Linux servers, use the Oracle-specific setup script:

```bash
scp -i /path/to/your/ssh-key.key \
    deploy/remote/server-setup-oracle.sh \
    opc@YOUR_ORACLE_CLOUD_IP:/tmp/

ssh -i /path/to/your/ssh-key.key opc@YOUR_ORACLE_CLOUD_IP
bash /tmp/server-setup-oracle.sh
```

**Firewall (firewalld):**
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

**SELinux:**
```bash
sudo setsebool -P httpd_can_network_connect 1
```

---

## GitHub Pages

Deploy frontend-only static site to GitHub Pages.

**⚠️ Note:** Backend API will not be available. For full-stack deployment, use VPS.

### Quick Deploy

```bash
npm run build
npm run deploy
```

### Manual Setup

**1. Configure Vite:**

Update `vite.config.ts` if repository name differs:
```typescript
base: '/your-repo-name/'
```

**2. Enable GitHub Pages:**
- Go to repository **Settings** → **Pages**
- Under **Source**, select **Deploy from a branch**
- Select `gh-pages` branch and `/ (root)` folder

**3. Deploy:**
```bash
npm run build
npm run deploy
```

Your site will be at: `https://[username].github.io/saisongs/`

### Routing Fix

GitHub Pages doesn't support client-side routing. Add `public/404.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Sai Songs</title>
    <script>
      sessionStorage.redirect = location.href;
    </script>
    <meta http-equiv="refresh" content="0;URL='/'">
  </head>
</html>
```

---

## Common Issues

### "Load Failed" on Mobile

**Problem:** Mobile devices show "Failed to fetch songs/singers/pitches"

**Root cause:** Frontend trying to connect to `localhost:3111` instead of production server

**Fix:**

Create `.env.production`:
```bash
echo "VITE_API_URL=/api" > .env.production
```

Rebuild and deploy:
```bash
npm run build:vps
npm run build:server
./deploy/remote/deploy.sh production
```

### Backend Not Starting

**Check logs:**
```bash
pm2 logs saisongs --lines 100
```

**Common causes:**
- Missing `.env` file
- Incorrect Oracle credentials
- Wallet files not found
- Port 3111 already in use

**Fix:**
```bash
# Verify environment
cat /var/www/saisongs/.env

# Check Oracle client
echo $LD_LIBRARY_PATH
ls -la /opt/oracle/instantclient_21_13/

# Restart
pm2 restart saisongs
```

### 502 Bad Gateway

**Check if backend is running:**
```bash
pm2 status
curl http://localhost:3111/api/health
```

**Check nginx logs:**
```bash
sudo tail -f /var/log/nginx/saisongs_error.log
```

**Restart services:**
```bash
pm2 restart saisongs
sudo systemctl reload nginx
```

### Oracle Connection Issues

**Pool already exists error:**
```bash
pm2 restart saisongs  # Clear existing pools
```

**Quota exceeded errors:**
See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#oracle-quota-issues)

### Assets Not Loading (404)

**Problem:** Assets trying to load from wrong path

**Fix:**
Ensure correct build target:
```bash
# For VPS
npm run build:vps

# For GitHub Pages
npm run build
```

Verify built files:
```bash
grep -o 'src="[^"]*"' dist/index.html
# Should show: src="/assets/..." for VPS
# Should show: src="/saisongs/assets/..." for GitHub Pages
```

---

## Rollback

Automatic backups are created on each deployment:
```bash
ssh ubuntu@YOUR_SERVER_IP
ls -la /var/www/saisongs.backup.*
sudo cp -r /var/www/saisongs.backup.20251119_120000/* /var/www/saisongs/
pm2 restart saisongs
```

---

## Health Check

```bash
# API health
curl https://YOUR_DOMAIN/api/health

# Should return:
# {"status":"ok","timestamp":"2025-11-19T..."}
```

---

## Security Checklist

- ✅ SSH key authentication (no password login)
- ✅ Firewall configured (UFW/firewalld)
- ✅ HTTPS/SSL enabled
- ✅ Environment variables secured (600 permissions)
- ✅ Oracle wallet secured (600 permissions)
- ⚠️ Change default admin password
- ⚠️ Regular system updates

---

## Monitoring

```bash
# Real-time monitoring
pm2 monit

# System resources
htop

# Nginx access logs
sudo tail -f /var/log/nginx/saisongs_access.log

# Application logs
pm2 logs saisongs
```

---

## Support

- Technical architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Troubleshooting guide: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Feature documentation: [FEATURES.md](./FEATURES.md)
