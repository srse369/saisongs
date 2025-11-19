#!/bin/bash

# Server Setup Script for Song Studio
# Run this on your remote server (141.148.149.54) for initial setup
# Usage: bash server-setup.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Song Studio Server Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run this script as root${NC}"
    echo -e "${YELLOW}Run as normal user with sudo privileges${NC}"
    exit 1
fi

# Step 1: Update system packages
echo -e "\n${BLUE}Step 1: Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y

# Step 2: Install Node.js
echo -e "\n${BLUE}Step 2: Installing Node.js 20...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${YELLOW}Node.js already installed: ${NODE_VERSION}${NC}"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
fi

# Step 3: Install PM2
echo -e "\n${BLUE}Step 3: Installing PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 already installed: $(pm2 --version)${NC}"
else
    sudo npm install -g pm2
    pm2 startup
    echo -e "${GREEN}✓ PM2 installed${NC}"
fi

# Step 4: Install Nginx
echo -e "\n${BLUE}Step 4: Installing Nginx...${NC}"
if command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Nginx already installed${NC}"
else
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed and started${NC}"
fi

# Step 5: Install Oracle Instant Client
echo -e "\n${BLUE}Step 5: Installing Oracle Instant Client...${NC}"
if [ -d "/opt/oracle/instantclient_21_11" ]; then
    echo -e "${YELLOW}Oracle Instant Client already installed${NC}"
else
    echo -e "${YELLOW}Downloading Oracle Instant Client...${NC}"
    cd /tmp
    
    # Install dependencies
    sudo apt install -y unzip libaio1
    
    # Download Instant Client (you may need to update these URLs)
    wget -q https://download.oracle.com/otn_software/linux/instantclient/2111000/instantclient-basic-linux.x64-21.11.0.0.0dbru.zip
    wget -q https://download.oracle.com/otn_software/linux/instantclient/2111000/instantclient-sdk-linux.x64-21.11.0.0.0dbru.zip
    
    # Extract
    sudo mkdir -p /opt/oracle
    sudo unzip -q instantclient-basic-linux.x64-21.11.0.0.0dbru.zip -d /opt/oracle
    sudo unzip -q instantclient-sdk-linux.x64-21.11.0.0.0dbru.zip -d /opt/oracle
    
    # Setup environment
    echo 'export LD_LIBRARY_PATH=/opt/oracle/instantclient_21_11:$LD_LIBRARY_PATH' | sudo tee /etc/profile.d/oracle.sh > /dev/null
    source /etc/profile.d/oracle.sh
    
    # Cleanup
    rm -f instantclient-*.zip
    
    echo -e "${GREEN}✓ Oracle Instant Client installed${NC}"
fi

# Step 6: Create application directory
echo -e "\n${BLUE}Step 6: Creating application directories...${NC}"
sudo mkdir -p /var/www/songstudio
sudo mkdir -p /var/www/songstudio/logs
sudo chown -R $USER:$USER /var/www/songstudio
echo -e "${GREEN}✓ Directories created${NC}"

# Step 7: Configure firewall
echo -e "\n${BLUE}Step 7: Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo -e "${GREEN}✓ Firewall configured${NC}"

# Step 8: Configure Nginx
echo -e "\n${BLUE}Step 8: Configuring Nginx...${NC}"
echo -e "${YELLOW}Please copy the nginx.conf file from the repository to:${NC}"
echo -e "${YELLOW}  /etc/nginx/sites-available/songstudio${NC}"
echo -e "${YELLOW}Then run:${NC}"
echo -e "${YELLOW}  sudo ln -s /etc/nginx/sites-available/songstudio /etc/nginx/sites-enabled/${NC}"
echo -e "${YELLOW}  sudo rm -f /etc/nginx/sites-enabled/default${NC}"
echo -e "${YELLOW}  sudo nginx -t${NC}"
echo -e "${YELLOW}  sudo systemctl reload nginx${NC}"

# Step 9: Environment variables
echo -e "\n${BLUE}Step 9: Environment variables...${NC}"
if [ ! -f "/var/www/songstudio/.env" ]; then
    cat > /var/www/songstudio/.env << 'EOF'
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Oracle Database - Update these with your actual values
VITE_ORACLE_USER=your_db_username
VITE_ORACLE_PASSWORD=your_db_password
VITE_ORACLE_CONNECT_STRING=your_connection_string
VITE_ORACLE_WALLET_PASSWORD=your_wallet_password

# Admin Access
ADMIN_PASSWORD=change_this_password

# Database Pool Settings
DB_POOL_MIN=1
DB_POOL_MAX=1
DB_POOL_INCREMENT=0

# URLs - Update with your domain/IP
APP_URL=https://your-domain.com
API_URL=https://your-domain.com/api
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info

# Oracle Instant Client
LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13
EOF
    echo -e "${GREEN}✓ Created .env template at /var/www/songstudio/.env${NC}"
    echo -e "${YELLOW}⚠ Please edit /var/www/songstudio/.env with your actual values${NC}"
else
    echo -e "${YELLOW}.env file already exists${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. Configure Nginx (see Step 8 above)"
echo -e "2. Edit /var/www/songstudio/.env with your database credentials"
echo -e "3. Deploy the application from your local machine using:"
echo -e "   ${YELLOW}./deploy.sh production${NC}"
echo -e "\n${BLUE}Useful Commands:${NC}"
echo -e "  pm2 list                  - View running processes"
echo -e "  pm2 logs songstudio       - View application logs"
echo -e "  pm2 restart songstudio    - Restart application"
echo -e "  sudo systemctl status nginx  - Check nginx status"
echo -e "  sudo nginx -t             - Test nginx configuration"

echo -e "\n${GREEN}Server is ready for deployment!${NC}"

