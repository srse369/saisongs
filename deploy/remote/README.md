# Remote Deployment Scripts

Scripts for deploying and managing Song Studio on remote production servers.

## Quick Reference

```bash
# First-time setup (on server)
./server-setup.sh              # Ubuntu/Debian servers
./server-setup-oracle.sh       # Oracle Linux servers

# Deploy application (from local)
./deploy.sh                    # Full deployment
./deploy.sh --backend-only     # Backend only
./deploy.sh --frontend-only    # Frontend only

# Server management (from local)
./restart-server.sh            # Restart backend
./check-server.sh              # Health check

# SSL setup (on server)
./setup-ssl.sh your-domain.com # Configure HTTPS
```

## Configuration

All deployment scripts source configuration from `config.sh`, which loads values from `.env` files in the project root.

### Configuration Priority (highest to lowest)

1. **Environment variables** - Set before running scripts
2. **`.env.deploy`** - Deployment-specific configuration (recommended)
3. **`.env.production`** - Production environment variables
4. **`.env.local`** - Local development overrides
5. **Default values** - Hardcoded in `config.sh`

### Setup Configuration File

**Option 1: Add to `.env.production` (recommended)**

```bash
# Edit .env.production in project root
nano .env.production

# Add deployment variables:
REMOTE_USER=your-user
REMOTE_HOST=your-server.com
REMOTE_PATH=/path/to/app
SSH_KEY=~/.ssh/your-key.pem
```

**Option 2: Add to `.env.local`**

```bash
# Add deployment variables to .env.local
cat >> .env.local << EOF
REMOTE_USER=your-user
REMOTE_HOST=your-server.com
REMOTE_PATH=/path/to/app
SSH_KEY=~/.ssh/your-key.pem
EOF
```

### Configuration Variables

```bash
# Server details (required)
REMOTE_USER=your-ssh-user             # SSH username
REMOTE_HOST=your-server.com           # Server hostname or domain
REMOTE_PATH=/path/to/app              # Installation path on server

# Optional
REMOTE_IP=your-server-ip              # Server IP address
SSH_KEY=~/.ssh/your-key.pem           # SSH key path (if not using default)
```

### Using Custom Configuration

**Using .env files:**
```bash
# Edit .env.production
nano .env.production

# Run deployment (uses .env.production automatically)
./deploy/remote/deploy.sh
```

**Using environment variables (one-off):**
```bash
# Deploy to custom server
REMOTE_HOST=example.com REMOTE_USER=myuser ./deploy/remote/deploy.sh

# Use specific SSH key
SSH_KEY=~/Downloads/"SSH Key Nov 12 2025.key" ./deploy/remote/deploy.sh
```

**Using multiple environments:**
```bash
# Production (uses .env.deploy or .env.production)
./deploy/remote/deploy.sh

# Staging (override with environment variables)
REMOTE_HOST=staging.example.com ./deploy/remote/deploy.sh
```

## Scripts Reference

### `config.sh`
Central configuration file sourced by other scripts.

**Features:**
- Loads configuration from `.env` files in project root
- Server connection details
- SSH configuration
- Color definitions for output
- Helper functions (`ssh_exec`, `scp_copy`)

**Configuration Loading:**
```bash
# Automatically sources (in order):
#   1. .env.local
#   2. .env.production  
#   3. .env.deploy
# Each file overrides the previous one

# Only these variables are loaded:
#   REMOTE_USER, REMOTE_HOST, REMOTE_IP, REMOTE_PATH, SSH_KEY
```

**Usage in scripts:**
```bash
# Source the config
source "$(dirname "$0")/config.sh"

# Use helper functions
ssh_exec "pm2 list"
scp_copy myfile.txt "${REMOTE_PATH}/"

# Access variables
echo "Deploying to: ${REMOTE_USER}@${REMOTE_HOST}"
```

---

### `deploy.sh`
Main deployment script - handles full application deployment.

**Features:**
- Builds frontend and backend locally
- Uploads to production server
- Restarts PM2 process
- Verifies deployment
- Shows logs and status

**Usage:**
```bash
# Full deployment
./deploy.sh

# Backend only
./deploy.sh --backend-only

# Frontend only
./deploy.sh --frontend-only

# With custom SSH key
SSH_KEY=~/.ssh/my-key.pem ./deploy.sh
```

**What it does:**
1. Checks for `.env.production` (creates if missing)
2. Builds frontend with `npm run build:vps`
3. Builds backend with `npm run build:server`
4. Uploads files via SCP
5. Restarts PM2 process
6. Waits for initialization
7. Tests API health and frontend
8. Shows server status and logs

**Options:**
- `--backend-only` / `--skip-frontend` - Deploy backend only
- `--frontend-only` / `--skip-backend` - Deploy frontend only

---

### `server-setup.sh`
Initial server setup for **Ubuntu/Debian** servers.

**Features:**
- Installs Node.js 20
- Installs PM2
- Installs Nginx
- Installs Oracle Instant Client
- Creates application directories
- Configures firewall (UFW)
- Creates `.env` template

**Usage:**
```bash
# Copy to server
scp server-setup.sh user@your-server.com:/tmp/

# SSH and run
ssh user@your-server.com
bash /tmp/server-setup.sh
```

**Prerequisites:**
- Ubuntu 20.04+ or Debian 10+
- User with sudo privileges
- Not run as root

**After running:**
1. Configure Nginx (see output for instructions)
2. Edit `/var/www/songstudio/.env` with credentials
3. Deploy application with `./deploy.sh`

---

### `server-setup-oracle.sh`
Initial server setup for **Oracle Linux** servers.

**Differences from Ubuntu version:**
- Uses `dnf` instead of `apt`
- Configures `firewalld` instead of `ufw`
- Configures SELinux policies
- Installs Oracle Instant Client from official repo
- Nginx config goes in `/etc/nginx/conf.d/`

**Usage:**
```bash
# Copy to server
scp server-setup-oracle.sh opc@141.148.149.54:/tmp/

# SSH and run
ssh opc@141.148.149.54
bash /tmp/server-setup-oracle.sh
```

**Prerequisites:**
- Oracle Linux 8+ or RHEL 8+
- User with sudo privileges
- Not run as root

---

### `restart-server.sh`
Quick restart of the backend server.

**Features:**
- Restarts or starts PM2 process
- Tests API health
- Shows quick status

**Usage:**
```bash
# From local machine
./restart-server.sh

# With custom SSH key
SSH_KEY=~/.ssh/my-key.pem ./restart-server.sh

# Direct SSH
ssh user@your-server.com 'bash -s' < restart-server.sh
```

**When to use:**
- After making backend code changes
- To clear Oracle connection pool errors
- After server reboot
- When backend is unresponsive

---

### `check-server.sh`
Comprehensive health check script.

**Checks:**
- PM2 installation and status
- Backend process status
- API health endpoint
- Nginx status
- Environment configuration
- Recent logs

**Usage:**
```bash
# From local machine
./check-server.sh

# With custom SSH key
SSH_KEY=~/.ssh/my-key.pem ./check-server.sh

# Direct SSH
ssh user@your-server.com 'bash -s' < check-server.sh
```

**Output includes:**
- PM2 process list
- Backend API response
- Nginx status
- Last 20 lines of logs
- Environment variables (sanitized)

**Auto-fixes:**
- Installs PM2 if missing
- Starts process if stopped
- Starts Nginx if not running

---

### `setup-ssl.sh`
Configure HTTPS with Let's Encrypt SSL certificate.

**Features:**
- Installs Certbot
- Obtains SSL certificate
- Updates Nginx configuration
- Configures auto-renewal
- Sets up HTTPS redirect

**Usage:**
```bash
# Copy to server
scp setup-ssl.sh user@your-server.com:/tmp/

# SSH and run
ssh user@your-server.com
bash /tmp/setup-ssl.sh your-domain.com

# With custom email
bash /tmp/setup-ssl.sh your-domain.com admin@example.com
```

**Prerequisites:**
- Domain name pointing to server
- Port 80 accessible
- Ubuntu/Debian server (uses `apt-get`)

**What it does:**
1. Installs Certbot
2. Stops Nginx temporarily
3. Obtains SSL certificate from Let's Encrypt
4. Updates Nginx config with HTTPS
5. Enables HTTP → HTTPS redirect
6. Configures auto-renewal

**Certificate renewal:**
```bash
# Test renewal
sudo certbot renew --dry-run

# Check status
sudo certbot certificates
```

---

### `ecosystem.config.cjs`
PM2 process manager configuration.

**Features:**
- Single instance (optimized for Oracle Free Tier)
- Cluster mode
- Auto-restart on crashes
- Memory limit: 512MB
- Environment-specific configs
- Logging configuration

**Key settings:**
```javascript
{
  instances: 1,                // Single instance (Free Tier optimization)
  max_memory_restart: '512M',  // Restart if memory exceeds 512MB
  env_production: {
    LD_LIBRARY_PATH: '/opt/oracle/instantclient_21_13:/usr/lib'
  }
}
```

**Usage:**
```bash
# Start with production config
pm2 start ecosystem.config.cjs --env production

# Reload (zero-downtime restart)
pm2 reload ecosystem.config.cjs --env production

# Stop
pm2 stop songstudio

# Delete process
pm2 delete songstudio
```

---

### `nginx.conf`
Nginx web server configuration.

**Features:**
- Serves React frontend
- Proxies API requests to backend
- Gzip compression
- Asset caching
- Security headers
- SPA routing support

**Key locations:**
- `/` - React app (SPA routing)
- `/api/` - Proxied to backend (port 3001)
- `/assets/` - Static assets (1 year cache)

**Installation:**
```bash
# Ubuntu/Debian
sudo cp nginx.conf /etc/nginx/sites-available/songstudio
sudo ln -s /etc/nginx/sites-available/songstudio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Oracle Linux/RHEL
sudo cp nginx.conf /etc/nginx/conf.d/songstudio.conf
sudo nginx -t
sudo systemctl reload nginx
```

**HTTPS configuration:**
Uncomment the HTTPS server block and add SSL certificate paths.

---

## Deployment Workflow

### Initial Setup (One-time)

**1. Prepare server:**
```bash
# Copy setup script to server
scp server-setup.sh ubuntu@saisongs.org:/tmp/

# SSH into server
ssh ubuntu@saisongs.org

# Run setup
bash /tmp/server-setup.sh

# Configure Nginx
sudo cp /tmp/nginx.conf /etc/nginx/sites-available/songstudio
sudo ln -s /etc/nginx/sites-available/songstudio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Edit environment variables
nano /var/www/songstudio/.env
# Update Oracle credentials, admin password, etc.
```

**2. Copy Oracle wallet:**
```bash
# From local machine
scp -r wallet user@your-server.com:/path/to/app/
```

**3. Deploy application:**
```bash
# From local machine
./deploy.sh
```

**4. (Optional) Setup SSL:**
```bash
# On server
./setup-ssl.sh your-domain.com
```

---

### Regular Deployments

**Full deployment:**
```bash
./deploy.sh
```

**Backend only:**
```bash
./deploy.sh --backend-only
```

**Frontend only:**
```bash
./deploy.sh --frontend-only
```

---

### Maintenance

**Check server health:**
```bash
./check-server.sh
```

**Restart backend:**
```bash
./restart-server.sh
```

**View logs:**
```bash
ssh user@your-server.com 'pm2 logs songstudio --lines 50'
```

**Check PM2 status:**
```bash
ssh user@your-server.com 'pm2 status'
```

---

## Troubleshooting

### Deployment Fails

**Check SSH connection:**
```bash
ssh user@your-server.com 'echo "Connected"'
```

**Check disk space:**
```bash
ssh user@your-server.com 'df -h'
```

**Check permissions:**
```bash
ssh user@your-server.com 'ls -la /path/to/app'
```

### Backend Won't Start

**Check logs:**
```bash
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 100'
```

**Check environment:**
```bash
ssh user@your-server.com 'cat /path/to/app/.env | grep -v PASSWORD'
```

**Check Oracle Instant Client:**
```bash
ssh user@your-server.com 'echo $LD_LIBRARY_PATH'
ssh user@your-server.com 'ls -la /opt/oracle/instantclient_21_13/'
```

**Restart services:**
```bash
./restart-server.sh
```

### SSL Certificate Issues

**Check certificate:**
```bash
ssh user@your-server.com 'sudo certbot certificates'
```

**Test renewal:**
```bash
ssh user@your-server.com 'sudo certbot renew --dry-run'
```

**Force renewal:**
```bash
ssh user@your-server.com 'sudo certbot renew --force-renewal'
```

---

## Security Best Practices

1. **SSH Keys**: Always use SSH keys, never passwords
   ```bash
   SSH_KEY=~/.ssh/my-key.pem ./deploy.sh
   ```

2. **Environment Variables**: Never commit `.env` files
   - Keep credentials in `/var/www/songstudio/.env` on server
   - Use 600 permissions: `chmod 600 .env`

3. **Firewall**: Keep firewall enabled
   ```bash
   # Ubuntu
   sudo ufw status
   
   # Oracle Linux
   sudo firewall-cmd --list-all
   ```

4. **Updates**: Keep system updated
   ```bash
   # Ubuntu
   sudo apt update && sudo apt upgrade
   
   # Oracle Linux
   sudo dnf update
   ```

5. **HTTPS**: Always use SSL/TLS in production
   ```bash
   ./setup-ssl.sh your-domain.com
   ```

6. **Admin Password**: Change default admin password in `.env`

---

## Advanced Usage

### Custom Server Configuration

Create a local config file:

```bash
# my-server-config.sh
export REMOTE_USER=myuser
export REMOTE_HOST=example.com
export REMOTE_IP=1.2.3.4
export REMOTE_PATH=/opt/myapp
export SSH_KEY=~/.ssh/my-key.pem
```

Use it:

```bash
source my-server-config.sh
./deploy.sh
```

### Multiple Environments

```bash
# Staging
REMOTE_HOST=staging.example.com ./deploy.sh

# Production
REMOTE_HOST=your-server.com ./deploy.sh
```

### Automated Deployment

Add to CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Deploy to Production
  run: |
    echo "${{ secrets.SSH_KEY }}" > /tmp/key
    chmod 600 /tmp/key
    SSH_KEY=/tmp/key ./deploy/remote/deploy.sh
  env:
    REMOTE_HOST: your-server.com
    REMOTE_USER: ubuntu
```

---

## Files Reference

| File | Purpose | Run On |
|------|---------|--------|
| `config.sh` | Central configuration | Local/Server |
| `.env.deploy.example` | Configuration template | Documentation |
| `deploy.sh` | Main deployment script | Local |
| `server-setup.sh` | Ubuntu/Debian setup | Server |
| `server-setup-oracle.sh` | Oracle Linux setup | Server |
| `restart-server.sh` | Quick restart | Local |
| `check-server.sh` | Health check | Local |
| `setup-ssl.sh` | SSL configuration | Server |
| `ecosystem.config.cjs` | PM2 configuration | Server |
| `nginx.conf` | Web server config | Server |

---

## Related Documentation

- [Main Deployment Guide](../../docs/DEPLOYMENT.md)
- [Troubleshooting](../../docs/TROUBLESHOOTING.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Local Development](../local/README.md)

---

## Support

For issues or questions:
1. Check logs: `./check-server.sh`
2. Review troubleshooting guide: [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md)
3. Check server status: `ssh user@your-server.com 'pm2 status'`

