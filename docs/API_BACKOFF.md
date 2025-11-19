# API Request Backoff Strategy

To prevent the UI from continuously hammering the backend when it's down or experiencing issues, Song Studio implements an exponential backoff strategy for failed API requests.

## How It Works

### Failure Tracking
- Each API endpoint is tracked independently
- Failure count and last failure time are recorded per endpoint
- Successful requests reset the backoff state for that endpoint

### Backoff Behavior

**First 3 failures**: Requests proceed normally with no delay

**After 3 failures**: Exponential backoff kicks in:
- 4th failure: 5 second wait
- 5th failure: 10 second wait
- 6th failure: 20 second wait
- 7th failure: 40 second wait
- 8th+ failures: 60 second wait (max)

### User Experience

When a request is blocked due to backoff:
- User sees a clear error message: `"Server connection issue. Retrying in Xs. Please wait or check if backend is running."`
- The countdown shows how many seconds until the next retry is allowed
- Users can wait for the timer, or restart the backend and click "Refresh"

### Explicit Refresh

When users click "Refresh" buttons in the UI:
- Backoff state is automatically reset for that endpoint
- Request proceeds immediately
- This allows users to force a retry after fixing server issues

## Technical Implementation

### ApiClient

The `ApiClient` class (`src/services/ApiClient.ts`) manages backoff:

```typescript
// Track failures per endpoint
private failureCount: Map<string, number>;
private lastFailureTime: Map<string, number>;

// Backoff configuration
private readonly MAX_FAILURES_BEFORE_BACKOFF = 3;
private readonly MIN_BACKOFF_MS = 5000;  // 5 seconds
private readonly MAX_BACKOFF_MS = 60000; // 60 seconds
```

### Context Integration

All data contexts (`SongContext`, `SingerContext`, `PitchContext`) call `apiClient.resetBackoff()` before explicit user-triggered refreshes:

```typescript
const fetchSongs = useCallback(async (forceRefresh: boolean = false) => {
  // Reset backoff for explicit user-triggered refreshes
  if (forceRefresh) {
    const { apiClient } = await import('../services/ApiClient');
    apiClient.resetBackoff('/songs');
  }
  // ... fetch logic
}, []);
```

## Benefits

✅ **No continuous pinging**: After repeated failures, requests are throttled automatically

✅ **User-friendly**: Clear error messages with countdown timers

✅ **Flexible**: Users can force immediate retry via "Refresh" buttons

✅ **Per-endpoint**: One failing endpoint doesn't block others

✅ **Self-healing**: Automatically resets on successful requests

## Example Scenarios

### Scenario 1: Backend Down During Development

1. Backend crashes during development
2. UI tries to fetch data 3 times (fails each time)
3. 4th attempt blocked with "Retrying in 5s" message
4. Developer restarts backend
5. Developer clicks "Refresh" button
6. Backoff is reset, request succeeds immediately

### Scenario 2: Network Issue

1. Network has intermittent issues
2. Some requests fail, triggering backoff
3. Network stabilizes
4. Next successful request automatically resets backoff
5. Normal operation resumes

### Scenario 3: Prolonged Outage

1. Backend goes down for maintenance
2. After 3 failures, backoff begins
3. Backoff increases exponentially up to 60 seconds
4. UI only attempts requests every 60 seconds maximum
5. User sees countdown and knows system is protecting itself
6. When backend returns, next request (or manual refresh) succeeds and resets state

## Configuration

Backoff parameters can be adjusted in `ApiClient.ts`:

```typescript
private readonly MAX_FAILURES_BEFORE_BACKOFF = 3; // Allow N failures before backoff
private readonly MIN_BACKOFF_MS = 5000;            // Starting backoff (5s)
private readonly MAX_BACKOFF_MS = 60000;           // Maximum backoff (60s)
```

The exponential growth formula:
```
backoff = min(MIN_BACKOFF * 2^(failures - MAX_FAILURES_BEFORE_BACKOFF), MAX_BACKOFF)
```

## Testing

To test the backoff behavior:

1. Start the frontend: `npm run dev`
2. **Don't** start the backend
3. Navigate to any data page (Songs, Singers, Pitches)
4. Observe the error messages and countdown timers
5. Click "Refresh" several times to see backoff increase
6. Start the backend: `npm run dev:server`
7. Click "Refresh" to see immediate recovery

