# Backend Server Setup

## Architecture Overview

Song Studio now uses a **client-server architecture**:

- **Frontend (React + Vite)**: Runs in the browser on port 5174
- **Backend (Express + Node.js)**: Runs on your machine on port 3001
- **Database (Oracle)**: Oracle Autonomous Database in the cloud

```
Browser (React App) → Backend API Server → Oracle Database
    Port 5174            Port 3001           Cloud
```

## Why This Change?

The `oracledb` package is a Node.js native module that **cannot run in the browser**. It requires:
- Native C++ bindings
- Oracle Instant Client libraries
- File system access
- Network sockets

Therefore, we need a backend server to handle database connections.

## Running the Application

### Option 1: Run Both Together (Recommended)
```bash
npm run dev:all
```

This starts both the frontend and backend simultaneously.

### Option 2: Run Separately
```bash
# Terminal 1 - Backend Server
npm run dev:server

# Terminal 2 - Frontend
npm run dev
```

## Project Structure

```
songstudio/
├── src/                    # Frontend React app
│   ├── components/
│   ├── services/
│   │   ├── ApiClient.ts   # NEW: HTTP client for API calls
│   │   └── SongService.ts # Updated to use ApiClient
│   └── ...
├── server/                 # NEW: Backend Express server
│   ├── index.ts           # Server entry point
│   ├── routes/            # API route handlers
│   │   ├── songs.ts
│   │   ├── singers.ts
│   │   └── pitches.ts
│   └── services/
│       └── DatabaseService.ts  # Oracle database connection
└── ...
```

## API Endpoints

### Songs
- `GET /api/songs` - Get all songs
- `GET /api/songs/:id` - Get song by ID
- `POST /api/songs` - Create new song
- `PUT /api/songs/:id` - Update song
- `DELETE /api/songs/:id` - Delete song

### Singers
- `GET /api/singers` - Get all singers
- `GET /api/singers/:id` - Get singer by ID
- `POST /api/singers` - Create new singer
- `PUT /api/singers/:id` - Update singer
- `DELETE /api/singers/:id` - Delete singer

### Pitches
- `GET /api/pitches` - Get all pitch associations
- `GET /api/pitches/:id` - Get pitch by ID
- `GET /api/pitches/song/:songId` - Get pitches for a song
- `POST /api/pitches` - Create new pitch association
- `PUT /api/pitches/:id` - Update pitch association
- `DELETE /api/pitches/:id` - Delete pitch association

### Health Check
- `GET /api/health` - Check if server is running

## Environment Variables

Add to your `.env.local`:

```bash
# Oracle Database (used by backend server)
VITE_ORACLE_USER=your_username
VITE_ORACLE_PASSWORD=your_password
VITE_ORACLE_CONNECT_STRING=your_connection_string

# API URL (used by frontend)
VITE_API_URL=http://localhost:3001/api

# Admin Password
VITE_ADMIN_PASSWORD=your_admin_password
```

## Troubleshooting

### Frontend shows "Failed to fetch songs"
- Make sure the backend server is running (`npm run dev:server`)
- Check that port 3001 is not blocked
- Verify `.env.local` has `VITE_API_URL=http://localhost:3001/api`

### Backend shows "Oracle database credentials are not configured"
- Check that `.env.local` has your Oracle credentials
- Restart the backend server after adding credentials

### CORS errors in browser console
- The backend is configured with CORS enabled
- If you still see errors, check that the API URL is correct

## Production Deployment

For production, you'll need to:

1. Build the frontend: `npm run build`
2. Build the backend: `npm run build:server`
3. Deploy both to a hosting service (e.g., Heroku, AWS, Oracle Cloud)
4. Update `VITE_API_URL` to point to your production API URL
5. Set environment variables on your hosting platform

## Development Tips

- The backend uses `tsx watch` for hot-reloading
- Changes to server files will automatically restart the server
- Frontend changes will hot-reload as usual with Vite
- Use browser DevTools Network tab to debug API calls
