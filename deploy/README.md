# Deployment Configuration

Deployment files for Song Studio.

## Structure

```
deploy/
├── local/
│   └── .env.local.template       # Local development environment
└── remote/
    ├── deploy.sh                 # VPS deployment script
    ├── server-setup.sh           # Server initialization
    ├── ecosystem.config.js       # PM2 configuration
    ├── nginx.conf                # Nginx configuration
    └── .env.production.template  # Production environment
```

## Usage

**Local Development:**
```bash
cp deploy/local/.env.local.template .env.local
# Edit .env.local with your credentials
npm run dev:all
```

**VPS Deployment:**
```bash
# One-time: Run deploy/remote/server-setup.sh on server
./deploy/remote/deploy.sh production
```

**GitHub Pages:**
```bash
npm run deploy
```

See [docs/DEPLOYMENT_VPS.md](../docs/DEPLOYMENT_VPS.md) for detailed VPS deployment guide.
