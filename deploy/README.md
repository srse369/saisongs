# Song Studio Deployment

## Quick Commands

### Production
```bash
# First time: Add deployment config to .env.production
# Add: REMOTE_USER, REMOTE_HOST, REMOTE_PATH, SSH_KEY
nano .env.production

# Deploy
./remote/deploy.sh              # Deploy everything
./remote/deploy.sh --backend-only    # Backend only

# Manage
./remote/check-server.sh        # Health check
./remote/restart-server.sh      # Restart
```

### Local Development
```bash
./local/start.sh    # Start
./local/status.sh   # Status
./local/logs.sh -f  # Logs
./local/stop.sh     # Stop
```

---

## Configuration

Deployment scripts load settings from `.env.production` or `.env.local` in the project root:

```bash
# Add to .env.production
REMOTE_USER=your-user
REMOTE_HOST=your-server.com
REMOTE_PATH=/path/to/app
SSH_KEY=~/.ssh/your-key.pem

# Or use environment variables for one-time deployments
REMOTE_HOST=example.com REMOTE_USER=user ./remote/deploy.sh
```

**Required Variables:** `REMOTE_USER`, `REMOTE_HOST`, `REMOTE_PATH`  
**Optional:** `SSH_KEY`, `REMOTE_IP`

---

## Documentation

| Guide | What's Inside |
|-------|---------------|
| [DEPLOYMENT.md](../docs/DEPLOYMENT.md) | Full deployment guide |
| [remote/README.md](./remote/README.md) | Production scripts docs |
| [local/README.md](./local/README.md) | Local dev scripts docs |
| [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) | Fix common issues |

---

## Structure

```
deploy/
├── local/      # Local development (start.sh, stop.sh, status.sh)
└── remote/     # Production deployment (deploy.sh, check-server.sh)
```

---

That's it! Check the linked docs for details.
