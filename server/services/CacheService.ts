/**
 * CacheService - In-memory cache for database results
 * Reduces database load by caching query results with TTL
 */

import * as yaml from 'js-yaml';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Get data from cache if not expired
   * @param key Cache key
   * @returns Cached data or null if expired/not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache entry has expired
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttlMs Time to live in milliseconds (default: 10 minutes)
   */
  set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate a specific cache key
   * @param key Cache key to invalidate
   */
  invalidate(key: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
  }

  /**
   * Invalidate all cache keys matching a pattern
   * @param pattern Regex pattern or string prefix to match
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
  }

  /**
   * Invalidate user-related caches (singers, centers, sessions)
   * Call this whenever user data changes (permissions, admin status, etc.)
   */
  private invalidateUserRelatedCaches(): void {
    this.invalidatePattern('singers:');
    this.invalidatePattern('centers:');
    this.invalidatePattern('sessions:');
  }

  /**
   * Invalidate center-related caches (centers, singers with center filters)
   * Call this whenever center data or center-user relationships change
   */
  private invalidateCenterRelatedCaches(): void {
    this.invalidatePattern('centers:');
    this.invalidatePattern('singers:'); // Singers are filtered by centers
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries (run periodically)
   */
  cleanupExpired(): void {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        count++;
      }
    }
  }

  // ==================== DATABASE OPERATIONS ====================
  // All database operations go through CacheService to ensure proper caching
  // Routes should NEVER import DatabaseService directly

  private async getDatabase() {
    const { databaseService } = await import('./DatabaseService.js');
    return databaseService;
  }

  /**
   * Filter resources by center access permissions
   * Implements the same logic as user_has_center_access Oracle function
   * @param resources Array of resources with center_ids property
   * @param userRole User's role ('admin', 'editor', or 'viewer')
   * @param centerIds User's accessible center IDs (centerIds + editorFor combined)
   * @returns Filtered array of resources the user can access
   */
  filterByCenterAccess<T extends { center_ids?: number[] }>(
    resources: T[],
    userRole?: string,
    centerIds?: number[]
  ): T[] {
    // Admin users have access to everything
    if (userRole === 'admin' || !centerIds) {
      return resources;
    }

    return resources.filter(resource => {
      // Untagged content (null or empty center_ids) is visible to everyone
      if (!resource.center_ids || resource.center_ids.length === 0) {
        return true;
      }

      // Check if user has access to any of the resource's centers
      return resource.center_ids.some(contentCenterId => 
        centerIds.includes(contentCenterId)
      );
    });
  }

  // ==================== SONGS ====================

  /**
   * Get all songs WITHOUT CLOB fields (lyrics, meaning, song_tags)
   * Use getSong(id) for individual songs with full details including CLOBs
   */
  async getAllSongs(): Promise<any[]> {
    const cacheKey = 'songs:all';
    const cached = this.get<any[]>(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const db = await this.getDatabase();
    const songs = await db.query(`
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
        s.video_link,
        s.golden_voice,
        s.reference_gents_pitch,
        s.reference_ladies_pitch,
        s.created_by,
        s.created_at,
        s.updated_at,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.song_id = s.id) as pitch_count
      FROM songs s
      ORDER BY LTRIM(REGEXP_REPLACE(LOWER(s.name), '[^a-zA-Z0-9 ]', ''), '0123456789 ')
    `);

    const mappedSongs = songs.map((song: any) => ({
      id: extractValue(song.ID),
      name: extractValue(song.NAME),
      externalSourceUrl: extractValue(song.EXTERNAL_SOURCE_URL),
      language: extractValue(song.LANGUAGE),
      deity: extractValue(song.DEITY),
      tempo: extractValue(song.TEMPO),
      beat: extractValue(song.BEAT),
      raga: extractValue(song.RAGA),
      level: extractValue(song.SONG_LEVEL),
      audioLink: extractValue(song.AUDIO_LINK),
      videoLink: extractValue(song.VIDEO_LINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      referenceGentsPitch: extractValue(song.REFERENCE_GENTS_PITCH),
      referenceLadiesPitch: extractValue(song.REFERENCE_LADIES_PITCH),
      createdBy: extractValue(song.CREATED_BY),
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT),
      pitch_count: parseInt(song.PITCH_COUNT || song.pitch_count || '0', 10),
      // CLOB fields set to null - fetch on-demand via getSong(id)
      lyrics: null,
      meaning: null,
      songTags: null
    }));

    this.set(cacheKey, mappedSongs, 5 * 60 * 1000);
    return mappedSongs;
  }

  /**
   * Get individual song WITH CLOB fields (lyrics, meaning, song_tags)
   * Used when viewing song details - fetches and caches full data
   */
  async getSong(id: string): Promise<any> {
    // Check individual song cache first
    const cacheKey = `song:${id}`;
    const cached = this.get<any>(cacheKey);
    if (cached) return cached;

    const db = await this.getDatabase();
    const songs = await db.query(`
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
        s.created_by,
        s.created_at,
        s.updated_at,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.song_id = s.id) as pitch_count
      FROM songs s
      WHERE RAWTOHEX(s.id) = :1
    `, [id]);
    
    if (songs.length === 0) return null;
    
    const song = songs[0];
    const mappedSong = {
      id: extractValue(song.ID),
      name: extractValue(song.NAME),
      externalSourceUrl: extractValue(song.EXTERNAL_SOURCE_URL),
      lyrics: extractValue(song.LYRICS),
      meaning: extractValue(song.MEANING),
      language: extractValue(song.LANGUAGE),
      deity: extractValue(song.DEITY),
      tempo: extractValue(song.TEMPO),
      beat: extractValue(song.BEAT),
      raga: extractValue(song.RAGA),
      level: extractValue(song.SONG_LEVEL),
      songTags: extractValue(song.SONG_TAGS),
      audioLink: extractValue(song.AUDIO_LINK),
      videoLink: extractValue(song.VIDEO_LINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      referenceGentsPitch: extractValue(song.REFERENCE_GENTS_PITCH),
      referenceLadiesPitch: extractValue(song.REFERENCE_LADIES_PITCH),
      createdBy: extractValue(song.CREATED_BY),
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT),
      pitch_count: parseInt(song.PITCH_COUNT || song.pitch_count || '0', 10),
    };
    
    // Cache individual song with CLOBs (5 min TTL)
    this.set(cacheKey, mappedSong, 5 * 60 * 1000);
    return mappedSong;
  }

  async createSong(songData: any): Promise<any> {
    const db = await this.getDatabase();
    
    // Separate CLOB and non-CLOB fields
    const clobFields = {
      lyrics: String(songData.lyrics || ''),
      meaning: String(songData.meaning || ''),
      song_tags: String(songData.song_tags || '')
    };

    // Step 1: Insert with EMPTY_CLOB for CLOB fields using named bindings
    await db.query(`
      INSERT INTO songs (
        name, external_source_url,
        "LANGUAGE", deity, tempo, beat, raga, "LEVEL",
        audio_link, video_link, golden_voice,
        reference_gents_pitch, reference_ladies_pitch, created_by,
        lyrics, meaning, song_tags
      ) VALUES (
        :p_name, :p_external_source_url, :p_language, :p_deity, :p_tempo, :p_beat, :p_raga, :p_level,
        :p_audio_link, :p_video_link, :p_golden_voice,
        :p_reference_gents_pitch, :p_reference_ladies_pitch, :p_created_by,
        EMPTY_CLOB(), EMPTY_CLOB(), EMPTY_CLOB()
      )
    `, {
      p_name: String(songData.name || ''),
      p_external_source_url: songData.external_source_url ? String(songData.external_source_url) : null,
      p_language: String(songData.language || ''),
      p_deity: String(songData.deity || ''),
      p_tempo: songData.tempo ? String(songData.tempo) : null,
      p_beat: songData.beat ? String(songData.beat) : null,
      p_raga: songData.raga ? String(songData.raga) : null,
      p_level: songData.level ? String(songData.level) : null,
      p_audio_link: songData.audio_link ? String(songData.audio_link) : null,
      p_video_link: songData.video_link ? String(songData.video_link) : null,
      p_golden_voice: Number(songData.golden_voice || 0),
      p_reference_gents_pitch: songData.reference_gents_pitch ? String(songData.reference_gents_pitch) : null,
      p_reference_ladies_pitch: songData.reference_ladies_pitch ? String(songData.reference_ladies_pitch) : null,
      p_created_by: songData.created_by ? String(songData.created_by) : null
    }, {
      autoCommit: false
    });

    // Get the newly inserted song's ID by querying the most recent song
    const newSongsResult = await db.query(`
      SELECT RAWTOHEX(id) as id FROM songs 
      WHERE name = :p_name 
      ORDER BY created_at DESC 
      FETCH FIRST 1 ROWS ONLY
    `, { p_name: String(songData.name || '') });
    
    if (newSongsResult.length === 0) {
      throw new Error('Failed to retrieve newly created song ID');
    }

    const newId = newSongsResult[0].ID;

    // Step 2: Write CLOB content using PL/SQL (simpler than LOB API)
    if (clobFields.lyrics) {
      await db.query(`
        BEGIN
          UPDATE songs SET lyrics = :p_lyrics WHERE RAWTOHEX(id) = :p_id;
          COMMIT;
        END;
      `, {
        p_lyrics: clobFields.lyrics,
        p_id: newId
      });
    }

    if (clobFields.meaning) {
      await db.query(`
        BEGIN
          UPDATE songs SET meaning = :p_meaning WHERE RAWTOHEX(id) = :p_id;
          COMMIT;
        END;
      `, {
        p_meaning: clobFields.meaning,
        p_id: newId
      });
    }

    if (clobFields.song_tags) {
      await db.query(`
        BEGIN
          UPDATE songs SET song_tags = :p_song_tags WHERE RAWTOHEX(id) = :p_id;
          COMMIT;
        END;
      `, {
        p_song_tags: clobFields.song_tags,
        p_id: newId
      });
    }

    // Write-through cache: Fetch only the newly created song
    const newSongs = await db.query(`
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
        video_link,
        golden_voice,
        reference_gents_pitch,
        reference_ladies_pitch,
        created_at,
        updated_at
      FROM songs
      WHERE name = :name
      ORDER BY created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, { name: songData.name });

    if (newSongs.length > 0) {
      const newSong = newSongs[0];
      const mappedSong = {
        id: extractValue(newSong.ID),
        name: extractValue(newSong.NAME),
        externalSourceUrl: extractValue(newSong.EXTERNAL_SOURCE_URL),
        lyrics: extractValue(newSong.LYRICS),
        meaning: extractValue(newSong.MEANING),
        language: extractValue(newSong.LANGUAGE),
        deity: extractValue(newSong.DEITY),
        tempo: extractValue(newSong.TEMPO),
        beat: extractValue(newSong.BEAT),
        raga: extractValue(newSong.RAGA),
        level: extractValue(newSong.SONG_LEVEL),
        songTags: extractValue(newSong.SONG_TAGS),
        audioLink: extractValue(newSong.AUDIO_LINK),
        videoLink: extractValue(newSong.VIDEO_LINK),
        goldenVoice: !!extractValue(newSong.GOLDEN_VOICE),
        referenceGentsPitch: extractValue(newSong.REFERENCE_GENTS_PITCH),
        referenceLadiesPitch: extractValue(newSong.REFERENCE_LADIES_PITCH),
        createdAt: extractValue(newSong.CREATED_AT),
        updatedAt: extractValue(newSong.UPDATED_AT),
        pitch_count: 0, // New songs have no pitches yet
      };

      // Update cache directly - add to existing cache or invalidate to force fresh fetch
      const cached = this.get('songs:all');
      if (cached && Array.isArray(cached)) {
        const updated = [...cached, mappedSong].sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
        this.set('songs:all', updated, 5 * 60 * 1000);
      } else {
        // No cache exists - invalidate to force fresh fetch on next request
        // This ensures all songs (including the new one) will be included
        this.invalidate('songs:all');
      }
      
      // Also cache the individual song
      this.set(`song:${mappedSong.id}`, mappedSong, 5 * 60 * 1000);
      
      return mappedSong;
    }
    
    return null;
  }

  async updateSong(id: string, songData: any): Promise<any> {
    const db = await this.getDatabase();
    
    // Separate CLOB and non-CLOB fields
    const clobFields = {
      lyrics: String(songData.lyrics || ''),
      meaning: String(songData.meaning || ''),
      song_tags: String(songData.song_tags || '')
    };
    
    // Step 1: Update non-CLOB fields with EMPTY_CLOB placeholders for CLOB fields
    // Using named bindings to avoid mixing positional and output bindings
    await db.query(`
      UPDATE songs SET
        name = :p_name,
        external_source_url = :p_external_source_url,
        "LANGUAGE" = :p_language,
        deity = :p_deity,
        tempo = :p_tempo,
        beat = :p_beat,
        raga = :p_raga,
        "LEVEL" = :p_level,
        audio_link = :p_audio_link,
        video_link = :p_video_link,
        golden_voice = :p_golden_voice,
        reference_gents_pitch = :p_reference_gents_pitch,
        reference_ladies_pitch = :p_reference_ladies_pitch,
        updated_by = :p_updated_by,
        updated_at = CURRENT_TIMESTAMP,
        lyrics = EMPTY_CLOB(),
        meaning = EMPTY_CLOB(),
        song_tags = EMPTY_CLOB()
      WHERE RAWTOHEX(id) = :p_id
    `, {
      p_name: String(songData.name || ''),
      p_external_source_url: songData.external_source_url ? String(songData.external_source_url) : null,
      p_language: String(songData.language || ''),
      p_deity: String(songData.deity || ''),
      p_tempo: songData.tempo ? String(songData.tempo) : null,
      p_beat: songData.beat ? String(songData.beat) : null,
      p_raga: songData.raga ? String(songData.raga) : null,
      p_level: songData.level ? String(songData.level) : null,
      p_audio_link: songData.audio_link ? String(songData.audio_link) : null,
      p_video_link: songData.video_link ? String(songData.video_link) : null,
      p_golden_voice: Number(songData.golden_voice || 0),
      p_reference_gents_pitch: songData.reference_gents_pitch ? String(songData.reference_gents_pitch) : null,
      p_reference_ladies_pitch: songData.reference_ladies_pitch ? String(songData.reference_ladies_pitch) : null,
      p_updated_by: songData.updated_by ? String(songData.updated_by) : null,
      p_id: String(id)
    }, {
      autoCommit: false
    });

    // Step 2: Write CLOB content using PL/SQL (simpler than LOB API)
    if (clobFields.lyrics) {
      await db.query(`
        BEGIN
          UPDATE songs SET lyrics = :p_lyrics WHERE RAWTOHEX(id) = :p_id;
          COMMIT;
        END;
      `, {
        p_lyrics: clobFields.lyrics,
        p_id: id
      });
    }

    if (clobFields.meaning) {
      await db.query(`
        BEGIN
          UPDATE songs SET meaning = :p_meaning WHERE RAWTOHEX(id) = :p_id;
          COMMIT;
        END;
      `, {
        p_meaning: clobFields.meaning,
        p_id: id
      });
    }

    if (clobFields.song_tags) {
      await db.query(`
        BEGIN
          UPDATE songs SET song_tags = :p_song_tags WHERE RAWTOHEX(id) = :p_id;
          COMMIT;
        END;
      `, {
        p_song_tags: clobFields.song_tags,
        p_id: id
      });
    }

    // Write-through cache: Fetch only the updated song
    const updatedSongs = await db.query(`
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
        video_link,
        golden_voice,
        reference_gents_pitch,
        reference_ladies_pitch,
        created_at,
        updated_at
      FROM songs
      WHERE RAWTOHEX(id) = :id
    `, { id: id });

    if (updatedSongs.length > 0) {
      const updatedSong = updatedSongs[0];
      
      // Preserve pitch_count from cache if exists, otherwise fetch fresh
      const cached = this.get('songs:all');
      const cachedSong = cached && Array.isArray(cached) ? cached.find((s: any) => s.id === id) : null;
      
      const mappedSong = {
        id: extractValue(updatedSong.ID),
        name: extractValue(updatedSong.NAME),
        externalSourceUrl: extractValue(updatedSong.EXTERNAL_SOURCE_URL),
        lyrics: extractValue(updatedSong.LYRICS),
        meaning: extractValue(updatedSong.MEANING),
        language: extractValue(updatedSong.LANGUAGE),
        deity: extractValue(updatedSong.DEITY),
        tempo: extractValue(updatedSong.TEMPO),
        beat: extractValue(updatedSong.BEAT),
        raga: extractValue(updatedSong.RAGA),
        level: extractValue(updatedSong.SONG_LEVEL),
        songTags: extractValue(updatedSong.SONG_TAGS),
        audioLink: extractValue(updatedSong.AUDIO_LINK),
        videoLink: extractValue(updatedSong.VIDEO_LINK),
        goldenVoice: !!extractValue(updatedSong.GOLDEN_VOICE),
        referenceGentsPitch: extractValue(updatedSong.REFERENCE_GENTS_PITCH),
        referenceLadiesPitch: extractValue(updatedSong.REFERENCE_LADIES_PITCH),
        createdAt: extractValue(updatedSong.CREATED_AT),
        updatedAt: extractValue(updatedSong.UPDATED_AT),
        pitch_count: cachedSong?.pitch_count ?? 0, // Preserve from cache since update doesn't change pitches
      };

      // Update cache directly - replace in list or add if not exists
      // Use the already-fetched cached value from above
      if (cached && Array.isArray(cached)) {
        const songExists = cached.some(song => song.id === id);
        let updated;
        if (songExists) {
          updated = cached
            .map(song => song.id === id ? mappedSong : song)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else {
          // Song not in cache list, add it
          updated = [...cached, mappedSong].sort((a, b) => 
            (a.name || '').localeCompare(b.name || '')
          );
        }
        this.set('songs:all', updated, 5 * 60 * 1000);
      }
      // No else - if cache doesn't exist, don't force a full reload
      // The next getAllSongs() call will fetch from DB naturally
      
      // Update the individual song cache directly
      this.set(`song:${id}`, mappedSong, 5 * 60 * 1000);
      
      return mappedSong;
    }
    
    return null;
  }

  async deleteSong(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM songs WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Remove from individual song cache
    this.invalidate(`song:${id}`);
    
    // Update cache directly - remove from list
    const cached = this.get('songs:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((song: any) => song.id !== id);
      this.set('songs:all', updated, 5 * 60 * 1000);
    }
    
    // CASCADE will delete associated pitches - invalidate pitch cache
    this.invalidate('pitches:all');
    // Note: Cannot invalidate individual pitch caches without querying which pitches were affected
  }

  // ==================== SINGERS ====================

  async getAllSingers(): Promise<any[]> {
    const cacheKey = 'singers:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const db = await this.getDatabase();
    const singers = await db.query(`
      SELECT 
        RAWTOHEX(u.id) as id,
        u.name,
        u.gender,
        u.email,
        u.is_admin,
        u.center_ids,
        u.editor_for,
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.singer_id = u.id) as pitch_count
      FROM users u
      WHERE u.name IS NOT NULL
      ORDER BY u.name
    `);

    // Normalize field names (Oracle returns uppercase: ID, NAME, GENDER, CENTER_IDS, EDITOR_FOR, CREATED_AT, UPDATED_AT)
    const normalizedSingers = singers.map((s: any) => {
      let centerIds: number[] = [];
      let editorFor: number[] = [];
      
      try {
        if (s.CENTER_IDS || s.center_ids) {
          centerIds = JSON.parse(s.CENTER_IDS || s.center_ids);
        }
      } catch (e) {
        console.error('Error parsing center_ids for singer:', e);
      }
      
      try {
        if (s.EDITOR_FOR || s.editor_for) {
          editorFor = JSON.parse(s.EDITOR_FOR || s.editor_for);
        }
      } catch (e) {
        console.error('Error parsing editor_for for singer:', e);
      }
      
      return {
        id: s.id || s.ID,
        name: s.name || s.NAME,
        gender: s.gender || s.GENDER,
        email: s.email || s.EMAIL,
        is_admin: (s.is_admin || s.IS_ADMIN) === 1,
        center_ids: centerIds,
        editor_for: editorFor,
        created_at: s.created_at || s.CREATED_AT,
        updated_at: s.updated_at || s.UPDATED_AT,
        pitch_count: parseInt(s.pitch_count || s.PITCH_COUNT || '0', 10),
      };
    }).filter((s: any) => s.name); // Filter out any singers with no name

    this.set(cacheKey, normalizedSingers, 5 * 60 * 1000);
    return normalizedSingers;
  }

  async getSinger(id: string): Promise<any> {
    const db = await this.getDatabase();
    const singers = await db.query(`
      SELECT 
        RAWTOHEX(u.id) as id,
        u.name,
        u.gender,
        u.email,
        u.is_admin,
        u.center_ids,
        u.editor_for,
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.singer_id = u.id) as pitch_count
      FROM users u
      WHERE RAWTOHEX(u.id) = :1
    `, [id]);
    
    if (singers.length === 0) return null;
    
    const s = singers[0];
    let centerIds: number[] = [];
    let editorFor: number[] = [];
    
    try {
      if (s.CENTER_IDS || s.center_ids) {
        centerIds = JSON.parse(s.CENTER_IDS || s.center_ids);
      }
    } catch (e) {
      console.error('Error parsing center_ids for singer:', e);
    }
    
    try {
      if (s.EDITOR_FOR || s.editor_for) {
        editorFor = JSON.parse(s.EDITOR_FOR || s.editor_for);
      }
    } catch (e) {
      console.error('Error parsing editor_for for singer:', e);
    }
    
    return {
      id: s.id || s.ID,
      name: s.name || s.NAME,
      gender: s.gender || s.GENDER,
      email: s.email || s.EMAIL,
      is_admin: (s.is_admin || s.IS_ADMIN) === 1,
      center_ids: centerIds,
      editor_for: editorFor,
      created_at: s.created_at || s.CREATED_AT,
      updated_at: s.updated_at || s.UPDATED_AT,
      pitch_count: parseInt(s.pitch_count || s.PITCH_COUNT || '0', 10),
    };
  }

  async createSinger(name: string, gender?: string, email?: string, centerIds?: number[], created_by?: string): Promise<any> {
    try {
      const db = await this.getDatabase();
      
      // Prepare center_ids as JSON string
      const centerIdsJson = centerIds && centerIds.length > 0 
        ? JSON.stringify(centerIds) 
        : null;
      
      await db.query(`INSERT INTO users (name, gender, email, center_ids, created_by) VALUES (:1, :2, :3, :4, :5)`, [name, gender || null, email || null, centerIdsJson, created_by || null]);
      
      // Write-through cache: Fetch only the newly created singer
      const newSingers = await db.query(`
        SELECT 
          RAWTOHEX(id) as id,
          name,
          gender,
          email,
          center_ids,
          created_at,
          updated_at
        FROM users
        WHERE name = :1
        ORDER BY created_at DESC
        FETCH FIRST 1 ROWS ONLY
      `, [name]);
      
      if (newSingers.length > 0) {
        const rawSinger = newSingers[0];
        
        let parsedCenterIds: number[] = [];
        try {
          if (rawSinger.CENTER_IDS || rawSinger.center_ids) {
            parsedCenterIds = JSON.parse(rawSinger.CENTER_IDS || rawSinger.center_ids);
          }
        } catch (e) {
          console.error('Error parsing center_ids:', e);
        }
        
        // Normalize field names to lowercase (Oracle might return uppercase)
        // New singer always has pitch_count = 0
        const normalizedSinger = {
          id: rawSinger.id || rawSinger.ID,
          name: rawSinger.name || rawSinger.NAME,
          gender: rawSinger.gender || rawSinger.GENDER,
          email: rawSinger.email || rawSinger.EMAIL,
          center_ids: parsedCenterIds,
          created_at: rawSinger.created_at || rawSinger.CREATED_AT,
          updated_at: rawSinger.updated_at || rawSinger.UPDATED_AT,
          pitch_count: 0,
        };
        
        // Write-through cache: Add to cache or create minimal cache with new singer
        const cached = this.get('singers:all');
        if (cached && Array.isArray(cached)) {
          const updated = [...cached, normalizedSinger].sort((a, b) => 
            (a.name || '').localeCompare(b.name || '')
          );
          this.set('singers:all', updated, 5 * 60 * 1000);
        } else {
          // Cache doesn't exist - invalidate to force fresh fetch on next request
          // This ensures the new singer will be included
          this.invalidate('singers:all');
        }
        
        // Return the normalized singer object
        return normalizedSinger;
      }
      
      console.error(`  ❌ No singer found after INSERT`);
      throw new Error('Failed to create singer: No singer returned after insert');
    } catch (error) {
      console.error(`❌ CacheService.createSinger failed for "${name}":`, error);
      throw error;
    }
  }

  async updateSinger(id: string, name: string, gender?: string, email?: string, centerIds?: number[], updated_by?: string): Promise<void> {
    const db = await this.getDatabase();
    
    // Prepare center_ids as JSON string
    const centerIdsJson = centerIds && centerIds.length > 0 
      ? JSON.stringify(centerIds) 
      : null;
    
    await db.query(`
      UPDATE users SET
        name = :1,
        gender = :2,
        email = :3,
        center_ids = :4,
        updated_by = :5,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :6
    `, [name, gender || null, email || null, centerIdsJson, updated_by || null, id]);
    
    // Write-through cache: Fetch the complete updated singer with all fields including pitch_count
    const updatedSingers = await db.query(`
      SELECT 
        RAWTOHEX(u.id) as id,
        u.name,
        u.gender,
        u.email,
        u.is_admin,
        u.center_ids,
        u.editor_for,
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.singer_id = u.id) as pitch_count
      FROM users u
      WHERE RAWTOHEX(u.id) = :1
    `, [id]);
    
    if (updatedSingers.length > 0) {
      const s = updatedSingers[0];
      let parsedCenterIds: number[] = [];
      let parsedEditorFor: number[] = [];
      try {
        if (s.CENTER_IDS || s.center_ids) {
          parsedCenterIds = JSON.parse(s.CENTER_IDS || s.center_ids);
        }
      } catch (e) {
        console.error('Error parsing center_ids:', e);
      }
      try {
        if (s.EDITOR_FOR || s.editor_for) {
          parsedEditorFor = JSON.parse(s.EDITOR_FOR || s.editor_for);
        }
      } catch (e) {
        console.error('Error parsing editor_for:', e);
      }
      
      const normalizedSinger = {
        id: s.id || s.ID,
        name: s.name || s.NAME,
        gender: s.gender || s.GENDER,
        email: s.email || s.EMAIL,
        is_admin: (s.is_admin || s.IS_ADMIN) === 1,
        center_ids: parsedCenterIds,
        editor_for: parsedEditorFor,
        created_at: s.created_at || s.CREATED_AT,
        updated_at: s.updated_at || s.UPDATED_AT,
        pitch_count: parseInt(s.pitch_count || s.PITCH_COUNT || '0', 10),
      };
      
      const cached = this.get('singers:all');
      if (cached && Array.isArray(cached)) {
        // Update the cached singer with the fresh data from database
        const updated = cached
          .map((singer: any) => {
            if (singer.id === id) {
              return normalizedSinger;
            }
            return singer;
          })
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.set('singers:all', updated, 5 * 60 * 1000);
      }
    }
    
    // If center associations changed, invalidate center caches
    if (centerIds !== undefined) {
      this.invalidatePattern('centers:');
    }
  }

  async deleteSinger(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM users WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Write-through cache: Remove from cached list
    const cached = this.get('singers:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((singer: any) => singer.ID !== id);
      this.set('singers:all', updated, 5 * 60 * 1000);
    }
    
    // CASCADE will delete associated pitches - invalidate pitch cache
    this.invalidate('pitches:all');
    // Note: Cannot invalidate individual pitch caches without querying which pitches were affected
  }

  async updateSingerAdminStatus(id: string, isAdmin: number): Promise<void> {
    const db = await this.getDatabase();
    
    // First check if user has email (required for admin)
    const users = await db.query(
      `SELECT email FROM users WHERE RAWTOHEX(id) = :1`,
      [id]
    );
    
    if (users.length === 0) {
      throw new Error('User not found');
    }
    
    const user = users[0];
    const email = user.email || user.EMAIL;
    
    if (isAdmin === 1 && !email) {
      throw new Error('Cannot set admin flag: user must have an email address');
    }
    
    // Update admin status
    await db.query(
      `UPDATE users SET is_admin = :1 WHERE RAWTOHEX(id) = :2`,
      [isAdmin, id]
    );
    
    // Invalidate user-related caches
    this.invalidateUserRelatedCaches();
  }

  async updateUserEditorFor(id: string, editorFor: number[]): Promise<void> {
    const db = await this.getDatabase();
    
    // Validate that user exists
    const users = await db.query(
      `SELECT id FROM users WHERE RAWTOHEX(id) = :1`,
      [id]
    );
    
    if (users.length === 0) {
      throw new Error('User not found');
    }
    
    // Convert editor_for array to JSON string
    const editorForJson = editorFor.length > 0 
      ? JSON.stringify(editorFor) 
      : null;
    
    // Update editor_for
    await db.query(
      `UPDATE users SET editor_for = :1 WHERE RAWTOHEX(id) = :2`,
      [editorForJson, id]
    );
    
    // Invalidate user-related caches (affects singers view and centers editor lists)
    this.invalidateUserRelatedCaches();
  }

  async addUserEditorAccess(userId: string, centerId: number): Promise<void> {
    const db = await this.getDatabase();
    
    // Get current editor_for array (userId is hex string from RAWTOHEX)
    const users = await db.query<any>(
      `SELECT editor_for FROM users WHERE RAWTOHEX(id) = :1`,
      [userId]
    );
    
    if (users.length === 0) {
      throw new Error('User not found');
    }
    
    let editorFor: number[] = [];
    if (users[0].EDITOR_FOR || users[0].editor_for) {
      try {
        editorFor = JSON.parse(users[0].EDITOR_FOR || users[0].editor_for);
      } catch {
        editorFor = [];
      }
    }
    
    // Add center if not already present
    if (!editorFor.includes(centerId)) {
      editorFor.push(centerId);
      const editorForJson = JSON.stringify(editorFor);
      
      await db.query(
        `UPDATE users SET editor_for = :1 WHERE RAWTOHEX(id) = :2`,
        [editorForJson, userId]
      );
      
      // Invalidate user-related caches
      this.invalidateUserRelatedCaches();
    }
  }

  async removeUserEditorAccess(userId: string, centerId: number): Promise<void> {
    const db = await this.getDatabase();
    
    // Get current editor_for array (userId is hex string from RAWTOHEX)
    const users = await db.query<any>(
      `SELECT editor_for FROM users WHERE RAWTOHEX(id) = :1`,
      [userId]
    );
    
    if (users.length === 0) {
      throw new Error('User not found');
    }
    
    let editorFor: number[] = [];
    if (users[0].EDITOR_FOR || users[0].editor_for) {
      try {
        editorFor = JSON.parse(users[0].EDITOR_FOR || users[0].editor_for);
      } catch {
        editorFor = [];
      }
    }
    
    // Remove center if present
    const filtered = editorFor.filter(id => id !== centerId);
    if (filtered.length !== editorFor.length) {
      const editorForJson = filtered.length > 0 ? JSON.stringify(filtered) : null;
      
      await db.query(
        `UPDATE users SET editor_for = :1 WHERE RAWTOHEX(id) = :2`,
        [editorForJson, userId]
      );
      
      // Invalidate user-related caches
      this.invalidateUserRelatedCaches();
    }
  }

  // ==================== PITCHES ====================

  async getAllPitches(): Promise<any[]> {
    const cacheKey = 'pitches:all';
    const cached = this.get(cacheKey);
    
    // Return cached data if available
    if (cached && Array.isArray(cached)) {
      return cached;
    }

    // Fetch pitches with song and singer names for proper sorting
    // Use LEFT JOIN to include orphaned pitches (where song or singer was deleted)
    const db = await this.getDatabase();
    const pitches = await db.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      LEFT JOIN songs s ON ssp.song_id = s.id
      LEFT JOIN users si ON ssp.singer_id = si.id
      ORDER BY LTRIM(REGEXP_REPLACE(LOWER(s.name), '[^a-zA-Z0-9 ]', ''), '0123456789 ') NULLS LAST, LTRIM(REGEXP_REPLACE(LOWER(si.name), '[^a-zA-Z0-9 ]', ''), '0123456789 ') NULLS LAST
    `);

    // Normalize field names (Oracle returns uppercase)
    const normalizedPitches = pitches.map((p: any) => ({
      id: p.id || p.ID,
      song_id: p.song_id || p.SONG_ID,
      singer_id: p.singer_id || p.SINGER_ID,
      pitch: p.pitch || p.PITCH,
      song_name: p.song_name || p.SONG_NAME,
      singer_name: p.singer_name || p.SINGER_NAME,
      created_at: p.created_at || p.CREATED_AT,
      updated_at: p.updated_at || p.UPDATED_AT,
    }));

    this.set(cacheKey, normalizedPitches, 5 * 60 * 1000);
    return normalizedPitches;
  }

  async getPitch(id: string): Promise<any> {
    const cacheKey = `pitch:${id}`;
    const cached = this.get(cacheKey);
    
    // Don't use cached data for getPitch to avoid stale orphaned records
    // If we have it cached, verify it still exists in DB

    const db = await this.getDatabase();
    const pitches = await db.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      LEFT JOIN songs s ON ssp.song_id = s.id
      LEFT JOIN users si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.id) = :1
    `, [id]);
    
    if (pitches.length === 0) {
      // Not found in DB - invalidate cache if it exists
      this.invalidate(cacheKey);
      return null;
    }
    
    // Normalize field names (Oracle returns uppercase)
    const p = pitches[0];
    const normalized = {
      id: p.id || p.ID,
      song_id: p.song_id || p.SONG_ID,
      singer_id: p.singer_id || p.SINGER_ID,
      pitch: p.pitch || p.PITCH,
      song_name: p.song_name || p.SONG_NAME,
      singer_name: p.singer_name || p.SINGER_NAME,
      created_at: p.created_at || p.CREATED_AT,
      updated_at: p.updated_at || p.UPDATED_AT,
    };

    this.set(cacheKey, normalized, 5 * 60 * 1000);
    return normalized;
  }

  async getSongPitches(songId: string): Promise<any[]> {
    const db = await this.getDatabase();
    return await db.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      JOIN users si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.song_id) = :1
      ORDER BY si.name
    `, [songId]);
  }

  async createPitch(pitchData: any): Promise<any> {
    const db = await this.getDatabase();
    const created_by = pitchData.created_by ? String(pitchData.created_by) : null;
    
    await db.query(`
      INSERT INTO song_singer_pitches (song_id, singer_id, pitch, created_by)
      VALUES (HEXTORAW(:1), HEXTORAW(:2), :3, :4)
    `, [pitchData.song_id, pitchData.singer_id, pitchData.pitch, created_by]);
    
    // Write-through cache: Fetch only the newly created pitch with joins
    const newPitches = await db.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      JOIN songs s ON ssp.song_id = s.id
      JOIN users si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.song_id) = :1 AND RAWTOHEX(ssp.singer_id) = :2
      ORDER BY ssp.created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, [pitchData.song_id, pitchData.singer_id]);
    
    if (newPitches.length > 0) {
      // Normalize the new pitch data
      const rawPitch = newPitches[0];
      const normalizedPitch = {
        id: rawPitch.id || rawPitch.ID,
        song_id: rawPitch.song_id || rawPitch.SONG_ID,
        singer_id: rawPitch.singer_id || rawPitch.SINGER_ID,
        pitch: rawPitch.pitch || rawPitch.PITCH,
        song_name: rawPitch.song_name || rawPitch.SONG_NAME,
        singer_name: rawPitch.singer_name || rawPitch.SINGER_NAME,
        created_at: rawPitch.created_at || rawPitch.CREATED_AT,
        updated_at: rawPitch.updated_at || rawPitch.UPDATED_AT,
      };
      
      // Write-through cache: Add to existing cache or invalidate
      const cached = this.get('pitches:all');
      if (cached && Array.isArray(cached)) {
        // Add to cache and sort
        const updated = [...cached, normalizedPitch].sort((a, b) => {
          const songCompare = (a.song_name || '').localeCompare(b.song_name || '');
          if (songCompare !== 0) return songCompare;
          return (a.singer_name || '').localeCompare(b.singer_name || '');
        });
        this.set('pitches:all', updated, 5 * 60 * 1000);
      } else {
        // No cache exists - invalidate to force fresh fetch
        this.invalidate('pitches:all');
      }
      
      // Invalidate songs and singers cache since pitch_count changes
      this.invalidate('songs:all');
      this.invalidate('singers:all');
      
      return normalizedPitch;
    }
    
    return null;
  }

  async updatePitch(id: string, pitch: string, updated_by?: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`
      UPDATE song_singer_pitches SET
        pitch = :1,
        updated_by = :2,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :3
    `, [pitch, updated_by || null, id]);
    
    // Write-through cache: Fetch only the updated pitch with joins
    const updatedPitches = await db.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      JOIN songs s ON ssp.song_id = s.id
      JOIN users si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.id) = :1
    `, [id]);
    
    if (updatedPitches.length > 0) {
      const cached = this.get('pitches:all');
      if (cached && Array.isArray(cached)) {
        // Normalize the updated pitch data
        const rawPitch = updatedPitches[0];
        const normalizedPitch = {
          id: rawPitch.id || rawPitch.ID,
          song_id: rawPitch.song_id || rawPitch.SONG_ID,
          singer_id: rawPitch.singer_id || rawPitch.SINGER_ID,
          pitch: rawPitch.pitch || rawPitch.PITCH,
          song_name: rawPitch.song_name || rawPitch.SONG_NAME,
          singer_name: rawPitch.singer_name || rawPitch.SINGER_NAME,
          created_at: rawPitch.created_at || rawPitch.CREATED_AT,
          updated_at: rawPitch.updated_at || rawPitch.UPDATED_AT,
        };
        
        // Replace the pitch in cache (use lowercase 'id' to match normalized cache)
        const updated = cached.map((p: any) => p.id === id ? normalizedPitch : p);
        this.set('pitches:all', updated, 5 * 60 * 1000);
        
        // Also update individual pitch cache
        this.set(`pitch:${id}`, normalizedPitch, 5 * 60 * 1000);
      }
    }
  }

  async deletePitch(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM song_singer_pitches WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Write-through cache: Remove from cached list
    const cached = this.get('pitches:all');
    if (cached && Array.isArray(cached)) {
      // Use lowercase 'id' to match normalized cache
      const updated = cached.filter((pitch: any) => pitch.id !== id);
      this.set('pitches:all', updated, 5 * 60 * 1000);
    }
    
    // Also invalidate individual pitch cache
    this.invalidate(`pitch:${id}`);
    
    // Invalidate songs and singers cache since pitch_count changes
    this.invalidate('songs:all');
    this.invalidate('singers:all');
  }

  // ==================== SESSIONS ====================

  async getAllSessions(): Promise<any[]> {
    const cacheKey = 'sessions:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const db = await this.getDatabase();
    const sessions = await db.query(`
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

    const mappedSessions = sessions.map((row: any) => {
      let centerIds: number[] | undefined = undefined;
      try {
        if (row.CENTER_IDS) {
          const parsed = JSON.parse(row.CENTER_IDS);
          // Only set centerIds if it's a non-empty array
          if (Array.isArray(parsed) && parsed.length > 0) {
            centerIds = parsed;
          }
        }
      } catch (e) {
        console.error('Error parsing center_ids for session:', row.NAME, e);
      }
      
      return {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        center_ids: centerIds,
        created_by: row.CREATED_BY,
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      };
    });

    this.set(cacheKey, mappedSessions, 5 * 60 * 1000);
    return mappedSessions;
  }

  async getAllTemplates(): Promise<any[]> {
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const db = await this.getDatabase();
    const templates = await db.query(`
      SELECT 
        id,
        name,
        description,
        template_json,
        center_ids,
        is_default,
        created_at,
        updated_at
      FROM presentation_templates 
      ORDER BY is_default DESC, name ASC
    `);

    const mappedTemplates = templates.map((row: any) => {
      let templateJson: any = {};
      try {
        templateJson = typeof row.TEMPLATE_JSON === 'string' ? JSON.parse(row.TEMPLATE_JSON) : row.TEMPLATE_JSON || {};
      } catch (e) {
        console.error('Error parsing template JSON:', e);
      }

      let centerIds: number[] = [];
      try {
        if (row.CENTER_IDS) {
          centerIds = JSON.parse(row.CENTER_IDS);
        }
      } catch (e) {
        console.error('Error parsing center_ids for template:', e);
      }

      // Check if this is a multi-slide template
      const isMultiSlide = Array.isArray(templateJson.slides) && templateJson.slides.length > 0;

      const template: any = {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        aspectRatio: templateJson.aspectRatio || '16:9',  // Extract aspect ratio from JSON
        center_ids: centerIds,
        isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      };

      if (isMultiSlide) {
        // Multi-slide format
        template.slides = templateJson.slides;
        template.referenceSlideIndex = templateJson.referenceSlideIndex ?? 0;
        // Also populate legacy fields from reference slide for backward compatibility
        const refSlide = template.slides[template.referenceSlideIndex] || template.slides[0];
        template.background = refSlide?.background;
        template.images = refSlide?.images || [];
        template.videos = refSlide?.videos || [];
        template.text = refSlide?.text || [];
      } else {
        // Legacy single-slide format
        template.background = templateJson.background;
        template.images = templateJson.images || [];
        template.videos = templateJson.videos || [];
        template.text = templateJson.text || [];
        // Auto-migrate to multi-slide format
        template.slides = [{
          background: template.background,
          images: template.images,
          videos: template.videos,
          text: template.text,
        }];
        template.referenceSlideIndex = 0;
      }

      // Reconstruct YAML from template data (using multi-slide format)
      if (template.slides && template.slides.length > 0) {
        template.yaml = yaml.dump({
          name: template.name,
          description: template.description,
          aspectRatio: template.aspectRatio,
          slides: template.slides,
          referenceSlideIndex: template.referenceSlideIndex ?? 0,
        });
      } else {
        template.yaml = yaml.dump({
          name: template.name,
          description: template.description,
          aspectRatio: template.aspectRatio,
          background: template.background,
          images: template.images || [],
          videos: template.videos || [],
          text: template.text || [],
        });
      }

      return template;
    });

    this.set(cacheKey, mappedTemplates, 5 * 60 * 1000);
    return mappedTemplates;
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<any> {
    const templateService = (await import('./TemplateService.js')).default;
    return await templateService.getTemplate(id);
  }

  /**
   * Create a template with write-through cache update
   */
  async createTemplate(template: any): Promise<any> {
    const templateService = (await import('./TemplateService.js')).default;
    const created = await templateService.createTemplate(template);
    
    // Write-through: add to cache directly
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      cached.push(created);
      this.set(cacheKey, cached, 5 * 60 * 1000);
    }
    
    return created;
  }

  /**
   * Update a template with write-through cache update
   */
  async updateTemplate(id: string, updates: any): Promise<any> {
    const templateService = (await import('./TemplateService.js')).default;
    const updated = await templateService.updateTemplate(id, updates);
    
    // Write-through: update in cache directly
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      const index = cached.findIndex((t: any) => t.id === id);
      if (index !== -1) {
        cached[index] = updated;
        this.set(cacheKey, cached, 5 * 60 * 1000);
      }
    }
    
    return updated;
  }

  /**
   * Delete a template with write-through cache update
   */
  async deleteTemplate(id: string): Promise<void> {
    const templateService = (await import('./TemplateService.js')).default;
    await templateService.deleteTemplate(id);
    
    // Write-through: remove from cache directly
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      const filtered = cached.filter((t: any) => t.id !== id);
      this.set(cacheKey, filtered, 5 * 60 * 1000);
    }
  }

  /**
   * Set a template as default with write-through cache update
   */
  async setTemplateAsDefault(id: string): Promise<any> {
    const templateService = (await import('./TemplateService.js')).default;
    const updated = await templateService.setAsDefault(id);
    
    // Write-through: update all templates in cache to reflect new default
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      const updatedCache = cached.map((t: any) => ({
        ...t,
        isDefault: t.id === id
      }));
      this.set(cacheKey, updatedCache, 5 * 60 * 1000);
    }
    
    return updated;
  }

  async getSession(id: string): Promise<any> {
    const db = await this.getDatabase();
    
    // Get session
    const sessions = await db.query(`
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

    if (sessions.length === 0) return null;

    const sessionRow = sessions[0];
    
    // Parse center_ids
    let centerIds: number[] | undefined = undefined;
    try {
      if (sessionRow.CENTER_IDS) {
        const parsed = JSON.parse(sessionRow.CENTER_IDS);
        // Only set centerIds if it's a non-empty array
        if (Array.isArray(parsed) && parsed.length > 0) {
          centerIds = parsed;
        }
      }
    } catch (e) {
      console.error('Error parsing center_ids for session:', sessionRow.NAME, e);
    }

    // Get session items with details
    const items = await db.query(`
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
    `, [id]);

    const mappedItems = items.map((row: any) => ({
      id: row.ID,
      sessionId: row.SESSION_ID,
      songId: row.SONG_ID,
      singerId: row.SINGER_ID || undefined,
      pitch: row.PITCH,
      sequenceOrder: row.SEQUENCE_ORDER,
      songName: row.SONG_NAME,
      singerName: row.SINGER_NAME,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));

    return {
      id: sessionRow.ID,
      name: sessionRow.NAME,
      description: sessionRow.DESCRIPTION,
      center_ids: centerIds,
      created_by: sessionRow.CREATED_BY,
      createdAt: sessionRow.CREATED_AT,
      updatedAt: sessionRow.UPDATED_AT,
      items: mappedItems,
    };
  }

  async createSession(name: string, description?: string, centerIds?: number[], createdBy?: string): Promise<any> {
    const db = await this.getDatabase();
    
    // Prepare center_ids as JSON string
    const centerIdsJson = centerIds && centerIds.length > 0 
      ? JSON.stringify(centerIds) 
      : null;
    
    await db.query(`
      INSERT INTO song_sessions (name, description, center_ids, created_by)
      VALUES (:1, :2, :3, :4)
    `, [String(name), String(description || ''), centerIdsJson, createdBy || null]);

    // Fetch the created session
    const sessions = await db.query(`
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

    if (sessions.length === 0) throw new Error('Failed to retrieve created session');

    const session = sessions[0];
    let parsedCenterIds: number[] = [];
    try {
      if (session.CENTER_IDS) {
        parsedCenterIds = JSON.parse(session.CENTER_IDS);
      }
    } catch (e) {
      console.error('Error parsing center_ids:', e);
    }
    
    const mappedSession = {
      id: session.ID,
      name: session.NAME,
      description: session.DESCRIPTION,
      center_ids: parsedCenterIds,
      created_by: session.CREATED_BY,
      createdAt: session.CREATED_AT,
      updatedAt: session.UPDATED_AT,
    };
    
    // Write-through cache: Add to cached list and re-sort
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = [...cached, mappedSession].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '')
      );
      this.set('sessions:all', updated, 5 * 60 * 1000);
    }

    return mappedSession;
  }

  async updateSession(id: string, updates: { name?: string; description?: string; center_ids?: number[]; updated_by?: string }): Promise<any> {
    const db = await this.getDatabase();
    
    const updateParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateParts.push(`name = :${paramIndex++}`);
      params.push(String(updates.name));
    }
    if (updates.description !== undefined) {
      updateParts.push(`description = :${paramIndex++}`);
      params.push(String(updates.description || ''));
    }
    if (updates.center_ids !== undefined) {
      updateParts.push(`center_ids = :${paramIndex++}`);
      const centerIdsJson = updates.center_ids && updates.center_ids.length > 0 
        ? JSON.stringify(updates.center_ids) 
        : null;
      params.push(centerIdsJson);
    }
    if (updates.updated_by !== undefined) {
      updateParts.push(`updated_by = :${paramIndex++}`);
      params.push(updates.updated_by);
    }

    if (updateParts.length === 0) throw new Error('No fields to update');

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`
      UPDATE song_sessions 
      SET ${updateParts.join(', ')} 
      WHERE RAWTOHEX(id) = :${paramIndex}
    `, params);

    // Fetch updated session
    const sessions = await db.query(`
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

    if (sessions.length === 0) return null;

    const session = sessions[0];
    let parsedCenterIds: number[] | undefined = undefined;
    try {
      if (session.CENTER_IDS) {
        const parsed = JSON.parse(session.CENTER_IDS);
        // Only set centerIds if it's a non-empty array
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsedCenterIds = parsed;
        }
      }
    } catch (e) {
      console.error('Error parsing center_ids for session:', session.NAME, e);
    }
    
    const mappedSession = {
      id: session.ID,
      name: session.NAME,
      description: session.DESCRIPTION,
      center_ids: parsedCenterIds,
      createdAt: session.CREATED_AT,
      updatedAt: session.UPDATED_AT,
    };
    
    // Write-through cache: Replace in cached list and re-sort (in case name changed)
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached
        .map((s: any) => s.id === id ? mappedSession : s)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      this.set('sessions:all', updated, 5 * 60 * 1000);
    }

    return mappedSession;
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM song_sessions WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Write-through cache: Remove from cached list
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((session: any) => session.id !== id);
      this.set('sessions:all', updated, 5 * 60 * 1000);
    }
  }

  async duplicateSession(id: string, newName: string): Promise<any> {
    const db = await this.getDatabase();
    
    // Get original session
    const sessions = await db.query(`
      SELECT name, description 
      FROM song_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (sessions.length === 0) throw new Error('Session not found');

    const originalSession = sessions[0];

    // Create new session
    await db.query(`
      INSERT INTO song_sessions (name, description)
      VALUES (:1, :2)
    `, [String(newName), String(originalSession.DESCRIPTION || '')]);

    // Get the new session ID
    const newSessions = await db.query(`
      SELECT RAWTOHEX(id) as id 
      FROM song_sessions 
      WHERE name = :1
    `, [newName]);

    if (newSessions.length === 0) throw new Error('Failed to retrieve duplicated session');

    const newSessionId = newSessions[0].ID;

    // Copy items
    await db.query(`
      INSERT INTO song_session_items (session_id, song_id, singer_id, pitch, sequence_order)
      SELECT HEXTORAW(:1), song_id, singer_id, pitch, sequence_order
      FROM song_session_items
      WHERE RAWTOHEX(session_id) = :2
    `, [newSessionId, id]);

    // Fetch new session with full details
    const result = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM song_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [newSessionId]);

    const session = result[0];
    const mappedSession = {
      id: session.ID,
      name: session.NAME,
      description: session.DESCRIPTION,
      createdAt: session.CREATED_AT,
      updatedAt: session.UPDATED_AT,
    };
    
    // Write-through cache: Add to cached list and re-sort
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = [...cached, mappedSession].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '')
      );
      this.set('sessions:all', updated, 5 * 60 * 1000);
    }

    return mappedSession;
  }

  async getSessionItems(sessionId: string): Promise<any[]> {
    const db = await this.getDatabase();
    const items = await db.query(`
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

    return items.map((row: any) => ({
      id: row.ID,
      sessionId: row.SESSION_ID,
      songId: row.SONG_ID,
      singerId: row.SINGER_ID || undefined,
      pitch: row.PITCH,
      sequenceOrder: row.SEQUENCE_ORDER,
      songName: row.SONG_NAME,
      singerName: row.SINGER_NAME,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));
  }

  async addSessionItem(sessionId: string, itemData: any): Promise<void> {
    const db = await this.getDatabase();
    const { songId, singerId, pitch, sequenceOrder } = itemData;

    await db.query(`
      INSERT INTO song_session_items (session_id, song_id, singer_id, pitch, sequence_order)
      VALUES (
        HEXTORAW(:1),
        HEXTORAW(:2),
        ${singerId ? 'HEXTORAW(:3)' : 'NULL'},
        :${singerId ? '4' : '3'},
        :${singerId ? '5' : '4'}
      )
    `, singerId 
      ? [sessionId, songId, singerId, String(pitch || ''), sequenceOrder]
      : [sessionId, songId, String(pitch || ''), sequenceOrder]
    );

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async updateSessionItem(id: string, updates: any): Promise<void> {
    const db = await this.getDatabase();
    const { singerId, pitch, sequenceOrder } = updates;

    const updateParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (singerId !== undefined) {
      if (singerId) {
        updateParts.push(`singer_id = HEXTORAW(:${paramIndex++})`);
        params.push(singerId);
      } else {
        updateParts.push('singer_id = NULL');
      }
    }
    if (pitch !== undefined) {
      updateParts.push(`pitch = :${paramIndex++}`);
      params.push(String(pitch || ''));
    }
    if (sequenceOrder !== undefined) {
      updateParts.push(`sequence_order = :${paramIndex++}`);
      params.push(sequenceOrder);
    }

    if (updateParts.length === 0) throw new Error('No fields to update');

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`
      UPDATE song_session_items 
      SET ${updateParts.join(', ')} 
      WHERE RAWTOHEX(id) = :${paramIndex}
    `, params);

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async deleteSessionItem(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM song_session_items WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async reorderSessionItems(sessionId: string, itemIds: string[]): Promise<void> {
    const db = await this.getDatabase();
    
    for (let i = 0; i < itemIds.length; i++) {
      await db.query(`
        UPDATE song_session_items 
        SET sequence_order = :1, updated_at = CURRENT_TIMESTAMP 
        WHERE RAWTOHEX(id) = :2 AND RAWTOHEX(session_id) = :3
      `, [i + 1, itemIds[i], sessionId]);
    }

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async setSessionItems(sessionId: string, items: any[]): Promise<any[]> {
    const db = await this.getDatabase();
    
    // Delete existing items
    await db.query(`
      DELETE FROM song_session_items 
      WHERE RAWTOHEX(session_id) = :1
    `, [sessionId]);

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const { songId, singerId, pitch } = items[i];
      
      await db.query(`
        INSERT INTO song_session_items (session_id, song_id, singer_id, pitch, sequence_order)
        VALUES (
          HEXTORAW(:1),
          HEXTORAW(:2),
          ${singerId ? 'HEXTORAW(:3)' : 'NULL'},
          :${singerId ? '4' : '3'},
          :${singerId ? '5' : '4'}
        )
      `, singerId 
        ? [sessionId, songId, singerId, String(pitch || ''), i + 1]
        : [sessionId, songId, String(pitch || ''), i + 1]
      );
    }

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');

    // Fetch all items with details
    return await this.getSessionItems(sessionId);
  }

  // ==================== IMPORT MAPPINGS ====================

  async getAllSongMappings(): Promise<any[]> {
    const db = await this.getDatabase();
    const mappings = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        csv_song_name,
        RAWTOHEX(db_song_id) as db_song_id,
        db_song_name,
        created_at,
        updated_at
      FROM csv_song_mappings
      ORDER BY created_at DESC
    `);
    
    return mappings.map((m: any) => ({
      id: m.id || m.ID,
      csvSongName: m.csv_song_name || m.CSV_SONG_NAME,
      dbSongId: m.db_song_id || m.DB_SONG_ID,
      dbSongName: m.db_song_name || m.DB_SONG_NAME,
      createdAt: m.created_at || m.CREATED_AT,
      updatedAt: m.updated_at || m.UPDATED_AT,
    }));
  }

  async getSongMappingByName(csvName: string): Promise<any | null> {
    const db = await this.getDatabase();
    const mappings = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        csv_song_name,
        RAWTOHEX(db_song_id) as db_song_id,
        db_song_name,
        created_at,
        updated_at
      FROM csv_song_mappings
      WHERE csv_song_name = :1
    `, [csvName]);
    
    if (mappings.length === 0) return null;
    
    const m = mappings[0];
    return {
      id: m.id || m.ID,
      csvSongName: m.csv_song_name || m.CSV_SONG_NAME,
      dbSongId: m.db_song_id || m.DB_SONG_ID,
      dbSongName: m.db_song_name || m.DB_SONG_NAME,
      createdAt: m.created_at || m.CREATED_AT,
      updatedAt: m.updated_at || m.UPDATED_AT,
    };
  }

  async saveSongMapping(csvSongName: string, dbSongId: string, dbSongName: string): Promise<void> {
    const db = await this.getDatabase();
    
    // Check if mapping already exists
    const existing = await this.getSongMappingByName(csvSongName);
    
    if (existing) {
      // Update existing mapping
      await db.query(`
        UPDATE csv_song_mappings
        SET db_song_id = HEXTORAW(:1),
            db_song_name = :2,
            updated_at = CURRENT_TIMESTAMP
        WHERE csv_song_name = :3
      `, [dbSongId, dbSongName, csvSongName]);
    } else {
      // Insert new mapping
      await db.query(`
        INSERT INTO csv_song_mappings (csv_song_name, db_song_id, db_song_name)
        VALUES (:1, HEXTORAW(:2), :3)
      `, [csvSongName, dbSongId, dbSongName]);
    }
  }

  async deleteSongMapping(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM csv_song_mappings WHERE RAWTOHEX(id) = :1`, [id]);
  }

  async getAllPitchMappings(): Promise<any[]> {
    const db = await this.getDatabase();
    const mappings = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        original_format,
        normalized_format,
        created_at,
        updated_at
      FROM csv_pitch_mappings
      ORDER BY created_at DESC
    `);
    
    return mappings.map((m: any) => ({
      id: m.id || m.ID,
      originalFormat: m.original_format || m.ORIGINAL_FORMAT,
      normalizedFormat: m.normalized_format || m.NORMALIZED_FORMAT,
      createdAt: m.created_at || m.CREATED_AT,
      updatedAt: m.updated_at || m.UPDATED_AT,
    }));
  }

  async getPitchMappingByFormat(originalFormat: string): Promise<any | null> {
    const db = await this.getDatabase();
    const mappings = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        original_format,
        normalized_format,
        created_at,
        updated_at
      FROM csv_pitch_mappings
      WHERE original_format = :1
    `, [originalFormat]);
    
    if (mappings.length === 0) return null;
    
    const m = mappings[0];
    return {
      id: m.id || m.ID,
      originalFormat: m.original_format || m.ORIGINAL_FORMAT,
      normalizedFormat: m.normalized_format || m.NORMALIZED_FORMAT,
      createdAt: m.created_at || m.CREATED_AT,
      updatedAt: m.updated_at || m.UPDATED_AT,
    };
  }

  async savePitchMapping(originalFormat: string, normalizedFormat: string): Promise<void> {
    const db = await this.getDatabase();
    
    // Check if mapping already exists
    const existing = await this.getPitchMappingByFormat(originalFormat);
    
    if (existing) {
      // Update existing mapping
      await db.query(`
        UPDATE csv_pitch_mappings
        SET normalized_format = :1,
            updated_at = CURRENT_TIMESTAMP
        WHERE original_format = :2
      `, [normalizedFormat, originalFormat]);
    } else {
      // Insert new mapping
      await db.query(`
        INSERT INTO csv_pitch_mappings (original_format, normalized_format)
        VALUES (:1, :2)
      `, [originalFormat, normalizedFormat]);
    }
  }

  async deletePitchMapping(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM csv_pitch_mappings WHERE RAWTOHEX(id) = :1`, [id]);
  }

  // ============================================================================
  // CENTERS METHODS
  // ============================================================================

  async getAllCenters(): Promise<any[]> {
    const cacheKey = 'centers:all';
    const cached = this.get<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const db = await this.getDatabase();
    const centers = await db.query<any>(
      `SELECT id, name, badge_text_color, created_at, updated_at 
       FROM centers 
       ORDER BY name ASC`
    );

    // Get all users with their editor_for arrays
    const users = await db.query<any>(
      `SELECT RAWTOHEX(id) as id, editor_for FROM users WHERE editor_for IS NOT NULL`
    );

    // Build a map of center_id -> user_ids who are editors
    const centerEditors = new Map<number, string[]>();
    for (const user of users) {
      try {
        const editorFor = user.EDITOR_FOR || user.editor_for;
        if (editorFor) {
          const centerIds = JSON.parse(editorFor);
          for (const centerId of centerIds) {
            if (!centerEditors.has(centerId)) {
              centerEditors.set(centerId, []);
            }
            centerEditors.get(centerId)!.push(user.ID || user.id);
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    // Normalize Oracle uppercase column names to lowercase and add editor_ids
    const normalizedCenters = centers.map(center => {
      const id = center.ID || center.id;
      return {
        id,
        name: center.NAME || center.name,
        badge_text_color: center.BADGE_TEXT_COLOR || center.badge_text_color,
        editor_ids: centerEditors.get(id) || [],
        created_at: center.CREATED_AT || center.created_at,
        updated_at: center.UPDATED_AT || center.updated_at,
      };
    });

    this.set(cacheKey, normalizedCenters);
    return normalizedCenters;
  }

  async getCenterById(id: string | number): Promise<any> {
    const cacheKey = `centers:${id}`;
    const cached = this.get<any>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const db = await this.getDatabase();
    const centers = await db.query<any>(
      `SELECT id, name, badge_text_color, created_at, updated_at 
       FROM centers 
       WHERE id = :1`,
      [id]
    );

    if (centers.length === 0) {
      return null;
    }

    const center = centers[0];
    
    // Get all users who have this center in their editor_for array
    const editors = await db.query<any>(
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
    
    const editor_ids = editors.map((e: any) => e.ID || e.id);
    
    const normalizedCenter = {
      id: center.ID || center.id,
      name: center.NAME || center.name,
      badge_text_color: center.BADGE_TEXT_COLOR || center.badge_text_color,
      editor_ids,
      created_at: center.CREATED_AT || center.created_at,
      updated_at: center.UPDATED_AT || center.updated_at,
    };

    this.set(cacheKey, normalizedCenter);
    return normalizedCenter;
  }

  async createCenter(data: { name: string; badge_text_color: string; editor_ids?: number[]; created_by?: string }): Promise<any> {
    const db = await this.getDatabase();
    
    // Insert center
    await db.query(
      `INSERT INTO centers (name, badge_text_color, created_by, created_at, updated_at) 
       VALUES (:1, :2, :3, SYSTIMESTAMP, SYSTIMESTAMP)`,
      [data.name, data.badge_text_color, data.created_by || null]
    );

    // Get the newly created center
    const result = await db.query<any>(
      `SELECT id, name, badge_text_color, created_at, updated_at 
       FROM centers 
       WHERE name = :1 
       ORDER BY created_at DESC`,
      [data.name]
    );

    // Invalidate center-related caches
    this.invalidateCenterRelatedCaches();

    if (result.length > 0) {
      const center = result[0];
      
      return {
        id: center.ID || center.id,
        name: center.NAME || center.name,
        badge_text_color: center.BADGE_TEXT_COLOR || center.badge_text_color,
        created_at: center.CREATED_AT || center.created_at,
        updated_at: center.UPDATED_AT || center.updated_at,
      };
    }

    return null;
  }

  async updateCenter(id: string | number, data: { name?: string; badge_text_color?: string; editor_ids?: number[]; updated_by?: string }): Promise<any> {
    const db = await this.getDatabase();
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = :' + (params.length + 1));
      params.push(data.name);
    }
    
    if (data.badge_text_color !== undefined) {
      updates.push('badge_text_color = :' + (params.length + 1));
      params.push(data.badge_text_color);
    }
    
    if (data.updated_by !== undefined) {
      updates.push('updated_by = :' + (params.length + 1));
      params.push(data.updated_by);
    }
    
    updates.push('updated_at = SYSTIMESTAMP');
    params.push(id);
    
    await db.query(
      `UPDATE centers SET ${updates.join(', ')} WHERE id = :${params.length}`,
      params
    );

    // Invalidate center-related caches
    this.invalidateCenterRelatedCaches();

    // Return updated center
    return this.getCenterById(id);
  }

  async deleteCenter(id: string | number): Promise<void> {
    const db = await this.getDatabase();
    
    await db.query(
      `DELETE FROM centers WHERE id = :1`,
      [id]
    );

    // Invalidate center-related caches
    this.invalidateCenterRelatedCaches();
  }

  // ============================================================================
  // FEEDBACK METHODS
  // ============================================================================

  async createFeedback(data: {
    feedback: string;
    category: string;
    email: string;
    userAgent?: string;
    url?: string;
    ipAddress?: string;
  }): Promise<any> {
    const db = await this.getDatabase();
    
    await db.query(
      `INSERT INTO feedback (feedback, category, email, user_agent, url, ip_address, status, created_at, updated_at)
       VALUES (:1, :2, :3, :4, :5, :6, 'new', SYSTIMESTAMP, SYSTIMESTAMP)`,
      [
        data.feedback,
        data.category,
        data.email,
        data.userAgent || null,
        data.url || null,
        data.ipAddress || null
      ]
    );

    // Invalidate feedback cache
    this.invalidatePattern(/^feedback:/);

    return { success: true };
  }

  async getAllFeedback(): Promise<any[]> {
    const cacheKey = 'feedback:all';
    const cached = this.get<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const db = await this.getDatabase();
    const feedback = await db.query<any>(
      `SELECT RAWTOHEX(id) as id, feedback, category, email, user_agent, url, ip_address, 
              status, admin_notes, created_at, updated_at
       FROM feedback 
       ORDER BY created_at DESC`
    );

    // Normalize Oracle uppercase column names
    const normalizedFeedback = feedback.map(f => ({
      id: f.ID || f.id,
      feedback: f.FEEDBACK || f.feedback,
      category: f.CATEGORY || f.category,
      email: f.EMAIL || f.email,
      user_agent: f.USER_AGENT || f.user_agent,
      url: f.URL || f.url,
      ip_address: f.IP_ADDRESS || f.ip_address,
      status: f.STATUS || f.status,
      admin_notes: f.ADMIN_NOTES || f.admin_notes,
      created_at: f.CREATED_AT || f.created_at,
      updated_at: f.UPDATED_AT || f.updated_at,
    }));

    this.set(cacheKey, normalizedFeedback);
    return normalizedFeedback;
  }

  async getFeedbackById(id: string | number): Promise<any> {
    const cacheKey = `feedback:${id}`;
    const cached = this.get<any>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const db = await this.getDatabase();
    const feedback = await db.query<any>(
      `SELECT RAWTOHEX(id) as id, feedback, category, email, user_agent, url, ip_address, 
              status, admin_notes, created_at, updated_at
       FROM feedback 
       WHERE RAWTOHEX(id) = :1`,
      [id]
    );

    if (feedback.length === 0) {
      return null;
    }

    const f = feedback[0];
    const normalizedFeedback = {
      id: f.ID || f.id,
      feedback: f.FEEDBACK || f.feedback,
      category: f.CATEGORY || f.category,
      email: f.EMAIL || f.email,
      user_agent: f.USER_AGENT || f.user_agent,
      url: f.URL || f.url,
      ip_address: f.IP_ADDRESS || f.ip_address,
      status: f.STATUS || f.status,
      admin_notes: f.ADMIN_NOTES || f.admin_notes,
      created_at: f.CREATED_AT || f.created_at,
      updated_at: f.UPDATED_AT || f.updated_at,
    };

    this.set(cacheKey, normalizedFeedback);
    return normalizedFeedback;
  }

  async updateFeedback(id: string | number, data: { status?: string; admin_notes?: string }): Promise<any> {
    const db = await this.getDatabase();
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.status !== undefined) {
      updates.push('status = :' + (params.length + 1));
      params.push(data.status);
    }
    
    if (data.admin_notes !== undefined) {
      updates.push('admin_notes = :' + (params.length + 1));
      params.push(data.admin_notes);
    }
    
    updates.push('updated_at = SYSTIMESTAMP');
    params.push(id);
    
    await db.query(
      `UPDATE feedback SET ${updates.join(', ')} WHERE RAWTOHEX(id) = :${params.length}`,
      params
    );

    // Invalidate cache
    this.invalidatePattern(/^feedback:/);

    return this.getFeedbackById(id);
  }

  async deleteFeedback(id: string | number): Promise<void> {
    const db = await this.getDatabase();
    
    await db.query(
      `DELETE FROM feedback WHERE RAWTOHEX(id) = :1`,
      [id]
    );

    // Invalidate cache
    this.invalidatePattern(/^feedback:/);
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Run cleanup every 5 minutes
setInterval(() => {
  cacheService.cleanupExpired();
}, 5 * 60 * 1000);

// Helper function to safely extract Oracle values (handles CLOBs and circular refs)
function extractValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  // If it's a Lob (CLOB/BLOB), we currently convert it in SQL using DBMS_LOB.SUBSTR,
  // so we should not normally see LOB instances here. As a safety net, return null.
  if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Lob') {
    return null;
  }
  // If it's a Date, convert to ISO string
  if (value instanceof Date) {
    return value.toISOString();
  }
  // Return primitive values as-is
  return value;
}

/**
 * Warm up cache by fetching all data on startup
 * This reduces latency for initial requests
 */
/**
 * Selective warmup - fetches all data WITHOUT expensive CLOB fields
 * CLOBs (lyrics, meaning, song_tags) are fetched on-demand when viewing song details
 * This reduces recursive SQL from 40k to ~2-3k
 */
export async function warmupCache(): Promise<void> {
  const { databaseService } = await import('./DatabaseService.js');
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Track overall success
  let successCount = 0;
  let failureCount = 0;
  const stats: { table: string; count: number }[] = [];

  try {
    const songs = await databaseService.query(`
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
        s.video_link,
        s.golden_voice,
        s.reference_gents_pitch,
        s.reference_ladies_pitch,
        s.created_at,
        s.updated_at,
        (SELECT COUNT(*) FROM song_singer_pitches ssp WHERE ssp.song_id = s.id) as pitch_count
      FROM songs s
      ORDER BY s.name
    `);

    stats.push({ table: 'songs', count: songs.length });

    // Map WITHOUT CLOB fields (lyrics, meaning, song_tags)
    const mappedSongs = songs.map((song: any) => ({
      id: extractValue(song.ID),
      name: extractValue(song.NAME),
      externalSourceUrl: extractValue(song.EXTERNAL_SOURCE_URL),
      language: extractValue(song.LANGUAGE),
      deity: extractValue(song.DEITY),
      tempo: extractValue(song.TEMPO),
      beat: extractValue(song.BEAT),
      raga: extractValue(song.RAGA),
      level: extractValue(song.SONG_LEVEL),
      audioLink: extractValue(song.AUDIO_LINK),
      videoLink: extractValue(song.VIDEO_LINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      referenceGentsPitch: extractValue(song.REFERENCE_GENTS_PITCH),
      referenceLadiesPitch: extractValue(song.REFERENCE_LADIES_PITCH),
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT),
      pitch_count: parseInt(song.PITCH_COUNT || song.pitch_count || '0', 10),
      // CLOB fields will be fetched on-demand:
      lyrics: null,
      meaning: null,
      songTags: null
    }));

    cacheService.set('songs:all', mappedSongs, CACHE_TTL);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache songs:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const singers = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        gender,
        email,
        center_ids,
        created_at,
        updated_at
      FROM users
      ORDER BY name
    `);

    stats.push({ table: 'users', count: singers.length });
    
    // Normalize and parse center_ids JSON
    const normalizedSingers = singers.map((s: any) => {
      let centerIds: number[] = [];
      try {
        if (s.CENTER_IDS || s.center_ids) {
          centerIds = JSON.parse(s.CENTER_IDS || s.center_ids);
        }
      } catch (e) {
        // Silently skip parse errors during warmup
      }
      
      return {
        id: s.id || s.ID,
        name: s.name || s.NAME,
        gender: s.gender || s.GENDER,
        email: s.email || s.EMAIL,
        center_ids: centerIds,
        created_at: s.created_at || s.CREATED_AT,
        updated_at: s.updated_at || s.UPDATED_AT,
      };
    });
    
    cacheService.set('singers:all', normalizedSingers, CACHE_TTL);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache singers:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Fetch pitches with song and singer names for proper sorting
    const pitches = await databaseService.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      JOIN songs s ON ssp.song_id = s.id
      JOIN users si ON ssp.singer_id = si.id
      ORDER BY LTRIM(REGEXP_REPLACE(LOWER(s.name), '[^a-zA-Z0-9 ]', ''), '0123456789 '), LTRIM(REGEXP_REPLACE(LOWER(si.name), '[^a-zA-Z0-9 ]', ''), '0123456789 ')
    `);

    stats.push({ table: 'pitches', count: pitches.length });

    // Normalize field names (Oracle returns uppercase) for cache consistency
    const normalizedPitches = pitches.map((p: any) => ({
      id: p.id || p.ID,
      song_id: p.song_id || p.SONG_ID,
      singer_id: p.singer_id || p.SINGER_ID,
      pitch: p.pitch || p.PITCH,
      song_name: p.song_name || p.SONG_NAME,
      singer_name: p.singer_name || p.SINGER_NAME,
      created_at: p.created_at || p.CREATED_AT,
      updated_at: p.updated_at || p.UPDATED_AT,
    }));

    cacheService.set('pitches:all', normalizedPitches, CACHE_TTL);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache pitches:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const sessions = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM song_sessions 
      ORDER BY name
    `);

    stats.push({ table: 'sessions', count: sessions.length });

    const mappedSessions = sessions.map((row: any) => ({
      id: row.ID,
      name: row.NAME,
      description: row.DESCRIPTION,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));

    cacheService.set('sessions:all', mappedSessions, CACHE_TTL);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache sessions:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const templates = await databaseService.query(`
      SELECT 
        id,
        name,
        description,
        template_json,
        is_default,
        created_at,
        updated_at
      FROM presentation_templates 
      ORDER BY is_default DESC, name ASC
    `);

    stats.push({ table: 'templates', count: templates.length });

    const mappedTemplates = templates.map((row: any) => {
      let templateJson: any = {};
      try {
        templateJson = typeof row.TEMPLATE_JSON === 'string' ? JSON.parse(row.TEMPLATE_JSON) : row.TEMPLATE_JSON || {};
      } catch (e) {
        console.error('Error parsing template JSON:', e);
      }

      // Check if this is a multi-slide template
      const isMultiSlide = Array.isArray(templateJson.slides) && templateJson.slides.length > 0;

      const template: any = {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        aspectRatio: templateJson.aspectRatio || '16:9',  // Extract aspect ratio from JSON
        isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      };

      if (isMultiSlide) {
        // Multi-slide format
        template.slides = templateJson.slides;
        template.referenceSlideIndex = templateJson.referenceSlideIndex ?? 0;
        // Also populate legacy fields from reference slide for backward compatibility
        const refSlide = template.slides[template.referenceSlideIndex] || template.slides[0];
        template.background = refSlide?.background;
        template.images = refSlide?.images || [];
        template.videos = refSlide?.videos || [];
        template.text = refSlide?.text || [];
      } else {
        // Legacy single-slide format
        template.background = templateJson.background;
        template.images = templateJson.images || [];
        template.videos = templateJson.videos || [];
        template.text = templateJson.text || [];
        // Auto-migrate to multi-slide format
        template.slides = [{
          background: template.background,
          images: template.images,
          videos: template.videos,
          text: template.text,
        }];
        template.referenceSlideIndex = 0;
      }

      // Reconstruct YAML from template data (using multi-slide format)
      if (template.slides && template.slides.length > 0) {
        template.yaml = yaml.dump({
          name: template.name,
          description: template.description,
          aspectRatio: template.aspectRatio,
          slides: template.slides,
          referenceSlideIndex: template.referenceSlideIndex ?? 0,
        });
      } else {
        template.yaml = yaml.dump({
          name: template.name,
          description: template.description,
          aspectRatio: template.aspectRatio,
          background: template.background,
          images: template.images || [],
          videos: template.videos || [],
          text: template.text || [],
        });
      }

      return template;
    });

    cacheService.set('templates:all', mappedTemplates, CACHE_TTL);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache templates:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const centers = await databaseService.query(`
      SELECT id, name, badge_text_color, created_at, updated_at 
      FROM centers 
      ORDER BY name ASC
    `);

    stats.push({ table: 'centers', count: centers.length });

    // Normalize Oracle uppercase column names
    const normalizedCenters = centers.map((center: any) => ({
      id: center.ID || center.id,
      name: center.NAME || center.name,
      badge_text_color: center.BADGE_TEXT_COLOR || center.badge_text_color,
      created_at: center.CREATED_AT || center.created_at,
      updated_at: center.UPDATED_AT || center.updated_at,
    }));

    cacheService.set('centers:all', normalizedCenters, CACHE_TTL);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache centers:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const feedback = await databaseService.query(`
      SELECT id, feedback, category, email, user_agent, url, ip_address, 
             status, admin_notes, created_at, updated_at
      FROM feedback 
      ORDER BY created_at DESC
    `);

    stats.push({ table: 'feedback', count: feedback.length });

    // Normalize Oracle uppercase column names
    const normalizedFeedback = feedback.map((f: any) => ({
      id: f.ID || f.id,
      feedback: f.FEEDBACK || f.feedback,
      category: f.CATEGORY || f.category,
      email: f.EMAIL || f.email,
      user_agent: f.USER_AGENT || f.user_agent,
      url: f.URL || f.url,
      ip_address: f.IP_ADDRESS || f.ip_address,
      status: f.STATUS || f.status,
      admin_notes: f.ADMIN_NOTES || f.admin_notes,
      created_at: f.CREATED_AT || f.created_at,
      updated_at: f.UPDATED_AT || f.updated_at,
    }));

    cacheService.set('feedback:all', normalizedFeedback, CACHE_TTL);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache feedback:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Summary
  const total = successCount + failureCount;
  
  console.log('📊 Cache warmup statistics:');
  stats.forEach(({ table, count }) => {
    console.log(`   ${table.padEnd(15)}: ${count.toString().padStart(4)} rows`);
  });
  console.log(`   ${'Total tables'.padEnd(15)}: ${successCount}/${total} cached`);
  
  if (failureCount === total) {
    throw new Error('All cache warmup attempts failed - database may not be configured');
  }
}

export default cacheService;

