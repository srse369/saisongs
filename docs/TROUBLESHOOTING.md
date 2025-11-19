# Troubleshooting Guide

Solutions to common issues with Song Studio deployment and operation.

## Table of Contents
- [Mobile "Load Failed" Errors](#mobile-load-failed-errors)
- [Backend Not Running](#backend-not-running)
- [Oracle Database Issues](#oracle-database-issues)
- [Deployment Issues](#deployment-issues)
- [Performance Issues](#performance-issues)

---

## Mobile "Load Failed" Errors

### Problem

Mobile device shows errors like:
- "Failed to fetch songs"
- "Failed to fetch singers"
- "Failed to fetch pitches"
- "Load failed"

### Root Cause

The frontend is trying to connect to `localhost:3001` instead of the production server. On mobile devices, "localhost" refers to the mobile device itself, not your server.

### Error Flow

```
Page Load
  → Context Provider mounts
  → Calls songService.getAllSongs()
  → Calls apiClient.get('/songs')
  → fetch('http://localhost:3001/api/songs')  ← PROBLEM
  → Network fails: TypeError: Failed to fetch
  → ApiClient throws error
  → Context catches, calls toast.error("Failed to fetch")
  → User sees error notification
```

### Solution

**1. Create `.env.production`:**

```bash
cd /Users/ssett2/Documents/github.com/srse369/songstudio
echo "VITE_API_URL=/api" > .env.production
```

**2. Rebuild with correct configuration:**

```bash
# Clean old build
rm -rf dist/

# Build for VPS (uses base path '/' not '/songstudio/')
npm run build:vps

# Build backend
npm run build:server
```

**3. Deploy to server:**

```bash
./deploy/remote/deploy.sh production
```

Or manually:
```bash
# Deploy frontend
scp -r dist/* ubuntu@saisongs.org:/var/www/songstudio/dist/

# Restart backend
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```

### Verify the Fix

**Check built files don't reference localhost:**
```bash
grep -r "localhost:3001" dist/
# Should return: (nothing)
```

**Test from mobile:**
1. Open browser on mobile device
2. Navigate to: https://saisongs.org
3. Should load without errors

**Test API directly:**
```bash
curl https://saisongs.org/api/health
curl https://saisongs.org/api/songs | jq '.[0]'
```

### Understanding the Fix

**Before:**
```typescript
// Frontend tries to call:
fetch('http://localhost:3001/api/songs')
// ❌ Mobile can't reach localhost:3001
```

**After:**
```typescript
// Frontend calls:
fetch('/api/songs')
// ✅ Relative URL - nginx proxies to backend
```

**Nginx proxying:**
```
Mobile Browser
   ↓
https://saisongs.org/api/songs (HTTPS - secure)
   ↓
Nginx receives HTTPS request
   ↓
Proxies to → http://localhost:3001/api/songs (internal)
   ↓
Node.js Backend → Oracle Database
   ↓
Response flows back as HTTPS
```

---

## Backend Not Running

### Problem

Backend server not starting or immediately crashing.

### Check Status

```bash
# SSH into server
ssh ubuntu@saisongs.org

# Check PM2 processes
pm2 list

# View logs
pm2 logs songstudio --lines 50
```

### Common Causes

#### 1. Missing Environment Variables

**Check if `.env` exists:**
```bash
ls -la /var/www/songstudio/.env
```

**Verify contents:**
```bash
cat /var/www/songstudio/.env
```

**Required variables:**
```bash
NODE_ENV=production
PORT=3001
VITE_ORACLE_USER=your_user
VITE_ORACLE_PASSWORD=your_password
VITE_ORACLE_CONNECT_STRING=your_connection_string
VITE_ORACLE_WALLET_PASSWORD=your_wallet_password
ADMIN_PASSWORD=your_admin_password
LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13
```

#### 2. Oracle Connection Issues

**Error:** `NJS-046: pool alias already exists`

**Solution:**
```bash
pm2 restart songstudio
```

**Error:** `ORA-12154: TNS:could not resolve the connect identifier`

**Check wallet files:**
```bash
ls -la /var/www/songstudio/wallet/
# Should see: cwallet.sso, tnsnames.ora, sqlnet.ora
```

**Check Oracle Instant Client:**
```bash
echo $LD_LIBRARY_PATH
# Should include: /opt/oracle/instantclient_21_13

ls -la /opt/oracle/instantclient_21_13/
# Should see: libclntsh.so and other libraries
```

#### 3. Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::3001`

**Find process using port:**
```bash
sudo lsof -i :3001
# or
sudo netstat -tulpn | grep 3001
```

**Kill the process:**
```bash
sudo kill -9 <PID>
pm2 restart songstudio
```

#### 4. Missing Dependencies

**Reinstall dependencies:**
```bash
cd /var/www/songstudio
npm install
pm2 restart songstudio
```

### Restart Backend

**Simple restart:**
```bash
pm2 restart songstudio
```

**Full restart with environment:**
```bash
pm2 delete songstudio
cd /var/www/songstudio
pm2 start ecosystem.config.cjs --env production
pm2 save
```

### View Detailed Logs

**Real-time logs:**
```bash
pm2 logs songstudio
```

**Last 100 lines:**
```bash
pm2 logs songstudio --lines 100
```

**Error logs only:**
```bash
pm2 logs songstudio --err
```

**Filter logs:**
```bash
pm2 logs songstudio | grep -i "error\|fail\|exception"
```

---

## Oracle Database Issues

### Quota Exceeded Errors

**Problem:** `ORA-XXX: quota exceeded` or connection limit errors

**Cause:** Oracle Free Tier limits:
- 20 concurrent connections
- 1 OCPU (shared CPU)
- 20GB storage

#### Immediate Fix

**Restart backend to clear connections:**
```bash
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```

#### Long-term Solutions

**1. Reduce connection pool size** (already implemented):
```typescript
// server/services/DatabaseService.ts
poolMin: 1,
poolMax: 1,  // Only 1 connection
```

**2. Verify pool configuration:**
```bash
ssh ubuntu@saisongs.org
cat /var/www/songstudio/dist/server/services/DatabaseService.js | grep -A 5 "poolMax"
```

**3. Monitor usage in Oracle Cloud Console:**
- Login: https://cloud.oracle.com
- Navigate: Oracle Database → Autonomous Database → [Your Database]
- Check: Performance Hub → Active Sessions

**4. Enable server-side caching** (already implemented):
- 5-minute TTL reduces DB queries by 99.7%
- See [ARCHITECTURE.md](./ARCHITECTURE.md#server-side-caching)

### Connection Timeout

**Error:** `ORA-12170: TNS:Connect timeout occurred`

**Solutions:**

**1. Check wallet files:**
```bash
ls -la /var/www/songstudio/wallet/
chmod 600 /var/www/songstudio/wallet/*
```

**2. Verify connection string:**
```bash
# In .env file
cat /var/www/songstudio/.env | grep CONNECT_STRING
```

**3. Test connection:**
```bash
cd /var/www/songstudio
node -e "
const oracledb = require('oracledb');
console.log('OracleDB version:', oracledb.versionString);
"
```

### Pool Already Exists Error

**Error:** `NJS-046: pool alias "songstudio_pool" already exists`

**Cause:** Previous pool not properly closed

**Solution:**
```bash
pm2 restart songstudio
```

**Prevention:** Graceful shutdown is implemented:
```typescript
// server/index.ts
process.on('SIGINT', async () => {
  await dbService.close();
  process.exit(0);
});
```

### Storage Issues

**Check storage usage in Oracle Cloud Console:**
- Performance Hub → Monitor → Storage Usage

**If approaching 20GB:**
- Archive old data
- Delete unused records
- Consider upgrading to paid tier

---

## Deployment Issues

### SCP/SSH Connection Fails

**Problem:** Cannot connect to server via SSH

**Check SSH key permissions:**
```bash
ls -l ~/Downloads/"SSH Key Nov 12 2025.key"
# Should show: -rw------- (600)

# Fix if needed:
chmod 600 ~/Downloads/"SSH Key Nov 12 2025.key"
```

**Test connection:**
```bash
ssh -v -i ~/Downloads/"SSH Key Nov 12 2025.key" ubuntu@saisongs.org "echo 'Connected'"
```

**Add to SSH config:**
```bash
# Edit ~/.ssh/config
Host saisongs
    HostName saisongs.org
    User ubuntu
    IdentityFile ~/Downloads/SSH Key Nov 12 2025.key
    IdentitiesOnly yes

# Then simply use:
ssh saisongs
```

### Deployment Script Fails

**Check disk space:**
```bash
ssh ubuntu@saisongs.org "df -h"
```

**Check Node.js version:**
```bash
ssh ubuntu@saisongs.org "node --version"
# Should be: v20.x.x or higher
```

**Manual deployment:**
```bash
# Build locally
npm run build:vps
npm run build:server

# Create deployment package
tar -czf deploy.tar.gz dist package.json package-lock.json

# Copy to server
scp deploy.tar.gz ubuntu@saisongs.org:/tmp/

# SSH and deploy
ssh ubuntu@saisongs.org
cd /var/www/songstudio
tar -xzf /tmp/deploy.tar.gz
npm ci --production
pm2 restart songstudio
```

### Nginx 502 Bad Gateway

**Problem:** Nginx shows 502 error

**Causes:**

**1. Backend not running:**
```bash
pm2 status
# If stopped:
pm2 restart songstudio
```

**2. Backend not listening on port 3001:**
```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok"}
```

**3. Nginx can't connect to backend:**
```bash
sudo tail -f /var/log/nginx/songstudio_error.log
# Look for: "connect() failed"
```

**4. SELinux blocking (Oracle Linux only):**
```bash
sudo getsebool httpd_can_network_connect
# Should be: on

# If off:
sudo setsebool -P httpd_can_network_connect 1
```

**Fix:**
```bash
# Test backend directly
curl http://localhost:3001/api/health

# Restart services
pm2 restart songstudio
sudo systemctl reload nginx
```

### Assets Not Loading (404)

**Problem:** Frontend assets return 404 errors

**Causes:**

**1. Wrong base path in build:**

Check `dist/index.html`:
```bash
grep -o 'src="[^"]*"' dist/index.html

# For VPS should show:
# src="/assets/index-*.js"  ✅

# NOT:
# src="/songstudio/assets/index-*.js"  ❌
```

**Fix:**
```bash
# Rebuild with correct target
npm run build:vps
./deploy/remote/deploy.sh production
```

**2. Nginx not serving static files:**

Check nginx config:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/songstudio_error.log
```

**3. Files not uploaded:**
```bash
ssh ubuntu@saisongs.org 'ls -la /var/www/songstudio/dist/'
# Should see: index.html, assets/, vite.svg, etc.
```

---

## Performance Issues

### Slow Loading

**Check caching:**

**Server-side cache:**
```bash
ssh ubuntu@saisongs.org 'pm2 logs songstudio | grep -i cache'

# Should see:
# ✅ Cache hit for key: songs:all (age: 45s)
```

**If no cache hits:**
- Caching might not be working
- Check `server/services/CacheService.ts` is deployed
- Restart backend: `pm2 restart songstudio`

**Frontend cache:**
- Open browser console (F12)
- Check localStorage for cached data:
```javascript
Object.keys(localStorage).filter(k => k.startsWith('songstudio_'))
```

### High Memory Usage

**Check PM2 memory:**
```bash
pm2 list
# Look at "memory" column
```

**If memory > 512MB:**
```bash
# Restart to clear memory
pm2 restart songstudio

# Check for memory leaks in logs
pm2 logs songstudio | grep -i "memory\|heap"
```

**Adjust memory limit:**
Edit `ecosystem.config.cjs`:
```javascript
max_memory_restart: '512M'  // Increase if needed
```

### Slow Database Queries

**Check Oracle Cloud Console:**
- Performance Hub → SQL Monitoring
- Look for slow queries

**Add indexes:**
```sql
-- Song lookups
CREATE INDEX idx_songs_name ON songs(name);

-- Singer lookups
CREATE INDEX idx_singers_name ON singers(name);

-- Pitch queries
CREATE INDEX idx_pitches_song_id ON pitches(song_id);
CREATE INDEX idx_pitches_singer_id ON pitches(singer_id);

-- Session items
CREATE INDEX idx_session_items_session_id ON session_items(session_id);
```

**Check query execution:**
```bash
ssh ubuntu@saisongs.org 'pm2 logs songstudio | grep -i "query\|sql"'
```

---

## Frontend Issues

### White Screen / Blank Page

**Check browser console:**
- Press F12
- Look for JavaScript errors

**Common causes:**

**1. Missing environment variables:**
```bash
# Check if .env.production exists
ls -la .env.production

# Should contain:
VITE_API_URL=/api
```

**2. Build errors:**
```bash
npm run build:vps
# Look for errors in output
```

**3. Service worker issues:**
- Clear browser cache
- Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)

### API Calls Failing

**Check network tab (F12):**
- Look at failed requests
- Check request URL
- Check response status

**Common issues:**

**1. Wrong API URL:**
```javascript
// Browser console
console.log(window.location.origin + '/api')
// Should match your server URL
```

**2. CORS errors:**
- Check `CORS_ORIGIN` in server `.env`
- Should match frontend URL

**3. Backoff blocking requests:**
```
Error: "Server connection issue. Retrying in 10s."
```

**Solution:**
- Click "Refresh" button to reset backoff
- Or restart backend to fix underlying issue

---

## Health Check Commands

### Quick Health Check

```bash
# API health
curl https://saisongs.org/api/health

# Backend status
ssh ubuntu@saisongs.org 'pm2 status'

# Backend logs
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 20'

# Nginx status
ssh ubuntu@saisongs.org 'sudo systemctl status nginx'

# Nginx logs
ssh ubuntu@saisongs.org 'sudo tail -20 /var/log/nginx/songstudio_error.log'
```

### Full System Check

Use the check script:
```bash
ssh ubuntu@saisongs.org 'bash -s' < deploy/remote/check-server.sh
```

Or manually:
```bash
ssh ubuntu@saisongs.org

# PM2 status
pm2 status

# Backend health
curl http://localhost:3001/api/health

# Test database
curl http://localhost:3001/api/songs | jq '.[0]'

# Nginx status
sudo systemctl status nginx

# Test full stack
curl http://localhost/api/health

# Disk space
df -h

# Memory usage
free -h

# Process list
ps aux | grep -E "node|nginx|pm2"
```

---

## Emergency Procedures

### Complete System Restart

```bash
ssh ubuntu@saisongs.org

# Stop everything
pm2 stop songstudio
sudo systemctl stop nginx

# Wait 10 seconds
sleep 10

# Start everything
sudo systemctl start nginx
pm2 restart songstudio

# Check status
pm2 status
sudo systemctl status nginx
curl http://localhost:3001/api/health
```

### Reset to Last Known Good State

```bash
ssh ubuntu@saisongs.org

# List backups
ls -la /var/www/songstudio.backup.*

# Restore from backup
sudo cp -r /var/www/songstudio.backup.YYYYMMDD_HHMMSS/* /var/www/songstudio/

# Restart
pm2 restart songstudio
```

### Clear All Caches

```bash
# Server-side cache
ssh ubuntu@saisongs.org 'pm2 restart songstudio'

# Frontend cache
# In browser console (F12):
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## Getting Help

### Collect Information

When reporting issues, include:

**1. Error messages:**
```bash
pm2 logs songstudio --lines 100 > logs.txt
```

**2. System status:**
```bash
pm2 status > status.txt
```

**3. Configuration:**
```bash
# Remove sensitive data before sharing!
cat /var/www/songstudio/.env | grep -v PASSWORD > env.txt
```

**4. Browser console errors:**
- Press F12
- Copy errors from Console tab
- Copy failed requests from Network tab

### Check Documentation

- Deployment: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Features: [FEATURES.md](./FEATURES.md)

### Common Commands Reference

```bash
# SSH into server
ssh ubuntu@saisongs.org

# Check backend
pm2 status
pm2 logs songstudio --lines 50
pm2 restart songstudio

# Check nginx
sudo systemctl status nginx
sudo nginx -t
sudo systemctl reload nginx

# Check database
curl http://localhost:3001/api/health
curl http://localhost:3001/api/songs | jq '.[0]'

# Deploy updates
./deploy/remote/deploy.sh production

# View logs
pm2 logs songstudio
sudo tail -f /var/log/nginx/songstudio_error.log
```

---

## Still Having Issues?

If problems persist after trying these solutions:

1. Check all logs carefully for error messages
2. Verify all environment variables are set correctly
3. Ensure Oracle database is accessible
4. Try a complete system restart
5. Consider restoring from a backup

Most issues are related to:
- Missing or incorrect environment variables
- Oracle connection problems
- Wrong build configuration (localhost vs production)
- Backend not running or crashing

