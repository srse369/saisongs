#!/bin/bash

# Song Studio - Local Development Restart Script
# Stops and restarts both frontend and backend servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Restarting Song Studio (Local Development)${NC}"
echo "=========================================="

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Stop services
echo -e "${YELLOW}Stopping services...${NC}"
"$SCRIPT_DIR/stop.sh"

echo ""
echo -e "${YELLOW}Waiting 2 seconds...${NC}"
sleep 2

# Start services
echo ""
echo -e "${YELLOW}Starting services...${NC}"
"$SCRIPT_DIR/start.sh"

