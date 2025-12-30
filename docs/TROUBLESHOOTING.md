# Troubleshooting Guide

Solutions to common issues with Sai Songs deployment and operation.

## Table of Contents
- [Mobile "Load Failed" Errors](#mobile-load-failed-errors)
- [Backend Not Running](#backend-not-running)
- [Oracle Database Issues](#oracle-database-issues)
- [Oracle Session Leaks](#oracle-session-leaks)
- [Deployment Issues](#deployment-issues)
- [Performance Issues](#performance-issues)
- [AI Search (WebLLM) Issues](#ai-search-webllm-issues)
- [Emergency Procedures](#emergency-procedures)

---

## Mobile "Load Failed" Errors

### Problem

Mobile device shows errors like:
- "Failed to fetch songs"
- "Failed to fetch singers"
- "Failed to fetch pitches"
- "Load failed"

### Root Cause

The frontend is trying to connect to `localhost:3111` instead of the production server. On mobile devices, "localhost" refers to the mobile device itself, not your server.

### Solution

**1. Create `.env.production`:**

```bash
cd /Users/ssett2/Documents/github.com/srse369/saisongs
echo "VITE_API_URL=/api" > .env.production
```

**2. Rebuild with correct configuration:**

```bash
rm -rf dist/
npm run build:vps
npm run build:server
```

**3. Deploy to server:**

```bash
./deploy/remote/deploy.sh code
```

### Verify the Fix

```bash
# Check built files don't reference localhost
grep -r "localhost:3111" dist/
# Should return: (nothing)

# Test API directly
curl https://YOUR_DOMAIN/api/health
```

---

## Backend Not Running

### Check Status

```bash
ssh ubuntu@YOUR_DOMAIN
pm2 list
pm2 logs saisongs --lines 50
```

### Common Causes

#### 1. Missing Environment Variables

```bash
ls -la /var/www/saisongs/.env
cat /var/www/saisongs/.env
```

**Required variables:**
```bash
NODE_ENV=production
PORT=3111
ORACLE_USER=your_user
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_connection_string
ORACLE_WALLET_PASSWORD=your_wallet_password
ADMIN_PASSWORD=your_admin_password
LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13
```

#### 2. Oracle Connection Issues

**Error:** `NJS-046: pool alias already exists`

**Solution:**
```bash
pm2 restart saisongs
```

**Error:** `ORA-12154: TNS:could not resolve the connect identifier`

**Check wallet files:**
```bash
ls -la /var/www/saisongs/wallet/
# Should see: cwallet.sso, tnsnames.ora, sqlnet.ora
```

**Check Oracle Instant Client:**
```bash
echo $LD_LIBRARY_PATH
ls -la /opt/oracle/instantclient_21_13/
```

#### 3. Port Already in Use

```bash
sudo lsof -i :3111
sudo kill -9 <PID>
pm2 restart saisongs
```

#### 4. Missing Dependencies

```bash
cd /var/www/saisongs
npm install
pm2 restart saisongs
```

### Restart Backend

**Simple restart:**
```bash
pm2 restart saisongs
```

**Full restart with environment:**
```bash
pm2 delete saisongs
cd /var/www/saisongs
pm2 start ecosystem.config.cjs --env production
pm2 save
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

```bash
ssh ubuntu@YOUR_DOMAIN 'pm2 restart saisongs'
```

#### Long-term Solutions

1. **Reduce connection pool size** (already implemented: poolMax=1)
2. **Verify pool configuration:**
```bash
cat /var/www/saisongs/dist/server/services/DatabaseService.js | grep -A 5 "poolMax"
```

3. **Monitor usage in Oracle Cloud Console:**
   - Performance Hub → Active Sessions
   - Check for spikes in recursive SQL

### Connection Timeout

**Error:** `ORA-12170: TNS:Connect timeout occurred`

**Solutions:**

1. Check wallet files:
```bash
ls -la /var/www/saisongs/wallet/
chmod 600 /var/www/saisongs/wallet/*
```

2. Verify connection string in `.env`

3. Test connection:
```bash
node -e "const oracledb = require('oracledb'); console.log('OracleDB version:', oracledb.versionString);"
```

### Pool Already Exists Error

**Error:** `NJS-046: pool alias "saisongs_pool" already exists`

**Solution:**
```bash
pm2 restart saisongs
```

---

## Oracle Session Leaks

### 🚨 Critical: Maximum Sessions Exceeded

**Symptoms:**
- Oracle error: `ORA-00018: maximum number of sessions exceeded`
- OCI Monitor shows thousands of active connections
- Application unable to connect to database

### Emergency Fix: Kill All Hung Sessions

**Via Oracle Cloud Console SQL:**

1. Go to Oracle Cloud Console
2. Navigate to: Autonomous Database → Tools → SQL
3. Check session count:

```sql
SELECT COUNT(*) as total_sessions FROM v$session;
```

4. Generate kill commands:

```sql
SELECT 
    'ALTER SYSTEM KILL SESSION ''' || sid || ',' || serial# || ''' IMMEDIATE;' as kill_command
FROM v$session 
WHERE username = 'YOUR_DB_USER';
```

5. Execute each generated command

### Session Leak Prevention

**Changes implemented:**

1. **Reduced max pool size to 1:**
```typescript
poolMax: 1,  // EMERGENCY: Reduced until leak is confirmed fixed
```

2. **Added connection tracking:**
```typescript
private activeConnections: Set<oracledb.Connection> = new Set();
```

3. **Query timeout protection (30 seconds):**
```typescript
const queryTimeout = setTimeout(() => {
  if (connection) {
    connection.close().catch(err => console.error('Error force-closing:', err));
  }
}, 30000);
```

4. **Aggressive cleanup every 2 minutes**

### Monitoring Session Health

```bash
ssh ubuntu@YOUR_DOMAIN 'pm2 logs saisongs | grep -i "pool health"'

# Look for:
# 🔍 Pool health: 1 open, 0 in use, 1 available, 0 tracked
```

**Warning signs:**
```
⚠️  Pool health: 2-3 open, 1 in use, 1 available, 0 tracked
🚨 WARNING: 3 connections open - potential leak!
```

### Oracle Session Monitor Query

Run periodically to watch for session creep:

```sql
SELECT 
    TO_CHAR(SYSDATE, 'HH24:MI:SS') as check_time,
    COUNT(*) as session_count,
    MAX(last_call_et) as max_idle_seconds
FROM v$session 
WHERE username = 'YOUR_DB_USER';
```

If `session_count` keeps growing → Session leak still present.

---

## Deployment Issues

### SCP/SSH Connection Fails

**Check SSH key permissions:**
```bash
chmod 600 /path/to/your/ssh-key.key
```

**Test connection:**
```bash
ssh -v -i /path/to/your/ssh-key.key ubuntu@YOUR_DOMAIN "echo 'Connected'"
```

### Nginx 502 Bad Gateway

**Causes:**

1. **Backend not running:**
```bash
pm2 status
pm2 restart saisongs
```

2. **Backend not listening:**
```bash
curl http://localhost:3111/api/health
```

3. **Check nginx logs:**
```bash
sudo tail -f /var/log/nginx/saisongs_error.log
```

4. **SELinux blocking (Oracle Linux):**
```bash
sudo setsebool -P httpd_can_network_connect 1
```

### Assets Not Loading (404)

**Check built files:**
```bash
grep -o 'src="[^"]*"' dist/index.html
# For VPS: src="/assets/index-*.js"
# NOT: src="/saisongs/assets/..."
```

**Fix:**
```bash
npm run build:vps
./deploy/remote/deploy.sh code
```

---

## Performance Issues

### Slow Loading

**Check server-side caching:**
```bash
ssh ubuntu@YOUR_DOMAIN 'pm2 logs saisongs | grep -i cache'

# Should see:
# ✅ Cache hit for key: songs:all (age: 45s)
```

**Check frontend cache:**
```javascript
// Browser console
Object.keys(localStorage).filter(k => k.startsWith('saisongs_'))
```

### High Memory Usage

```bash
pm2 list  # Check memory column

# If > 512MB:
pm2 restart saisongs
```

### Slow Database Queries

**Check Oracle Cloud Console:**
- Performance Hub → SQL Monitoring

**Add indexes:**
```sql
CREATE INDEX idx_songs_name ON songs(name);
CREATE INDEX idx_singers_name ON singers(name);
CREATE INDEX idx_pitches_song_id ON pitches(song_id);
CREATE INDEX idx_pitches_singer_id ON pitches(singer_id);
```

---

## AI Search (WebLLM) Issues

### "WebGPU not available"

**Solutions:**
1. Update browser to Chrome/Edge 113+ or Safari 17+
2. Enable hardware acceleration:
   - Chrome: `chrome://settings/system` → "Use hardware acceleration"
3. Check WebGPU: https://webgpureport.org/

### "Network error loading model"

**Solutions:**
- Check internet connection
- Disable VPN/proxy temporarily
- Try again in a few minutes

### "Insufficient memory"

**Solutions:**
- Close other browser tabs
- Close other applications
- Restart browser
- Try on device with more RAM (need 4GB+)

### Model Loads But Doesn't Respond

**Solutions:**
1. Wait 5-10 seconds (first query is slower)
2. Check browser console (F12) for errors
3. Try disabling and re-enabling AI search
4. Restart browser

### Clear Browser Cache

```
Chrome: chrome://settings/clearBrowserData
Select "Cached images and files"
```

### Fall Back to Regular Search

- Regular search always works
- Advanced filters available (click filter icon)
- Just as powerful, just not natural language

---

## Emergency Procedures

### Complete System Restart

```bash
ssh ubuntu@YOUR_DOMAIN

# Stop everything
pm2 stop saisongs
sudo systemctl stop nginx

# Wait 10 seconds
sleep 10

# Start everything
sudo systemctl start nginx
pm2 restart saisongs

# Check status
pm2 status
sudo systemctl status nginx
curl http://localhost:3111/api/health
```

### Reset to Last Known Good State

```bash
ssh ubuntu@YOUR_DOMAIN

# List backups
ls -la /var/www/saisongs.backup.*

# Restore from backup
sudo cp -r /var/www/saisongs.backup.YYYYMMDD_HHMMSS/* /var/www/saisongs/

# Restart
pm2 restart saisongs
```

### Clear All Caches

**Server-side:**
```bash
ssh ubuntu@YOUR_DOMAIN 'pm2 restart saisongs'
```

**Frontend:**
```javascript
// Browser console (F12)
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## Health Check Commands

### Quick Health Check

```bash
# API health
curl https://YOUR_DOMAIN/api/health

# Backend status
ssh ubuntu@YOUR_DOMAIN 'pm2 status'

# Backend logs
ssh ubuntu@YOUR_DOMAIN 'pm2 logs saisongs --lines 20'

# Nginx status
ssh ubuntu@YOUR_DOMAIN 'sudo systemctl status nginx'
```

### Full System Check

```bash
ssh ubuntu@YOUR_DOMAIN

pm2 status
curl http://localhost:3111/api/health
curl http://localhost:3111/api/songs | jq '.[0]'
sudo systemctl status nginx
df -h
free -h
```

---

## Getting Help

### Collect Information

When reporting issues, include:

**1. Error messages:**
```bash
pm2 logs saisongs --lines 100 > logs.txt
```

**2. System status:**
```bash
pm2 status > status.txt
```

**3. Browser console errors:**
- Press F12
- Copy errors from Console tab
- Copy failed requests from Network tab

### Common Commands Reference

```bash
# SSH into server
ssh ubuntu@YOUR_DOMAIN

# Check backend
pm2 status
pm2 logs saisongs --lines 50
pm2 restart saisongs

# Check nginx
sudo systemctl status nginx
sudo nginx -t
sudo systemctl reload nginx

# Check database
curl http://localhost:3111/api/health

# Deploy updates
./deploy/remote/deploy.sh code

# View logs
pm2 logs saisongs
sudo tail -f /var/log/nginx/saisongs_error.log
```

---

## Still Having Issues?

Most issues are related to:
- Missing or incorrect environment variables
- Oracle connection problems
- Wrong build configuration (localhost vs production)
- Backend not running or crashing

If problems persist:
1. Check all logs carefully for error messages
2. Verify all environment variables are set correctly
3. Ensure Oracle database is accessible
4. Try a complete system restart
5. Consider restoring from a backup

---

## Support

- Deployment: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Features: [FEATURES.md](./FEATURES.md)
