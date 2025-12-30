# Local Development Scripts

Single script for managing Sai Songs in local development mode.

## Quick Start

```bash
# Start all services (frontend + backend)
./deploy/local/dev.sh start

# Check status
./deploy/local/dev.sh status

# View logs
./deploy/local/dev.sh logs -f

# Stop all services
./deploy/local/dev.sh stop
```

## Usage

```bash
./deploy/local/dev.sh <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `start` | Start frontend and backend servers |
| `stop` | Stop all services |
| `restart` | Restart all services |
| `status` | Show service status |
| `logs` | View logs (with options) |

### Log Options

| Option | Description |
|--------|-------------|
| `frontend`, `fe` | Show only frontend logs |
| `backend`, `be` | Show only backend logs |
| `-f`, `--follow` | Follow logs in real-time |
| `-n`, `--lines N` | Show last N lines (default: 50) |

---

## Command Details

### `start`

Starts both frontend and backend servers in the background.

**What it does:**
- Checks for `.env.local` (creates from `.env.example` if missing)
- Installs dependencies if needed
- Starts backend on port 3111
- Starts frontend on port 5111
- Saves PIDs to `logs/frontend.pid` and `logs/backend.pid`
- Offers to show live logs

**Example output:**
```
🚀 Starting Sai Songs (Local Development)
==========================================
🔧 Starting Backend Server...
   Port: 3111
   Logs: logs/backend.log
✅ Backend started (PID: 12345)

🎨 Starting Frontend Server...
   Port: 5111
   Logs: logs/frontend.log
✅ Frontend started (PID: 12346)

========================================
✅ Sai Songs is running!
========================================

🌐 URLs:
   Frontend: http://localhost:5111
   Backend:  http://localhost:3111
   API:      http://localhost:3111/api
```

---

### `stop`

Stops all running services.

**What it does:**
- Reads PIDs from log files
- Gracefully stops frontend and backend
- Force kills if graceful shutdown fails
- Cleans up PID files
- Also finds processes by port if PID files are missing

**Example output:**
```
🛑 Stopping Sai Songs (Local Development)
==========================================
🎨 Stopping Frontend (PID: 12346)...
✅ Frontend stopped
🔧 Stopping Backend (PID: 12345)...
✅ Backend stopped

========================================
✅ Stopped 2 service(s)
========================================
```

---

### `status`

Shows the current status of all services.

**What it does:**
- Checks if frontend is running (port 5111)
- Checks if backend is running (port 3111)
- Tests API health endpoint
- Tests database connection
- Shows memory usage
- Shows log file information

**Example output:**
```
📊 Sai Songs Status (Local Development)
==========================================

🎨 Frontend (Port 5111):
   Status: ● Running
   PID: 12346
   URL: http://localhost:5111
   Memory: 245.3 MB

🔧 Backend (Port 3111):
   Status: ● Running
   PID: 12345
   URL: http://localhost:3111
   API: http://localhost:3111/api
   Memory: 156.7 MB
   Health: ✓ API responding

🗄️  Database:
   Connection: ✓ Connected

📝 Logs:
   Frontend: logs/frontend.log (2.1M, 4523 lines)
   Backend:  logs/backend.log (1.8M, 3891 lines)

========================================
✅ All services running
========================================
```

---

### `restart`

Stops and restarts all services.

**When to use:**
- After making changes to backend code
- After updating dependencies
- To clear any issues with stuck processes

---

### `logs`

View logs from frontend and/or backend.

**Examples:**
```bash
# Show last 50 lines from both logs
./deploy/local/dev.sh logs

# Follow logs in real-time
./deploy/local/dev.sh logs -f

# Follow only frontend logs
./deploy/local/dev.sh logs frontend -f

# Show last 100 lines from backend
./deploy/local/dev.sh logs backend -n 100

# Aliases work too
./deploy/local/dev.sh logs fe -f        # frontend
./deploy/local/dev.sh logs be -f        # backend
```

---

## Typical Workflow

### Starting Your Day

```bash
# Check if anything is running
./deploy/local/dev.sh status

# Start services
./deploy/local/dev.sh start

# Open browser to http://localhost:5111
```

### During Development

```bash
# Check if everything is still running
./deploy/local/dev.sh status

# View recent logs
./deploy/local/dev.sh logs

# Follow logs while developing
./deploy/local/dev.sh logs -f

# Check backend errors
./deploy/local/dev.sh logs backend -n 50
```

### After Making Changes

```bash
# Frontend changes auto-reload (Vite HMR)
# No action needed!

# Backend changes require restart
./deploy/local/dev.sh restart
```

### Ending Your Day

```bash
# Stop everything
./deploy/local/dev.sh stop

# Verify stopped
./deploy/local/dev.sh status
```

---

## Troubleshooting

### Services Won't Start

**Check if ports are in use:**
```bash
# Check port 5111 (frontend)
lsof -i :5111

# Check port 3111 (backend)
lsof -i :3111

# Kill if needed
kill $(lsof -ti:5111)
kill $(lsof -ti:3111)
```

**Check logs for errors:**
```bash
./deploy/local/dev.sh logs backend -n 100
./deploy/local/dev.sh logs frontend -n 100
```

**Common issues:**
- Missing `.env.local` - Script will create it
- Missing `node_modules` - Script will install
- Oracle connection issues - Check credentials in `.env.local`
- Port already in use - Script will offer to kill and restart

### Backend API Not Responding

```bash
# Check if backend is running
./deploy/local/dev.sh status

# Check backend logs
./deploy/local/dev.sh logs backend -n 50

# Test API directly
curl http://localhost:3111/api/health

# Restart backend
./deploy/local/dev.sh restart
```

### Frontend Not Loading

```bash
# Check if frontend is running
./deploy/local/dev.sh status

# Check frontend logs
./deploy/local/dev.sh logs frontend -n 50

# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

# Restart frontend
./deploy/local/dev.sh restart
```

### PID Mismatch Note

You may see a note like: `ℹ️ Note: Child process PID differs from parent (npm wrapper)`

This is **normal behavior** and not a problem! When you run `npm run dev`, npm spawns a child process (vite or tsx). The saved PID is for the npm wrapper, but the actual server runs as a child with a different PID. The services are working correctly.

### Stale PID Files

If services won't start due to PID file conflicts:

```bash
# Manual cleanup
rm -f logs/frontend.pid logs/backend.pid

# Try starting again
./deploy/local/dev.sh start
```

### Script Not Executable

```bash
chmod +x deploy/local/dev.sh
```

---

## File Locations

### Generated Files

```
logs/
├── frontend.pid       # Frontend process ID
├── backend.pid        # Backend process ID
├── frontend.log       # Frontend logs
└── backend.log        # Backend logs
```

**Note:** The `logs/` directory is in `.gitignore` and won't be committed.

### Environment Files

```
.env.local            # Local development environment variables
.env.example          # Template for .env.local
```

---

## Environment Variables

The start command checks for `.env.local` and creates it from `.env.example` if missing.

**Required variables:**
```bash
# Oracle Database
ORACLE_USER=your_username
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_connection_string
ORACLE_WALLET_PASSWORD=your_wallet_password

# Admin Password
VITE_ADMIN_PASSWORD=AdminPassword
VITE_EDITOR_PASSWORD=EditorPassword

# API URL (for local development)
VITE_API_URL=http://localhost:3111/api
```

---

## Advanced Usage

### Run Services in Foreground

If you prefer to see logs directly (not in background):

```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Start frontend
npm run dev
```

### Custom Ports

If you need to use different ports, update `package.json`:

```json
{
  "scripts": {
    "dev": "vite --port 5111",
    "dev:server": "tsx watch --tsconfig config/tsconfig.server.json server/index.ts"
  }
}
```

And update your `.env.local`:
```bash
PORT=3111  # Backend port
```

### Clean Logs

```bash
# Clear all logs
rm -f logs/*.log

# Or start fresh
./deploy/local/dev.sh stop
rm -rf logs/
./deploy/local/dev.sh start
```

---

## Integration with IDE

### VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Sai Songs",
      "type": "shell",
      "command": "./deploy/local/dev.sh start",
      "problemMatcher": []
    },
    {
      "label": "Stop Sai Songs",
      "type": "shell",
      "command": "./deploy/local/dev.sh stop",
      "problemMatcher": []
    },
    {
      "label": "Sai Songs Status",
      "type": "shell",
      "command": "./deploy/local/dev.sh status",
      "problemMatcher": []
    }
  ]
}
```

### npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "local:start": "./deploy/local/dev.sh start",
    "local:stop": "./deploy/local/dev.sh stop",
    "local:restart": "./deploy/local/dev.sh restart",
    "local:status": "./deploy/local/dev.sh status",
    "local:logs": "./deploy/local/dev.sh logs"
  }
}
```

Then use:
```bash
npm run local:start
npm run local:status
npm run local:logs
```

---

## Comparison: Local vs Production

| Feature | Local Development | Production |
|---------|------------------|------------|
| Frontend | Vite dev server (HMR) | Nginx serving built files |
| Backend | tsx watch (auto-reload) | PM2 (process manager) |
| Port | 5111 (frontend), 3111 (backend) | 443 (HTTPS), 80 (HTTP) |
| Logs | `logs/` directory | PM2 logs, nginx logs |
| Process Management | Single bash script | PM2 |
| Database | Same Oracle DB | Same Oracle DB |
| Hot Reload | ✅ Frontend, ❌ Backend | ❌ Both |
| Auto Start on Boot | ❌ | ✅ PM2 |

---

## See Also

- [Production Deployment](../../docs/DEPLOYMENT.md)
- [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)
- [Architecture](../../docs/ARCHITECTURE.md)

---

## Questions?

If you encounter issues:
1. Check `./deploy/local/dev.sh status`
2. View logs with `./deploy/local/dev.sh logs -f`
3. Try `./deploy/local/dev.sh restart`
4. Check [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md)
