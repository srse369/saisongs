import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * DatabaseService handles all database connections and queries to Oracle Autonomous Database.
 * Uses the node-oracledb driver for Oracle database connectivity with thin mode wallet support.
 */
class DatabaseService {
  private pool: oracledb.Pool | null = null;
  private connectionConfig: oracledb.PoolAttributes;

  constructor() {
    const walletPath = path.join(__dirname, '../../wallet');
    console.log('📁 Oracle Wallet location:', walletPath);
    console.log('ℹ️  Using Oracle thin client mode (oracledb 6.x)');
    
    // For thin mode, we need to specify wallet location in connection parameters
    const walletLocation = walletPath;
    const walletPassword = process.env.VITE_ORACLE_WALLET_PASSWORD || ''; // Wallet password set during download
    
    // Get connection configuration from environment variables
    this.connectionConfig = {
      user: process.env.VITE_ORACLE_USER,
      password: process.env.VITE_ORACLE_PASSWORD,
      connectString: process.env.VITE_ORACLE_CONNECT_STRING,
      walletLocation: walletLocation,
      walletPassword: walletPassword,
      poolMin: 1,
      poolMax: 10,
      poolIncrement: 1,
      queueTimeout: 5000, // Fail fast after 5 seconds instead of 60
      connectTimeout: 5000, // Connection timeout of 5 seconds
    };

    if (!this.connectionConfig.user || !this.connectionConfig.password || !this.connectionConfig.connectString) {
      console.error('Oracle database credentials are not defined in environment variables');
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
        this.pool = await oracledb.createPool(this.connectionConfig);
        console.log('✅ Oracle database connection pool established');
      } catch (error) {
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
      console.error('Database query error:', error);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
