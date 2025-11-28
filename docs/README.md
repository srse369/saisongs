# Song Studio Documentation

Welcome to the Song Studio documentation! This guide will help you deploy, configure, troubleshoot, and use Song Studio.

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete deployment guide for all platforms |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture and performance optimizations |
| [FEATURES.md](./FEATURES.md) | User-facing features and functionality (includes presentation templates) |
| [TEMPLATE_VISUAL_EDITOR.md](./TEMPLATE_VISUAL_EDITOR.md) | User-friendly visual editor for creating presentation templates |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Solutions to common problems |

---

## Quick Start

### For Developers

```bash
# Clone repository
git clone https://github.com/srse369/songstudio.git
cd songstudio

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development
./deploy/local/dev.sh start
```

### Deploy to Production

```bash
./deploy/remote/deploy.sh code
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

### For Users

**Accessing Song Studio:**
- **Production:** https://saisongs.org
- **Login as admin:** Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)

**Basic usage:**
1. Browse songs, singers, and pitches
2. Add songs to live session
3. Use presentation mode to display songs
4. Save sessions for future use

See [FEATURES.md](./FEATURES.md) for complete feature documentation.

---

### For System Administrators

**Check system health:**
```bash
./deploy/remote/deploy.sh status
./deploy/remote/deploy.sh check
./deploy/remote/deploy.sh logs 50
```

**Common maintenance:**
```bash
./deploy/remote/deploy.sh restart    # Restart backend
./deploy/remote/deploy.sh logs -f    # Follow logs
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed procedures.

---

## Common Tasks

### Deploy Updates
```bash
./deploy/remote/deploy.sh code
./deploy/remote/deploy.sh code --backend-only
./deploy/remote/deploy.sh code --frontend-only
```

### Fix Mobile "Load Failed" Errors
```bash
echo "VITE_API_URL=/api" > .env.production
npm run build:vps
./deploy/remote/deploy.sh code
```

### Restart Backend
```bash
./deploy/remote/deploy.sh restart
```

### Check Oracle Database Status
Login to Oracle Cloud Console and check Performance Hub.

---

## Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite
- TailwindCSS
- Context API for state management

**Backend:**
- Node.js 20+ + Express
- TypeScript with ES modules
- Oracle Autonomous Database

**Infrastructure:**
- Ubuntu 22.04 LTS
- Nginx reverse proxy
- PM2 process manager
- Let's Encrypt SSL

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

---

## Important Links

- **Production:** https://saisongs.org
- **Repository:** https://github.com/srse369/songstudio
- **Oracle Cloud:** https://cloud.oracle.com

---

## Getting Help

**Quick Health Check:**
```bash
curl https://saisongs.org/api/health
```

**View Logs:**
```bash
./deploy/remote/deploy.sh logs 50
```

**Emergency Restart:**
```bash
./deploy/remote/deploy.sh restart
```

---

## Questions?

- **Deployment issues?** → [DEPLOYMENT.md](./DEPLOYMENT.md)
- **How does it work?** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- **How do I use X feature?** → [FEATURES.md](./FEATURES.md)
- **Something's broken!** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
