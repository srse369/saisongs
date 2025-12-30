# Sai Songs

A web-based song presentation system for devotional songs (bhajans) with slideshow presentation, session management, and smart search capabilities.

## Features

- 🎵 **Song Management** - Manage songs with lyrics and translations
- 👤 **Singer & Pitch Tracking** - Track singers and their pitch information
- 📊 **Presentation Mode** - Full-screen slideshow with keyboard navigation
- 📋 **Session Management** - Create and manage song sessions/playlists
- 🔍 **Smart Search** - Natural language search ("sai songs in sanskrit", "fast tempo")
- 🤖 **AI Search** - Optional WebLLM-powered semantic search
- 📈 **Analytics** - Usage tracking and visitor statistics
- 💬 **Feedback System** - Collect and manage user feedback with categorization
- 🔐 **Role-based Access** - Admin, Editor, and Viewer roles

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: Oracle Autonomous Database
- **Search**: Fuse.js (fuzzy) + WebLLM (AI-powered)
- **Deployment**: VPS with PM2 + Nginx

## Quick Start

### Prerequisites

- Node.js 20+
- Oracle Database (or Oracle Autonomous Database Free Tier)
- Oracle Wallet (for cloud database)

### Installation

```bash
# Clone and install
git clone <repository-url>
cd saisongs
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Oracle credentials and passwords
```

### Environment Variables

Create `.env.local` with:

```bash
# Oracle Database
ORACLE_USER=your_username
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_connection_string
ORACLE_WALLET_PASSWORD=your_wallet_password

# Authentication
ADMIN_PASSWORD=your_admin_password
EDITOR_PASSWORD=your_editor_password
VIEWER_PASSWORD=your_viewer_password
```

### Development

```bash
# Start both frontend and backend
npm run dev:all

# Or use the dev script
./deploy/local/dev.sh start
```

Open [http://localhost:5111](http://localhost:5111)

### Production Deployment

```bash
# Deploy to VPS
./deploy/remote/deploy.sh code

# Or use npm
npm run deploy
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed instructions.

## Project Structure

```
├── src/                    # Frontend (React)
│   ├── components/         # UI components
│   ├── contexts/           # React contexts
│   ├── services/           # API clients
│   └── utils/              # Utilities (search, validation)
├── server/                 # Backend (Express)
│   ├── routes/             # API endpoints
│   └── services/           # Database, cache services
├── database/               # SQL schemas
├── deploy/
│   ├── local/              # Local dev scripts
│   └── remote/             # Production deployment
└── docs/                   # Documentation
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run dev:server` | Start backend dev server |
| `npm run dev:all` | Start both frontend and backend |
| `npm run build` | Build frontend for production |
| `npm run build:server` | Build backend for production |
| `npm run deploy` | Deploy to VPS |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |

## Admin Access

Press **Ctrl+Shift+I** (or **Cmd+Shift+I** on Mac) to open the login dialog.

### Roles

| Role | Access |
|------|--------|
| **Admin** | Full access + imports + analytics |
| **Editor** | Manage songs, singers, pitches, sessions |
| **Viewer** | Read-only access to protected data |

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System design and performance
- [Deployment](./docs/DEPLOYMENT.md) - Production deployment guide
- [Features](./docs/FEATURES.md) - Feature documentation
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions

## License

MIT
