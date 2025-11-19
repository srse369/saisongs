#!/bin/bash

# Song Studio - Local Development Startup Script
# Starts both frontend and backend servers locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Song Studio (Local Development)${NC}"
echo "=========================================="

# Get the project root directory (2 levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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
echo "   ./deploy/local/stop.sh"
echo ""
echo -e "${BLUE}📊 Check status:${NC}"
echo "   ./deploy/local/status.sh"
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

