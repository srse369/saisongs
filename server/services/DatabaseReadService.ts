import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local' });

/**
 * DatabaseReadService handles database connections and READ operations.
 * Uses the node-oracledb driver for Oracle database connectivity with thin mode wallet support.
 * 
 * This service manages the connection pool and provides all read-only query methods.
 * Write operations are handled by DatabaseWriteService which depends on this service.
 */
class DatabaseReadService {
  private pool: oracledb.Pool | null = null;
  private connectionConfig: oracledb.PoolAttributes;
  private initializingPool: Promise<void> | null = null;
  private activeConnections: Set<oracledb.Connection> = new Set();

  constructor() {
    // Determine wallet path - use absolute path in production, relative in development
    let walletPath: string;
    
    if (process.env.NODE_ENV === 'production') {
      walletPath = '/var/www/songstudio/wallet';
    } else {
      walletPath = path.join(path.dirname(__filename), '../../wallet');
    }
    
    console.log('📁 Oracle Wallet location:', walletPath);
    console.log('ℹ️  Using Oracle thin client mode (oracledb 6.x)');
    
    const walletLocation = walletPath;
    const walletPassword = process.env.ORACLE_WALLET_PASSWORD || '';
    
    // Connection pool configuration for Oracle Autonomous Database Free Tier
    this.connectionConfig = {
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
      walletLocation: walletLocation,
      walletPassword: walletPassword,
      poolMin: 0,
      poolMax: 2,
      poolIncrement: 1,
      poolTimeout: 30,
      queueTimeout: 10000,
      connectTimeout: 20000,
      enableStatistics: true,
      _enableStats: true,
      poolAlias: 'songstudio_pool',
      stmtCacheSize: 0,
      poolPingInterval: -1,
      sessionCallback: undefined,
    };

    if (!this.connectionConfig.user || !this.connectionConfig.password || !this.connectionConfig.connectString) {
      console.error('⚠️  Oracle database credentials are not defined in environment variables');
    }

    // Configure Oracle client
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.autoCommit = true;
    oracledb.fetchAsString = [oracledb.CLOB];
    
    // Periodic cleanup every 2 minutes
    setInterval(() => this.cleanupIdleConnections(), 2 * 60 * 1000);
  }

  /**
   * Initializes the Oracle connection pool
   */
  private async initPool(): Promise<void> {
    if (this.pool) return;

    if (this.initializingPool) {
      await this.initializingPool;
      return;
    }

    this.initializingPool = (async () => {
      try {
        if (!this.connectionConfig.user || !this.connectionConfig.password || !this.connectionConfig.connectString) {
          throw new Error('Oracle database credentials are not configured.');
        }

        if (this.pool) return;

        // Clean up existing pool from previous crashes
        try {
          const existingPool = oracledb.getPool('songstudio_pool');
          console.log('🧹 Cleaning up existing pool from previous run...');
          await existingPool.close(0);
          console.log('✅ Cleaned up stale pool');
        } catch (e) {
          // Pool doesn't exist
        }

        try {
          this.pool = await oracledb.createPool(this.connectionConfig);
          console.log('✅ Oracle database connection pool established');
          console.log(`📊 Pool config: min=${this.connectionConfig.poolMin}, max=${this.connectionConfig.poolMax}`);
        } catch (error: any) {
          if (error.code === 'NJS-046') {
            console.log('⚠️  Pool created by another process, reusing...');
            try {
              this.pool = oracledb.getPool('songstudio_pool');
              console.log('♻️  Successfully reused pool after collision');
              return;
            } catch (reuseError) {
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
   * This is the base query method used by both read and write operations
   */
  async query<T = any>(sql: string, params: any[] | Record<string, any> = [], options: any = {}): Promise<T[]> {
    await this.initPool();

    if (!this.pool) {
      throw new Error('Database pool is not initialized');
    }

    let connection: oracledb.Connection | undefined;
    const connectionStartTime = Date.now();
    
    try {
      connection = await this.pool.getConnection();
      this.activeConnections.add(connection);
      
      const result = await connection.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: options.autoCommit !== false ? true : false,
        ...options
      });
      
      return (result.rows || []) as T[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Database query error:', errorMessage);
      
      if (errorMessage.includes('ORA-00018') || errorMessage.includes('sessions exceeded')) {
        console.error('🚨 CRITICAL: Maximum Oracle sessions exceeded!');
        if (this.pool) {
          try {
            await this.pool.reconfigure({ poolMin: 0, poolMax: 2 });
            console.log('   ↻ Attempted pool cleanup');
          } catch (reconfigError) {
            console.error('   ⚠️  Pool cleanup failed:', reconfigError);
          }
        }
      }
      
      console.error('SQL:', sql.substring(0, 200));
      throw new Error(`Query execution failed: ${errorMessage}`);
    } finally {
      if (connection) {
        try {
          this.activeConnections.delete(connection);
          await connection.close();
          
          const connectionDuration = Date.now() - connectionStartTime;
          if (connectionDuration > 5000) {
            console.warn(`⚠️  Connection held for ${connectionDuration}ms`);
          }
        } catch (err) {
          console.error('Error closing connection:', err);
          this.activeConnections.delete(connection);
        }
      }
      
      if (this.activeConnections.size > 5) {
        console.warn(`⚠️  ${this.activeConnections.size} connections still active`);
      }
    }
  }

  /**
   * Initialize the database pool explicitly
   */
  async initialize(): Promise<void> {
    await this.initPool();
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1 FROM DUAL');
      
      try {
        const sessionInfo = await this.query<any>(`
          SELECT COUNT(*) as current_sessions
          FROM v$session 
          WHERE username = USER
        `);
        
        if (sessionInfo.length > 0) {
          const current = sessionInfo[0].CURRENT_SESSIONS || sessionInfo[0].current_sessions || 0;
          console.log(`📊 Oracle sessions: ${current} active`);
          if (current > 10) {
            console.warn(`⚠️  WARNING: ${current} sessions active - possible leak!`);
          }
        }
      } catch (sessionCheckError) {
        console.log('ℹ️  Unable to check session count');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    if (!this.pool) return;
    
    try {
      const poolStats = this.pool.getStatistics();
      const openConnections = poolStats?.connectionsOpen || 0;
      const inUse = poolStats?.connectionsInUse || 0;
      const poolAvailable = poolStats?.connectionsInPool || 0;
      
      console.log(`🔍 Pool health: ${openConnections} open, ${inUse} in use, ${poolAvailable} available, ${this.activeConnections.size} tracked`);
      
      if (this.activeConnections.size > 0) {
        console.warn(`⚠️  Force-closing ${this.activeConnections.size} tracked connections`);
        for (const conn of this.activeConnections) {
          try {
            await conn.close();
          } catch (err) {
            console.error('Error force-closing tracked connection:', err);
          }
        }
        this.activeConnections.clear();
      }
      
      if (openConnections > 3) {
        console.warn(`🚨 WARNING: ${openConnections} connections open - potential leak!`);
      }
      
      await this.pool.reconfigure({ poolMin: 0, poolMax: 2 });
    } catch (error) {
      console.error('Pool cleanup warning:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Closes the database connection pool
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close(10);
        this.pool = null;
        console.log('Oracle database connection pool closed');
      } catch (error) {
        console.error('Error closing database connection pool:', error);
        throw new Error(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // =====================================================
  // USER READ METHODS
  // =====================================================

  /**
   * Get user by email with all fields
   */
  async getUserByEmail(email: string): Promise<any | null> {
    const users = await this.query<any>(
      'SELECT RAWTOHEX(id) as id, name, email, is_admin, editor_for, center_ids FROM users WHERE LOWER(email) = LOWER(:1)',
      [email.toLowerCase().trim()]
    );
    if (users.length === 0) return null;
    
    const user = users[0];
    return {
      id: user.id || user.ID,
      name: user.name || user.NAME,
      email: user.email || user.EMAIL,
      isAdmin: (user.is_admin || user.IS_ADMIN) === 1,
      editorFor: this.parseJsonField(user.editor_for || user.EDITOR_FOR),
      centerIds: this.parseJsonField(user.center_ids || user.CENTER_IDS),
    };
  }

  /**
   * Get basic user info by email (for OTP request)
   */
  async getUserBasicInfo(email: string): Promise<{ id: string; name: string; email: string } | null> {
    const users = await this.query<any>(
      'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(:1)',
      [email.toLowerCase().trim()]
    );
    if (users.length === 0) return null;
    
    const user = users[0];
    return {
      id: user.id || user.ID,
      name: user.name || user.NAME,
      email: user.email || user.EMAIL,
    };
  }

  /**
   * Get all admin users
   */
  async getAdminUsers(): Promise<Array<{ id: string; name: string; email: string }>> {
    const admins = await this.query<any>(
      `SELECT RAWTOHEX(id) as id, name, email 
       FROM users 
       WHERE is_admin = 1 
       ORDER BY name`
    );
    return admins.map((admin: any) => ({
      id: admin.id || admin.ID,
      name: admin.name || admin.NAME,
      email: admin.email || admin.EMAIL,
    }));
  }

  /**
   * Get valid unused OTP code
   */
  async getValidOTPCode(email: string, code: string): Promise<any | null> {
    const records = await this.query<any>(
      `SELECT id, code, email, expires_at, used FROM otp_codes 
       WHERE email = :1 AND code = :2 AND used = 0 
       ORDER BY created_at DESC`,
      [email.toLowerCase().trim(), code]
    );
    if (records.length === 0) return null;
    
    const record = records[0];
    return {
      id: record.id || record.ID,
      code: record.code || record.CODE,
      email: record.email || record.EMAIL,
      expiresAt: record.expires_at || record.EXPIRES_AT,
      used: record.used || record.USED,
    };
  }

  // =====================================================
  // SONG READ METHODS
  // =====================================================

  /**
   * Count pitches for a song
   */
  async getSongPitchCount(songId: string): Promise<number> {
    const result = await this.query<any>(
      'SELECT COUNT(*) as count FROM song_singer_pitches WHERE song_id = HEXTORAW(:1)',
      [songId]
    );
    return result[0]?.COUNT || result[0]?.count || 0;
  }

  /**
   * Count session items for a song
   */
  async getSongSessionItemCount(songId: string): Promise<number> {
    const result = await this.query<any>(
      'SELECT COUNT(*) as count FROM song_session_items WHERE song_id = HEXTORAW(:1)',
      [songId]
    );
    return result[0]?.COUNT || result[0]?.count || 0;
  }

  // =====================================================
  // SESSION READ METHODS
  // =====================================================

  /**
   * Get all sessions (raw, unfiltered)
   */
  async getAllSessions(): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    centerIds?: number[];
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
  }>> {
    const sessions = await this.query<any>(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        center_ids,
        created_by,
        created_at,
        updated_at
      FROM song_sessions 
      ORDER BY name
    `);

    return sessions.map((row: any) => {
      let centerIds: number[] | undefined = undefined;
      try {
        const centerIdsJson = row.CENTER_IDS || row.center_ids;
        if (centerIdsJson) {
          const parsed = JSON.parse(centerIdsJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            centerIds = parsed;
          }
        }
      } catch (e) {
        console.error('[DB] Error parsing center_ids:', e);
      }

      return {
        id: row.ID || row.id,
        name: row.NAME || row.name,
        description: row.DESCRIPTION || row.description,
        centerIds,
        createdBy: row.CREATED_BY || row.created_by,
        createdAt: new Date(row.CREATED_AT || row.created_at).toISOString(),
        updatedAt: new Date(row.UPDATED_AT || row.updated_at).toISOString(),
      };
    });
  }

  /**
   * Get session ID by session item ID
   */
  async getSessionIdByItemId(itemId: string): Promise<string | null> {
    const result = await this.query<any>(
      'SELECT RAWTOHEX(session_id) as session_id FROM song_session_items WHERE RAWTOHEX(id) = :1',
      [itemId]
    );
    if (result.length === 0) return null;
    return result[0]?.session_id || result[0]?.SESSION_ID || null;
  }

  // =====================================================
  // SINGER READ METHODS
  // =====================================================

  /**
   * Count pitches for a singer
   */
  async getSingerPitchCount(singerId: string): Promise<number> {
    const result = await this.query<any>(
      'SELECT COUNT(*) as count FROM song_singer_pitches WHERE singer_id = HEXTORAW(:1)',
      [singerId]
    );
    return result[0]?.COUNT || result[0]?.count || 0;
  }

  /**
   * Get all pitches for a singer
   */
  async getSingerPitches(singerId: string): Promise<Array<{ id: string; songId: string }>> {
    const result = await this.query<any>(
      `SELECT RAWTOHEX(id) as id, RAWTOHEX(song_id) as song_id 
       FROM song_singer_pitches 
       WHERE singer_id = HEXTORAW(:1)`,
      [singerId]
    );
    return result.map((row: any) => ({
      id: row.id || row.ID,
      songId: row.song_id || row.SONG_ID,
    }));
  }

  /**
   * Check if singer already has a pitch for a song
   */
  async checkSingerHasSongPitch(singerId: string, songId: string): Promise<boolean> {
    const result = await this.query<any>(
      `SELECT COUNT(*) as count 
       FROM song_singer_pitches 
       WHERE singer_id = HEXTORAW(:1) AND song_id = HEXTORAW(:2)`,
      [singerId, songId]
    );
    return (result[0]?.COUNT || result[0]?.count || 0) > 0;
  }

  // =====================================================
  // TEMPLATE READ METHODS
  // =====================================================

  /**
   * Get all presentation templates
   */
  async getAllTemplates(): Promise<any[]> {
    return await this.query<any>(`
      SELECT id, name, description, template_json, center_ids, is_default, created_at, updated_at
      FROM presentation_templates
      ORDER BY is_default DESC, name ASC
    `);
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<any | null> {
    const result = await this.query<any>(`
      SELECT id, name, description, template_json, center_ids, is_default, created_at, updated_at
      FROM presentation_templates
      WHERE id = :1
    `, [id]);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get default template
   */
  async getDefaultTemplate(): Promise<any | null> {
    const result = await this.query<any>(`
      SELECT id, name, description, template_json, center_ids, is_default, created_at, updated_at
      FROM presentation_templates
      WHERE is_default = 1
      FETCH FIRST 1 ROWS ONLY
    `);
    return result.length > 0 ? result[0] : null;
  }

  // =====================================================
  // ANALYTICS READ METHODS
  // =====================================================

  /**
   * Get total visits count since a date
   */
  async getTotalVisitsCount(sinceDate: Date): Promise<number> {
    const result = await this.query<any>(`
      SELECT COUNT(*) as total
      FROM visitor_analytics
      WHERE visit_timestamp >= :1
    `, [sinceDate]);
    return Number(result[0]?.TOTAL || result[0]?.total || 0);
  }

  /**
   * Get unique visitors count since a date
   */
  async getUniqueVisitorsCount(sinceDate: Date): Promise<number> {
    const result = await this.query<any>(`
      SELECT COUNT(DISTINCT ip_address) as unique_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1
    `, [sinceDate]);
    return Number(result[0]?.UNIQUE_COUNT || result[0]?.unique_count || 0);
  }

  /**
   * Get top countries since a date
   */
  async getTopCountries(sinceDate: Date, limit: number = 10): Promise<any[]> {
    return await this.query<any>(`
      SELECT 
        country,
        country_code,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 AND country IS NOT NULL
      GROUP BY country, country_code
      ORDER BY visit_count DESC
      FETCH FIRST :2 ROWS ONLY
    `, [sinceDate, limit]);
  }

  /**
   * Get top pages since a date
   */
  async getTopPages(sinceDate: Date, limit: number = 10): Promise<any[]> {
    return await this.query<any>(`
      SELECT 
        page_path as page,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 AND page_path IS NOT NULL
      GROUP BY page_path
      ORDER BY visit_count DESC
      FETCH FIRST :2 ROWS ONLY
    `, [sinceDate, limit]);
  }

  /**
   * Get recent visits since a date
   */
  async getRecentVisits(sinceDate: Date, limit: number = 50): Promise<any[]> {
    return await this.query<any>(`
      SELECT 
        RAWTOHEX(id) as id,
        ip_address,
        country,
        city,
        page_path,
        user_role,
        visit_timestamp,
        TO_CHAR(visit_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"') as timestamp_utc
      FROM visitor_analytics
      WHERE visit_timestamp >= :1
      ORDER BY visit_timestamp DESC
      FETCH FIRST :2 ROWS ONLY
    `, [sinceDate, limit]);
  }

  /**
   * Get visitor locations for map since a date
   */
  async getVisitorLocations(sinceDate: Date): Promise<any[]> {
    return await this.query<any>(`
      SELECT 
        latitude,
        longitude,
        city,
        country,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      GROUP BY latitude, longitude, city, country
      ORDER BY visit_count DESC
    `, [sinceDate]);
  }

  /**
   * Get visitor locations with country code since a date
   */
  async getVisitorLocationsWithCountryCode(sinceDate: Date): Promise<any[]> {
    return await this.query<any>(`
      SELECT 
        latitude,
        longitude,
        city,
        country,
        country_code,
        COUNT(*) as visit_count
      FROM visitor_analytics
      WHERE visit_timestamp >= :1 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      GROUP BY latitude, longitude, city, country, country_code
      ORDER BY visit_count DESC
    `, [sinceDate]);
  }

  // =====================================================
  // SESSION STORE READ METHODS
  // =====================================================

  /**
   * Get session by SID
   */
  async getSessionBySid(sid: string): Promise<any | null> {
    const result = await this.query<any>(
      `SELECT sess, expire FROM sessions WHERE sid = :1`,
      [sid]
    );
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get active session count
   */
  async getActiveSessionCount(): Promise<number> {
    const result = await this.query<any>(
      `SELECT COUNT(*) as cnt FROM sessions WHERE expire > SYSTIMESTAMP`
    );
    return result[0]?.CNT || result[0]?.cnt || 0;
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Safely parse JSON field from database
   */
  parseJsonField(jsonString: string | null): any[] {
    if (!jsonString) return [];
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('[DB] Error parsing JSON field:', e);
      return [];
    }
  }

  // =====================================================
  // RAW QUERY EXECUTION (for CacheService complex operations)
  // These methods should ONLY be called from CacheService
  // =====================================================

  /**
   * Execute a raw SELECT query
   * @internal For use by CacheService only
   */
  async executeQuery<T = any>(sql: string, params: any[] | Record<string, any> = [], options: any = {}): Promise<T[]> {
    return await this.query<T>(sql, params, options);
  }
}

// Export singleton instance
export const databaseReadService = new DatabaseReadService();
export default databaseReadService;

