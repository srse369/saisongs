# Local Development Scripts

Scripts for managing Song Studio in local development mode.

## Quick Start

```bash
# Start all services (frontend + backend)
./deploy/local/start.sh

# Check status
./deploy/local/status.sh

# View logs
./deploy/local/logs.sh -f

# Stop all services
./deploy/local/stop.sh
```

## Scripts

### `start.sh`
Starts both frontend and backend servers in the background.

**What it does:**
- Checks for `.env.local` (creates from `.env.example` if missing)
- Installs dependencies if needed
- Starts backend on port 3001
- Starts frontend on port 5173
- Saves PIDs to `logs/frontend.pid` and `logs/backend.pid`
- Offers to show live logs

**Usage:**
```bash
./deploy/local/start.sh
```

**Output:**
```
🚀 Starting Song Studio (Local Development)
==========================================
🔧 Starting Backend Server...
   Port: 3001
   Logs: logs/backend.log
✅ Backend started (PID: 12345)

🎨 Starting Frontend Server...
   Port: 5173
   Logs: logs/frontend.log
✅ Frontend started (PID: 12346)

========================================
✅ Song Studio is running!
========================================

🌐 URLs:
   Frontend: http://localhost:5173
   Backend:  http://localhost:3001
   API:      http://localhost:3001/api
```

**Features:**
- Detects if services are already running
- Offers to kill and restart existing services
- Creates log files automatically
- Handles errors gracefully
- Optional live log viewing

---

### `stop.sh`
Stops all running services.

**What it does:**
- Reads PIDs from log files
- Gracefully stops frontend and backend
- Force kills if graceful shutdown fails
- Cleans up PID files
- Also finds processes by port if PID files are missing

**Usage:**
```bash
./deploy/local/stop.sh
```

**Output:**
```
🛑 Stopping Song Studio (Local Development)
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

### `status.sh`
Shows the current status of all services.

**What it does:**
- Checks if frontend is running (port 5173)
- Checks if backend is running (port 3001)
- Tests API health endpoint
- Tests database connection
- Shows memory usage
- Shows log file information

**Usage:**
```bash
./deploy/local/status.sh
```

**Output:**
```
📊 Song Studio Status (Local Development)
==========================================

🎨 Frontend (Port 5173):
   Status: ● Running
   PID: 12346
   URL: http://localhost:5173
   Memory: 245.3 MB

🔧 Backend (Port 3001):
   Status: ● Running
   PID: 12345
   URL: http://localhost:3001
   API: http://localhost:3001/api
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

### `restart.sh`
Stops and restarts all services.

**What it does:**
- Calls `stop.sh` to stop services
- Waits 2 seconds
- Calls `start.sh` to restart services

**Usage:**
```bash
./deploy/local/restart.sh
```

**When to use:**
- After making changes to backend code
- After updating dependencies
- To clear any issues with stuck processes

---

### `logs.sh`
View logs from frontend and/or backend.

**Usage:**
```bash
# Show last 50 lines from both logs
./deploy/local/logs.sh

# Follow logs in real-time
./deploy/local/logs.sh -f

# Follow only frontend logs
./deploy/local/logs.sh frontend -f

# Show last 100 lines from backend
./deploy/local/logs.sh backend -n 100

# Aliases work too
./deploy/local/logs.sh fe -f        # frontend
./deploy/local/logs.sh be -f        # backend
./deploy/local/logs.sh server -f    # backend
```

**Options:**
- `frontend`, `fe` - Show only frontend logs
- `backend`, `be`, `server` - Show only backend logs
- `-f`, `--follow` - Follow logs in real-time (like `tail -f`)
- `-n`, `--lines N` - Show last N lines (default: 50)

**Examples:**
```bash
# Follow both logs
./deploy/local/logs.sh -f

# Last 200 lines from both
./deploy/local/logs.sh -n 200

# Follow frontend only
./deploy/local/logs.sh frontend -f

# Last 100 backend lines
./deploy/local/logs.sh backend -n 100
```

---

## Typical Workflow

### Starting Your Day

```bash
# Check if anything is running
./deploy/local/status.sh

# Start services
./deploy/local/start.sh

# Open browser to http://localhost:5173
```

### During Development

```bash
# Check if everything is still running
./deploy/local/status.sh

# View recent logs
./deploy/local/logs.sh

# Follow logs while developing
./deploy/local/logs.sh -f

# Check backend errors
./deploy/local/logs.sh backend -n 50
```

### After Making Changes

```bash
# Frontend changes auto-reload (Vite HMR)
# No action needed!

# Backend changes require restart
./deploy/local/restart.sh
```

### Ending Your Day

```bash
# Stop everything
./deploy/local/stop.sh

# Verify stopped
./deploy/local/status.sh
```

---

## Troubleshooting

### Services Won't Start

**Check if ports are in use:**
```bash
# Check port 5173 (frontend)
lsof -i :5173

# Check port 3001 (backend)
lsof -i :3001

# Kill if needed
kill $(lsof -ti:5173)
kill $(lsof -ti:3001)
```

**Check logs for errors:**
```bash
./deploy/local/logs.sh backend -n 100
./deploy/local/logs.sh frontend -n 100
```

**Common issues:**
- Missing `.env.local` - Script will create it
- Missing `node_modules` - Script will install
- Oracle connection issues - Check credentials in `.env.local`
- Port already in use - Script will offer to kill and restart

### Backend API Not Responding

```bash
# Check if backend is running
./deploy/local/status.sh

# Check backend logs
./deploy/local/logs.sh backend -n 50

# Test API directly
curl http://localhost:3001/api/health

# Restart backend
./deploy/local/restart.sh
```

### Frontend Not Loading

```bash
# Check if frontend is running
./deploy/local/status.sh

# Check frontend logs
./deploy/local/logs.sh frontend -n 50

# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

# Restart frontend
./deploy/local/restart.sh
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
./deploy/local/start.sh
```

### Scripts Not Executable

```bash
# Make all scripts executable
chmod +x deploy/local/*.sh
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

The `start.sh` script checks for `.env.local` and creates it from `.env.example` if missing.

**Required variables:**
```bash
# Oracle Database
VITE_ORACLE_USER=your_username
VITE_ORACLE_PASSWORD=your_password
VITE_ORACLE_CONNECT_STRING=your_connection_string
VITE_ORACLE_WALLET_PASSWORD=your_wallet_password

# Admin Password
VITE_ADMIN_PASSWORD=AdminPassword
VITE_EDITOR_PASSWORD=EditorPassword

# API URL (for local development)
VITE_API_URL=http://localhost:3001/api
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
    "dev": "vite --port 5173",
    "dev:server": "tsx watch --tsconfig config/tsconfig.server.json server/index.ts"
  }
}
```

And update your `.env.local`:
```bash
PORT=3001  # Backend port
```

### Clean Logs

```bash
# Clear all logs
rm -f logs/*.log

# Or start fresh
./deploy/local/stop.sh
rm -rf logs/
./deploy/local/start.sh
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
      "label": "Start Song Studio",
      "type": "shell",
      "command": "./deploy/local/start.sh",
      "problemMatcher": []
    },
    {
      "label": "Stop Song Studio",
      "type": "shell",
      "command": "./deploy/local/stop.sh",
      "problemMatcher": []
    },
    {
      "label": "Song Studio Status",
      "type": "shell",
      "command": "./deploy/local/status.sh",
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
    "local:start": "./deploy/local/start.sh",
    "local:stop": "./deploy/local/stop.sh",
    "local:restart": "./deploy/local/restart.sh",
    "local:status": "./deploy/local/status.sh",
    "local:logs": "./deploy/local/logs.sh"
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
| Port | 5173 (frontend), 3001 (backend) | 443 (HTTPS), 80 (HTTP) |
| Logs | `logs/` directory | PM2 logs, nginx logs |
| Process Management | Bash scripts | PM2 |
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
1. Check `./deploy/local/status.sh`
2. View logs with `./deploy/local/logs.sh -f`
3. Try `./deploy/local/restart.sh`
4. Check [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md)

