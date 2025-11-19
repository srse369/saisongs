#!/bin/bash
# Quick restart script for Song Studio backend
# Usage: ./restart-server.sh
# Or with SSH key: SSH_KEY=~/.ssh/my-key ./restart-server.sh

# Source shared configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Check required configuration
if [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_HOST" ]; then
    echo "❌ Error: REMOTE_USER and REMOTE_HOST must be set"
    echo "   Set them as environment variables or in config.sh"
    exit 1
fi

echo "🔄 Restarting Song Studio backend..."

ssh_exec << ENDSSH
cd ${REMOTE_PATH}

# Check if PM2 process exists
if pm2 list | grep -q "songstudio"; then
    echo "Restarting existing process..."
    pm2 restart songstudio --env production
else
    echo "Starting new process..."
    pm2 start ecosystem.config.cjs --env production
fi

# Wait for service to start
sleep 3

# Test the API
echo ""
echo "Testing API..."
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is running!"
    curl -s http://localhost:3001/api/health | jq .
else
    echo "❌ Backend failed to start. Check logs:"
    echo "   pm2 logs songstudio --lines 50"
fi

# Save PM2 configuration
pm2 save
echo ""
echo "Done! PM2 configuration saved."
ENDSSH
