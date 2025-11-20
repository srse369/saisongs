/**
 * Database Diagnostics Script
 * This script helps identify the cause of recursive SQL executions
 */

import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECTION_STRING || process.env.DB_HOST,
  walletLocation: path.join(__dirname, 'wallet'),
  walletPassword: process.env.DB_WALLET_PASSWORD || '',
};

console.log('Config:', {
  user: config.user,
  hasPassword: !!config.password,
  connectString: config.connectString,
  walletLocation: config.walletLocation
});

console.log('🔍 Oracle Database Diagnostics');
console.log('================================\n');

async function runDiagnostics() {
  let connection;
  
  try {
    console.log('1️⃣  Attempting single connection (no pool)...');
    const startTime = Date.now();
    
    connection = await oracledb.getConnection(config);
    const connectTime = Date.now() - startTime;
    
    console.log(`✅ Connection established in ${connectTime}ms\n`);
    
    // Test basic query
    console.log('2️⃣  Testing basic query...');
    const queryStart = Date.now();
    const result = await connection.execute('SELECT 1 FROM DUAL');
    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query executed in ${queryTime}ms\n`);
    
    // Check current sessions
    console.log('3️⃣  Checking active sessions...');
    const sessions = await connection.execute(`
      SELECT 
        sid,
        serial#,
        username,
        program,
        status,
        last_call_et as idle_seconds,
        sql_id
      FROM v$session 
      WHERE username = :user
      ORDER BY last_call_et DESC
    `, [config.user.toUpperCase()]);
    
    console.log(`📊 Active sessions for user ${config.user}:`, sessions.rows.length);
    if (sessions.rows.length > 0) {
      console.log('\nSession Details:');
      sessions.rows.forEach((row, i) => {
        console.log(`  Session ${i + 1}:`);
        console.log(`    SID: ${row[0]}, Serial#: ${row[1]}`);
        console.log(`    Program: ${row[3]}`);
        console.log(`    Status: ${row[4]}`);
        console.log(`    Idle: ${row[5]} seconds`);
        console.log(`    SQL_ID: ${row[6] || 'N/A'}`);
      });
    }
    console.log('');
    
    // Check for hung sessions (idle > 5 minutes)
    console.log('4️⃣  Checking for hung sessions (idle > 300s)...');
    const hungSessions = sessions.rows.filter(row => row[5] > 300);
    if (hungSessions.length > 0) {
      console.log(`⚠️  Found ${hungSessions.length} hung sessions!`);
      console.log('\nTo kill these sessions, run:');
      hungSessions.forEach(row => {
        console.log(`  ALTER SYSTEM KILL SESSION '${row[0]},${row[1]}' IMMEDIATE;`);
      });
    } else {
      console.log('✅ No hung sessions found\n');
    }
    
    // Check recent recursive SQL
    console.log('5️⃣  Checking recursive SQL statistics...');
    try {
      const recursiveStats = await connection.execute(`
        SELECT 
          parsing_schema_name,
          sql_text,
          executions,
          elapsed_time / 1000000 as elapsed_sec
        FROM v$sql 
        WHERE parsing_schema_name = :user
          AND command_type != 47  -- Exclude PL/SQL blocks
        ORDER BY executions DESC
        FETCH FIRST 10 ROWS ONLY
      `, [config.user.toUpperCase()]);
      
      console.log('📈 Top 10 most executed queries:');
      if (recursiveStats.rows.length > 0) {
        recursiveStats.rows.forEach((row, i) => {
          const sqlText = row[1].substring(0, 80).replace(/\n/g, ' ');
          console.log(`\n  ${i + 1}. Executions: ${row[2]}, Time: ${row[3].toFixed(2)}s`);
          console.log(`     SQL: ${sqlText}...`);
        });
      } else {
        console.log('  No queries found');
      }
      console.log('');
    } catch (err) {
      console.log('⚠️  Could not query v$sql (may need DBA privileges)\n');
    }
    
    // Check table sizes
    console.log('6️⃣  Checking table row counts...');
    const tables = ['songs', 'singers', 'song_singer_pitches', 'named_sessions', 'session_items'];
    for (const table of tables) {
      try {
        const count = await connection.execute(`SELECT COUNT(*) as cnt FROM ${table}`);
        console.log(`  ${table}: ${count.rows[0][0]} rows`);
      } catch (err) {
        console.log(`  ${table}: Error - ${err.message}`);
      }
    }
    console.log('');
    
    // Check for invalid objects
    console.log('7️⃣  Checking for invalid database objects...');
    const invalidObjects = await connection.execute(`
      SELECT object_name, object_type, status
      FROM user_objects
      WHERE status != 'VALID'
    `);
    
    if (invalidObjects.rows.length > 0) {
      console.log(`⚠️  Found ${invalidObjects.rows.length} invalid objects:`);
      invalidObjects.rows.forEach(row => {
        console.log(`  ${row[1]}: ${row[0]} (${row[2]})`);
      });
    } else {
      console.log('✅ All database objects are valid\n');
    }
    
    console.log('================================');
    console.log('✅ Diagnostics complete');
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
    if (error.message.includes('NJS-040')) {
      console.error('\n⚠️  Connection timeout detected!');
      console.error('   This suggests the database is overwhelmed or unreachable.');
      console.error('   Recommendations:');
      console.error('   1. Restart Oracle Autonomous Database in Oracle Cloud Console');
      console.error('   2. Check if there are hung sessions blocking resources');
      console.error('   3. Verify network connectivity and wallet configuration');
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('🔌 Connection closed');
      } catch (err) {
        console.error('Error closing connection:', err.message);
      }
    }
  }
}

runDiagnostics().catch(console.error);

