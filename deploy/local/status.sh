#!/bin/bash

# Song Studio - Local Development Status Script
# Shows status of frontend and backend servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Song Studio Status (Local Development)${NC}"
echo "=========================================="

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Check frontend
echo ""
echo -e "${BLUE}🎨 Frontend (Port 5173):${NC}"
FRONTEND_PID=$(lsof -ti:5173 2>/dev/null || true)

if [ ! -z "$FRONTEND_PID" ]; then
    echo -e "   Status: ${GREEN}● Running${NC}"
    echo "   PID: $FRONTEND_PID"
    echo "   URL: http://localhost:5173"
    
    # Check memory usage
    if command -v ps &> /dev/null; then
        MEM=$(ps -p $FRONTEND_PID -o rss= 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
        echo "   Memory: $MEM"
    fi
    
    # Check if PID file exists and matches
    if [ -f "logs/frontend.pid" ]; then
        STORED_PID=$(cat logs/frontend.pid)
        if [ "$STORED_PID" != "$FRONTEND_PID" ]; then
            echo -e "   ${BLUE}ℹ️  Note: Child process PID differs from parent (npm wrapper)${NC}"
        fi
    fi
else
    echo -e "   Status: ${RED}○ Not running${NC}"
fi

# Check backend
echo ""
echo -e "${BLUE}🔧 Backend (Port 3001):${NC}"
BACKEND_PID=$(lsof -ti:3001 2>/dev/null || true)

if [ ! -z "$BACKEND_PID" ]; then
    echo -e "   Status: ${GREEN}● Running${NC}"
    echo "   PID: $BACKEND_PID"
    echo "   URL: http://localhost:3001"
    echo "   API: http://localhost:3001/api"
    
    # Check memory usage
    if command -v ps &> /dev/null; then
        MEM=$(ps -p $BACKEND_PID -o rss= 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
        echo "   Memory: $MEM"
    fi
    
    # Check if PID file exists and matches
    if [ -f "logs/backend.pid" ]; then
        STORED_PID=$(cat logs/backend.pid)
        if [ "$STORED_PID" != "$BACKEND_PID" ]; then
            echo -e "   ${BLUE}ℹ️  Note: Child process PID differs from parent (npm wrapper)${NC}"
        fi
    fi
    
    # Test API health
    echo -n "   Health: "
    HEALTH=$(curl -s http://localhost:3001/api/health 2>/dev/null || echo "")
    if [ ! -z "$HEALTH" ]; then
        echo -e "${GREEN}✓ API responding${NC}"
    else
        echo -e "${RED}✗ API not responding${NC}"
    fi
else
    echo -e "   Status: ${RED}○ Not running${NC}"
fi

# Check database connection (if backend is running)
if [ ! -z "$BACKEND_PID" ]; then
    echo ""
    echo -e "${BLUE}🗄️  Database:${NC}"
    echo -n "   Connection: "
    
    # Try to fetch a small dataset to test DB connection
    DB_TEST=$(curl -s http://localhost:3001/api/songs 2>/dev/null | head -c 50 || echo "")
    if [ ! -z "$DB_TEST" ]; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${RED}✗ Not responding${NC}"
    fi
fi

# Check for log files
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
if [ -f "logs/frontend.log" ]; then
    FRONTEND_LOG_SIZE=$(du -h logs/frontend.log 2>/dev/null | cut -f1)
    FRONTEND_LOG_LINES=$(wc -l < logs/frontend.log 2>/dev/null)
    echo "   Frontend: logs/frontend.log ($FRONTEND_LOG_SIZE, $FRONTEND_LOG_LINES lines)"
else
    echo "   Frontend: No log file"
fi

if [ -f "logs/backend.log" ]; then
    BACKEND_LOG_SIZE=$(du -h logs/backend.log 2>/dev/null | cut -f1)
    BACKEND_LOG_LINES=$(wc -l < logs/backend.log 2>/dev/null)
    echo "   Backend:  logs/backend.log ($BACKEND_LOG_SIZE, $BACKEND_LOG_LINES lines)"
else
    echo "   Backend:  No log file"
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"

RUNNING_COUNT=0
[ ! -z "$FRONTEND_PID" ] && RUNNING_COUNT=$((RUNNING_COUNT + 1))
[ ! -z "$BACKEND_PID" ] && RUNNING_COUNT=$((RUNNING_COUNT + 1))

if [ $RUNNING_COUNT -eq 2 ]; then
    echo -e "${GREEN}✅ All services running${NC}"
elif [ $RUNNING_COUNT -eq 1 ]; then
    echo -e "${YELLOW}⚠️  Partial: $RUNNING_COUNT/2 services running${NC}"
else
    echo -e "${RED}❌ No services running${NC}"
fi

echo -e "${GREEN}========================================${NC}"
echo ""

# Quick actions
if [ $RUNNING_COUNT -eq 0 ]; then
    echo -e "${BLUE}💡 Start services:${NC}"
    echo "   ./deploy/local/start.sh"
elif [ $RUNNING_COUNT -eq 2 ]; then
    echo -e "${BLUE}💡 Quick actions:${NC}"
    echo "   View logs:    tail -f logs/frontend.log logs/backend.log"
    echo "   Restart:      ./deploy/local/restart.sh"
    echo "   Stop:         ./deploy/local/stop.sh"
fi
echo ""

