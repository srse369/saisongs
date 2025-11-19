# "Load Failed" Error Flow - Mobile Device

## Where Your "Load Failed" Error Comes From

Here's the complete error flow from network failure to the UI toast message you see on your mobile device.

---

## 🔴 Step-by-Step Error Flow

### 1. Initial Page Load
**File:** `src/App.tsx` (Line 29-37)

When the app loads, it immediately fetches data:
```typescript
useEffect(() => {
  if (!initialLoadDone.current) {
    initialLoadDone.current = true;
    fetchSongs();        // ← Triggers error chain
    fetchSingers();      // ← Triggers error chain
    fetchAllPitches();   // ← Triggers error chain
  }
}, []);
```

### 2. Context Provider Tries to Fetch
**File:** `src/contexts/SongContext.tsx` (Line 78-79)

```typescript
const freshSongs = await songService.getAllSongs();
// ↓ calls
```

### 3. Service Layer Makes API Call
**File:** `src/services/SongService.ts`

```typescript
async getAllSongs(): Promise<Song[]> {
  return apiClient.get('/songs');
  // ↓ calls
}
```

### 4. API Client Attempts Request
**File:** `src/services/ApiClient.ts` (Line 6, 96-105)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
//                                                    ↑
//                              THIS IS THE PROBLEM!

private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${this.baseUrl}${endpoint}`;
  // url becomes: "http://localhost:3001/api/songs"
  
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' }
    });
    // ↓ fetch() throws TypeError: Failed to fetch
  }
```

### 5. Network Request Fails
**Browser Fetch API:**

```javascript
// Mobile device tries to connect to:
fetch('http://localhost:3001/api/songs')

// ❌ FAILS because:
// - "localhost" on mobile = the mobile device itself
// - The backend is actually on 129.153.85.24, not on the mobile device
// - fetch() throws: TypeError: Failed to fetch
```

### 6. API Client Catches Error
**File:** `src/services/ApiClient.ts` (Line 122-125)

```typescript
} catch (error) {
  this.recordFailure(endpoint);
  console.error(`API request failed: /songs`, error);
  throw error;  // Re-throws the TypeError
}
```

**Console Output (from Line 124):**
```
API request failed: /songs Error: Failed to fetch
```

### 7. Context Provider Catches Error
**File:** `src/contexts/SongContext.tsx` (Line 92-98)

```typescript
} catch (err) {
  const errorMessage = err instanceof Error 
    ? err.message           // "Failed to fetch"
    : 'Failed to fetch songs';
  
  setError({
    code: 'UNKNOWN_ERROR',
    message: errorMessage   // "Failed to fetch"
  });
  
  toast.error(errorMessage);  // ← Displays error in UI
}
```

### 8. Toast Context Displays Error
**File:** `src/contexts/ToastContext.tsx` (Line 53-54)

```typescript
const error = useCallback((message: string, duration?: number) => {
  showToast('error', message, duration);
}, [showToast]);
```

### 9. Toast Component Renders
**File:** `src/components/common/Toast.tsx` (Line 58-71)

```typescript
return (
  <div className="bg-red-600 text-white px-6 py-4 rounded-lg">
    {/* X icon */}
    <p className="text-sm font-medium">{toast.message}</p>
    {/* Close button */}
  </div>
);
```

**What You See on Mobile:**
```
┌─────────────────────────────────┐
│ ⨯  Failed to fetch              │
│                              [X] │
└─────────────────────────────────┘
```

---

## 🎯 Why Multiple Errors Appear

You see **3 error toasts** because 3 things fail simultaneously on page load:

1. **"Failed to fetch songs"** - from `fetchSongs()`
2. **"Failed to fetch singers"** - from `fetchSingers()`  
3. **"Failed to fetch pitches"** - from `fetchAllPitches()`

Plus, if you have the `/session` page, it also tries:
4. **"Failed to fetch sessions"** - from `NamedSessionProvider` (Line 220 in `NamedSessionContext.tsx`)

---

## 🔍 The Root Cause

### Current Configuration
```typescript
// src/services/ApiClient.ts (Line 6)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

### What Happens in Production Build

1. **Build-time:** `import.meta.env.VITE_API_URL` is replaced with value from `.env.production`
2. **Your build:** `.env.production` doesn't exist or doesn't set `VITE_API_URL`
3. **Result:** Falls back to `'http://localhost:3001/api'`
4. **Mobile device:** Tries to connect to `localhost:3001` on the phone (fails!)

---

## ✅ The Fix

### Create `.env.production`

```bash
# In your project root
echo "VITE_API_URL=/api" > .env.production
```

**This makes the frontend use:**
```javascript
const API_BASE_URL = '/api';  // Relative path

// Requests become:
fetch('/api/songs')           // ✅ nginx proxies to localhost:3001
fetch('/api/singers')         // ✅ nginx proxies to localhost:3001
fetch('/api/pitches')         // ✅ nginx proxies to localhost:3001
```

### Rebuild and Deploy

```bash
# 1. Rebuild with correct API URL
npm run build

# 2. Copy to server (from your local machine)
scp -r dist/* ubuntu@129.153.85.24:/var/www/songstudio/dist/

# 3. Test from mobile
# Open: http://129.153.85.24
```

---

## 🧪 How to Verify the Fix

### Before Fix (Current State)

**Check built files:**
```bash
grep -r "localhost:3001" dist/assets/
# Returns: matches found (BAD)
```

**From mobile browser:**
```
Open: http://129.153.85.24
Error: "Failed to fetch"
Error: "Failed to fetch songs"
Error: "Failed to fetch singers"
Error: "Failed to fetch pitches"
```

### After Fix (Expected State)

**Check built files:**
```bash
grep -r "localhost:3001" dist/assets/
# Returns: no matches (GOOD)
```

**From mobile browser:**
```
Open: http://129.153.85.24
✅ No errors
✅ Songs load
✅ Singers load
✅ Pitches load
```

---

## 📊 Network Tab Analysis

### Current State (Failing)

Open mobile browser console (F12 on desktop, Remote Debug on mobile):

```
Network Tab:
❌ http://localhost:3001/api/songs     Failed    (net::ERR_CONNECTION_REFUSED)
❌ http://localhost:3001/api/singers   Failed    (net::ERR_CONNECTION_REFUSED)
❌ http://localhost:3001/api/pitches   Failed    (net::ERR_CONNECTION_REFUSED)
❌ http://localhost:3001/api/sessions  Failed    (net::ERR_CONNECTION_REFUSED)
```

### After Fix (Working)

```
Network Tab:
✅ /api/songs      200 OK    [Proxied by nginx to localhost:3001]
✅ /api/singers    200 OK    [Proxied by nginx to localhost:3001]
✅ /api/pitches    200 OK    [Proxied by nginx to localhost:3001]
✅ /api/sessions   200 OK    [Proxied by nginx to localhost:3001]
```

---

## 🔧 Additional Notes

### Why Desktop Works but Mobile Doesn't

- **Desktop:** You run backend locally at `localhost:3001` → Frontend can reach it
- **Mobile:** Backend is on `129.153.85.24` → Can't reach `localhost:3001` on phone

### Backoff Mechanism

The ApiClient has a backoff mechanism (Lines 20-34) that prevents retry spam:
- First failure: Retry immediately
- Second failure: Wait 3 seconds
- Third failure: Wait 10 seconds
- After MAX_RETRIES: Stop trying until manual reset

This is why you might see:
```
Retrying in 3s... (Attempt 2/3)
Connection failed after 2 attempts...
```

### How to Reset Backoff

If the app stops trying to fetch, you can reset it:
```javascript
// From browser console
window.location.reload()  // Hard refresh
```

Or the app resets backoff when you explicitly click a "Refresh" button.

---

## Summary

**The error flow:**
```
Page Load
  → Context Provider mounts
  → Calls songService.getAllSongs()
  → Calls apiClient.get('/songs')
  → fetch('http://localhost:3001/api/songs')
  → Network fails: TypeError: Failed to fetch
  → ApiClient throws error
  → Context catches, calls toast.error("Failed to fetch")
  → Toast component renders red notification
  → User sees: "Failed to fetch" on screen
```

**The fix:**
Create `.env.production` with `VITE_API_URL=/api`, rebuild, and redeploy.

