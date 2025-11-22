#!/bin/bash
# Complete Deployment Script for Song Studio
# Handles frontend, backend, and all configurations

set -e

# Source shared configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "🚀 Song Studio Deployment"
echo "========================="
echo ""

# Check required configuration
if [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_HOST" ]; then
    echo "❌ Error: REMOTE_USER and REMOTE_HOST must be set"
    echo "   Set them as environment variables or in config.sh"
    exit 1
fi

if [ -n "$SSH_OPTS" ]; then
    echo "🔑 Using SSH key authentication"
fi
echo ""

# Parse arguments
SKIP_FRONTEND=false
SKIP_BACKEND=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-frontend)
      SKIP_FRONTEND=true
      shift
      ;;
    --skip-backend)
      SKIP_BACKEND=true
      shift
      ;;
    --backend-only)
      SKIP_FRONTEND=true
      shift
      ;;
    --frontend-only)
      SKIP_BACKEND=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--backend-only|--frontend-only|--skip-frontend|--skip-backend]"
      exit 1
      ;;
  esac
done

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Frontend Deployment
if [ "$SKIP_FRONTEND" = false ]; then
    echo "📦 Building Frontend..."
    echo "----------------------"
    
    # Ensure .env.production exists
    if [ ! -f ".env.production" ]; then
        echo "Creating .env.production..."
        echo "VITE_API_URL=/api" > .env.production
    fi
    
    # Clean and build
    rm -rf dist/
    npm run build:vps
    echo "✅ Frontend built"
    echo ""
fi

# Backend Deployment
if [ "$SKIP_BACKEND" = false ]; then
    echo "🔧 Building Backend..."
    echo "---------------------"
    npm run build:server
    echo "✅ Backend built"
    echo ""
fi

# Deploy to Server
echo "🚢 Deploying to ${REMOTE_HOST}..."
echo "--------------------------------"

if [ "$SKIP_FRONTEND" = false ]; then
    echo "  → Uploading frontend files..."
    eval scp $SSH_OPTS -r dist/* "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/dist/"
fi

if [ "$SKIP_BACKEND" = false ]; then
    echo "  → Uploading backend files..."
    eval scp $SSH_OPTS -r dist/server "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/dist/"
    
    # Deploy PM2 ecosystem config
    echo "  → Uploading PM2 config..."
    eval scp $SSH_OPTS deploy/remote/ecosystem.config.cjs "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"
    
    # Remove old .js config if it exists
    ssh_exec 'rm -f '"${REMOTE_PATH}"'/ecosystem.config.js' 2>/dev/null || true
fi

echo "✅ Files deployed"
echo ""

# Restart Backend (if backend was updated)
if [ "$SKIP_BACKEND" = false ]; then
    echo "🔄 Restarting Backend..."
    echo "-----------------------"
    
    ssh_exec << ENDSSH
        cd ${REMOTE_PATH}
        
        # Stop gracefully
        pm2 stop songstudio 2>/dev/null || true
        
        # Wait for cleanup (important for Oracle connection pool)
        sleep 3
        
        # Start fresh
        pm2 start ecosystem.config.cjs --env production
        
        # Save configuration
        pm2 save
ENDSSH
    
    echo "✅ Backend restarted"
    echo ""
    
    # Wait for app to initialize
    echo "⏳ Waiting for app to initialize..."
    sleep 10
    echo ""
fi

# Verify Deployment
echo "🧪 Verifying Deployment..."
echo "-------------------------"

# Test API health
echo "  → Testing API health..."
if curl -f -s -k https://${REMOTE_IP}/api/health > /dev/null 2>&1; then
    echo "  ✅ API health check passed"
else
    echo "  ❌ API health check failed"
fi

# Test frontend
echo "  → Testing frontend..."
if curl -f -s -k https://${REMOTE_IP}/ > /dev/null 2>&1; then
    echo "  ✅ Frontend loading"
else
    echo "  ❌ Frontend not responding"
fi

echo ""

# Show Status
echo "📊 Server Status"
echo "---------------"
ssh_exec 'pm2 list'
echo ""

# Show Recent Logs
echo "📝 Recent Logs (last 15 lines)"
echo "------------------------------"
ssh_exec 'pm2 logs songstudio --nostream --lines 15'
echo ""

# Summary
echo "========================="
echo "✅ Deployment Complete!"
echo "========================="
echo ""
echo "🌐 URLs:"
echo "  Frontend: https://${REMOTE_HOST}"
echo "  API:      https://${REMOTE_HOST}/api/health"
echo ""
echo "📊 Monitor:"
echo "  Logs:     ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 logs songstudio'"
echo "  Status:   ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 status'"
echo "  Restart:  ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 restart songstudio'"
echo ""
echo "🔍 Check caching:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 logs songstudio | grep -i cache'"
echo ""
echo "Expected cache messages:"
echo "  ✅ Cache hit for key: songs:all (age: 15s)"
echo "  💾 Cached data for key: songs:all (TTL: 300s)"
echo ""
