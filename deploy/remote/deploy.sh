#!/bin/bash

# Deploy Song Studio to Remote Server
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e  # Exit on error

# Configuration
REMOTE_HOST="129.153.85.24"
REMOTE_USER="ubuntu"
REMOTE_PATH="/var/www/songstudio"
ENVIRONMENT="${1:-production}"
SSH_KEY="${HOME}/Downloads/SSH Key Nov 12 2025.key"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Song Studio Deployment Script${NC}"
echo -e "${GREEN}  Target: ${REMOTE_HOST}${NC}"
echo -e "${GREEN}  Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}Error: SSH key not found at: $SSH_KEY${NC}"
    echo -e "${YELLOW}Please ensure the SSH key exists at this location.${NC}"
    exit 1
fi

# Set proper permissions on SSH key
chmod 600 "$SSH_KEY"

# Step 1: Build the application locally
echo -e "\n${GREEN}Step 1: Building application...${NC}"
npm run build:vps
npm run build:server

# Step 2: Create deployment package
echo -e "\n${GREEN}Step 2: Creating deployment package...${NC}"
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/songstudio"

# Copy necessary files
cp -r dist "$TEMP_DIR/songstudio/"
cp package.json "$TEMP_DIR/songstudio/"
cp package-lock.json "$TEMP_DIR/songstudio/"
cp deploy/remote/ecosystem.config.cjs "$TEMP_DIR/songstudio/" 2>/dev/null || echo "No ecosystem.config.cjs found"
cp .env.production "$TEMP_DIR/songstudio/.env" 2>/dev/null || echo "No .env.production found"

# Create tarball
cd "$TEMP_DIR"
tar -czf songstudio.tar.gz songstudio/
cd - > /dev/null

# Step 3: Transfer to remote server
echo -e "\n${GREEN}Step 3: Transferring files to remote server...${NC}"
scp -i "$SSH_KEY" "$TEMP_DIR/songstudio.tar.gz" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/"

# Step 4: Deploy on remote server
echo -e "\n${GREEN}Step 4: Deploying on remote server...${NC}"
ssh -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" << 'ENDSSH'
set -e

echo "Extracting deployment package..."
cd /tmp
tar -xzf songstudio.tar.gz

echo "Creating backup of current deployment..."
if [ -d "/var/www/songstudio" ]; then
    sudo cp -r /var/www/songstudio "/var/www/songstudio.backup.$(date +%Y%m%d_%H%M%S)"
fi

echo "Installing application..."
sudo mkdir -p /var/www/songstudio
sudo cp -r /tmp/songstudio/* /var/www/songstudio/
sudo chown -R $USER:$USER /var/www/songstudio

echo "Installing dependencies..."
cd /var/www/songstudio
npm ci --only=production

echo "Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production
else
    echo "PM2 not found. Starting with node..."
    nohup node dist/server/index.js > /var/www/songstudio/logs/app.log 2>&1 &
fi

echo "Cleaning up..."
rm -rf /tmp/songstudio /tmp/songstudio.tar.gz

echo "Deployment complete!"
ENDSSH

# Cleanup local temp files
rm -rf "$TEMP_DIR"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}  Application URL: http://${REMOTE_HOST}${NC}"
echo -e "${GREEN}========================================${NC}"

# Step 5: Health check
echo -e "\n${GREEN}Step 5: Performing health check...${NC}"
sleep 5
if curl -f "http://${REMOTE_HOST}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed!${NC}"
else
    echo -e "${RED}✗ Health check failed. Please check the logs.${NC}"
    echo -e "${YELLOW}SSH into server: ssh ${REMOTE_USER}@${REMOTE_HOST}${NC}"
    echo -e "${YELLOW}Check logs: pm2 logs songstudio${NC}"
fi

