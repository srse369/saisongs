# Oracle Database Quota Exceeded - Solutions

## The Problem

Oracle Autonomous Database Free Tier has strict limits:
- ⚠️ **20 concurrent connections** (most common issue)
- ⚠️ **1 OCPU** (shared CPU)
- ⚠️ **20GB storage**

You're seeing "quota exceeded" errors because your app is hitting these limits.

---

## Immediate Fix (Right Now)

### 1. Restart Backend to Clear Connections

```bash
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```

This closes all database connections and starts fresh.

### 2. Check What's Consuming Resources

```bash
# View backend logs
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 50'

# Look for quota errors
ssh ubuntu@saisongs.org 'pm2 logs songstudio --lines 100 | grep -i "quota\|exceeded\|ORA-"'
```

---

## Long-term Fix (Deploy Updated Code)

I've updated the connection pool to use **only 1 connection** instead of 2:

```typescript
poolMax: 1,  // ONLY 1 connection (was 2)
poolPingInterval: 60,  // Check connection health
```

### Deploy the Fix:

```bash
# Rebuild backend
npm run build:server

# Deploy to server
scp -r dist/server ubuntu@saisongs.org:/var/www/songstudio/dist/

# Restart backend
ssh ubuntu@saisongs.org 'cd /var/www/songstudio && pm2 restart songstudio'
```

---

## Understanding Free Tier Limits

### Connection Limits

**Free Tier:** 20 concurrent connections across ALL applications

**Your app usage:**
- Before: `poolMax: 2` = up to 2 connections per PM2 instance
- After: `poolMax: 1` = only 1 connection

**If you have multiple PM2 instances:**
```bash
# Check how many instances are running
ssh ubuntu@saisongs.org 'pm2 list'

# If you see multiple instances, reduce to 1
ssh ubuntu@saisongs.org 'pm2 scale songstudio 1'
```

### Storage Limits

Check your database storage:
```sql
-- Login to Oracle Cloud Console
-- Navigate to: Autonomous Database → Performance Hub
-- Check: Storage usage
```

If you're near 20GB, you need to:
- Archive old data
- Delete unused records
- Upgrade to paid tier

### CPU Limits

Free Tier gets **1 OCPU** (Oracle CPU Unit) which is shared.

**Symptoms of CPU limit:**
- Slow queries
- Timeouts
- "Resource busy" errors

**Solutions:**
- Optimize queries (add indexes)
- Reduce concurrent requests
- Cache results in frontend

---

## Check Oracle Cloud Dashboard

### 1. Login to Oracle Cloud

```
https://cloud.oracle.com
```

### 2. Navigate to Your Database

```
Menu → Oracle Database → Autonomous Database → [Your Database]
```

### 3. Check Metrics

**Performance Hub:**
- Active sessions
- SQL execution time
- CPU usage
- Storage usage

**Service Console:**
- Connection count
- Wait events
- Top SQL queries

---

## Optimization Tips

### 1. Add Database Indexes

Common queries should have indexes:

```sql
-- Check what queries are slow
SELECT sql_text, elapsed_time
FROM v$sql
ORDER BY elapsed_time DESC
FETCH FIRST 10 ROWS ONLY;

-- Add indexes on frequently queried columns
CREATE INDEX idx_songs_name ON songs(name);
CREATE INDEX idx_singers_name ON singers(name);
CREATE INDEX idx_pitches_song_id ON pitches(song_id);
CREATE INDEX idx_pitches_singer_id ON pitches(singer_id);
```

### 2. Enable Frontend Caching

Your app already caches songs in localStorage (5-minute TTL):

```typescript
// src/contexts/SongContext.tsx
const SONGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

To reduce database load, increase the cache time:

```typescript
const SONGS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
```

### 3. Implement Request Throttling

Add rate limiting to your API:

```typescript
// In server/index.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4. Close Connections Aggressively

The updated code now:
- Uses only 1 connection max
- Pings connections every 60 seconds
- Closes idle connections quickly

---

## When to Upgrade to Paid Tier

Consider upgrading if you experience:

1. **Frequent quota errors** even with optimizations
2. **Many concurrent users** (>10 simultaneous)
3. **Large dataset** (approaching 20GB)
4. **Need for better performance**

**Oracle Paid Tier Benefits:**
- More OCPUs (better performance)
- More concurrent connections
- More storage
- Better SLA
- 24/7 support

**Cost:** Starting at ~$20-40/month (always-free credits may apply)

---

## Monitor Usage

### Check Connection Count

```bash
# SSH to server
ssh ubuntu@saisongs.org

# Check PM2 pool statistics
pm2 monit
```

### Check Database Sessions

Login to Oracle Cloud Console:
```
Performance Hub → Activity → Active Sessions
```

### Set Up Alerts

In Oracle Cloud Console:
```
Monitoring → Alarms → Create Alarm
Metric: CPU Utilization, Storage Usage, etc.
Threshold: 80%
Notification: Your email
```

---

## Emergency Actions

### If Database is Completely Locked

1. **Stop all applications:**
```bash
ssh ubuntu@saisongs.org 'pm2 stop songstudio'
```

2. **Wait 5 minutes** for connections to timeout

3. **Restart with minimal connections:**
```bash
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```

### If Oracle Console is Unresponsive

Oracle may be throttling you. Wait 15-30 minutes before trying again.

### Contact Oracle Support

If you have Always Free account:
- Community forums: https://community.oracle.com/
- Documentation: https://docs.oracle.com/

If you have paid account:
- Open support ticket in Oracle Cloud Console

---

## Summary

**Immediate fix:**
```bash
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```

**Deploy optimized code:**
```bash
npm run build:server
scp -r dist/server ubuntu@saisongs.org:/var/www/songstudio/dist/
ssh ubuntu@saisongs.org 'pm2 restart songstudio'
```

**Monitor:**
- Check PM2 logs: `pm2 logs songstudio`
- Check Oracle Cloud Console for usage metrics
- Watch for quota errors in logs

**Long-term:**
- Consider upgrading if free tier is insufficient
- Optimize queries with indexes
- Increase frontend cache duration
- Limit concurrent users if needed

