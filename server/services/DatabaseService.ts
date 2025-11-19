import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
// In production, load from .env, in development from .env.local
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local' });

/**
 * DatabaseService handles all database connections and queries to Oracle Autonomous Database.
 * Uses the node-oracledb driver for Oracle database connectivity with thin mode wallet support.
 */
class DatabaseService {
  private pool: oracledb.Pool | null = null;
  private connectionConfig: oracledb.PoolAttributes;

  constructor() {
    // Determine wallet path - use absolute path in production, relative in development
    let walletPath: string;
    
    if (process.env.NODE_ENV === 'production') {
      // In production, wallet is in the app directory
      walletPath = '/var/www/songstudio/wallet';
    } else {
      // In development, use relative path from current file
      walletPath = path.join(path.dirname(__filename), '../../wallet');
    }
    
    console.log('📁 Oracle Wallet location:', walletPath);
    console.log('ℹ️  Using Oracle thin client mode (oracledb 6.x)');
    
    // For thin mode, we need to specify wallet location in connection parameters
    const walletLocation = walletPath;
    const walletPassword = process.env.VITE_ORACLE_WALLET_PASSWORD || ''; // Wallet password set during download
    
    // Get connection configuration from environment variables
    // Use VERY conservative pool settings for Oracle Autonomous Database Free Tier
    // Free Tier limits: 20 concurrent connections, limited OCPU
    this.connectionConfig = {
      user: process.env.VITE_ORACLE_USER,
      password: process.env.VITE_ORACLE_PASSWORD,
      connectString: process.env.VITE_ORACLE_CONNECT_STRING,
      walletLocation: walletLocation,
      walletPassword: walletPassword,
      poolMin: 0,                   // Start with 0 connections
      poolMax: 1,                   // ONLY 1 connection to stay well under limit
      poolIncrement: 1,             // Add 1 connection at a time
      poolTimeout: 60,              // Wait 1 minute for connection from pool
      queueTimeout: 10000,          // Wait 10 seconds in queue before failing
      connectTimeout: 15000,        // Connection timeout of 15 seconds
      enableStatistics: true,       // Enable pool statistics
      _enableStats: true,           // Internal stats
      poolAlias: 'songstudio_pool', // Named pool for monitoring
      stmtCacheSize: 0,             // Disable statement caching to reduce memory
      poolPingInterval: 60,         // Check connection health every 60 seconds
    };

    if (!this.connectionConfig.user || !this.connectionConfig.password || !this.connectionConfig.connectString) {
      console.error('⚠️  Oracle database credentials are not defined in environment variables');
      console.error('⚠️  Database operations will fail until credentials are configured');
    }

    // Configure Oracle client for optimal performance
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.autoCommit = true;
  }

  /**
   * Initializes the Oracle connection pool
   * @throws Error if connection configuration is missing or pool creation fails
   */
  private async initPool(): Promise<void> {
    if (!this.connectionConfig.user || !this.connectionConfig.password || !this.connectionConfig.connectString) {
      throw new Error('Oracle database credentials are not configured. Please set VITE_ORACLE_USER, VITE_ORACLE_PASSWORD, and VITE_ORACLE_CONNECT_STRING in your .env.local file.');
    }

    if (!this.pool) {
      try {
        // Check if pool with this alias already exists and reuse it
        try {
          this.pool = oracledb.getPool('songstudio_pool');
          console.log('♻️  Reusing existing Oracle database connection pool');
          return;
        } catch (e) {
          // Pool doesn't exist, continue to create it
        }

        // If we get here, pool doesn't exist - create new pool
        this.pool = await oracledb.createPool(this.connectionConfig);
        console.log('✅ Oracle database connection pool established');
      } catch (error: any) {
        // If pool alias already exists (race condition), try to reuse it
        if (error.code === 'NJS-046') {
          console.log('⚠️  Pool alias already exists, attempting to reuse...');
          try {
            this.pool = oracledb.getPool('songstudio_pool');
            console.log('♻️  Successfully reused existing pool after collision');
            return;
          } catch (reuseError) {
            console.error('Failed to reuse existing pool:', reuseError);
          }
        }
        
        console.error('Failed to create Oracle connection pool:', error);
        throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Executes a parameterized SQL query
   * @param sql - SQL query string with :1, :2, etc. placeholders for Oracle
   * @param params - Array of parameters to bind to the query
   * @returns Query result rows
   * @throws Error if query execution fails
   */
  async query<T = any>(sql: string, params: any[] | Record<string, any> = []): Promise<T[]> {
    await this.initPool();

    if (!this.pool) {
      throw new Error('Database pool is not initialized');
    }

    let connection: oracledb.Connection | undefined;
    try {
      connection = await this.pool.getConnection();
      const result = await connection.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });
      
      return (result.rows || []) as T[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Database query error:', errorMessage);
      
      // Check for quota/connection limit errors
      if (errorMessage.includes('quota') || 
          errorMessage.includes('QUOTA') ||
          errorMessage.includes('exceeded') ||
          errorMessage.includes('limit') ||
          errorMessage.includes('ORA-')) {
        console.error('⚠️  Oracle Database limit reached. Consider upgrading or optimizing queries.');
        console.error('Free Tier limits: 20 concurrent connections, 1 OCPU, 20GB storage');
      }
      
      console.error('SQL:', sql.substring(0, 200)); // Log first 200 chars only
      throw new Error(`Query execution failed: ${errorMessage}`);
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error('Error closing connection:', err);
        }
      }
    }
  }

  /**
   * Closes the database connection pool
   * Should be called when the application is shutting down
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close(10); // 10 seconds drain time
        this.pool = null;
        console.log('Oracle database connection pool closed');
      } catch (error) {
        console.error('Error closing database connection pool:', error);
        throw new Error(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
