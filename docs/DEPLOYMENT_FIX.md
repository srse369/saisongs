# Fixing Mobile "Load Failed" Error on saisongs.org

## Current Problem

From your nginx logs, the issues are:

1. **404 errors:** Assets trying to load from `/songstudio/assets/...` instead of `/assets/...`
2. **Mixed content:** Frontend trying to use `http://localhost:3001` from HTTPS page

```
❌ GET /songstudio/assets/index-*.js → 404
❌ Mixed Content: https page calling http://localhost:3001
```

## Root Causes

1. **Wrong base path:** App built with `base: '/songstudio/'` but nginx serves from root `/`
2. **No production env:** No `.env.production` file, so API URL defaults to `http://localhost:3001`

## The Fix

### Step 1: Create `.env.production`

```bash
cd /Users/ssett2/Documents/github.com/srse369/songstudio

cat > .env.production << 'EOF'
# Production environment variables for saisongs.org
VITE_API_URL=/api
EOF
```

### Step 2: Rebuild with Correct Configuration

```bash
# Clean old build
rm -rf dist/

# Build for VPS (uses base path '/' not '/songstudio/')
npm run build:vps

# Build backend
npm run build:server
```

### Step 3: Deploy to Server

```bash
# Use the deployment script
./deploy/remote/redeploy.sh
```

Or manually:
```bash
# Deploy frontend
scp -r dist/* ubuntu@saisongs.org:/var/www/songstudio/dist/

# Restart backend
ssh ubuntu@saisongs.org 'cd /var/www/songstudio && pm2 restart songstudio'
```

### Step 4: Verify

Test from your mobile device:
```
https://saisongs.org
```

Should now work without errors!

---

## What Gets Fixed

### Before Fix

**Browser requests:**
```
❌ https://saisongs.org/songstudio/assets/index-*.js  → 404 Not Found
❌ http://localhost:3001/api/songs                    → Mixed Content Blocked
```

**Errors on mobile:**
- "Failed to fetch songs"
- "Failed to fetch singers"
- "Failed to fetch pitches"
- Assets don't load

### After Fix

**Browser requests:**
```
✅ https://saisongs.org/assets/index-*.js    → 200 OK
✅ https://saisongs.org/api/songs            → 200 OK (nginx proxies to backend)
```

**Mobile experience:**
- ✅ Page loads correctly
- ✅ Assets load
- ✅ API calls work
- ✅ No mixed content warnings
- ✅ Songs, singers, and pitches load

---

## How It Works

### Build Configuration

**vite.config.ts:**
```typescript
base: process.env.VITE_DEPLOY_TARGET === 'vps' 
  ? '/'              // ← Root path for VPS
  : '/songstudio/',  // ← GitHub Pages needs this
```

**npm scripts:**
```json
{
  "build": "vite build",           // Uses /songstudio/ (GitHub Pages)
  "build:vps": "VITE_DEPLOY_TARGET=vps vite build"  // Uses / (VPS)
}
```

### API Configuration

**With `.env.production`:**
```typescript
// src/services/ApiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
//                   ↑ Reads from .env.production
//                   Sets to: '/api'
```

**Requests become:**
```javascript
// Before:
fetch('http://localhost:3001/api/songs')  // ❌ Mixed content blocked

// After:
fetch('/api/songs')  // ✅ Relative URL
// Browser expands to: https://saisongs.org/api/songs
```

### Nginx Proxying

**From your config:**
```nginx
location /api {
    proxy_pass http://localhost:3001/api;
    # When browser requests https://saisongs.org/api/songs
    # Nginx proxies to http://localhost:3001/api/songs internally
}
```

**Flow:**
```
Mobile Browser
   ↓
https://saisongs.org/api/songs (HTTPS - secure)
   ↓
Nginx (receives HTTPS request)
   ↓
http://localhost:3001/api/songs (internal network - safe)
   ↓
Node.js Backend (PM2)
   ↓
Oracle Database
   ↓
Response flows back as HTTPS
```

---

## Troubleshooting

### If Assets Still 404

Check the built `index.html`:
```bash
grep -o 'src="[^"]*"' dist/index.html

# Should show:
# src="/assets/index-*.js"  ✅
# 
# NOT:
# src="/songstudio/assets/index-*.js"  ❌
```

If still wrong:
```bash
# Rebuild with explicit VPS target
VITE_DEPLOY_TARGET=vps npm run build
```

### If API Calls Still Fail

Check browser console (F12):
```javascript
// Check what's actually being called
console.log('Fetching:', '/api/songs')
```

Verify backend is running:
```bash
ssh ubuntu@saisongs.org 'pm2 list'
ssh ubuntu@saisongs.org 'curl http://localhost:3001/api/health'
```

### If Mixed Content Persists

Check built JavaScript for hardcoded URLs:
```bash
grep -r "localhost:3001" dist/
# Should return: (nothing)
```

If found, `.env.production` wasn't used during build. Rebuild:
```bash
rm -rf dist/
npm run build:vps
```

---

## Quick Reference

### Deploy Command
```bash
./deploy/remote/redeploy.sh
```

### Check Status
```bash
# Backend status
ssh ubuntu@saisongs.org 'pm2 list'

# Backend logs
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 50'

# Nginx logs
ssh ubuntu@saisongs.org 'sudo tail -f /var/log/nginx/access.log'
```

### Test APIs
```bash
# Health check
curl https://saisongs.org/api/health

# Get songs
curl https://saisongs.org/api/songs | jq '.[0]'

# Get singers
curl https://saisongs.org/api/singers | jq '.[0]'
```

---

## Summary

**Files to create:**
- `.env.production` with `VITE_API_URL=/api`

**Commands to run:**
```bash
npm run build:vps
npm run build:server
./deploy/remote/redeploy.sh
```

**Result:**
- ✅ Assets load from `https://saisongs.org/assets/`
- ✅ API calls to `https://saisongs.org/api/`
- ✅ No mixed content errors
- ✅ Works on mobile devices

