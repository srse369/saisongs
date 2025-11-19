# Deployment Guide - Oracle Linux Server

Deploy Song Studio to Oracle Linux server at **141.148.149.54**

## Server Information

- **IP Address**: 141.148.149.54
- **Username**: opc
- **OS**: Oracle Linux 9 (6.12.0 kernel)
- **SSH Key**: `~/Downloads/SSH Key Nov 12 2025.key`

## Quick Deployment Steps

### 1. First-Time Server Setup

Transfer the setup script to the server and run it:

```bash
# From your local machine
cd /Users/ssett2/Documents/github.com/srse369/songstudio

# Make setup script executable
chmod +x deploy/remote/server-setup-oracle.sh

# Copy setup script to server
scp -i ~/Downloads/"SSH Key Nov 12 2025.key" \
    deploy/remote/server-setup-oracle.sh \
    opc@141.148.149.54:/tmp/

# SSH into the server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# Run the setup script on the server
bash /tmp/server-setup-oracle.sh
```

### 2. Configure Nginx

After the setup script completes:

```bash
# From your local machine - copy nginx config
scp -i ~/Downloads/"SSH Key Nov 12 2025.key" \
    deploy/remote/nginx.conf \
    opc@141.148.149.54:/tmp/

# SSH into server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# Move nginx config to proper location
sudo mv /tmp/nginx.conf /etc/nginx/conf.d/songstudio.conf

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Configure Database Connection

Edit the environment file on the server:

```bash
# On the server
nano /var/www/songstudio/.env

# Update these values:
# DB_USER=your_oracle_username
# DB_PASSWORD=your_oracle_password
# DB_CONNECTION_STRING=your_oracle_connection_string
# ADMIN_PASSWORD=your_admin_password
```

### 4. Deploy the Application

From your local machine:

```bash
cd /Users/ssett2/Documents/github.com/srse369/songstudio

# Make deploy script executable
chmod +x deploy/remote/deploy.sh

# Run deployment
./deploy/remote/deploy.sh production

# Or use npm script
npm run deploy:vps
```

## SSH Connection

### Quick SSH Connection

```bash
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54
```

### Setup SSH Config (Optional)

Add to `~/.ssh/config`:

```
Host songstudio
    HostName 141.148.149.54
    User opc
    IdentityFile ~/Downloads/SSH Key Nov 12 2025.key
    IdentitiesOnly yes
```

Then you can simply use:

```bash
ssh songstudio
scp file.txt songstudio:/tmp/
```

## Server Management

### Application Management (PM2)

```bash
# SSH into server first
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# Check status
pm2 status

# View logs
pm2 logs songstudio
pm2 logs songstudio --lines 100

# Restart application
pm2 restart songstudio

# Stop application
pm2 stop songstudio

# Start application
pm2 start songstudio
```

### Nginx Management

```bash
# Check nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Reload nginx (without downtime)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# View nginx logs
sudo tail -f /var/log/nginx/songstudio_access.log
sudo tail -f /var/log/nginx/songstudio_error.log
```

### Firewall Management (firewalld)

```bash
# Check firewall status
sudo firewall-cmd --state

# List all rules
sudo firewall-cmd --list-all

# Add a service
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

# Add a port
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### SELinux Management

```bash
# Check SELinux status
getenforce

# View SELinux denials
sudo ausearch -m avc -ts recent

# Set SELinux boolean
sudo setsebool -P httpd_can_network_connect 1

# Restore file contexts
sudo restorecon -Rv /var/www/songstudio
```

## Troubleshooting

### Cannot Connect via SSH

```bash
# Test SSH key permissions
ls -l ~/Downloads/"SSH Key Nov 12 2025.key"
# Should show: -rw------- (600)

# Fix permissions if needed
chmod 600 ~/Downloads/"SSH Key Nov 12 2025.key"

# Test connection
ssh -v -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54
```

### Deployment Fails

```bash
# Check if SSH key is correct
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54 "echo 'Connected'"

# Check disk space on server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54 "df -h"

# Check if Node.js is installed
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54 "node --version"
```

### Application Won't Start

```bash
# SSH into server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# Check PM2 logs
pm2 logs songstudio --lines 50

# Check if environment file exists
cat /var/www/songstudio/.env

# Check Oracle client
echo $LD_LIBRARY_PATH
ls -la /usr/lib/oracle/*/client64/lib

# Test Oracle connection
cd /var/www/songstudio
node -e "const oracledb = require('oracledb'); console.log(oracledb);"
```

### 502 Bad Gateway

```bash
# Check if backend is running
pm2 status

# Test backend directly
curl http://localhost:3001/api/health

# Check nginx error logs
sudo tail -f /var/log/nginx/songstudio_error.log

# Check nginx can connect to backend (SELinux)
sudo getsebool httpd_can_network_connect
# Should be "on"
```

### Port Already in Use

```bash
# Find process using port 3001
sudo lsof -i :3001
# or
sudo netstat -tulpn | grep 3001

# Kill the process
sudo kill -9 <PID>

# Restart application
pm2 restart songstudio
```

## Health Check

```bash
# From local machine
curl http://141.148.149.54/api/health

# Should return:
# {"status":"ok","timestamp":"2025-11-19T..."}
```

## Updates and Maintenance

### Deploy New Version

```bash
# From local machine
cd /Users/ssett2/Documents/github.com/srse369/songstudio
./deploy/remote/deploy.sh production
```

### Update System Packages

```bash
# SSH into server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# Update packages
sudo dnf update -y

# Reboot if kernel updated
sudo reboot
```

### Update Node.js

```bash
# SSH into server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# Check current version
node --version

# Update to new version (e.g., 22.x)
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# Update PM2 if needed
sudo npm install -g pm2@latest
pm2 update
```

## Backup and Restore

### Backup

Automatic backups are created on each deployment at:
```
/var/www/songstudio.backup.YYYYMMDD_HHMMSS/
```

### Manual Backup

```bash
# SSH into server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# Create backup
sudo cp -r /var/www/songstudio /var/www/songstudio.backup.$(date +%Y%m%d_%H%M%S)
```

### Restore

```bash
# SSH into server
ssh -i ~/Downloads/"SSH Key Nov 12 2025.key" opc@141.148.149.54

# List backups
ls -la /var/www/songstudio.backup.*

# Restore from backup
sudo cp -r /var/www/songstudio.backup.20251119_120000/* /var/www/songstudio/
pm2 restart songstudio
```

## Security Best Practices

1. **Keep system updated**: `sudo dnf update -y` regularly
2. **Use strong admin password**: Update `ADMIN_PASSWORD` in `.env`
3. **Keep SSH key secure**: Never share `SSH Key Nov 12 2025.key`
4. **Monitor logs**: Regularly check PM2 and Nginx logs
5. **Enable HTTPS**: Use Let's Encrypt for SSL certificate
6. **Keep firewall enabled**: Don't disable firewalld
7. **Monitor SELinux**: Keep it enforcing, don't disable

## Performance Monitoring

```bash
# System resources
htop
# or
top

# PM2 monitoring
pm2 monit

# Disk usage
df -h

# Memory usage
free -h

# Network connections
ss -tulpn
```

## URLs

- **Application**: http://141.148.149.54
- **API Health**: http://141.148.149.54/api/health
- **API Base**: http://141.148.149.54/api

## Support

For issues specific to:
- **Oracle Linux**: Check `/var/log/messages`
- **Nginx**: Check `/var/log/nginx/`
- **Application**: Check `pm2 logs songstudio`
- **SELinux**: Check `sudo ausearch -m avc`

