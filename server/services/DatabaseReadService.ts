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
      walletPath = '/var/www/saisongs/wallet';
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
      poolAlias: 'saisongs_pool',
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
          const existingPool = oracledb.getPool('saisongs_pool');
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
              this.pool = oracledb.getPool('saisongs_pool');
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
   * Executes a query and returns the full result object (including rowsAffected)
   * Used for DELETE/UPDATE operations that need to check if rows were affected
   */
  async queryWithResult<T = any>(sql: string, params: any[] | Record<string, any> = [], options: any = {}): Promise<oracledb.Result<T>> {
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

      return result;
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
    // Get is_admin value (Oracle returns uppercase)
    const isAdminVal = user.is_admin ?? user.IS_ADMIN ?? 0;

    return {
      id: user.id || user.ID,
      name: user.name || user.NAME,
      email: user.email || user.EMAIL,
      isAdmin: isAdminVal === 1 || isAdminVal === '1' || isAdminVal === true,
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
  // CACHE SERVICE READ METHODS
  // These methods are specifically for CacheService to use
  // =====================================================

  /**
   * Get all songs without CLOB fields (for caching)
   */
  async getAllSongsForCache(): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(s.id) as id,
        s.name,
        s.external_source_url,
        s."LANGUAGE" as language,
        s.deity,
        s.tempo,
        s.beat,
        s.raga,
        s."LEVEL" as song_level,
        s.audio_link,
        s.golden_voice,
        s.reference_gents_pitch,
        s.reference_ladies_pitch,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.song_id = s.id) as pitch_count
      FROM songs s
      ORDER BY LTRIM(REGEXP_REPLACE(LOWER(s.name), '[^a-zA-Z0-9 ]', ''), '0123456789 ')
    `);
  }

  /**
   * Get a single song with CLOB fields (for caching)
   */
  async getSongWithClobsForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(s.id) as id,
        s.name,
        s.external_source_url,
        DBMS_LOB.SUBSTR(s.lyrics, 4000, 1) AS lyrics,
        DBMS_LOB.SUBSTR(s.meaning, 4000, 1) AS meaning,
        s."LANGUAGE" as language,
        s.deity,
        s.tempo,
        s.beat,
        s.raga,
        s."LEVEL" as song_level,
        DBMS_LOB.SUBSTR(s.song_tags, 4000, 1) AS song_tags,
        s.audio_link,
        s.video_link,
        s.golden_voice,
        s.reference_gents_pitch,
        s.reference_ladies_pitch,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.song_id = s.id) as pitch_count
      FROM songs s
      WHERE RAWTOHEX(s.id) = :1
    `, [id]);
  }

  /**
   * Get newly created song by name (for caching)
   */
  async getNewSongByNameForCache(name: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        external_source_url,
        DBMS_LOB.SUBSTR(lyrics, 4000, 1) AS lyrics,
        DBMS_LOB.SUBSTR(meaning, 4000, 1) AS meaning,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        DBMS_LOB.SUBSTR(song_tags, 4000, 1) AS song_tags,
        audio_link,
        golden_voice,
        reference_gents_pitch,
        reference_ladies_pitch
      FROM songs
      WHERE name = :name
      ORDER BY created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, { name });
  }

  /**
   * Get updated song by ID (for caching)
   */
  async getUpdatedSongByIdForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        external_source_url,
        lyrics,
        meaning,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        song_tags,
        audio_link,
        golden_voice,
        reference_gents_pitch,
        reference_ladies_pitch
      FROM songs
      WHERE RAWTOHEX(id) = :id
    `, { id: id });
  }

  /**
   * Get all singers (for caching)
   */
  async getAllSingersForCache(): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(u.id) as id,
        u.name,
        u.gender,
        u.email,
        u.is_admin,
        u.center_ids,
        u.editor_for,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.singer_id = u.id) as pitch_count
      FROM users u
      WHERE u.name IS NOT NULL
      ORDER BY u.name
    `);
  }

  /**
   * Get a single singer by ID (for caching)
   */
  async getSingerByIdForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(u.id) as id,
        u.name,
        u.gender,
        u.email,
        u.is_admin,
        u.center_ids,
        u.editor_for,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.singer_id = u.id) as pitch_count
      FROM users u
      WHERE RAWTOHEX(u.id) = :1
    `, [id]);
  }

  /**
   * Get newly created singer by name (for caching)
   */
  async getNewSingerByNameForCache(name: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        gender,
        email,
        center_ids,
        editor_for
      FROM users
      WHERE name = :1
      ORDER BY created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, [name]);
  }

  /**
   * Get singer admin/center data before update (for caching)
   */
  async getSingerForUpdateForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(u.id) as id,
        u.is_admin,
        u.center_ids,
        u.editor_for
      FROM users u
      WHERE RAWTOHEX(u.id) = :1
    `, [id]);
  }

  /**
   * Get updated singer by ID (for caching)
   */
  async getUpdatedSingerByIdForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(u.id) as id,
        u.name,
        u.gender,
        u.email,
        u.is_admin,
        u.center_ids,
        u.editor_for,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.singer_id = u.id) as pitch_count
      FROM users u
      WHERE RAWTOHEX(u.id) = :1
    `, [id]);
  }

  /**
   * Get user by ID for admin status check (for caching)
   */
  async getUserEmailByIdForCache(id: string): Promise<any[]> {
    return await this.query(
      `SELECT email FROM users WHERE RAWTOHEX(id) = :1`,
      [id]
    );
  }

  /**
   * Get user editor_for by ID (for caching)
   */
  async getUserEditorForByIdForCache(id: string): Promise<any[]> {
    return await this.query(
      `SELECT RAWTOHEX(id) as id, editor_for FROM users WHERE RAWTOHEX(id) = :1`,
      [id]
    );
  }

  /**
   * Get all pitches with song and singer names (for caching)
   */
  async getAllPitchesForCache(): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name
      FROM song_singer_pitches ssp
      LEFT JOIN songs s ON ssp.song_id = s.id
      LEFT JOIN users si ON ssp.singer_id = si.id
      ORDER BY LTRIM(REGEXP_REPLACE(LOWER(s.name), '[^a-zA-Z0-9 ]', ''), '0123456789 ') NULLS LAST, LTRIM(REGEXP_REPLACE(LOWER(si.name), '[^a-zA-Z0-9 ]', ''), '0123456789 ') NULLS LAST
    `);
  }

  /**
   * Get a single pitch by ID (for caching)
   */
  async getPitchByIdForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name
      FROM song_singer_pitches ssp
      LEFT JOIN songs s ON ssp.song_id = s.id
      LEFT JOIN users si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.id) = :1
    `, [id]);
  }

  /**
   * Get newly created pitch (for caching)
   */
  async getNewPitchForCache(songId: string, singerId: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name
      FROM song_singer_pitches ssp
      JOIN songs s ON ssp.song_id = s.id
      JOIN users si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.song_id) = :1 AND RAWTOHEX(ssp.singer_id) = :2
      ORDER BY ssp.created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, [songId, singerId]);
  }

  /**
   * Get updated pitch by ID (for caching)
   */
  async getUpdatedPitchForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name
      FROM song_singer_pitches ssp
      JOIN songs s ON ssp.song_id = s.id
      JOIN users si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.id) = :1
    `, [id]);
  }

  /**
   * Get pitch count for a song (for caching)
   */
  async getSongPitchCountForCache(songId: string): Promise<any[]> {
    return await this.query(`
      SELECT COUNT(*) as pitch_count
      FROM song_singer_pitches
      WHERE RAWTOHEX(song_id) = :1
    `, [songId]);
  }

  /**
   * Get pitch count for a singer (for caching)
   */
  async getSingerPitchCountForCache(singerId: string): Promise<any[]> {
    return await this.query(`
      SELECT COUNT(*) as pitch_count
      FROM song_singer_pitches
      WHERE RAWTOHEX(singer_id) = :1
    `, [singerId]);
  }

  /**
   * Get all centers (for caching)
   */
  async getAllCentersForCache(): Promise<any[]> {
    return await this.query(
      `SELECT id, name, badge_text_color, created_at, created_by, updated_at, updated_by
       FROM centers 
       ORDER BY name ASC`
    );
  }

  /**
   * Get all users with editor_for and center_ids (for caching)
   */
  async getAllUsersForCentersCache(): Promise<any[]> {
    return await this.query(
      `SELECT RAWTOHEX(id) as id, editor_for, center_ids, name
        FROM users WHERE name IS NOT NULL`
    );
  }

  /**
   * Get center by ID (for caching)
   */
  async getCenterByIdForCache(id: string | number): Promise<any[]> {
    return await this.query(
      `SELECT id, name, badge_text_color, created_at, created_by, updated_at, updated_by
       FROM centers 
       WHERE id = :1`,
      [id]
    );
  }

  /**
   * Get editors for a center (for caching)
   */
  async getCenterEditorsForCache(id: string | number): Promise<any[]> {
    return await this.query(
      `SELECT RAWTOHEX(id) as id FROM users 
       WHERE editor_for IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM JSON_TABLE(editor_for, '$[*]'
           COLUMNS (center_id NUMBER PATH '$')
         ) jt
         WHERE jt.center_id = :1
       )`,
      [id]
    );
  }

  /**
   * Get newly created center by name (for caching)
   */
  async getNewCenterByNameForCache(name: string): Promise<any[]> {
    return await this.query(
      `SELECT id, name, badge_text_color, created_at, updated_at 
       FROM centers 
       WHERE name = :1 
       ORDER BY created_at DESC`,
      [name]
    );
  }

  /**
   * Get all sessions (for caching)
   */
  async getAllSessionsForCache(): Promise<any[]> {
    return await this.query(`
        SELECT 
          RAWTOHEX(id) as id,
          name,
          description,
          center_ids,
          created_at,
          created_by,
          updated_at,
          updated_by
        FROM song_sessions 
        ORDER BY name
      `);
  }

  /**
   * Get session by ID (for caching)
   */
  async getSessionByIdForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        center_ids,
        created_by,
        created_at,
        updated_at
      FROM song_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);
  }

  /**
   * Get session items with details (for caching)
   */
  async getSessionItemsForCache(sessionId: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(si.id) as id,
        RAWTOHEX(si.session_id) as session_id,
        RAWTOHEX(si.song_id) as song_id,
        RAWTOHEX(si.singer_id) as singer_id,
        si.pitch,
        si.sequence_order,
        si.created_at,
        si.updated_at,
        s.name as song_name,
        s.deity as song_deity,
        s.language as song_language,
        s.tempo as song_tempo,
        s.raga as song_raga,
        sg.name as singer_name,
        sg.gender as singer_gender,
        sg.center_ids as singer_center_ids
      FROM song_session_items si
      JOIN songs s ON si.song_id = s.id
      LEFT JOIN users sg ON si.singer_id = sg.id
      WHERE RAWTOHEX(si.session_id) = :1
      ORDER BY si.sequence_order
    `, [sessionId]);
  }

  /**
   * Get session items for reordering (for caching)
   */
  async getSessionItemsForReorderForCache(sessionId: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(si.id) as id,
        RAWTOHEX(si.session_id) as session_id,
        RAWTOHEX(si.song_id) as song_id,
        RAWTOHEX(si.singer_id) as singer_id,
        si.pitch,
        si.sequence_order,
        si.created_at,
        si.updated_at,
        s.name as song_name,
        sg.name as singer_name
      FROM song_session_items si
      JOIN songs s ON si.song_id = s.id
      LEFT JOIN users sg ON si.singer_id = sg.id
      WHERE RAWTOHEX(si.session_id) = :1
      ORDER BY si.sequence_order
    `, [sessionId]);
  }

  /**
   * Get newly created session by name (for caching)
   */
  async getNewSessionByNameForCache(name: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        center_ids,
        created_by,
        created_at,
        updated_at
      FROM song_sessions 
      WHERE name = :1
    `, [name]);
  }

  /**
   * Get updated session by ID (for caching)
   */
  async getUpdatedSessionByIdForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        center_ids,
        created_at,
        updated_at
      FROM song_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);
  }

  /**
   * Get session name and description for duplication (for caching)
   */
  async getSessionForDuplicateForCache(id: string): Promise<any[]> {
    return await this.query(`
      SELECT name, description 
      FROM song_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);
  }

  /**
   * Get new session ID by name after duplication (for caching)
   */
  async getNewSessionIdByNameForCache(name: string): Promise<any[]> {
    return await this.query(`
      SELECT RAWTOHEX(id) as id 
      FROM song_sessions 
      WHERE name = :1
    `, [name]);
  }

  /**
   * Get duplicated session details (for caching)
   */
  async getDuplicatedSessionForCache(newSessionId: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM song_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [newSessionId]);
  }

  /**
   * Get all song mappings (for caching)
   */
  async getAllSongMappingsForCache(): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        csv_song_name,
        RAWTOHEX(db_song_id) as db_song_id,
        db_song_name
      FROM csv_song_mappings
      ORDER BY created_at DESC
    `);
  }

  /**
   * Get song mapping by CSV name (for caching)
   */
  async getSongMappingByNameForCache(csvName: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        csv_song_name,
        RAWTOHEX(db_song_id) as db_song_id,
        db_song_name
      FROM csv_song_mappings
      WHERE csv_song_name = :1
    `, [csvName]);
  }

  /**
   * Get all pitch mappings (for caching)
   */
  async getAllPitchMappingsForCache(): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        original_format,
        normalized_format
      FROM csv_pitch_mappings
      ORDER BY created_at DESC
    `);
  }

  /**
   * Get pitch mapping by format (for caching)
   */
  async getPitchMappingByFormatForCache(originalFormat: string): Promise<any[]> {
    return await this.query(`
      SELECT 
        RAWTOHEX(id) as id,
        original_format,
        normalized_format
      FROM csv_pitch_mappings
      WHERE original_format = :1
    `, [originalFormat]);
  }

  /**
   * Get all feedback (for caching)
   */
  async getAllFeedbackForCache(): Promise<any[]> {
    return await this.query(`
      SELECT RAWTOHEX(id) as id, feedback, category, email, user_agent, url, ip_address, 
              status, admin_notes, created_at, updated_at, updated_by
       FROM feedback 
       ORDER BY updated_at, created_at DESC
    `);
  }

  /**
   * Get feedback by ID (for caching)
   */
  async getFeedbackByIdForCache(id: string | number): Promise<any[]> {
    // Normalize ID to uppercase for comparison
    const normalizedId = String(id).toUpperCase();
    return await this.query(`
      SELECT RAWTOHEX(id) as id, feedback, category, email, user_agent, url, ip_address, 
              status, admin_notes, created_at, updated_at, updated_by
       FROM feedback 
       WHERE RAWTOHEX(id) = :1`,
      [normalizedId]
    );
  }
}

// Export singleton instance
export const databaseReadService = new DatabaseReadService();
export default databaseReadService;
