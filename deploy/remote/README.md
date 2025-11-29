# Remote Deployment Scripts

Scripts for deploying and managing Song Studio on remote production servers.

## Quick Reference

```bash
# From local machine - deploy and manage
./deploy/remote/deploy.sh code                # Deploy application code
./deploy/remote/deploy.sh code --backend-only
./deploy/remote/deploy.sh env                 # Upload merged .env files
./deploy/remote/deploy.sh wallet              # Upload Oracle wallet
./deploy/remote/deploy.sh check               # Health check
./deploy/remote/deploy.sh restart             # Restart backend
./deploy/remote/deploy.sh logs                # View logs
./deploy/remote/deploy.sh status              # PM2 status

# On remote server - initial setup
./setup.sh ubuntu                             # Ubuntu/Debian servers
./setup.sh oracle                             # Oracle Linux servers
./setup.sh ssl your-domain.com                # Configure HTTPS
```

## Scripts

| Script | Purpose | Run From |
|--------|---------|----------|
| `deploy.sh` | Deploy code, env, wallet, check, restart, logs | Local machine |
| `setup.sh` | Initial server setup | Remote server |
| `ecosystem.config.cjs` | PM2 configuration | (config file) |
| `nginx.conf` | Nginx configuration | (config file) |

---

## `deploy.sh` - Local Operations

Unified CLI for all remote operations run from your local machine.

### Usage

```bash
./deploy/remote/deploy.sh <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `code [opts]` | Deploy application code to remote server |
| `env` | Upload merged .env.local + .env.production to remote |
| `wallet` | Upload Oracle wallet to remote server |
| `check` | Run health check on remote server |
| `restart` | Restart backend on remote server |
| `logs [n]` | View remote logs (default: 50 lines) |
| `status` | Show PM2 status and system info |

### Code Deploy Options

| Option | Description |
|--------|-------------|
| `--backend-only` | Deploy backend only |
| `--frontend-only` | Deploy frontend only |

### Examples

```bash
# Full code deployment
./deploy/remote/deploy.sh code

# Backend only
./deploy/remote/deploy.sh code --backend-only

# Frontend only
./deploy/remote/deploy.sh code --frontend-only

# Upload environment files
./deploy/remote/deploy.sh env

# Upload Oracle wallet
./deploy/remote/deploy.sh wallet

# Health check
./deploy/remote/deploy.sh check

# Restart backend
./deploy/remote/deploy.sh restart

# View last 100 lines of logs
./deploy/remote/deploy.sh logs 100

# Check PM2 status
./deploy/remote/deploy.sh status
```

---

## `setup.sh` - Server Setup

Run this ON the remote server for initial setup.

### Usage

```bash
./setup.sh <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `ubuntu` | Initial setup for Ubuntu/Debian servers |
| `oracle` | Initial setup for Oracle Linux servers |
| `ssl <domain>` | Configure SSL with Let's Encrypt |

### Examples

```bash
# Copy to server and run
scp deploy/remote/setup.sh user@server:/tmp/
ssh user@server

# Ubuntu/Debian setup
bash /tmp/setup.sh ubuntu

# Oracle Linux setup
bash /tmp/setup.sh oracle

# SSL setup (after basic setup)
bash /tmp/setup.sh ssl example.com
bash /tmp/setup.sh ssl example.com admin@example.com
```

### What Setup Installs

**Both Ubuntu and Oracle Linux:**
- Node.js 20
- PM2 process manager
- Nginx web server
- Oracle Instant Client
- Application directories (`/var/www/songstudio`)
- Environment template (`.env`)
- Firewall configuration

**Oracle Linux specific:**
- SELinux policies
- firewalld configuration

---

## Configuration

### Environment Files

The deployment uses three environment files with different purposes:

| File | Purpose | Used By | Uploaded? |
|------|---------|---------|-----------|
| `.env.deploy` | SSH/deployment config | Local scripts | ❌ Never |
| `.env.local` | Secrets (passwords, credentials) | Server runtime | ✅ Merged |
| `.env.production` | Runtime config overrides | Server runtime | ✅ Merged |

### `.env.deploy` - Deployment Config (Recommended)

Create this file for SSH and server connection settings:

```bash
# .env.deploy - Deployment configuration (local use only)
REMOTE_USER=ubuntu
REMOTE_HOST=songstudio.example.com
REMOTE_IP=123.45.67.89
REMOTE_PATH=/var/www/songstudio
SSH_KEY=~/.ssh/my-server-key.pem
```

### `.env.local` - Secrets

Contains sensitive credentials (merged and uploaded to server):

```bash
# .env.local - Credentials (uploaded to server)
ORACLE_USER=admin
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_connection_string
ORACLE_WALLET_PASSWORD=your_wallet_password

ADMIN_PASSWORD=your_admin_password
EDITOR_PASSWORD=your_editor_password
VIEWER_PASSWORD=your_viewer_password
```

### `.env.production` - Runtime Overrides

Production-specific settings (merged and uploaded to server):

```bash
# .env.production - Runtime config (uploaded to server)
NODE_ENV=production
VITE_API_URL=/api
```

### Using the Configuration

```bash
# Deploy code using settings from .env.deploy
./deploy/remote/deploy.sh code

# Upload merged .env.local + .env.production to server
./deploy/remote/deploy.sh env

# One-off override (not recommended)
REMOTE_HOST=example.com REMOTE_USER=myuser ./deploy/remote/deploy.sh code
```

---

## Deployment Workflow

### Initial Setup (One-time)

**1. Prepare server:**
```bash
# Copy setup script to server
scp deploy/remote/setup.sh user@your-server:/tmp/

# SSH into server
ssh user@your-server

# Run setup (choose one)
bash /tmp/setup.sh ubuntu    # Ubuntu/Debian
bash /tmp/setup.sh oracle    # Oracle Linux
```

**2. Configure Nginx:**
```bash
# On server - Ubuntu
sudo cp /tmp/nginx.conf /etc/nginx/sites-available/songstudio
sudo ln -s /etc/nginx/sites-available/songstudio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# On server - Oracle Linux
sudo cp /tmp/nginx.conf /etc/nginx/conf.d/songstudio.conf
sudo nginx -t && sudo systemctl reload nginx
```

**3. Create local environment files:**
```bash
# Create .env.deploy for SSH config
cat > .env.deploy << 'EOF'
REMOTE_USER=ubuntu
REMOTE_HOST=your-server.com
REMOTE_PATH=/var/www/songstudio
SSH_KEY=~/.ssh/your-key.pem
EOF

# Create .env.local with your credentials
cat > .env.local << 'EOF'
ORACLE_USER=your_user
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_connection_string
ORACLE_WALLET_PASSWORD=your_wallet_password
ADMIN_PASSWORD=your_admin_password
EOF

# Create .env.production for runtime config
cat > .env.production << 'EOF'
NODE_ENV=production
VITE_API_URL=/api
EOF
```

**4. Upload environment and wallet:**
```bash
# From local machine
./deploy/remote/deploy.sh env      # Upload merged .env
./deploy/remote/deploy.sh wallet   # Upload Oracle wallet
```

**5. Deploy application:**
```bash
# From local machine
./deploy/remote/deploy.sh code
```

**6. (Optional) Setup SSL:**
```bash
# On server
bash /tmp/setup.sh ssl your-domain.com
```

### Regular Deployments

```bash
# Full deployment
./deploy/remote/deploy.sh code

# Backend only (faster)
./deploy/remote/deploy.sh code --backend-only

# Frontend only
./deploy/remote/deploy.sh code --frontend-only
```

### Maintenance

```bash
# Check server health
./deploy/remote/deploy.sh check

# View logs
./deploy/remote/deploy.sh logs 100

# Restart backend
./deploy/remote/deploy.sh restart

# Check status
./deploy/remote/deploy.sh status
```

---

## Config Files

### `ecosystem.config.cjs`
PM2 process manager configuration.

**Key settings:**
- Single instance (optimized for Free Tier)
- 512MB memory limit
- Auto-restart on crashes
- Production environment variables

**Usage:**
```bash
pm2 start ecosystem.config.cjs --env production
pm2 reload ecosystem.config.cjs --env production
pm2 stop songstudio
```

### `nginx.conf`
Nginx web server configuration.

**Features:**
- Serves React frontend (SPA routing)
- Proxies `/api/` to backend (port 3111)
- Gzip compression
- Asset caching (1 year for static files)
- Security headers

**Installation:**
```bash
# Ubuntu/Debian
sudo cp nginx.conf /etc/nginx/sites-available/songstudio
sudo ln -s /etc/nginx/sites-available/songstudio /etc/nginx/sites-enabled/

# Oracle Linux
sudo cp nginx.conf /etc/nginx/conf.d/songstudio.conf
```

---

## Troubleshooting

### Deployment Fails

```bash
# Check SSH connection
ssh user@your-server 'echo "Connected"'

# Check disk space
./deploy/remote/deploy.sh status
```

### Backend Won't Start

```bash
# Check health
./deploy/remote/deploy.sh check

# View logs
./deploy/remote/deploy.sh logs 100

# Restart
./deploy/remote/deploy.sh restart
```

### SSL Certificate Issues

```bash
# On server
sudo certbot certificates
sudo certbot renew --dry-run
sudo certbot renew --force-renewal
```

---

## Security Best Practices

1. **SSH Keys**: Always use SSH keys, never passwords
2. **Environment Files**: Never commit `.env*` files (all are in `.gitignore`)
   - `.env.deploy` - Contains SSH keys/hosts
   - `.env.local` - Contains passwords/secrets
   - `.env.production` - Contains production config
3. **Firewall**: Keep firewall enabled
4. **Updates**: Keep system updated
5. **HTTPS**: Always use SSL/TLS in production
6. **Admin Password**: Change default admin password
7. **Wallet Security**: Oracle wallet contains DB credentials - keep secure

---

## Related Documentation

- [Local Development](../local/README.md)
- [Deployment Guide](../../docs/DEPLOYMENT.md)
- [Troubleshooting](../../docs/TROUBLESHOOTING.md)
- [Architecture](../../docs/ARCHITECTURE.md)
