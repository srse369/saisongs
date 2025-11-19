#!/bin/bash
# =============================================================================
# Central Configuration for Remote Deployment Scripts
# =============================================================================
# This file is sourced by all deployment scripts to provide:
# - Centralized server configuration
# - SSH connection settings
# - Helper functions for SSH/SCP operations
# - Color output variables
#
# Usage in scripts:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/config.sh"
#
# Configuration Sources (in priority order):
#   1. Environment variables (highest priority)
#   2. .env.production (recommended for deployment config)
#   3. .env.local (local development overrides)
#   4. Default values (lowest priority)
#
# Add to .env.production in the project root:
#   REMOTE_USER=your-ssh-user
#   REMOTE_HOST=your-server.com
#   REMOTE_IP=your-server-ip
#   REMOTE_PATH=/path/to/app
#   SSH_KEY=~/.ssh/your-key.pem
# =============================================================================

# Find project root (go up two directories from this script)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source .env files if they exist (in order of precedence)
# Later files override earlier ones
for env_file in ".env.local" ".env.production"; do
    if [ -f "$PROJECT_ROOT/$env_file" ]; then
        # Source the file, but only export variables we care about
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ $key =~ ^#.*$ ]] && continue
            [[ -z $key ]] && continue
            
            # Only load deployment-related variables
            case $key in
                REMOTE_USER|REMOTE_HOST|REMOTE_IP|REMOTE_PATH|SSH_KEY)
                    # Remove quotes from value if present
                    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                    export "$key"="$value"
                    ;;
            esac
        done < "$PROJECT_ROOT/$env_file"
    fi
done

# Server Configuration
# Use values from .env files (no defaults - must be set in .env.production or env vars)
export REMOTE_USER="${REMOTE_USER:-}"
export REMOTE_HOST="${REMOTE_HOST:-}"
export REMOTE_IP="${REMOTE_IP:-}"
export REMOTE_PATH="${REMOTE_PATH:-}"

# SSH Configuration
export SSH_KEY="${SSH_KEY:-}"
export SSH_OPTS=""

if [ -n "$SSH_KEY" ]; then
    # Expand tilde and resolve full path
    SSH_KEY_PATH=$(eval echo "$SSH_KEY")
    
    if [ -f "$SSH_KEY_PATH" ]; then
        SSH_OPTS="-i \"$SSH_KEY_PATH\""
    fi
fi

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Helper function to execute SSH commands
ssh_exec() {
    eval ssh $SSH_OPTS "${REMOTE_USER}@${REMOTE_HOST}" "$@"
}

# Helper function to copy files via SCP
scp_copy() {
    eval scp $SSH_OPTS "$@" "${REMOTE_USER}@${REMOTE_HOST}:"
}
