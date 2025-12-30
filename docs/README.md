# Sai Songs Documentation

Welcome to Sai Songs! This documentation will help you get started, deploy, and use all features effectively.

## 📚 Documentation Structure

### Core Guides

| Document | Purpose | Audience |
|----------|---------|----------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete deployment guide | Developers, DevOps |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture, performance, database | Developers, Architects |
| [FEATURES.md](./FEATURES.md) | All user-facing features including templates | End Users, Admins |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions | Everyone |

### Additional Resources

| Document | Description |
|----------|-------------|
| [../config/README.md](../config/README.md) | Build configuration (Vite, TypeScript, Tailwind, ESLint) |
| [../database/README.md](../database/README.md) | Database schema and SQL scripts |
| [../deploy/README.md](../deploy/README.md) | Deployment scripts reference |
| [../deploy/local/README.md](../deploy/local/README.md) | Local development setup |
| [../deploy/remote/README.md](../deploy/remote/README.md) | Production VPS deployment |

---

## Quick Start

### Local Development

```bash
# Clone and setup
git clone https://github.com/srse369/saisongs.git
cd saisongs
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Oracle DB credentials

# Start development servers
./deploy/local/dev.sh start
```

### Production Deployment

```bash
./deploy/remote/deploy.sh code
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete instructions.

---

## Common Tasks

### Deployment

```bash
# Full deployment
./deploy/remote/deploy.sh code

# Backend only
./deploy/remote/deploy.sh code --backend-only

# Frontend only
./deploy/remote/deploy.sh code --frontend-only
```

### Monitoring

```bash
# Check status
./deploy/remote/deploy.sh status

# View logs
./deploy/remote/deploy.sh logs 50

# Health check
curl https://YOUR_DOMAIN/api/health
```

### Maintenance

```bash
# Restart backend
./deploy/remote/deploy.sh restart

# View real-time logs
./deploy/remote/deploy.sh logs -f
```

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS |
| **Backend** | Node.js 20+, Express, TypeScript (ES modules) |
| **Database** | Oracle Autonomous Database |
| **Infrastructure** | Ubuntu 22.04, Nginx, PM2, Let's Encrypt SSL |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

---

## Getting Help

| Problem | Solution |
|---------|----------|
| **Deployment fails** | See [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **How does X work?** | See [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **How to use feature Y?** | See [FEATURES.md](./FEATURES.md) |
| **Something's broken** | See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |

**Emergency procedures:**
```bash
# Quick restart
./deploy/remote/deploy.sh restart

# Check what's wrong
./deploy/remote/deploy.sh logs 100
```
