#!/bin/bash

# Server Setup Script for Song Studio - Oracle Linux
# Run this on your remote Oracle Linux server (141.148.149.54) for initial setup
# Usage: bash server-setup-oracle.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Song Studio Server Setup${NC}"
echo -e "${GREEN}  Oracle Linux Edition${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run this script as root${NC}"
    echo -e "${YELLOW}Run as normal user with sudo privileges${NC}"
    exit 1
fi

# Step 1: Update system packages
echo -e "\n${BLUE}Step 1: Updating system packages...${NC}"
sudo dnf update -y

# Step 2: Install essential tools
echo -e "\n${BLUE}Step 2: Installing essential tools...${NC}"
sudo dnf install -y wget curl unzip tar

# Step 3: Install Node.js
echo -e "\n${BLUE}Step 3: Installing Node.js 20...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${YELLOW}Node.js already installed: ${NODE_VERSION}${NC}"
else
    # Install Node.js 20.x using NodeSource
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
fi

# Step 4: Install PM2
echo -e "\n${BLUE}Step 4: Installing PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 already installed: $(pm2 --version)${NC}"
else
    sudo npm install -g pm2
    pm2 startup
    echo -e "${GREEN}✓ PM2 installed${NC}"
    echo -e "${YELLOW}⚠ Run the command above to configure PM2 startup${NC}"
fi

# Step 5: Install Nginx
echo -e "\n${BLUE}Step 5: Installing Nginx...${NC}"
if command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Nginx already installed${NC}"
else
    sudo dnf install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed and started${NC}"
fi

# Step 6: Install Oracle Instant Client
echo -e "\n${BLUE}Step 6: Installing Oracle Instant Client...${NC}"
if [ -d "/opt/oracle/instantclient_21_13" ] || [ -d "/usr/lib/oracle" ]; then
    echo -e "${YELLOW}Oracle Instant Client already installed${NC}"
else
    echo -e "${YELLOW}Installing Oracle Instant Client...${NC}"
    
    # Install dependencies
    sudo dnf install -y libaio
    
    # For Oracle Linux, we can use the oracle-instantclient package from Oracle repo
    sudo dnf install -y oracle-instantclient-release-el9
    sudo dnf install -y oracle-instantclient-basic oracle-instantclient-devel oracle-instantclient-sqlplus
    
    # Find the installed instant client directory
    IC_DIR=$(ls -d /usr/lib/oracle/*/client64/lib 2>/dev/null | head -1)
    
    if [ -n "$IC_DIR" ]; then
        # Setup environment
        echo "export LD_LIBRARY_PATH=${IC_DIR}:\$LD_LIBRARY_PATH" | sudo tee /etc/profile.d/oracle.sh > /dev/null
        source /etc/profile.d/oracle.sh
        echo -e "${GREEN}✓ Oracle Instant Client installed${NC}"
    else
        echo -e "${YELLOW}⚠ Could not find Oracle Instant Client directory. You may need to set LD_LIBRARY_PATH manually.${NC}"
    fi
fi

# Step 7: Create application directory
echo -e "\n${BLUE}Step 7: Creating application directories...${NC}"
sudo mkdir -p /var/www/songstudio
sudo mkdir -p /var/www/songstudio/logs
sudo chown -R $USER:$USER /var/www/songstudio
echo -e "${GREEN}✓ Directories created${NC}"

# Step 8: Configure firewall (firewalld on Oracle Linux)
echo -e "\n${BLUE}Step 8: Configuring firewall...${NC}"
if command -v firewall-cmd &> /dev/null; then
    sudo systemctl start firewalld
    sudo systemctl enable firewalld
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --reload
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ firewalld not found, skipping firewall configuration${NC}"
fi

# Step 9: Configure SELinux for web application
echo -e "\n${BLUE}Step 9: Configuring SELinux...${NC}"
if command -v getenforce &> /dev/null; then
    SELINUX_STATUS=$(getenforce)
    if [ "$SELINUX_STATUS" != "Disabled" ]; then
        echo -e "${YELLOW}SELinux is ${SELINUX_STATUS}. Configuring policies...${NC}"
        
        # Allow nginx to connect to network
        sudo setsebool -P httpd_can_network_connect 1
        
        # Set proper context for application directory
        sudo semanage fcontext -a -t httpd_sys_content_t "/var/www/songstudio(/.*)?"
        sudo restorecon -Rv /var/www/songstudio
        
        echo -e "${GREEN}✓ SELinux configured${NC}"
    else
        echo -e "${YELLOW}SELinux is disabled${NC}"
    fi
fi

# Step 10: Configure Nginx
echo -e "\n${BLUE}Step 10: Configuring Nginx...${NC}"
echo -e "${YELLOW}Please copy the nginx.conf file from the repository to:${NC}"
echo -e "${YELLOW}  /etc/nginx/conf.d/songstudio.conf${NC}"
echo -e "${YELLOW}Then run:${NC}"
echo -e "${YELLOW}  sudo nginx -t${NC}"
echo -e "${YELLOW}  sudo systemctl reload nginx${NC}"

# Step 11: Environment variables
echo -e "\n${BLUE}Step 11: Environment variables...${NC}"
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

# Database Pool Settings (optimized for Oracle Free Tier)
DB_POOL_MIN=1
DB_POOL_MAX=1
DB_POOL_INCREMENT=0

# URLs - Update with your domain/IP
APP_URL=http://141.148.149.54
API_URL=http://141.148.149.54/api
CORS_ORIGIN=http://141.148.149.54

# Logging
LOG_LEVEL=info

# Oracle Instant Client
LD_LIBRARY_PATH=/usr/lib/oracle/21/client64/lib
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
echo -e "1. Copy nginx configuration:"
echo -e "   ${YELLOW}sudo scp -i ~/Downloads/SSH\\ Key\\ Nov\\ 12\\ 2025.key opc@141.148.149.54:/tmp/nginx.conf${NC}"
echo -e "   ${YELLOW}ssh -i ~/Downloads/SSH\\ Key\\ Nov\\ 12\\ 2025.key opc@141.148.149.54${NC}"
echo -e "   ${YELLOW}sudo mv /tmp/nginx.conf /etc/nginx/conf.d/songstudio.conf${NC}"
echo -e "   ${YELLOW}sudo nginx -t && sudo systemctl reload nginx${NC}"
echo -e "2. Edit /var/www/songstudio/.env with your database credentials"
echo -e "3. Deploy the application from your local machine using:"
echo -e "   ${YELLOW}./deploy/remote/deploy.sh production${NC}"
echo -e "\n${BLUE}Useful Commands:${NC}"
echo -e "  pm2 list                  - View running processes"
echo -e "  pm2 logs songstudio       - View application logs"
echo -e "  pm2 restart songstudio    - Restart application"
echo -e "  sudo systemctl status nginx  - Check nginx status"
echo -e "  sudo nginx -t             - Test nginx configuration"
echo -e "  sudo firewall-cmd --list-all  - Check firewall rules"

echo -e "\n${GREEN}Server is ready for deployment!${NC}"

