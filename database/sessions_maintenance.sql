-- Sessions Maintenance (Identify, Kill, Verify)
-- Use in Oracle SQL Developer / SQL*Plus to manage hung sessions.

-- 1) Identify idle sessions (>5 minutes)
SELECT 
    sid,
    serial#,
    username,
    program,
    status,
    last_call_et AS idle_seconds,
    sql_id,
    'ALTER SYSTEM KILL SESSION ''' || sid || ',' || serial# || ''' IMMEDIATE;' AS kill_command
FROM v$session
WHERE username = USER
  AND last_call_et > 300
  AND status != 'ACTIVE'
ORDER BY last_call_et DESC;

-- 2) (Manual) Copy and run generated kill commands above
-- Example:
-- ALTER SYSTEM KILL SESSION '123,45678' IMMEDIATE;

-- 3) Verify cleanup
SELECT 
    sid,
    serial#,
    username,
    status,
    last_call_et AS idle_seconds
FROM v$session
WHERE username = USER
ORDER BY last_call_et DESC;

-- 4) Helpers: sessions overview by program
SELECT 
    program,
    status,
    COUNT(*) AS session_count
FROM v$session
WHERE username = USER
GROUP BY program, status
ORDER BY session_count DESC;

-- 5) Quick monitoring snapshot
SELECT 
    TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS check_time,
    COUNT(*) AS session_count,
    SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_count,
    SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_count,
    MAX(last_call_et) AS max_idle_seconds
FROM v$session 
WHERE username = USER;

-- EMERGENCY (DBA only) - bulk kill (commented)
/*
BEGIN
  FOR r IN (
    SELECT sid, serial#
    FROM v$session
    WHERE username = USER
      AND sid != (SELECT sid FROM v$mystat WHERE ROWNUM = 1)
  ) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'ALTER SYSTEM KILL SESSION '''||r.sid||','||r.serial#||''' IMMEDIATE';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/
*/


