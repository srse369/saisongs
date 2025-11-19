# Song Studio Deployment Status

## Server Information
- **IP Address**: 129.153.85.24
- **OS**: Ubuntu 22.04.5 LTS
- **Username**: ubuntu
- **SSH Key**: `~/Downloads/SSH Key Nov 12 2025.key`

## Current Status: ⚠️ Partially Complete

### ✅ Completed Steps

1. **Server Setup** - All software installed:
   - Node.js v20.19.5 ✅
   - PM2 (process manager) ✅
   - Nginx (web server) ✅
   - Oracle Instant Client 21.13 ✅
   - Application directories created ✅

2. **Deployment Configuration**:
   - Deployment scripts configured for Ubuntu ✅
   - PM2 ecosystem config (.cjs) ✅
   - Nginx reverse proxy configured ✅
   - Firewall rules set (Oracle Cloud security list) ✅

3. **Application Deployed**:
   - Frontend built and deployed ✅
   - Backend built and deployed ✅
   - PM2 managing the application ✅

###  ⚠️ Known Issues

1. **Application Startup Errors**:
   - ES module `__dirname` reference issue in DatabaseService
   - Application crashes on startup when trying to initialize Oracle client
   - Health check endpoint not accessible

2. **Database Configuration**:
   - Environment variables need to be configured
   - Oracle wallet needs to be copied to server

## Next Steps to Complete Deployment

### Step 1: Fix ES Module Issues

The server code needs adjustment for ES modules. You have two options:

**Option A: Use dynamic import for __dirname** (Recommended)

Edit `/var/www/songstudio/.env` on the server to set:
```bash
LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13:$LD_LIBRARY_PATH
```

**Option B: Simplify by removing Oracle wallet dependency**

For now, configure the app to work without wallet (if your Oracle DB allows it).

### Step 2: Configure Database Credentials

SSH into the server:
```bash
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" ubuntu@129.153.85.24
```

Edit the environment file:
```bash
nano /var/www/songstudio/.env
```

Update these values:
```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Your Oracle Database Credentials
VITE_ORACLE_USER=your_username
VITE_ORACLE_PASSWORD=your_password
VITE_ORACLE_CONNECT_STRING=your_connection_string
VITE_ORACLE_WALLET_PASSWORD=your_wallet_password

# Admin password for the app
ADMIN_PASSWORD=your_admin_password

# Database pool settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_INCREMENT=1

# URLs
APP_URL=http://129.153.85.24
API_URL=http://129.153.85.24/api
CORS_ORIGIN=http://129.153.85.24

# Logging
LOG_LEVEL=info

# Oracle Client
LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13
```

Save and exit (Ctrl+X, then Y, then Enter).

### Step 3: Copy Oracle Wallet to Server

From your local machine:
```bash
cd /Users/ssett2/Documents/github.com/srse369/songstudio
scp -i ~/Downloads/"SSH Key Nov 12 2025.key" -r wallet ubuntu@129.153.85.24:/var/www/songstudio/
```

### Step 4: Restart the Application

On the server:
```bash
pm2 restart songstudio
pm2 logs songstudio
```

Wait a few seconds and check if you see:
```
🚀 Server running on http://localhost:3001
📊 API available at http://localhost:3001/api
```

### Step 5: Test the Application

From your local machine:
```bash
# Test health endpoint
curl http://129.153.85.24/api/health

# Should return:
# {"status":"ok","timestamp":"2025-11-19T..."}
```

If successful, open in browser:
```
http://129.153.85.24
```

## Useful Commands

### On Local Machine
```bash
# Deploy application
./deploy/remote/deploy.sh production

# SSH into server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" ubuntu@129.153.85.24

# Test API
curl http://129.153.85.24/api/health
```

### On Server
```bash
# Check application status
pm2 status

# View logs
pm2 logs songstudio
pm2 logs songstudio --lines 100

# Restart application
pm2 restart songstudio

# Check what's listening on port 3001
sudo lsof -i :3001

# Check Nginx status
sudo systemctl status nginx

# Test backend directly
curl http://localhost:3001/api/health

# Check environment variables
cat /var/www/songstudio/.env

# Check Oracle Instant Client
echo $LD_LIBRARY_PATH
ls -la /opt/oracle/instantclient_21_13/
```

## Troubleshooting

### Application Not Starting
```bash
# Check logs
pm2 logs songstudio --lines 50

# Check if Oracle client is found
ldd /opt/oracle/instantclient_21_13/libclntsh.so

# Restart with environment variable
pm2 delete songstudio
LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13 pm2 start /var/www/songstudio/ecosystem.config.cjs --env production
```

### 502 Bad Gateway
- Check if backend is running: `pm2 status`
- Check if port 3001 is listening: `sudo lsof -i :3001`
- Check Nginx logs: `sudo tail -f /var/log/nginx/songstudio_error.log`

### Cannot Access from Browser
- Check Oracle Cloud security list allows port 80
- Check firewall: Oracle Cloud uses security lists, not UFW
- Test from server: `curl http://localhost/api/health`

## Server Resource Usage

Current server specs:
- **CPU**: 2 cores
- **Memory**: 956 MB (~1 GB)
- **Disk**: 45 GB

Application usage:
- **Memory**: ~50-60 MB per instance
- **Expected total**: < 200 MB with overhead

## Security Notes

1. **SSH Key**: Keep `SSH Key Nov 12 2025.key` secure
2. **Admin Password**: Change default password in `.env`
3. **Database Credentials**: Never commit to git
4. **Firewall**: Managed through Oracle Cloud security lists
5. **Updates**: Run `sudo apt update && sudo apt upgrade` regularly

## Additional Resources

- Deployment Guide: `/Users/ssett2/Documents/github.com/srse369/songstudio/docs/DEPLOYMENT_ORACLE.md`
- PM2 Documentation: https://pm2.keymetrics.io/
- Nginx Configuration: `/etc/nginx/sites-available/songstudio`
- Application Logs: `/var/www/songstudio/logs/`

## Contact & Support

If you need help, check:
1. PM2 logs: `pm2 logs songstudio`
2. Nginx logs: `/var/log/nginx/songstudio_error.log`
3. System logs: `journalctl -xe`

