# Troubleshooting Mobile Access Issues

## Problem: Mobile Device Shows "Failed to Fetch Songs/Singers/Pitches"

When accessing the production server from a mobile device, if you see errors like:
- "Failed to fetch songs"
- "Failed to fetch singers"  
- "Failed to fetch pitches"
- "Load failed"

This usually means the backend API server is not running on your production server.

## Quick Fix

### Option 1: Restart the Backend (Recommended)

Run this command from your local machine:

```bash
ssh ubuntu@129.153.85.24 'bash -s' < deploy/remote/restart-server.sh
```

### Option 2: Full Health Check

Run a comprehensive health check:

```bash
ssh ubuntu@129.153.85.24 'bash -s' < deploy/remote/check-server.sh
```

### Option 3: Manual SSH

SSH into your server and check manually:

```bash
# SSH into server
ssh ubuntu@129.153.85.24

# Check PM2 processes
pm2 list

# Check if backend is running
curl http://localhost:3001/api/health

# View logs
pm2 logs songstudio --lines 50

# Restart if needed
cd /var/www/songstudio
pm2 restart songstudio --env production
```

## Common Issues

### 1. PM2 Process Not Running

**Symptom:** `pm2 list` shows no processes or songstudio is "stopped"

**Fix:**
```bash
cd /var/www/songstudio
pm2 start ecosystem.config.js --env production
pm2 save
```

### 2. Backend Crashes on Start

**Symptom:** Process starts but immediately stops

**Check logs:**
```bash
pm2 logs songstudio --lines 50
```

**Common causes:**
- Missing `.env` file with Oracle credentials
- Incorrect Oracle connection string
- Wallet files not found
- Port 3001 already in use

### 3. Nginx Not Proxying to Backend

**Symptom:** API calls get 502 or 504 errors

**Fix:**
```bash
# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Check nginx logs
sudo tail -f /var/log/nginx/songstudio_error.log
```

### 4. Missing Environment Variables

**Create/check `.env` file on server:**
```bash
ssh ubuntu@129.153.85.24

# Check if .env exists
ls -la /var/www/songstudio/.env

# Edit if needed
nano /var/www/songstudio/.env
```

Required variables:
```bash
NODE_ENV=production
PORT=3001
VITE_ORACLE_USER=your_user
VITE_ORACLE_PASSWORD=your_password
VITE_ORACLE_CONNECT_STRING=your_connection_string
VITE_ORACLE_WALLET_PASSWORD=your_wallet_password
```

## Verify It's Working

After applying fixes, test from your mobile device:

1. Open browser on mobile
2. Navigate to: `http://129.153.85.24`
3. You should see the Song Studio homepage
4. Check the database connection indicator (should be green)
5. Try navigating to Songs, Singers, or Pitches pages

Or test the API directly:
```bash
curl http://129.153.85.24/api/health
curl http://129.153.85.24/api/songs
```

## Monitoring

### Check Server Status
```bash
pm2 status
pm2 monit  # Live monitoring
```

### View Logs
```bash
# Real-time logs
pm2 logs songstudio

# Last 100 lines
pm2 logs songstudio --lines 100

# Error logs only
pm2 logs songstudio --err
```

### Keep PM2 Running on Reboot
```bash
# Save current PM2 processes
pm2 save

# Setup startup script
pm2 startup
# Follow the instructions it provides
```

## Still Not Working?

1. **Check firewall:** Ensure port 80 is open
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   ```

2. **Verify nginx is running:**
   ```bash
   sudo systemctl status nginx
   ```

3. **Check Oracle database connection:**
   ```bash
   cd /var/www/songstudio
   node -e "import('./dist/server/index.js')"
   # Watch for Oracle connection messages
   ```

4. **Redeploy from scratch:**
   ```bash
   cd /var/www/songstudio
   git pull
   npm install
   npm run build
   npm run build:server
   pm2 restart songstudio --env production
   ```

## Contact

If issues persist, check the logs and error messages carefully. The most common issue is the backend not running due to missing environment variables or Oracle connection problems.

