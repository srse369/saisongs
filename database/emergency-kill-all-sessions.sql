-- ⚠️  EMERGENCY: Kill All Database Sessions
-- Run this when you have 40k+ sessions and ORA-00018 errors
-- 
-- INSTRUCTIONS:
-- 1. Open Oracle Cloud Console → SQL
-- 2. Run STEP 1 to see current session count
-- 3. Run STEP 2 to generate kill commands
-- 4. Execute each kill command
-- 5. Run STEP 3 to verify cleanup

-- =============================================================================
-- STEP 1: Check Current Session Count
-- =============================================================================
SELECT 
    'Total Sessions' as metric,
    COUNT(*) as count
FROM v$session
UNION ALL
SELECT 
    'Your App Sessions' as metric,
    COUNT(*) as count
FROM v$session 
WHERE username = USER;  -- Your database user

-- =============================================================================
-- STEP 2: Generate Kill Commands for All Your Sessions
-- =============================================================================
-- Copy each line from the output and run them individually

SELECT 
    'ALTER SYSTEM KILL SESSION ''' || sid || ',' || serial# || ''' IMMEDIATE;' as kill_command,
    program,
    status,
    ROUND(last_call_et/60, 1) as idle_minutes
FROM v$session 
WHERE username = USER
ORDER BY last_call_et DESC;

-- =============================================================================
-- STEP 3: Verify All Sessions Killed
-- =============================================================================
-- Should return 0 or very few rows after cleanup

SELECT 
    sid,
    serial#,
    username,
    program,
    status,
    ROUND(last_call_et/60, 1) as idle_minutes
FROM v$session 
WHERE username = USER
ORDER BY last_call_et DESC;

-- =============================================================================
-- STEP 4: Monitor for Session Creep (Run every 5 minutes)
-- =============================================================================
-- If count keeps growing, the leak is not fixed

SELECT 
    TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') as check_time,
    COUNT(*) as session_count,
    SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count,
    SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) as inactive_count,
    MAX(last_call_et) as max_idle_seconds
FROM v$session 
WHERE username = USER;

-- =============================================================================
-- EMERGENCY: If you have DBA privileges and need to kill all at once
-- =============================================================================
-- ⚠️  WARNING: This will disconnect your app immediately
-- Only use if you have 1000+ sessions and can't kill them manually

/*
BEGIN
    FOR session_rec IN (
        SELECT sid, serial# 
        FROM v$session 
        WHERE username = USER
        AND sid != (SELECT sid FROM v$mystat WHERE ROWNUM = 1)  -- Don't kill your own session
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE 
                'ALTER SYSTEM KILL SESSION ''' || 
                session_rec.sid || ',' || session_rec.serial# || 
                ''' IMMEDIATE';
        EXCEPTION
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('Failed to kill session ' || session_rec.sid || ': ' || SQLERRM);
        END;
    END LOOP;
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Session cleanup completed');
END;
/
*/

-- =============================================================================
-- Helpful Queries for Investigation
-- =============================================================================

-- Show sessions grouped by program
SELECT 
    program,
    status,
    COUNT(*) as session_count
FROM v$session 
WHERE username = USER
GROUP BY program, status
ORDER BY session_count DESC;

-- Show long-running queries
SELECT 
    sid,
    serial#,
    SUBSTR(sql_text, 1, 100) as sql_preview,
    ROUND(elapsed_time/1000000, 2) as elapsed_sec,
    ROUND(cpu_time/1000000, 2) as cpu_sec
FROM v$session s
LEFT JOIN v$sqlarea q ON s.sql_id = q.sql_id
WHERE s.username = USER
AND s.status = 'ACTIVE'
ORDER BY elapsed_time DESC
FETCH FIRST 10 ROWS ONLY;

-- Show session limits
SELECT 
    'Current Sessions' as metric,
    TO_CHAR(COUNT(*)) as value
FROM v$session
WHERE username = USER
UNION ALL
SELECT 
    'Sessions Limit' as metric,
    value
FROM v$parameter 
WHERE name = 'sessions';

