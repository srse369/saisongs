#!/bin/bash

# Song Studio - Local Development CLI
# Single script for managing local development services
#
# Usage: ./deploy/local/dev.sh <command> [options]
#
# Commands:
#   start     Start frontend and backend servers
#   stop      Stop all services
#   restart   Restart all services
#   status    Show service status
#   logs      View logs (with options)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory (2 levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# =============================================================================
# Helper Functions
# =============================================================================

usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start               Start frontend and backend"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo "  status              Show service status"
    echo "  logs [opts]         View logs"
    echo ""
    echo "Log Options:"
    echo "  frontend, fe        Show only frontend logs"
    echo "  backend, be         Show only backend logs"
    echo "  -f, --follow        Follow logs in real-time"
    echo "  -n, --lines N       Show last N lines (default: 50)"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 status"
    echo "  $0 logs -f"
    echo "  $0 logs backend -n 100"
    echo "  $0 stop"
}

# =============================================================================
# START Command
# =============================================================================

cmd_start() {
    echo -e "${BLUE}🚀 Starting Song Studio (Local Development)${NC}"
    echo "=========================================="

    cd "$PROJECT_ROOT"

    # Check if .env.local exists
    if [ ! -f ".env.local" ]; then
        echo -e "${YELLOW}⚠️  Warning: .env.local not found${NC}"
        echo "   Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env.local
            echo -e "${GREEN}✅ Created .env.local - please update with your credentials${NC}"
        else
            echo -e "${RED}❌ .env.example not found. Please create .env.local manually.${NC}"
            exit 1
        fi
    fi

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        npm install
        echo -e "${GREEN}✅ Dependencies installed${NC}"
    fi

    # Check if services are already running
    FRONTEND_PID=$(lsof -ti:5173 2>/dev/null || true)
    BACKEND_PID=$(lsof -ti:3001 2>/dev/null || true)

    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}⚠️  Frontend already running on port 5173 (PID: $FRONTEND_PID)${NC}"
        read -p "   Kill and restart? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill $FRONTEND_PID
            sleep 2
        else
            echo -e "${BLUE}ℹ️  Skipping frontend startup${NC}"
        fi
    fi

    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}⚠️  Backend already running on port 3001 (PID: $BACKEND_PID)${NC}"
        read -p "   Kill and restart? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill $BACKEND_PID
            sleep 2
        else
            echo -e "${BLUE}ℹ️  Skipping backend startup${NC}"
        fi
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start backend server
    echo ""
    echo -e "${BLUE}🔧 Starting Backend Server...${NC}"
    echo "   Port: 3001"
    echo "   Logs: logs/backend.log"

    npm run dev:server > logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > logs/backend.pid

    # Wait a moment for backend to start
    sleep 2

    # Check if backend started successfully
    if ps -p $BACKEND_PID > /dev/null; then
        echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}❌ Backend failed to start. Check logs/backend.log${NC}"
        tail -20 logs/backend.log
        exit 1
    fi

    # Start frontend server
    echo ""
    echo -e "${BLUE}🎨 Starting Frontend Server...${NC}"
    echo "   Port: 5173"
    echo "   Logs: logs/frontend.log"

    npm run dev > logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > logs/frontend.pid

    # Wait a moment for frontend to start
    sleep 2

    # Check if frontend started successfully
    if ps -p $FRONTEND_PID > /dev/null; then
        echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}❌ Frontend failed to start. Check logs/frontend.log${NC}"
        tail -20 logs/frontend.log
        exit 1
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Song Studio is running!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}🌐 URLs:${NC}"
    echo "   Frontend: http://localhost:5173"
    echo "   Backend:  http://localhost:3001"
    echo "   API:      http://localhost:3001/api"
    echo ""
    echo -e "${BLUE}📝 Logs:${NC}"
    echo "   Frontend: tail -f logs/frontend.log"
    echo "   Backend:  tail -f logs/backend.log"
    echo ""
    echo -e "${BLUE}🛑 Stop services:${NC}"
    echo "   $0 stop"
    echo ""
    echo -e "${BLUE}📊 Check status:${NC}"
    echo "   $0 status"
    echo ""
    echo -e "${YELLOW}💡 Press Ctrl+C to view logs, or close terminal to keep running in background${NC}"
    echo ""

    # Offer to tail logs
    read -p "View live logs? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}📋 Showing live logs (Ctrl+C to exit)...${NC}"
        echo ""
        tail -f logs/frontend.log logs/backend.log
    fi
}

# =============================================================================
# STOP Command
# =============================================================================

cmd_stop() {
    echo -e "${BLUE}🛑 Stopping Song Studio (Local Development)${NC}"
    echo "=========================================="

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
}

# =============================================================================
# RESTART Command
# =============================================================================

cmd_restart() {
    echo -e "${BLUE}🔄 Restarting Song Studio (Local Development)${NC}"
    echo "=========================================="

    # Stop services (inline, don't call cmd_stop to avoid duplicate output)
    echo -e "${YELLOW}Stopping services...${NC}"
    cmd_stop

    echo ""
    echo -e "${YELLOW}Waiting 3 seconds...${NC}"
    sleep 3

    # Start services
    echo ""
    echo -e "${YELLOW}Starting services...${NC}"
    cmd_start
}

# =============================================================================
# STATUS Command
# =============================================================================

cmd_status() {
    echo -e "${BLUE}📊 Song Studio Status (Local Development)${NC}"
    echo "=========================================="

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
        echo "   $0 start"
    elif [ $RUNNING_COUNT -eq 2 ]; then
        echo -e "${BLUE}💡 Quick actions:${NC}"
        echo "   View logs:    $0 logs -f"
        echo "   Restart:      $0 restart"
        echo "   Stop:         $0 stop"
    fi
    echo ""
}

# =============================================================================
# LOGS Command
# =============================================================================

cmd_logs() {
    cd "$PROJECT_ROOT"

    # Parse arguments
    LINES=50
    FOLLOW=false
    LOG_TYPE=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--follow)
                FOLLOW=true
                shift
                ;;
            -n|--lines)
                LINES="$2"
                shift 2
                ;;
            frontend|fe)
                LOG_TYPE="frontend"
                shift
                ;;
            backend|be|server)
                LOG_TYPE="backend"
                shift
                ;;
            -h|--help)
                echo "Usage: $0 logs [frontend|backend] [-f|--follow] [-n|--lines N]"
                echo ""
                echo "Options:"
                echo "  frontend, fe       Show only frontend logs"
                echo "  backend, be        Show only backend logs"
                echo "  -f, --follow       Follow logs in real-time"
                echo "  -n, --lines N      Show last N lines (default: 50)"
                echo ""
                echo "Examples:"
                echo "  $0 logs                    # Show last 50 lines from both"
                echo "  $0 logs -f                 # Follow both logs"
                echo "  $0 logs frontend -f        # Follow frontend only"
                echo "  $0 logs backend -n 100     # Show last 100 backend lines"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 logs [frontend|backend] [-f|--follow] [-n|--lines N]"
                exit 1
                ;;
        esac
    done

    # Check if logs exist
    if [ ! -d "logs" ]; then
        echo -e "${RED}❌ No logs directory found${NC}"
        echo "   Have you started the services? Run: $0 start"
        exit 1
    fi

    if [ "$FOLLOW" = true ]; then
        echo -e "${BLUE}📋 Following logs (Ctrl+C to exit)${NC}"
        echo "=========================================="
        echo ""
        
        if [ "$LOG_TYPE" = "frontend" ]; then
            if [ -f "logs/frontend.log" ]; then
                tail -f logs/frontend.log
            else
                echo -e "${RED}❌ Frontend log not found${NC}"
                exit 1
            fi
        elif [ "$LOG_TYPE" = "backend" ]; then
            if [ -f "logs/backend.log" ]; then
                tail -f logs/backend.log
            else
                echo -e "${RED}❌ Backend log not found${NC}"
                exit 1
            fi
        else
            # Follow both
            if [ -f "logs/frontend.log" ] && [ -f "logs/backend.log" ]; then
                tail -f logs/frontend.log logs/backend.log
            elif [ -f "logs/frontend.log" ]; then
                echo -e "${YELLOW}⚠️  Backend log not found, showing frontend only${NC}"
                tail -f logs/frontend.log
            elif [ -f "logs/backend.log" ]; then
                echo -e "${YELLOW}⚠️  Frontend log not found, showing backend only${NC}"
                tail -f logs/backend.log
            else
                echo -e "${RED}❌ No log files found${NC}"
                exit 1
            fi
        fi
    else
        echo -e "${BLUE}📋 Last $LINES lines${NC}"
        echo "=========================================="
        echo ""
        
        if [ "$LOG_TYPE" = "frontend" ]; then
            if [ -f "logs/frontend.log" ]; then
                echo -e "${GREEN}Frontend:${NC}"
                tail -n $LINES logs/frontend.log
            else
                echo -e "${RED}❌ Frontend log not found${NC}"
                exit 1
            fi
        elif [ "$LOG_TYPE" = "backend" ]; then
            if [ -f "logs/backend.log" ]; then
                echo -e "${GREEN}Backend:${NC}"
                tail -n $LINES logs/backend.log
            else
                echo -e "${RED}❌ Backend log not found${NC}"
                exit 1
            fi
        else
            # Show both
            if [ -f "logs/frontend.log" ]; then
                echo -e "${GREEN}Frontend (last $LINES lines):${NC}"
                tail -n $LINES logs/frontend.log
                echo ""
            else
                echo -e "${YELLOW}⚠️  Frontend log not found${NC}"
            fi
            
            if [ -f "logs/backend.log" ]; then
                echo -e "${GREEN}Backend (last $LINES lines):${NC}"
                tail -n $LINES logs/backend.log
            else
                echo -e "${YELLOW}⚠️  Backend log not found${NC}"
            fi
        fi
    fi
}

# =============================================================================
# Main Command Router
# =============================================================================

cmd="${1:-}"
shift || true

case "$cmd" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$@"
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
