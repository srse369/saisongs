#!/bin/bash

# Song Studio - View Logs Script
# Displays logs from frontend and backend servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Parse arguments
LINES=50
FOLLOW=false

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
        *)
            echo "Usage: $0 [frontend|backend] [-f|--follow] [-n|--lines N]"
            echo ""
            echo "Options:"
            echo "  frontend, fe       Show only frontend logs"
            echo "  backend, be        Show only backend logs"
            echo "  -f, --follow       Follow logs in real-time"
            echo "  -n, --lines N      Show last N lines (default: 50)"
            echo ""
            echo "Examples:"
            echo "  $0                      # Show last 50 lines from both"
            echo "  $0 -f                   # Follow both logs"
            echo "  $0 frontend -f          # Follow frontend only"
            echo "  $0 backend -n 100       # Show last 100 backend lines"
            exit 1
            ;;
    esac
done

# Check if logs exist
if [ ! -d "logs" ]; then
    echo -e "${RED}❌ No logs directory found${NC}"
    echo "   Have you started the services? Run: ./deploy/local/start.sh"
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

