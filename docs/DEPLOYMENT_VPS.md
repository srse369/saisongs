# VPS Deployment Guide

Deploy Song Studio to a remote VPS server (e.g., 141.148.149.54).

## Quick Start

### First-Time Setup

**On the server (one-time):**
```bash
ssh ubuntu@141.148.149.54

# Run setup script (installs Node.js, PM2, Nginx, Oracle Client)
bash deploy/remote/server-setup.sh

# Configure Nginx
sudo nano /etc/nginx/sites-available/songstudio
# Paste contents from deploy/remote/nginx.conf
sudo ln -s /etc/nginx/sites-available/songstudio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Setup environment variables
nano /var/www/songstudio/.env
# Use deploy/remote/.env.production.template as reference
```

**From local machine:**
```bash
chmod +x deploy/remote/deploy.sh
./deploy/remote/deploy.sh production
```

### Regular Deployments

```bash
./deploy/remote/deploy.sh production
# or
npm run deploy:vps
```

## Server Requirements

- Ubuntu 20.04/22.04 or similar
- Root/sudo access
- Node.js 20+ (installed by setup script)
- Oracle Instant Client (installed by setup script)

## Configuration Files

| File | Purpose |
|------|---------|
| `deploy/remote/deploy.sh` | Automated deployment script |
| `deploy/remote/server-setup.sh` | Server initialization (one-time) |
| `deploy/remote/ecosystem.config.js` | PM2 process manager config |
| `deploy/remote/nginx.conf` | Nginx reverse proxy config |
| `deploy/remote/.env.production.template` | Environment variables template |

## Deployment Process

The `deploy.sh` script automatically:
1. Builds frontend and backend
2. Creates deployment package
3. Transfers to server via SCP
4. Installs dependencies
5. Restarts application with PM2
6. Runs health check

## Server Architecture

```
Client → Nginx (Port 80) → Express Backend (Port 3001) → Oracle DB
                ↓
            Static Files (React)
```

## Common Commands

### Local
```bash
npm run build:vps              # Build for VPS
./deploy/remote/deploy.sh production  # Deploy
```

### On Server
```bash
pm2 status                     # Check app status
pm2 logs songstudio            # View logs
pm2 restart songstudio         # Restart app
sudo systemctl reload nginx    # Reload Nginx
curl localhost:3001/api/health # Test backend
```

## Customization

### Change Server IP

Edit these files:
- `deploy/remote/deploy.sh`: Update `REMOTE_HOST` variable
- `deploy/remote/ecosystem.config.js`: Update `deploy.production.host`
- `deploy/remote/nginx.conf`: Update `server_name`

### Change Port

1. `server/index.ts`: Update `PORT`
2. `deploy/remote/ecosystem.config.js`: Update `env_production.PORT`
3. `deploy/remote/nginx.conf`: Update upstream server port

### Enable HTTPS

```bash
# On server
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
# Uncomment HTTPS block in nginx.conf
```

## Troubleshooting

### Deployment fails
```bash
# Check SSH access
ssh ubuntu@141.148.149.54 "echo 'Connected'"

# Setup SSH key if needed
ssh-copy-id ubuntu@141.148.149.54
```

### App won't start
```bash
ssh ubuntu@141.148.149.54
pm2 logs songstudio --lines 100
# Check for missing env vars or DB connection issues
```

### 502 Bad Gateway
```bash
ssh ubuntu@141.148.149.54
pm2 status                             # Check if running
curl localhost:3001/api/health         # Test backend
sudo tail -f /var/log/nginx/error.log  # Check Nginx logs
```

### Database connection errors
```bash
# Verify Oracle Instant Client
echo $LD_LIBRARY_PATH
ls -la /opt/oracle/instantclient_21_11/

# Check .env file
cat /var/www/songstudio/.env
```

## Monitoring

```bash
# View logs
ssh ubuntu@141.148.149.54 "pm2 logs songstudio"

# Monitor resources
ssh ubuntu@141.148.149.54 "pm2 monit"

# Health check
curl http://141.148.149.54/api/health
```

## Rollback

Automatic backups are created on each deployment:
```bash
ssh ubuntu@141.148.149.54
ls -la /var/www/songstudio.backup.*
sudo cp -r /var/www/songstudio.backup.YYYYMMDD_HHMMSS/* /var/www/songstudio/
pm2 restart songstudio
```

## Security

- Change admin password in `.env`
- Setup SSH key authentication (disable password login)
- Enable HTTPS in production
- Keep system packages updated: `sudo apt update && sudo apt upgrade`
- Setup firewall (handled by `server-setup.sh`)
