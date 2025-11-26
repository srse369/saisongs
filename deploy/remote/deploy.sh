#!/bin/bash

# Song Studio - Remote Deployment CLI
# Single script for managing remote production deployments
#
# Usage: ./deploy/remote/deploy.sh <command> [options]
#
# Commands:
#   code      Deploy application code to remote server
#   env       Upload environment files to remote server
#   wallet    Upload Oracle wallet to remote server
#   check     Run health check on remote server
#   restart   Restart backend on remote server
#   logs      View remote logs
#   status    Show PM2 status

set -e

# =============================================================================
# Configuration (from config.sh)
# =============================================================================

# Find project root (go up two directories from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source deployment config from .env.deploy (preferred) or fall back to .env.local/.env.production
# .env.deploy should contain: REMOTE_USER, REMOTE_HOST, REMOTE_IP, REMOTE_PATH, SSH_KEY
for env_file in ".env.deploy" ".env.local" ".env.production"; do
    if [ -f "$PROJECT_ROOT/$env_file" ]; then
        while IFS='=' read -r key value; do
            [[ $key =~ ^#.*$ ]] && continue
            [[ -z $key ]] && continue
            case $key in
                REMOTE_USER|REMOTE_HOST|REMOTE_IP|REMOTE_PATH|SSH_KEY)
                    # Only set if not already set (first file wins)
                    if [ -z "${!key}" ]; then
                        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                        export "$key"="$value"
                    fi
                    ;;
            esac
        done < "$PROJECT_ROOT/$env_file"
    fi
done

# Server Configuration
export REMOTE_USER="${REMOTE_USER:-}"
export REMOTE_HOST="${REMOTE_HOST:-}"
export REMOTE_IP="${REMOTE_IP:-}"
export REMOTE_PATH="${REMOTE_PATH:-}"

# SSH Configuration
export SSH_KEY="${SSH_KEY:-}"
export SSH_OPTS=""

if [ -n "$SSH_KEY" ]; then
    SSH_KEY_PATH=$(eval echo "$SSH_KEY")
    if [ -f "$SSH_KEY_PATH" ]; then
        SSH_OPTS="-i \"$SSH_KEY_PATH\""
    fi
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper function to execute SSH commands
ssh_exec() {
    eval ssh $SSH_OPTS "${REMOTE_USER}@${REMOTE_IP}" "$@"
}

# Helper function to copy files via SCP
scp_copy() {
    eval scp $SSH_OPTS "$@" "${REMOTE_USER}@${REMOTE_IP}:"
}

# =============================================================================
# Helper Functions
# =============================================================================

usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  code [opts]         Deploy application code to remote server"
    echo "  env                 Upload .env.local + .env.production to remote"
    echo "  wallet              Upload Oracle wallet to remote server"
    echo "  check               Run health check on remote server"
    echo "  restart             Restart backend on remote server"
    echo "  logs [n]            View remote logs (default: 50 lines)"
    echo "  status              Show PM2 status"
    echo ""
    echo "Code Deploy Options:"
    echo "  --backend-only      Deploy backend only"
    echo "  --frontend-only     Deploy frontend only"
    echo ""
    echo "Configuration:"
    echo "  Set in .env.deploy (recommended) or .env.local:"
    echo "    REMOTE_USER, REMOTE_HOST, REMOTE_IP, REMOTE_PATH, SSH_KEY"
    echo ""
    echo "Examples:"
    echo "  $0 code"
    echo "  $0 code --backend-only"
    echo "  $0 env"
    echo "  $0 wallet"
    echo "  $0 check"
    echo "  $0 restart"
    echo "  $0 logs 100"
    echo "  $0 status"
}

check_config() {
    if [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_HOST" ]; then
        echo -e "${RED}❌ Error: REMOTE_USER and REMOTE_HOST must be set${NC}"
        echo "   Set them in .env.production or as environment variables"
        exit 1
    fi
    if [ -z "$REMOTE_IP" ]; then
        REMOTE_IP="$REMOTE_HOST"
    fi
}

# =============================================================================
# CODE Command - Deploy application code
# =============================================================================

cmd_code() {
    check_config

    echo "🚀 Song Studio Deployment"
    echo "========================="
    echo ""

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
                echo "Usage: $0 deploy [--backend-only|--frontend-only]"
                exit 1
                ;;
        esac
    done

    cd "$PROJECT_ROOT"

    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ Error: Must run from project root directory${NC}"
        exit 1
    fi

    # Frontend Deployment
    if [ "$SKIP_FRONTEND" = false ]; then
        echo "📦 Building Frontend..."
        echo "----------------------"
        
        if [ ! -f ".env.production" ]; then
            echo "Creating .env.production..."
            echo "VITE_API_URL=/api" > .env.production
        fi
        
        rm -rf dist/
        npm run build
        echo -e "${GREEN}✅ Frontend built${NC}"
        echo ""
    fi

    # Backend Deployment
    if [ "$SKIP_BACKEND" = false ]; then
        echo "🔧 Building Backend..."
        echo "---------------------"
        npm run build:server
        echo -e "${GREEN}✅ Backend built${NC}"
        echo ""
    fi

    # Deploy to Server
    echo "🚢 Deploying to ${REMOTE_HOST} (${REMOTE_IP})..."
    echo "--------------------------------"

    if [ "$SKIP_FRONTEND" = false ]; then
        echo "  → Uploading frontend files..."
        eval scp $SSH_OPTS -r dist/* "${REMOTE_USER}@${REMOTE_IP}:${REMOTE_PATH}/dist/"
    fi

    if [ "$SKIP_BACKEND" = false ]; then
        echo "  → Uploading backend files..."
        eval scp $SSH_OPTS -r dist/server "${REMOTE_USER}@${REMOTE_IP}:${REMOTE_PATH}/dist/"
        
        echo "  → Uploading PM2 config..."
        eval scp $SSH_OPTS deploy/remote/ecosystem.config.cjs "${REMOTE_USER}@${REMOTE_IP}:${REMOTE_PATH}/"
    fi

    echo -e "${GREEN}✅ Files deployed${NC}"
    echo ""

    # Restart Backend (if backend was updated)
    if [ "$SKIP_BACKEND" = false ]; then
        echo "🔄 Restarting Backend..."
        echo "-----------------------"
        
        ssh_exec << ENDSSH
            cd ${REMOTE_PATH}
            pm2 stop songstudio 2>/dev/null || true
            sleep 3
            pm2 start ecosystem.config.cjs --env production
            pm2 save
ENDSSH
        
        echo -e "${GREEN}✅ Backend restarted${NC}"
        echo ""
        
        echo "⏳ Waiting for app to initialize..."
        sleep 10
        echo ""
    fi

    # Verify Deployment
    echo "🧪 Verifying Deployment..."
    echo "-------------------------"

    echo "  → Testing API health..."
    if curl -f -s -k https://${REMOTE_IP}/api/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ API health check passed${NC}"
    else
        echo -e "  ${RED}❌ API health check failed${NC}"
    fi

    echo "  → Testing frontend..."
    if curl -f -s -k https://${REMOTE_IP}/ > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Frontend loading${NC}"
    else
        echo -e "  ${RED}❌ Frontend not responding${NC}"
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
    echo -e "${GREEN}✅ Deployment Complete!${NC}"
    echo "========================="
    echo ""
    echo "🌐 URLs:"
    echo "  Frontend: https://${REMOTE_IP}"
    echo "  API:      https://${REMOTE_IP}/api/health"
    echo ""
    echo "📊 Monitor:"
    echo "  Logs:     $0 logs"
    echo "  Status:   $0 status"
    echo "  Restart:  $0 restart"
    echo ""
}

# =============================================================================
# ENV Command - Upload environment files to remote server
# =============================================================================

cmd_env() {
    check_config

    LOCAL_ENV_LOCAL="$PROJECT_ROOT/.env.local"
    LOCAL_ENV_PROD="$PROJECT_ROOT/.env.production"
    REMOTE_ENV="${REMOTE_PATH}/.env"
    TEMP_ENV="/tmp/songstudio_env_$$"

    echo "🔐 Environment Upload"
    echo "====================="
    echo ""

    # Check if at least one env file exists
    if [ ! -f "$LOCAL_ENV_LOCAL" ] && [ ! -f "$LOCAL_ENV_PROD" ]; then
        echo -e "${RED}❌ Error: No environment files found${NC}"
        echo "   Expected: .env.local and/or .env.production"
        exit 1
    fi

    # Create merged env file (production overrides local, no duplicates)
    echo "📦 Merging environment files..."
    echo ""
    
    # Start with header
    echo "# Song Studio Production Environment" > "$TEMP_ENV"
    echo "# Generated: $(date)" >> "$TEMP_ENV"
    echo "# Source: .env.local + .env.production (merged, production overrides)" >> "$TEMP_ENV"
    echo "" >> "$TEMP_ENV"

    # Show what we're including
    if [ -f "$LOCAL_ENV_LOCAL" ]; then
        echo "  ✓ Including .env.local (base credentials)"
    fi
    if [ -f "$LOCAL_ENV_PROD" ]; then
        echo "  ✓ Including .env.production (overrides)"
    fi
    
    # Merge files: .env.local first, then .env.production overrides
    # Using awk to keep only the last occurrence of each key (production wins)
    {
        [ -f "$LOCAL_ENV_LOCAL" ] && grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$LOCAL_ENV_LOCAL" 2>/dev/null
        [ -f "$LOCAL_ENV_PROD" ] && grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$LOCAL_ENV_PROD" 2>/dev/null
    } | awk -F= '{key=$1; data[key]=$0} END {for(k in data) print data[k]}' | sort >> "$TEMP_ENV"

    echo ""
    
    # Show what will be uploaded (keys only, not values)
    echo "📋 Variables to upload:"
    grep -E '^[A-Z_]+=' "$TEMP_ENV" | sed 's/=.*/=***/' | while read line; do
        echo "   $line"
    done
    echo ""

    # Confirm upload
    read -p "Upload to ${REMOTE_HOST}:${REMOTE_ENV}? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$TEMP_ENV"
        echo "Cancelled."
        exit 0
    fi

    echo ""
    echo "🚀 Uploading environment..."

    # Upload merged file
    eval scp $SSH_OPTS "$TEMP_ENV" "${REMOTE_USER}@${REMOTE_IP}:${REMOTE_ENV}"

    # Clean up temp file
    rm -f "$TEMP_ENV"

    # Set secure permissions on remote
    echo "🔒 Setting secure permissions..."
    ssh_exec "chmod 600 ${REMOTE_ENV}"

    echo ""
    echo -e "${GREEN}✅ Environment uploaded successfully!${NC}"
    echo ""

    # Ask if user wants to restart
    read -p "Restart backend to apply changes? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        cmd_restart
    else
        echo ""
        echo "ℹ️  Remember to restart the backend to apply changes:"
        echo "   $0 restart"
    fi
}

# =============================================================================
# WALLET Command - Upload Oracle wallet to remote server
# =============================================================================

cmd_wallet() {
    check_config

    LOCAL_WALLET_DIR="$PROJECT_ROOT/wallet"
    REMOTE_WALLET_DIR="${REMOTE_PATH}/wallet"

    echo "🔐 Oracle Wallet Upload"
    echo "======================="
    echo ""

    # Check if local wallet exists
    if [ ! -d "$LOCAL_WALLET_DIR" ]; then
        echo -e "${RED}❌ Error: Local wallet directory not found${NC}"
        echo "   Expected: $LOCAL_WALLET_DIR"
        echo ""
        echo "   Download your Oracle wallet from Oracle Cloud Console:"
        echo "   1. Go to Autonomous Database > DB Connection"
        echo "   2. Download Instance Wallet"
        echo "   3. Extract to: $LOCAL_WALLET_DIR"
        exit 1
    fi

    # Check for required wallet files
    REQUIRED_FILES=("tnsnames.ora" "sqlnet.ora" "cwallet.sso")
    MISSING_FILES=()
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$LOCAL_WALLET_DIR/$file" ]; then
            MISSING_FILES+=("$file")
        fi
    done

    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        echo -e "${RED}❌ Error: Missing required wallet files:${NC}"
        for file in "${MISSING_FILES[@]}"; do
            echo "   - $file"
        done
        exit 1
    fi

    echo "📁 Local wallet: $LOCAL_WALLET_DIR"
    echo "📁 Remote wallet: $REMOTE_WALLET_DIR"
    echo ""
    
    # List files being uploaded (without showing content)
    echo "📦 Files to upload:"
    ls -la "$LOCAL_WALLET_DIR" | grep -v "^total" | awk '{print "   " $NF}'
    echo ""

    # Confirm upload
    read -p "Upload wallet to ${REMOTE_HOST}? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi

    echo ""
    echo "🚀 Uploading wallet..."

    # Create remote directory if it doesn't exist
    ssh_exec "mkdir -p $REMOTE_WALLET_DIR"

    # Upload wallet files
    eval scp $SSH_OPTS -r "$LOCAL_WALLET_DIR/"* "${REMOTE_USER}@${REMOTE_IP}:${REMOTE_WALLET_DIR}/"

    # Set secure permissions on remote
    echo "🔒 Setting secure permissions..."
    ssh_exec << ENDSSH
chmod 700 $REMOTE_WALLET_DIR
chmod 600 $REMOTE_WALLET_DIR/*
echo "Wallet permissions set:"
ls -la $REMOTE_WALLET_DIR
ENDSSH

    echo ""
    echo -e "${GREEN}✅ Wallet uploaded successfully!${NC}"
    echo ""

    # Ask if user wants to restart
    read -p "Restart backend to use new wallet? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        cmd_restart
    else
        echo ""
        echo "ℹ️  Remember to restart the backend to use the new wallet:"
        echo "   $0 restart"
    fi
}

# =============================================================================
# CHECK Command
# =============================================================================

cmd_check() {
    check_config

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
    STATUS=$(pm2 jlist 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Process status: ${STATUS:-unknown}"
    
    if [ "$STATUS" != "online" ]; then
        echo "⚠️  Process is not online. Attempting to restart..."
        cd /var/www/songstudio
        pm2 delete songstudio 2>/dev/null || true
        pm2 start ecosystem.config.cjs --env production
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
    curl -s http://localhost:3001/api/health
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
    grep -E "^(NODE_ENV|PORT|ORACLE)" /var/www/songstudio/.env | sed 's/=.*/=***/' || echo "No variables found"
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
}

# =============================================================================
# RESTART Command
# =============================================================================

cmd_restart() {
    check_config

    echo "🔄 Restarting Song Studio backend..."

    ssh_exec << ENDSSH
cd ${REMOTE_PATH}

# Check if PM2 process exists
if pm2 list | grep -q "songstudio"; then
    echo "Restarting existing process..."
    pm2 delete songstudio 2>/dev/null || true
fi

echo "Starting process..."
pm2 start ecosystem.config.cjs --env production

# Wait for service to start
sleep 3

# Test the API
echo ""
echo "Testing API..."
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is running!"
    curl -s http://localhost:3001/api/health
else
    echo "❌ Backend failed to start. Check logs:"
    echo "   pm2 logs songstudio --lines 50"
fi

# Save PM2 configuration
pm2 save
echo ""
echo "Done! PM2 configuration saved."
ENDSSH
}

# =============================================================================
# LOGS Command
# =============================================================================

cmd_logs() {
    check_config

    LINES="${1:-50}"

    echo "📝 Last $LINES lines of logs"
    echo "============================="
    echo ""

    ssh_exec "pm2 logs songstudio --nostream --lines $LINES"
}

# =============================================================================
# STATUS Command
# =============================================================================

cmd_status() {
    check_config

    echo "📊 PM2 Status"
    echo "============="
    echo ""

    ssh_exec 'pm2 status'

    echo ""
    echo "🔧 System Info"
    echo "============="
    ssh_exec 'echo "Memory: $(free -h | grep Mem | awk '"'"'{print $3 "/" $2}'"'"')"'
    ssh_exec 'echo "Disk: $(df -h / | tail -1 | awk '"'"'{print $3 "/" $2}'"'"')"'
    ssh_exec 'echo "Uptime: $(uptime -p)"'
}

# =============================================================================
# Main Command Router
# =============================================================================

cmd="${1:-}"
shift || true

case "$cmd" in
    code)
        cmd_code "$@"
        ;;
    env)
        cmd_env
        ;;
    wallet)
        cmd_wallet
        ;;
    check)
        cmd_check
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs "$@"
        ;;
    status)
        cmd_status
        ;;
    -h|--help|"")
        usage
        ;;
    *)
        echo "Unknown command: $cmd"
        echo ""
        usage
        exit 1
        ;;
esac

