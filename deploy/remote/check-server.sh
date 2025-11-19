#!/bin/bash
# Script to check and restart the Song Studio backend server
# Usage: ./check-server.sh
# Or with SSH key: SSH_KEY=~/.ssh/my-key ./check-server.sh

# Source shared configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Check required configuration
if [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_HOST" ]; then
    echo "❌ Error: REMOTE_USER and REMOTE_HOST must be set"
    echo "   Set them as environment variables or in config.sh"
    exit 1
fi

echo "=========================================="
echo "Song Studio Server Health Check"
echo "=========================================="
echo ""

ssh_exec << 'ENDSSH'
# Check if PM2 is installed
echo "1. Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed"
    echo "Installing PM2..."
    npm install -g pm2
else
    echo "✅ PM2 is installed"
fi
echo ""

# Check PM2 process status
echo "2. Checking PM2 processes..."
pm2 list
echo ""

# Check if songstudio process is running
echo "3. Checking songstudio process..."
if pm2 list | grep -q "songstudio"; then
    STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="songstudio") | .pm2_env.status')
    echo "Process status: $STATUS"
    
    if [ "$STATUS" != "online" ]; then
        echo "⚠️  Process is not online. Attempting to restart..."
        cd /var/www/songstudio
        pm2 restart songstudio --env production
    else
        echo "✅ Process is online"
    fi
else
    echo "❌ songstudio process not found. Starting it..."
    cd /var/www/songstudio
    pm2 start ecosystem.config.cjs --env production
fi
echo ""

# Check if backend is responding
echo "4. Testing backend API..."
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend API is responding"
    curl -s http://localhost:3001/api/health | jq .
else
    echo "❌ Backend API is not responding"
fi
echo ""

# Check nginx status
echo "5. Checking nginx status..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
    echo "Starting nginx..."
    sudo systemctl start nginx
fi
echo ""

# Check recent PM2 logs
echo "6. Recent PM2 logs (last 20 lines)..."
pm2 logs songstudio --nostream --lines 20
echo ""

# Check if .env file exists
echo "7. Checking environment configuration..."
if [ -f /var/www/songstudio/.env ]; then
    echo "✅ .env file exists"
    echo "Environment variables configured:"
    grep -E "^(NODE_ENV|PORT|VITE_ORACLE)" /var/www/songstudio/.env | sed 's/=.*/=***/' || echo "No variables found"
else
    echo "❌ .env file not found!"
    echo "Please create /var/www/songstudio/.env with required variables"
fi
echo ""

echo "=========================================="
echo "Health check complete!"
echo "=========================================="
echo ""
echo "If issues persist, run:"
echo "  pm2 logs songstudio --lines 50"
echo "  sudo tail -f /var/log/nginx/songstudio_error.log"
ENDSSH

