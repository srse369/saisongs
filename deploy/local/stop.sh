#!/bin/bash

# Song Studio - Local Development Stop Script
# Stops frontend and backend servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Song Studio (Local Development)${NC}"
echo "=========================================="

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

STOPPED=0

# Stop frontend
if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}🎨 Stopping Frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            kill -9 $FRONTEND_PID 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ Frontend stopped${NC}"
        STOPPED=$((STOPPED + 1))
    else
        echo -e "${YELLOW}⚠️  Frontend not running (stale PID file)${NC}"
    fi
    rm -f logs/frontend.pid
else
    # Try to find by port
    FRONTEND_PID=$(lsof -ti:5173 2>/dev/null || true)
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}🎨 Stopping Frontend on port 5173 (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✅ Frontend stopped${NC}"
        STOPPED=$((STOPPED + 1))
    else
        echo -e "${BLUE}ℹ️  Frontend not running${NC}"
    fi
fi

# Stop backend
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}🔧 Stopping Backend (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            kill -9 $BACKEND_PID 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ Backend stopped${NC}"
        STOPPED=$((STOPPED + 1))
    else
        echo -e "${YELLOW}⚠️  Backend not running (stale PID file)${NC}"
    fi
    rm -f logs/backend.pid
else
    # Try to find by port
    BACKEND_PID=$(lsof -ti:3001 2>/dev/null || true)
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}🔧 Stopping Backend on port 3001 (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✅ Backend stopped${NC}"
        STOPPED=$((STOPPED + 1))
    else
        echo -e "${BLUE}ℹ️  Backend not running${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
if [ $STOPPED -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No services were running${NC}"
else
    echo -e "${GREEN}✅ Stopped $STOPPED service(s)${NC}"
fi
echo -e "${GREEN}========================================${NC}"
echo ""

