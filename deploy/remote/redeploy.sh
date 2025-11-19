#!/bin/bash
# Complete redeployment script for Song Studio to saisongs.org
# This rebuilds the frontend and deploys to the production server

set -e  # Exit on any error

echo "🚀 Starting Song Studio Deployment to saisongs.org"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Step 1: Clean old build
echo "🧹 Step 1: Cleaning old build..."
rm -rf dist/
echo "✅ Old build removed"
echo ""

# Step 2: Install dependencies (if needed)
echo "📦 Step 2: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Step 3: Build frontend with VPS configuration
echo "🔨 Step 3: Building frontend for VPS (root path)..."
npm run build:vps
echo "✅ Frontend built successfully"
echo ""

# Step 4: Build backend
echo "🔨 Step 4: Building backend..."
npm run build:server
echo "✅ Backend built successfully"
echo ""

# Step 5: Deploy to server
echo "🚢 Step 5: Deploying to saisongs.org..."

# Check if server is reachable
if ! ping -c 1 saisongs.org > /dev/null 2>&1; then
    echo "⚠️  Warning: Cannot reach saisongs.org"
    echo "   Continuing anyway..."
fi

# Deploy frontend
echo "  → Uploading frontend files..."
scp -r dist/* ubuntu@saisongs.org:/var/www/songstudio/dist/

# Deploy backend (if different from dist)
echo "  → Uploading backend files..."
scp -r dist/server ubuntu@saisongs.org:/var/www/songstudio/dist/

# Deploy .env file (if exists)
if [ -f ".env" ]; then
    echo "  → Uploading .env file..."
    scp .env ubuntu@saisongs.org:/var/www/songstudio/
fi

# Deploy wallet files (if not already there)
if [ -d "wallet" ]; then
    echo "  → Checking wallet files..."
    ssh ubuntu@saisongs.org "[ -d /var/www/songstudio/wallet ] && echo 'Wallet exists' || echo 'Need wallet'"
fi

echo "✅ Files deployed"
echo ""

# Step 6: Restart backend on server
echo "🔄 Step 6: Restarting backend service..."
ssh ubuntu@saisongs.org << 'ENDSSH'
    cd /var/www/songstudio
    pm2 restart songstudio --env production
    pm2 save
ENDSSH
echo "✅ Backend restarted"
echo ""

# Step 7: Verify deployment
echo "🧪 Step 7: Verifying deployment..."
sleep 3

# Check if backend is responding
echo "  → Testing API health..."
if curl -f -s https://saisongs.org/api/health > /dev/null; then
    echo "  ✅ API is responding"
    curl -s https://saisongs.org/api/health | head -1
else
    echo "  ❌ API is not responding"
    echo "     Check logs: ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 50'"
fi

echo ""
echo "=================================================="
echo "✅ Deployment complete!"
echo ""
echo "🌐 Visit: https://saisongs.org"
echo "📊 API:  https://saisongs.org/api/health"
echo ""
echo "📝 To check logs:"
echo "   ssh ubuntu@saisongs.org 'pm2 logs songstudio'"
echo ""
echo "🔧 To check nginx:"
echo "   ssh ubuntu@saisongs.org 'sudo systemctl status nginx'"
echo ""

