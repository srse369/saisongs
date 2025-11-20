-- Kill Hung Oracle Sessions Script
-- Run this in Oracle SQL Developer or SQL*Plus when you have hung sessions

-- Step 1: Identify hung sessions (idle > 5 minutes)
SELECT 
    sid,
    serial#,
    username,
    program,
    status,
    last_call_et as idle_seconds,
    sql_id,
    'ALTER SYSTEM KILL SESSION ''' || sid || ',' || serial# || ''' IMMEDIATE;' as kill_command
FROM v$session 
WHERE username = USER  -- Your current user
  AND last_call_et > 300  -- Idle for more than 5 minutes
  AND status != 'ACTIVE'
ORDER BY last_call_et DESC;

-- Step 2: Copy the generated kill_command values above and execute them
-- Example:
-- ALTER SYSTEM KILL SESSION '123,45678' IMMEDIATE;

-- Step 3: Verify all sessions are killed
SELECT 
    sid,
    serial#,
    username,
    status,
    last_call_et as idle_seconds
FROM v$session 
WHERE username = USER
ORDER BY last_call_et DESC;

-- Step 4: Check recursive SQL statistics
SELECT 
    parsing_schema_name,
    SUBSTR(sql_text, 1, 80) as sql_text_preview,
    executions,
    ROUND(elapsed_time / 1000000, 2) as elapsed_sec
FROM v$sql 
WHERE parsing_schema_name = USER
  AND executions > 100  -- Queries executed more than 100 times
ORDER BY executions DESC
FETCH FIRST 20 ROWS ONLY;

