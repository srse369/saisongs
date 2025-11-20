# Oracle Recursive SQL Issue - Diagnosis and Solutions

## Problem Summary

You're experiencing **65,000+ recursive SQL executions** in your Oracle Autonomous Database. This is NOT normal and indicates a serious problem.

## What is "Recursive SQL"?

In Oracle, "recursive SQL" includes:
1. Internal metadata queries (data dictionary lookups)
2. PL/SQL compilation queries
3. Connection validation queries
4. Trigger execution
5. Foreign key constraint checks
6. Index maintenance queries

## Root Cause

Based on your logs and symptoms, the issue is caused by:

1. **Connection Pool Timeouts**: The app tries to connect but times out (NJS-040)
2. **Long Timeout Values**: With 60-120 second timeouts, connections queue up
3. **Auto-Restart Loop**: tsx watch restarts the server on every file change
4. **Pool Ping Health Checks**: poolPingInterval causes validation queries
5. **Cascading Failures**: Each failed connection attempt triggers Oracle internal queries
6. **Cache Warmup Queries**: CLOB operations (DBMS_LOB.SUBSTR) and RAWTOHEX conversions trigger ~40k recursive queries PER warmup

### The Death Spiral:
```
1. Server starts → Creates pool → Tries to connect
2. Connection times out after 60s → Oracle runs recursive queries during timeout
3. File changes → tsx restarts server → Go to step 1
4. Multiply by number of restarts → 65k+ recursive queries
```

## Why Cache Warmup Causes 40k Recursive Queries

Your cache warmup queries use **expensive Oracle operations**:

### 1. CLOB Operations (Most Expensive)
```sql
DBMS_LOB.SUBSTR(lyrics, 4000, 1) AS lyrics
```
- Each CLOB access = ~15-20 internal Oracle queries
- 3 CLOB fields per song × 300 songs = **13,500+ recursive queries**

### 2. RAWTOHEX Conversions
```sql
RAWTOHEX(id), RAWTOHEX(song_id), RAWTOHEX(singer_id)
```
- Each conversion requires internal Oracle function calls
- Dozens of conversions per row = **thousands more recursive queries**

### 3. Complex JOINs with ORDER BY
```sql
FROM song_singer_pitches ssp
JOIN songs s ON ssp.song_id = s.id
JOIN singers si ON ssp.singer_id = si.id
ORDER BY s.name, si.name
```
- Metadata lookups for join execution
- Index scans, sorting operations
- Another **10k+ recursive queries**

### Total: ~40k recursive SQL per warmup attempt

## Immediate Fixes Applied

### 1. Disabled Cache Warmup
```typescript
// Cache will populate lazily on first API request instead
// Avoids 40k recursive SQL spike on startup
```
**Why**: The 40k recursive queries during warmup aren't worth the benefit

### 2. Reduced Timeouts (FAIL FAST)
```typescript
queueTimeout: 5000,     // 5s instead of 120s
connectTimeout: 10000,   // 10s instead of 60s
```
**Why**: Fail quickly instead of queuing connections that multiply

### 2. Disabled Pool Ping
```typescript
poolPingInterval: 0,     // Disabled
```
**Why**: Each ping is a `SELECT 1 FROM DUAL` that triggers recursive queries

### 3. Reduced Pool Size
```typescript
poolMax: 2,              // Down from 5
```
**Why**: Fewer connections = fewer failed attempts = fewer recursive queries

## Verification Steps

### Step 1: Run Diagnostics
```bash
node diagnose-db.js
```

This will:
- Test basic connection
- Check for hung sessions
- Show most executed queries
- Identify blocking sessions

### Step 2: Check Oracle Metrics

In Oracle Cloud Console → Autonomous Database → Performance Hub:
- Check "SQL Executions" graph
- Look for spikes in recursive calls
- Identify top SQL statements

### Step 3: Kill Hung Sessions (if any)

If diagnostics show hung sessions:
```sql
-- Find hung sessions
SELECT sid, serial#, username, status, last_call_et 
FROM v$session 
WHERE username = 'YOUR_USER' 
  AND last_call_et > 300;

-- Kill them
ALTER SYSTEM KILL SESSION 'sid,serial#' IMMEDIATE;
```

## Long-term Solutions

### Option 1: Restart Oracle Autonomous Database

This is the nuclear option but often most effective:
1. Go to Oracle Cloud Console
2. Navigate to your Autonomous Database
3. Click "More Actions" → "Stop"
4. Wait for it to stop completely
5. Click "Start"
6. Wait for it to be available

### Option 2: Fix Development Workflow

Stop auto-restart during database issues:
```bash
# Instead of tsx watch (auto-restart)
npm run dev:server:once

# Or run in regular node (no watch)
node --loader tsx server/index.ts
```

### Option 3: Add Connection Retry with Backoff

Instead of immediate retry on connection failure, add exponential backoff:
- First failure: wait 2s before retry
- Second failure: wait 4s
- Third failure: wait 8s
- Max wait: 30s
- Give up after 5 attempts

### Option 4: Use Circuit Breaker Pattern

If database is failing:
1. Stop trying for 60 seconds
2. Return cached data or error immediately
3. After cooldown, try one test connection
4. If successful, resume normal operation

## Prevention

### 1. Monitor Oracle Metrics
Set up alerts for:
- Recursive SQL executions > 1000/minute
- Active sessions > 10
- Connection timeouts > 5/minute

### 2. Use Proper Pool Settings

For Oracle Autonomous Free Tier:
```typescript
poolMin: 0,              // Create on demand
poolMax: 2-3,            // Conservative
queueTimeout: 5000,      // Fail fast
connectTimeout: 10000,   // Fail fast
poolPingInterval: 0,     // Disabled or 60+ seconds
```

### 3. Implement Health Check Endpoint

Add a database health check that doesn't hammer the DB:
```typescript
let lastHealthCheck = 0;
let lastHealthStatus = false;

app.get('/api/db-health', async (req, res) => {
  const now = Date.now();
  // Only check once per minute
  if (now - lastHealthCheck < 60000) {
    return res.json({ healthy: lastHealthStatus, cached: true });
  }
  
  try {
    await databaseService.testConnection();
    lastHealthStatus = true;
    lastHealthCheck = now;
    res.json({ healthy: true });
  } catch (err) {
    lastHealthStatus = false;
    lastHealthCheck = now;
    res.json({ healthy: false, error: err.message });
  }
});
```

## Current Status

✅ **Fixed**:
- Reduced timeouts to fail fast
- Disabled poolPingInterval
- Reduced pool size
- Added pool cleanup on startup

⚠️ **Still Need To Do**:
1. Restart Oracle Autonomous Database if issue persists
2. Verify no hung sessions blocking resources
3. Consider adding circuit breaker pattern
4. Monitor recursive SQL metric after changes

## Testing

After applying fixes:
```bash
# 1. Restart your app
npm run dev:server

# 2. Watch the logs - should see faster failures instead of long waits
tail -f logs/backend.log

# 3. Check Oracle metrics in 5 minutes - recursive SQL should drop dramatically
```

## Expected Results

Before fixes:
- 65,000+ recursive SQL executions
- Connection timeouts taking 60-120 seconds
- Server restart loops

After fixes:
- < 1,000 recursive SQL executions (normal)
- Connection failures within 10 seconds
- Graceful degradation when DB unavailable

---

## Need More Help?

If recursive SQL persists after these fixes:
1. Check for application-level infinite loops
2. Verify no triggers on tables causing cascades
3. Look for N+1 query problems in your code
4. Consider enabling Oracle SQL trace for detailed analysis

