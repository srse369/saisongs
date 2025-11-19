#!/bin/bash
# Quick restart script for Song Studio backend
# Usage: ssh ubuntu@129.153.85.24 'bash -s' < restart-server.sh

echo "🔄 Restarting Song Studio backend..."
cd /var/www/songstudio

# Check if PM2 process exists
if pm2 list | grep -q "songstudio"; then
    echo "Restarting existing process..."
    pm2 restart songstudio --env production
else
    echo "Starting new process..."
    pm2 start ecosystem.config.js --env production
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

