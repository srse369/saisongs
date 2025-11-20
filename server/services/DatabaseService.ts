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
  private initializingPool: Promise<void> | null = null;

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
    // Use conservative pool settings for Oracle Autonomous Database Free Tier
    // Free Tier limits: 20 concurrent connections, limited OCPU
    // Using 5 max connections keeps us well under the limit while avoiding timeouts
    this.connectionConfig = {
      user: process.env.VITE_ORACLE_USER,
      password: process.env.VITE_ORACLE_PASSWORD,
      connectString: process.env.VITE_ORACLE_CONNECT_STRING,
      walletLocation: walletLocation,
      walletPassword: walletPassword,
      poolMin: 0,                   // Start with 0 connections (create on-demand)
      poolMax: 3,                   // Reduced to 3 connections to be more conservative
      poolIncrement: 1,             // Add 1 connection at a time
      poolTimeout: 120,             // Wait 2 minutes for connection from pool
      queueTimeout: 120000,         // Wait 120 seconds in queue
      connectTimeout: 60000,        // Connection timeout of 60 seconds
      enableStatistics: true,       // Enable pool statistics
      _enableStats: true,           // Internal stats
      poolAlias: 'songstudio_pool', // Named pool for monitoring
      stmtCacheSize: 0,             // Disable statement caching to reduce memory
      poolPingInterval: 30,         // Check connection health every 30 seconds
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
   * Uses a singleton pattern with promise locking to prevent race conditions
   * @throws Error if connection configuration is missing or pool creation fails
   */
  private async initPool(): Promise<void> {
    // If pool already exists, return immediately
    if (this.pool) {
      return;
    }

    // If pool is currently being initialized, wait for that to complete
    if (this.initializingPool) {
      await this.initializingPool;
      return;
    }

    // Start pool initialization with promise lock
    this.initializingPool = (async () => {
      try {
        if (!this.connectionConfig.user || !this.connectionConfig.password || !this.connectionConfig.connectString) {
          throw new Error('Oracle database credentials are not configured. Please set VITE_ORACLE_USER, VITE_ORACLE_PASSWORD, and VITE_ORACLE_CONNECT_STRING in your .env.local file.');
        }

        // Double-check pool doesn't exist (could have been created by another call)
        if (this.pool) {
          return;
        }

        // Try to close any existing pool first (cleanup from previous crashes)
        try {
          const existingPool = oracledb.getPool('songstudio_pool');
          console.log('🧹 Cleaning up existing pool from previous run...');
          await existingPool.close(0); // Force close immediately
          console.log('✅ Cleaned up stale pool');
        } catch (e) {
          // Pool doesn't exist, which is good
        }

        // Create new pool
        try {
          this.pool = await oracledb.createPool(this.connectionConfig);
          console.log('✅ Oracle database connection pool established');
          console.log(`📊 Pool config: min=${this.connectionConfig.poolMin}, max=${this.connectionConfig.poolMax}`);
        } catch (error: any) {
          // Handle race condition where another process created the pool
          if (error.code === 'NJS-046') {
            console.log('⚠️  Pool created by another process, reusing...');
            try {
              this.pool = oracledb.getPool('songstudio_pool');
              console.log('♻️  Successfully reused pool after collision');
              return;
            } catch (reuseError) {
              console.error('Failed to reuse pool after collision:', reuseError);
              throw reuseError;
            }
          }
          throw error;
        }
      } catch (error) {
        console.error('Failed to initialize Oracle connection pool:', error);
        throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        this.initializingPool = null;
      }
    })();

    await this.initializingPool;
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
   * Initialize the database pool explicitly
   * Useful for warming up the connection before handling requests
   */
  async initialize(): Promise<void> {
    await this.initPool();
  }

  /**
   * Test database connection with a simple query
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing database connection...');
      const startTime = Date.now();
      await this.query('SELECT 1 FROM DUAL');
      const duration = Date.now() - startTime;
      console.log(`✅ Database connection test successful (${duration}ms)`);
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error instanceof Error ? error.message : error);
      return false;
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
