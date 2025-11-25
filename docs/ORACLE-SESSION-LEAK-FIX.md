# CRITICAL: Oracle Session Leak Fix

## 🚨 INCIDENT: 40,000 Database Connections

**Symptoms:**
- Oracle error: `ORA-00018: maximum number of sessions exceeded`
- OCI Monitor shows ~40,000 active connections
- Application unable to connect to database
- Connection timeouts

**Root Cause:**
Database sessions are not being properly closed or are hanging, accumulating over time to catastrophic levels.

---

## IMMEDIATE EMERGENCY STEPS

### Step 1: Kill All Hung Sessions (DO THIS FIRST)

**Option A: Via Oracle Cloud Console SQL**

1. Go to Oracle Cloud Console
2. Navigate to: Autonomous Database → Tools → SQL
3. Run this query to see all your sessions:

```sql
SELECT COUNT(*) as total_sessions FROM v$session;
```

4. Kill all user sessions (replace `YOUR_DB_USER` with your actual username):

```sql
-- Generate kill commands
SELECT 
    'ALTER SYSTEM KILL SESSION ''' || sid || ',' || serial# || ''' IMMEDIATE;' as kill_command
FROM v$session 
WHERE username = 'YOUR_DB_USER';  -- Replace with your actual username
```

5. Copy each generated command and execute them one by one

**Option B: Emergency Mass Kill (if you have DBA access)**

```sql
-- Kill ALL sessions for your user (CAUTION!)
BEGIN
    FOR session IN (
        SELECT sid, serial# 
        FROM v$session 
        WHERE username = 'YOUR_DB_USER'
    ) LOOP
        EXECUTE IMMEDIATE 
            'ALTER SYSTEM KILL SESSION ''' || 
            session.sid || ',' || session.serial# || 
            ''' IMMEDIATE';
    END LOOP;
END;
/
```

### Step 2: Restart Your Application

After killing sessions:

```bash
# Local
npm run dev:server

# Production
cd /var/www/songstudio
pm2 restart songstudio
pm2 logs songstudio --lines 50
```

### Step 3: Monitor Connection Count

Watch for any connection buildup:

```sql
-- Run this every minute to monitor
SELECT 
    COUNT(*) as current_sessions,
    status,
    program
FROM v$session 
WHERE username = 'YOUR_DB_USER'
GROUP BY status, program
ORDER BY current_sessions DESC;
```

---

## CHANGES MADE TO PREVENT RECURRENCE

### 1. **Reduced Max Pool Size to 1**

Changed from `poolMax: 2` to `poolMax: 1` to minimize potential leaks:

```typescript
// server/services/DatabaseService.ts
poolMax: 1,  // EMERGENCY: Reduced until leak is confirmed fixed
```

### 2. **Added Connection Tracking**

Every connection is now tracked and force-closed if it hangs:

```typescript
private activeConnections: Set<oracledb.Connection> = new Set();
```

### 3. **Query Timeout Protection**

Queries automatically timeout after 30 seconds:

```typescript
const queryTimeout = setTimeout(() => {
  if (connection) {
    connection.close().catch(err => console.error('Error force-closing:', err));
  }
}, 30000);
```

### 4. **Aggressive Cleanup Every 2 Minutes**

Background task forcefully closes any lingering connections:

```typescript
setInterval(() => this.cleanupIdleConnections(), 2 * 60 * 1000);
```

### 5. **Enhanced Error Handling**

Specific detection and logging for `ORA-00018` errors with recovery steps.

---

## MONITORING

### Check Connection Pool Health

After deploying the fix, monitor logs:

```bash
# Production
ssh ubuntu@saisongs.org 'pm2 logs songstudio | grep -i "pool health"'

# Look for lines like:
# 🔍 Pool health: 1 open, 0 in use, 1 available, 0 tracked
```

### Expected Behavior

**Normal (Good):**
```
🔍 Pool health: 0-1 open, 0 in use, 0-1 available, 0 tracked
```

**Warning (Investigate):**
```
⚠️  Pool health: 2-3 open, 1 in use, 1 available, 0 tracked
🚨 WARNING: 3 connections open - potential leak!
```

**Critical (Emergency):**
```
🚨 WARNING: 5+ connections open - potential leak!
⚠️  Force-closing X tracked connections
```

### Oracle Session Monitor Query

Run this periodically to watch for session creep:

```sql
-- Check every 5 minutes
SELECT 
    TO_CHAR(SYSDATE, 'HH24:MI:SS') as check_time,
    COUNT(*) as session_count,
    MAX(last_call_et) as max_idle_seconds
FROM v$session 
WHERE username = 'YOUR_DB_USER'
GROUP BY TO_CHAR(SYSDATE, 'HH24:MI:SS');
```

If `session_count` keeps growing → **Session leak still present**.

---

## ROOT CAUSE INVESTIGATION

### Potential Causes (Ordered by Likelihood)

1. **Connection not closed in error path** ✅ **FIXED**
   - Added connection tracking to ensure closure
   - Force-close in query timeout

2. **Async race condition**
   - Connection obtained but error thrown before `finally` block
   - **Fixed** by tracking connections at acquisition time

3. **Long-running queries**
   - Queries taking > 30 seconds hold connections
   - **Mitigated** by query timeout

4. **Cache warmup overwhelming pool**
   - Multiple simultaneous cache operations
   - **Mitigated** by poolMax=1 and delays between queries

5. **Oracle-side session accumulation**
   - Oracle not releasing sessions properly
   - **Workaround**: Periodic cleanup + manual session kills

### Verify Fix is Working

After 1 hour of uptime:

```sql
-- Should be < 5 sessions total
SELECT COUNT(*) FROM v$session WHERE username = 'YOUR_DB_USER';

-- Should be 0-1 active
SELECT COUNT(*) FROM v$session WHERE username = 'YOUR_DB_USER' AND status = 'ACTIVE';
```

If count > 10 after 1 hour → **Leak still present, escalate**.

---

## ROLLBACK PLAN

If the application becomes too slow due to `poolMax: 1`:

### Option 1: Temporarily Disable Cache Warmup

```typescript
// server/index.ts
// Comment out warmup:
// await warmupCache();
console.log('⚠️  Cache warmup DISABLED due to connection leak');
```

This reduces startup connections but may slow initial requests.

### Option 2: Increase Pool to 2 (with risk)

```typescript
// server/services/DatabaseService.ts
poolMax: 2,  // CAUTION: May cause leak to return
```

**Only do this if:**
- Session count stable at < 10 after 2 hours
- Application too slow with poolMax=1
- You can actively monitor for leaks

---

## PERMANENT SOLUTION

Once leak is confirmed fixed (stable session count < 5 for 24 hours):

1. **Increase pool gradually:**
   - Day 1: `poolMax: 1` (current)
   - Day 2: `poolMax: 2` (if stable)
   - Day 3: `poolMax: 3` (if needed)

2. **Keep monitoring:**
   - Daily session count checks for 1 week
   - Alert if sessions > 10

3. **Consider Oracle upgrade:**
   - Free Tier → Paid Tier for more sessions
   - Or optimize queries to need fewer connections

---

## CONTACT ORACLE SUPPORT

If sessions continue to accumulate despite fixes:

**Oracle Support Case Template:**

```
Subject: ORA-00018 Session Leak in Autonomous Database Free Tier

Description:
- Database: [Your DB Name]
- OCID: [Your DB OCID]
- Issue: Sessions accumulating to 40,000+ despite proper connection closure
- Application: Node.js with node-oracledb 6.x, poolMax=1
- Evidence: 
  * All connections closed in finally blocks
  * Query timeout enforced at 30 seconds
  * Periodic pool cleanup every 2 minutes
  * Still seeing session growth

Request:
- Identify any hung or zombie sessions on database side
- Confirm session limit configuration
- Recommend Oracle-side session timeout settings
```

---

## SUCCESS CRITERIA

✅ **Fixed when:**
- Session count stable at < 5 for 24 hours
- No `ORA-00018` errors for 48 hours
- Application performs normally
- Pool health logs show 0-1 connections consistently

---

## PREVENTION CHECKLIST

- [ ] Never call `query()` without `await`
- [ ] All database calls wrapped in try-finally
- [ ] No long-running queries (> 10 seconds)
- [ ] Monitor pool health logs daily
- [ ] Weekly Oracle session count check
- [ ] Connection timeout enforced
- [ ] Pool cleanup running every 2 minutes

---

## Files Changed

1. `server/services/DatabaseService.ts`
   - Added connection tracking
   - Reduced poolMax to 1
   - Added query timeout
   - Enhanced cleanup
   - Better error handling

2. `docs/ORACLE-SESSION-LEAK-FIX.md` (this file)
   - Complete incident response guide

---

## Next Steps

1. ✅ Deploy fixes immediately
2. ⏳ Kill all hung sessions in Oracle
3. ⏳ Monitor for 24 hours
4. ⏳ Verify session count stays < 5
5. ⏳ Gradually increase pool if stable

**Status:** 🔴 CRITICAL - Active Incident
**Owner:** Dev Team
**Updated:** 2024-11-24

