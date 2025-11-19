# Deployment Guide

## Quick Deploy

Deploy everything (frontend + backend):

```bash
./deploy/remote/deploy.sh
```

That's it! One command deploys everything to saisongs.org.

### Using SSH Key

If you need to specify a custom SSH key:

```bash
SSH_KEY=~/.ssh/my-custom-key ./deploy/remote/deploy.sh
```

Or set it as an environment variable:

```bash
export SSH_KEY=~/.ssh/my-custom-key
./deploy/remote/deploy.sh
```

**Note:** Tilde expansion (`~`) and spaces in filenames are supported:
```bash
# Works with tilde
SSH_KEY=~/Downloads/my-key.pem ./deploy/remote/deploy.sh

# Works with spaces (quote the path)
SSH_KEY="~/Downloads/SSH Key Nov 12 2025.key" ./deploy/remote/deploy.sh
```

---

## Deployment Options

### Deploy Everything (Default)
```bash
./deploy/remote/deploy.sh
```
- Builds frontend (with correct base path and API URL)
- Builds backend (with caching system)
- Deploys both to server
- Restarts PM2
- Verifies deployment

### Backend Only
```bash
./deploy/remote/deploy.sh --backend-only
```
Use when you only changed server-side code (routes, services, database logic).

### Frontend Only
```bash
./deploy/remote/deploy.sh --frontend-only
```
Use when you only changed UI code (components, contexts, styles).

---

## Utility Scripts

### Check Server Health
```bash
./deploy/remote/check-server.sh

# With custom SSH key:
SSH_KEY=~/.ssh/my-key ./deploy/remote/check-server.sh
```
Checks PM2 status, API health, nginx, logs, and environment variables.

### Restart Backend
```bash
./deploy/remote/restart-server.sh

# With custom SSH key:
SSH_KEY=~/.ssh/my-key ./deploy/remote/restart-server.sh
```
Quick restart of PM2 process without redeploying files.

---

## What Gets Deployed

### Frontend (`dist/`)
- React app built for VPS (base path: `/`)
- API configured to use `/api` (relative path)
- Optimized and minified assets
- Deployed to: `/var/www/songstudio/dist/`

### Backend (`dist/server/`)
- Compiled TypeScript → JavaScript
- All routes, services, and middleware
- Includes:
  - Oracle database connection pooling
  - Server-side caching (5-minute TTL)
  - Graceful shutdown handlers
  - Error handling
- Deployed to: `/var/www/songstudio/dist/server/`

---

## After Deployment

### Verify It Works

**Test from browser:**
```
https://saisongs.org
```

**Test API:**
```bash
curl https://saisongs.org/api/health
curl https://saisongs.org/api/songs | jq '.[0]'
```

### Monitor Logs

```bash
# Real-time logs
ssh ubuntu@saisongs.org 'pm2 logs songstudio'

# Last 50 lines
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 50'

# Filter for errors
ssh ubuntu@saisongs.org 'pm2 logs songstudio --err'

# Filter for cache activity
ssh ubuntu@saisongs.org 'pm2 logs songstudio | grep -i cache'
```

### Check Status

```bash
# PM2 status
ssh ubuntu@saisongs.org 'pm2 status'

# Nginx status
ssh ubuntu@saisongs.org 'sudo systemctl status nginx'

# Database connection
ssh ubuntu@saisongs.org 'pm2 logs songstudio | grep -i "oracle"'
```

---

## Troubleshooting

### Deployment Failed

**Check you're in the right directory:**
```bash
ls package.json  # Should exist
```

**Check SSH access:**
```bash
ssh ubuntu@saisongs.org 'echo "Connected!"'

# Or with custom SSH key:
ssh -i ~/.ssh/my-key ubuntu@saisongs.org 'echo "Connected!"'
```

**Set SSH key for deployment:**
```bash
export SSH_KEY=~/.ssh/my-key
./deploy/remote/deploy.sh
```

### App Not Starting After Deploy

**Check PM2 logs:**
```bash
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 100'
```

**Common issues:**
- Missing `.env` file on server
- Oracle credentials not configured
- Port 3001 already in use
- Database connection timeout

**Fix:**
```bash
# Restart manually
ssh ubuntu@saisongs.org 'cd /var/www/songstudio && pm2 restart songstudio'

# Check environment
ssh ubuntu@saisongs.org 'cat /var/www/songstudio/.env'
```

### Frontend Loads But API Fails

**Check nginx proxy:**
```bash
ssh ubuntu@saisongs.org 'sudo nginx -t'
ssh ubuntu@saisongs.org 'sudo tail -f /var/log/nginx/songstudio_error.log'
```

**Verify API is running:**
```bash
ssh ubuntu@saisongs.org 'curl http://localhost:3001/api/health'
```

---

## Environment Setup

### Required Files on Server

**`.env` (in `/var/www/songstudio/`):**
```bash
NODE_ENV=production
PORT=3001
VITE_ORACLE_USER=your_user
VITE_ORACLE_PASSWORD=your_password
VITE_ORACLE_CONNECT_STRING=your_connection_string
VITE_ORACLE_WALLET_PASSWORD=your_wallet_password
```

**Wallet files (in `/var/www/songstudio/wallet/`):**
- `cwallet.sso`
- `tnsnames.ora`
- `sqlnet.ora`
- Other Oracle wallet files

### First-Time Setup

If deploying to a new server, run the setup script first:
```bash
./deploy/remote/server-setup-oracle.sh
```

This installs:
- Node.js
- PM2
- Nginx
- Required system packages

---

## Deployment Checklist

Before deploying:
- [ ] `.env.production` exists locally (with `VITE_API_URL=/api`)
- [ ] Code committed to git (optional but recommended)
- [ ] Tested locally with `npm run dev:all`
- [ ] Backend builds without errors: `npm run build:server`
- [ ] Frontend builds without errors: `npm run build:vps`

After deploying:
- [ ] Frontend loads: https://saisongs.org
- [ ] API responds: https://saisongs.org/api/health
- [ ] No errors in PM2 logs
- [ ] Cache working (check logs for cache hits)
- [ ] Test on mobile device

---

## Summary

**One script to rule them all:**
```bash
./deploy/remote/deploy.sh
```

**Monitor after deploy:**
```bash
ssh ubuntu@saisongs.org 'pm2 logs songstudio'
```

**Quick restart if needed:**
```bash
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```

That's it! 🚀
