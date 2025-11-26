#!/bin/bash

# Song Studio - Server Setup CLI
# Single script for server-side setup operations
# Run this ON the remote server, not locally
#
# Usage: ./setup.sh <command> [options]
#
# Commands:
#   ubuntu    Initial setup for Ubuntu/Debian servers
#   oracle    Initial setup for Oracle Linux servers
#   ssl       Configure SSL with Let's Encrypt

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================

usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  ubuntu              Initial setup for Ubuntu/Debian servers"
    echo "  oracle              Initial setup for Oracle Linux servers"
    echo "  ssl <domain>        Configure SSL with Let's Encrypt"
    echo ""
    echo "Examples:"
    echo "  $0 ubuntu"
    echo "  $0 oracle"
    echo "  $0 ssl example.com"
    echo "  $0 ssl example.com admin@example.com"
    echo ""
    echo "NOTE: Run this script ON the remote server, not locally."
}

check_not_root() {
    if [ "$EUID" -eq 0 ]; then 
        echo -e "${RED}Please do not run this script as root${NC}"
        echo -e "${YELLOW}Run as normal user with sudo privileges${NC}"
        exit 1
    fi
}

create_env_template() {
    local APP_PATH="$1"
    local IP_OR_DOMAIN="$2"
    local IC_PATH="$3"

    if [ ! -f "$APP_PATH/.env" ]; then
        cat > "$APP_PATH/.env" << EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Oracle Database - Update these with your actual values
ORACLE_USER=your_db_username
ORACLE_PASSWORD=your_db_password
ORACLE_CONNECT_STRING=your_connection_string
ORACLE_WALLET_PASSWORD=your_wallet_password

# Admin Access
ADMIN_PASSWORD=change_this_password

# Database Pool Settings
DB_POOL_MIN=1
DB_POOL_MAX=1
DB_POOL_INCREMENT=0

# URLs - Update with your domain/IP
APP_URL=https://${IP_OR_DOMAIN}
API_URL=https://${IP_OR_DOMAIN}/api
CORS_ORIGIN=https://${IP_OR_DOMAIN}

# Logging
LOG_LEVEL=info

# Oracle Instant Client
LD_LIBRARY_PATH=${IC_PATH}
EOF
        echo -e "${GREEN}✓ Created .env template at $APP_PATH/.env${NC}"
        echo -e "${YELLOW}⚠ Please edit $APP_PATH/.env with your actual values${NC}"
    else
        echo -e "${YELLOW}.env file already exists${NC}"
    fi
}

# =============================================================================
# UBUNTU Setup Command
# =============================================================================

cmd_ubuntu() {
    check_not_root

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Song Studio Server Setup${NC}"
    echo -e "${GREEN}  Ubuntu/Debian Edition${NC}"
    echo -e "${GREEN}========================================${NC}"

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
        
        sudo apt install -y unzip libaio1
        
        wget -q https://download.oracle.com/otn_software/linux/instantclient/2111000/instantclient-basic-linux.x64-21.11.0.0.0dbru.zip
        wget -q https://download.oracle.com/otn_software/linux/instantclient/2111000/instantclient-sdk-linux.x64-21.11.0.0.0dbru.zip
        
        sudo mkdir -p /opt/oracle
        sudo unzip -q instantclient-basic-linux.x64-21.11.0.0.0dbru.zip -d /opt/oracle
        sudo unzip -q instantclient-sdk-linux.x64-21.11.0.0.0dbru.zip -d /opt/oracle
        
        echo 'export LD_LIBRARY_PATH=/opt/oracle/instantclient_21_11:$LD_LIBRARY_PATH' | sudo tee /etc/profile.d/oracle.sh > /dev/null
        source /etc/profile.d/oracle.sh
        
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
    create_env_template "/var/www/songstudio" "your-domain.com" "/opt/oracle/instantclient_21_11"

    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"

    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "1. Configure Nginx (see Step 8 above)"
    echo -e "2. Edit /var/www/songstudio/.env with your database credentials"
    echo -e "3. Deploy the application from your local machine"
    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo -e "  pm2 list                  - View running processes"
    echo -e "  pm2 logs songstudio       - View application logs"
    echo -e "  pm2 restart songstudio    - Restart application"
    echo -e "  sudo systemctl status nginx  - Check nginx status"
    echo -e "  sudo nginx -t             - Test nginx configuration"

    echo -e "\n${GREEN}Server is ready for deployment!${NC}"
}

# =============================================================================
# ORACLE Linux Setup Command
# =============================================================================

cmd_oracle() {
    check_not_root

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Song Studio Server Setup${NC}"
    echo -e "${GREEN}  Oracle Linux Edition${NC}"
    echo -e "${GREEN}========================================${NC}"

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
    IC_PATH="/usr/lib/oracle/21/client64/lib"
    if [ -d "/opt/oracle/instantclient_21_13" ] || [ -d "/usr/lib/oracle" ]; then
        echo -e "${YELLOW}Oracle Instant Client already installed${NC}"
    else
        echo -e "${YELLOW}Installing Oracle Instant Client...${NC}"
        
        sudo dnf install -y libaio
        sudo dnf install -y oracle-instantclient-release-el9
        sudo dnf install -y oracle-instantclient-basic oracle-instantclient-devel oracle-instantclient-sqlplus
        
        IC_DIR=$(ls -d /usr/lib/oracle/*/client64/lib 2>/dev/null | head -1)
        
        if [ -n "$IC_DIR" ]; then
            IC_PATH="$IC_DIR"
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

    # Step 9: Configure SELinux
    echo -e "\n${BLUE}Step 9: Configuring SELinux...${NC}"
    if command -v getenforce &> /dev/null; then
        SELINUX_STATUS=$(getenforce)
        if [ "$SELINUX_STATUS" != "Disabled" ]; then
            echo -e "${YELLOW}SELinux is ${SELINUX_STATUS}. Configuring policies...${NC}"
            
            sudo setsebool -P httpd_can_network_connect 1
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
    create_env_template "/var/www/songstudio" "your-domain.com" "$IC_PATH"

    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"

    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "1. Configure Nginx (see Step 10 above)"
    echo -e "2. Edit /var/www/songstudio/.env with your database credentials"
    echo -e "3. Deploy the application from your local machine"
    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo -e "  pm2 list                  - View running processes"
    echo -e "  pm2 logs songstudio       - View application logs"
    echo -e "  pm2 restart songstudio    - Restart application"
    echo -e "  sudo systemctl status nginx  - Check nginx status"
    echo -e "  sudo nginx -t             - Test nginx configuration"
    echo -e "  sudo firewall-cmd --list-all  - Check firewall rules"

    echo -e "\n${GREEN}Server is ready for deployment!${NC}"
}

# =============================================================================
# SSL Setup Command
# =============================================================================

cmd_ssl() {
    if [ -z "$1" ]; then
        echo "Usage: $0 ssl <domain-name> [email]"
        echo "Example: $0 ssl songstudio.example.com"
        exit 1
    fi

    DOMAIN=$1
    EMAIL=${2:-"admin@${DOMAIN}"}

    echo "🔒 Setting up SSL certificate for: $DOMAIN"
    echo "📧 Admin email: $EMAIL"
    echo ""

    # Install certbot and nginx plugin
    echo "📦 Installing Certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx

    # Stop nginx temporarily
    echo "⏸️  Stopping Nginx..."
    sudo systemctl stop nginx

    # Obtain certificate
    echo "🔐 Obtaining SSL certificate from Let's Encrypt..."
    sudo certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"

    # Update Nginx configuration
    echo "⚙️  Updating Nginx configuration..."
    sudo tee /etc/nginx/sites-available/songstudio > /dev/null <<EOF
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Root directory for static files
    root /var/www/songstudio/dist;
    index index.html;

    # Serve static files with caching
    location / {
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        }
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
}
EOF

    # Test nginx configuration
    echo "🧪 Testing Nginx configuration..."
    sudo nginx -t

    # Start nginx
    echo "🚀 Starting Nginx..."
    sudo systemctl start nginx
    sudo systemctl enable nginx

    # Setup auto-renewal
    echo "🔄 Setting up automatic certificate renewal..."
    sudo systemctl enable certbot.timer
    sudo systemctl start certbot.timer

    echo ""
    echo -e "${GREEN}✅ SSL Certificate installed successfully!${NC}"
    echo ""
    echo "🌐 Your site is now available at:"
    echo "   https://$DOMAIN"
    echo ""
    echo "📋 Certificate Details:"
    sudo certbot certificates
    echo ""
    echo "🔄 Certificate will auto-renew before expiry"
    echo "   You can test renewal with: sudo certbot renew --dry-run"
}

# =============================================================================
# Main Command Router
# =============================================================================

cmd="${1:-}"
shift || true

case "$cmd" in
    ubuntu)
        cmd_ubuntu
        ;;
    oracle)
        cmd_oracle
        ;;
    ssl)
        cmd_ssl "$@"
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

