# Frontend Load Execution Flow

## When the UI First Loads on Mobile/Desktop

Here's the complete execution flow when a user visits the site:

### 1. Entry Point: `main.tsx`
```typescript
// React app initialization
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

### 2. App Component: `App.tsx` 
```typescript
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>              // 1st: Auth context initializes
        <ToastProvider>           // 2nd: Toast system
          <SongProvider>          // 3rd: Songs context
            <SingerProvider>      // 4th: Singers context  
              <PitchProvider>     // 5th: Pitches context
                <NamedSessionProvider>  // 6th: Sessions context
                  <SessionProvider>     // 7th: Current session
                    <BrowserRouter>
                      <AppContent />  // Routes and main UI
                    </BrowserRouter>
                  </SessionProvider>
                </NamedSessionProvider>
              </PitchProvider>
            </SingerProvider>
          </SongProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
```

### 3. Context Providers Load Data

#### ✅ NamedSessionProvider (Line 218-221 in NamedSessionContext.tsx)
```typescript
// Load sessions on mount
useEffect(() => {
  loadSessions();  // ❌ THIS IS FAILING ON YOUR MOBILE!
}, [loadSessions]);

// loadSessions() calls:
const loadSessions = async () => {
  const data = await NamedSessionService.getAllSessions();
  // ↓ Makes API call
}

// NamedSessionService.getAllSessions():
async getAllSessions(): Promise<NamedSession[]> {
  return apiClient.get('/sessions');  // ❌ FAILS HERE
  // ↓ Calls
}

// ApiClient.get():
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
//                                                    ↑
//                                  THIS IS THE PROBLEM ON MOBILE!
```

### 4. AppContent Component (Line 29-37 in App.tsx)
```typescript
function AppContent() {
  const { fetchSongs } = useSongs();
  const { fetchSingers } = useSingers();
  const { fetchAllPitches } = usePitches();
  const initialLoadDone = useRef(false);

  // Warm up caches - runs ONCE on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchSongs();        // ❌ Also calls localhost:3001/api
      fetchSingers();      // ❌ Also calls localhost:3001/api
      fetchAllPitches();   // ❌ Also calls localhost:3001/api
    }
  }, []);
  
  return <Routes>...</Routes>
}
```

---

## The Problem on Mobile

### API Client Configuration
**File:** `src/services/ApiClient.ts` (Line 6)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

**What Happens:**
1. **Local Development:** Works fine because backend is on `localhost:3001`
2. **Production Build:** `VITE_API_URL` is NOT set, so it defaults to `localhost:3001`
3. **Mobile Device:** Cannot reach `localhost:3001` because:
   - `localhost` on mobile = the mobile device itself
   - Your server backend is at `129.153.85.24` (not on the mobile device)

### API Calls That Fail

When the UI loads, these API calls happen immediately:

```
1. GET /sessions          → http://localhost:3001/api/sessions
2. GET /songs             → http://localhost:3001/api/songs
3. GET /singers           → http://localhost:3001/api/singers
4. GET /pitches           → http://localhost:3001/api/pitches
```

All of these fail because mobile can't reach `localhost:3001`.

---

## The Solution

### Option 1: Use Relative Path (RECOMMENDED for production)

Since your nginx proxies `/api/` to the backend, use a relative path:

**Create/Update `.env.production`:**
```bash
# Use relative path - nginx will proxy to backend
VITE_API_URL=/api
```

**Then rebuild:**
```bash
npm run build
```

This makes the frontend call `/api/songs` which nginx proxies to `localhost:3001/api/songs` on the server.

### Option 2: Use Full Server URL (Alternative)

**In `.env.production`:**
```bash
# Use full server URL
VITE_API_URL=http://129.153.85.24/api
```

---

## How nginx Handles It

**From `deploy/remote/nginx.conf` (Line 47-62):**
```nginx
# API routes - proxy to backend
location /api/ {
    proxy_pass http://songstudio_backend;  # Points to localhost:3001
    proxy_http_version 1.1;
    # ... proxy headers ...
}

# Upstream backend server (Line 8-11)
upstream songstudio_backend {
    server 127.0.0.1:3001;  # Backend Node.js server
}
```

**Flow:**
```
Mobile Device
   ↓
http://129.153.85.24/api/songs
   ↓
Nginx (port 80)
   ↓
proxy_pass → localhost:3001/api/songs
   ↓
Node.js Backend
```

---

## Quick Fix Checklist

1. ✅ Create `.env.production` with `VITE_API_URL=/api`
2. ✅ Rebuild frontend: `npm run build`
3. ✅ Copy dist/ to server: `/var/www/songstudio/dist`
4. ✅ Restart nginx: `sudo systemctl reload nginx`
5. ✅ Test from mobile

---

## Debugging Tips

### Check API URL in Browser Console

On mobile, open browser console and type:
```javascript
// Check what API URL the app is using
console.log(window.location.origin + '/api')
```

### Test API Directly

From mobile browser:
```
http://129.153.85.24/api/health
http://129.153.85.24/api/songs
```

If these work, the backend is fine. If the app still fails, the build has wrong `VITE_API_URL`.

### Check Built Files

After building, check `dist/assets/*.js` for hardcoded URLs:
```bash
grep -r "localhost:3001" dist/
# Should return nothing if properly configured
```

---

## Summary

**What executes on first load:**
1. React renders component tree
2. Context providers mount and initialize
3. `NamedSessionProvider` immediately calls `GET /sessions`
4. `AppContent` immediately calls `GET /songs`, `GET /singers`, `GET /pitches`
5. All fail on mobile because `localhost:3001` ≠ `129.153.85.24`

**The fix:**
Set `VITE_API_URL=/api` in `.env.production` and rebuild.

