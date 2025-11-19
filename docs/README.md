# Song Studio Documentation

Welcome to the Song Studio documentation! This guide will help you deploy, configure, troubleshoot, and use Song Studio.

## 📚 Documentation Overview

### [DEPLOYMENT.md](./DEPLOYMENT.md)
**Complete deployment guide for all platforms**

Learn how to deploy Song Studio to:
- Production server (saisongs.org)
- Custom VPS servers
- GitHub Pages (frontend only)

Includes:
- First-time server setup
- Environment configuration
- Deployment scripts
- SSL/HTTPS setup
- Rollback procedures

**Start here if:** You're deploying Song Studio for the first time or setting up a new server.

---

### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Technical architecture and performance optimizations**

Deep dive into:
- System architecture overview
- Server-side caching (99.7% reduction in DB queries)
- API request backoff strategy
- Oracle database optimization
- Frontend architecture
- Performance monitoring

**Start here if:** You want to understand how Song Studio works under the hood or need to optimize performance.

---

### [FEATURES.md](./FEATURES.md)
**User-facing features and functionality**

Complete guide to:
- User roles & permissions (Viewer, Editor, Admin)
- Named sessions (save and reuse session configurations)
- Beaverton import utility (import singer and pitch data)
- Presentation mode
- Song, singer, and pitch management
- Search & filter
- Import/export

**Start here if:** You're a user learning how to use Song Studio features.

---

### [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
**Solutions to common problems**

Fixes for:
- Mobile "Load Failed" errors
- Backend not running
- Oracle database issues (quota, connections, timeouts)
- Deployment failures
- Performance problems
- Frontend issues
- Emergency procedures

**Start here if:** You're experiencing issues with Song Studio and need quick solutions.

---

## Quick Start Guides

### For Developers

**First-time setup:**
```bash
# Clone repository
git clone https://github.com/srse369/songstudio.git
cd songstudio

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run dev          # Frontend (http://localhost:5173)
npm run dev:server   # Backend (http://localhost:3001)
```

**Deploy to production:**
```bash
./deploy/remote/deploy.sh production
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
# SSH into server
ssh ubuntu@saisongs.org

# Check backend status
pm2 status

# View logs
pm2 logs songstudio --lines 50

# Test API
curl http://localhost:3001/api/health
```

**Common maintenance tasks:**
```bash
# Restart backend
pm2 restart songstudio

# Reload nginx
sudo systemctl reload nginx

# View recent logs
pm2 logs songstudio --lines 100

# Monitor resources
pm2 monit
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed procedures.

---

## Documentation Structure

```
docs/
├── README.md              ← You are here
├── DEPLOYMENT.md          ← Deployment guide
├── ARCHITECTURE.md        ← Technical architecture
├── FEATURES.md            ← User features
└── TROUBLESHOOTING.md     ← Problem solutions
```

## Common Tasks

### Deploy Updates
```bash
cd /Users/ssett2/Documents/github.com/srse369/songstudio
./deploy/remote/deploy.sh production
```
See: [DEPLOYMENT.md § Quick Deploy](./DEPLOYMENT.md#quick-deploy)

---

### Fix Mobile "Load Failed" Errors
```bash
echo "VITE_API_URL=/api" > .env.production
npm run build:vps
./deploy/remote/deploy.sh production
```
See: [TROUBLESHOOTING.md § Mobile Load Failed Errors](./TROUBLESHOOTING.md#mobile-load-failed-errors)

---

### Restart Backend
```bash
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```
See: [TROUBLESHOOTING.md § Backend Not Running](./TROUBLESHOOTING.md#backend-not-running)

---

### Check Oracle Database Status
Login to Oracle Cloud Console and check Performance Hub.

See: [TROUBLESHOOTING.md § Oracle Database Issues](./TROUBLESHOOTING.md#oracle-database-issues)

---

### Add New Feature
1. Implement feature in `src/`
2. Update tests
3. Build: `npm run build`
4. Test locally: `npm run preview`
5. Deploy: `./deploy/remote/deploy.sh production`

See: [ARCHITECTURE.md § Frontend Architecture](./ARCHITECTURE.md#frontend-architecture)

---

### Import Data from Beaverton
1. Login as admin (`Ctrl+Shift+I`)
2. Navigate to Home → "Import from Beaverton"
3. Follow import wizard

See: [FEATURES.md § Beaverton Import Utility](./FEATURES.md#beaverton-import-utility)

---

## Getting Help

### Quick Health Check
```bash
# Check if everything is working
curl https://saisongs.org/api/health

# Should return:
# {"status":"ok","timestamp":"2025-11-19T..."}
```

### View Logs
```bash
# Backend logs
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 50'

# Nginx logs
ssh ubuntu@saisongs.org 'sudo tail -50 /var/log/nginx/songstudio_error.log'
```

### Emergency Restart
```bash
ssh ubuntu@saisongs.org
pm2 restart songstudio
sudo systemctl reload nginx
```

### Report Issues

When reporting issues, include:
1. Error messages from logs
2. Steps to reproduce
3. Expected vs actual behavior
4. Browser console errors (F12)

See: [TROUBLESHOOTING.md § Getting Help](./TROUBLESHOOTING.md#getting-help)

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

See: [ARCHITECTURE.md § System Overview](./ARCHITECTURE.md#system-overview)

---

## Important Links

- **Production:** https://saisongs.org
- **Repository:** https://github.com/srse369/songstudio
- **Oracle Cloud:** https://cloud.oracle.com

---

## Contributing

When updating documentation:

1. Keep it concise and actionable
2. Include code examples where helpful
3. Add troubleshooting tips for common issues
4. Update this README if adding new docs

---

## Documentation History

**v1.0** (2025-11-19):
- Consolidated 15 separate docs into 4 comprehensive guides
- Organized by audience: developers, users, admins
- Added quick start guides and common tasks
- Cross-referenced related sections

**Previous structure:**
- 15 separate markdown files
- Redundant deployment guides
- Scattered troubleshooting info
- No clear organization

---

## Questions?

- **Deployment issues?** → [DEPLOYMENT.md](./DEPLOYMENT.md)
- **How does it work?** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- **How do I use X feature?** → [FEATURES.md](./FEATURES.md)
- **Something's broken!** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

