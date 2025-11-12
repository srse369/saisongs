import oracledb from 'oracledb';

/**
 * DatabaseService handles all database connections and queries to Oracle Autonomous Database.
 * Uses the node-oracledb driver for Oracle database connectivity.
 */
class DatabaseService {
  private pool: oracledb.Pool | null = null;
  private connectionConfig: oracledb.PoolAttributes;

  constructor() {
    // Get connection configuration from environment variables
    this.connectionConfig = {
      user: import.meta.env.VITE_ORACLE_USER,
      password: import.meta.env.VITE_ORACLE_PASSWORD,
      connectString: import.meta.env.VITE_ORACLE_CONNECT_STRING,
      poolMin: 1,
      poolMax: 10,
      poolIncrement: 1,
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
        console.log('Oracle database connection pool established');
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
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
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

  /**
   * Checks if the database pool is initialized
   * @returns true if initialized, false otherwise
   */
  isConnected(): boolean {
    return this.pool !== null;
  }

  /**
   * Tests the database connection health
   * @returns true if connection is healthy, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.initPool();
      if (!this.pool) {
        return false;
      }
      const connection = await this.pool.getConnection();
      await connection.execute('SELECT 1 FROM DUAL');
      await connection.close();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Resets the connection pool (useful for recovering from connection errors)
   */
  async resetConnection(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close(0); // Force close
      } catch (error) {
        console.error('Error closing existing pool:', error);
      }
      this.pool = null;
    }
    await this.initPool();
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
