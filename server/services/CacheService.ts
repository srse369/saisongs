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
  private readonly DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
   * @param ttlMs Time to live in milliseconds (default: 2 minutes)
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
        RAWTOHEX(id) as id,
        name,
        external_source_url,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        audio_link,
        video_link,
        golden_voice,
        reference_gents_pitch,
        reference_ladies_pitch,
        created_at,
        updated_at
      FROM songs
      ORDER BY name
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
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT),
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
      WHERE RAWTOHEX(id) = :1
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
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT)
    };
    
    // Cache individual song with CLOBs (5 min TTL)
    this.set(cacheKey, mappedSong, 5 * 60 * 1000);
    return mappedSong;
  }

  async createSong(songData: any): Promise<any> {
    const db = await this.getDatabase();
    const params = [
      String(songData.name || ''),
      String(songData.external_source_url || ''),
      String(songData.lyrics || ''),
      String(songData.meaning || ''),
      String(songData.language || ''),
      String(songData.deity || ''),
      String(songData.tempo || ''),
      String(songData.beat || ''),
      String(songData.raga || ''),
      String(songData.level || ''),
      String(songData.song_tags || ''),
      String(songData.audio_link || ''),
      String(songData.video_link || ''),
      Number(songData.golden_voice || 0),
      songData.reference_gents_pitch ? String(songData.reference_gents_pitch) : null,
      songData.reference_ladies_pitch ? String(songData.reference_ladies_pitch) : null
    ];

    await db.query(`
      INSERT INTO songs (
        name, external_source_url, lyrics, meaning,
        "LANGUAGE", deity, tempo, beat, raga, "LEVEL",
        song_tags, audio_link, video_link, golden_voice,
        reference_gents_pitch, reference_ladies_pitch
      ) VALUES (
        :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16
      )
    `, params);

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
      WHERE name = :1
      ORDER BY created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, [songData.name]);

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
        updatedAt: extractValue(newSong.UPDATED_AT)
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
    const params = [
      String(songData.name || ''),
      String(songData.external_source_url || ''),
      String(songData.lyrics || ''),
      String(songData.meaning || ''),
      String(songData.language || ''),
      String(songData.deity || ''),
      String(songData.tempo || ''),
      String(songData.beat || ''),
      String(songData.raga || ''),
      String(songData.level || ''),
      String(songData.song_tags || ''),
      String(songData.audio_link || ''),
      String(songData.video_link || ''),
      Number(songData.golden_voice || 0),
      songData.reference_gents_pitch ? String(songData.reference_gents_pitch) : null,
      songData.reference_ladies_pitch ? String(songData.reference_ladies_pitch) : null,
      String(id)
    ];

    await db.query(`
      UPDATE songs SET
        name = :1,
        external_source_url = :2,
        lyrics = :3,
        meaning = :4,
        "LANGUAGE" = :5,
        deity = :6,
        tempo = :7,
        beat = :8,
        raga = :9,
        "LEVEL" = :10,
        song_tags = :11,
        audio_link = :12,
        video_link = :13,
        golden_voice = :14,
        reference_gents_pitch = :15,
        reference_ladies_pitch = :16,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :17
    `, params);

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
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (updatedSongs.length > 0) {
      const updatedSong = updatedSongs[0];
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
        updatedAt: extractValue(updatedSong.UPDATED_AT)
      };

      // Update cache directly - replace in list or add if not exists
      const cached = this.get('songs:all');
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
    // No else - if cache doesn't exist, nothing to update
  }

  // ==================== SINGERS ====================

  async getAllSingers(): Promise<any[]> {
    const cacheKey = 'singers:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const db = await this.getDatabase();
    const singers = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        gender,
        created_at,
        updated_at
      FROM singers
      WHERE name IS NOT NULL
      ORDER BY name
    `);

    // Normalize field names (Oracle returns uppercase: ID, NAME, GENDER, CREATED_AT, UPDATED_AT)
    const normalizedSingers = singers.map((s: any) => ({
      id: s.id || s.ID,
      name: s.name || s.NAME,
      gender: s.gender || s.GENDER,
      created_at: s.created_at || s.CREATED_AT,
      updated_at: s.updated_at || s.UPDATED_AT,
    })).filter((s: any) => s.name); // Filter out any singers with no name

    this.set(cacheKey, normalizedSingers, 5 * 60 * 1000);
    return normalizedSingers;
  }

  async getSinger(id: string): Promise<any> {
    const db = await this.getDatabase();
    const singers = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        gender,
        created_at,
        updated_at
      FROM singers
      WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    return singers.length > 0 ? singers[0] : null;
  }

  async createSinger(name: string, gender?: string): Promise<any> {
    try {
      const db = await this.getDatabase();
      
      await db.query(`INSERT INTO singers (name, gender) VALUES (:1, :2)`, [name, gender || null]);
      
      // Write-through cache: Fetch only the newly created singer
      const newSingers = await db.query(`
        SELECT 
          RAWTOHEX(id) as id,
          name,
          gender,
          created_at,
          updated_at
        FROM singers
        WHERE name = :1
        ORDER BY created_at DESC
        FETCH FIRST 1 ROWS ONLY
      `, [name]);
      
      if (newSingers.length > 0) {
        const rawSinger = newSingers[0];
        
        // Normalize field names to lowercase (Oracle might return uppercase)
        const normalizedSinger = {
          id: rawSinger.id || rawSinger.ID,
          name: rawSinger.name || rawSinger.NAME,
          gender: rawSinger.gender || rawSinger.GENDER,
          created_at: rawSinger.created_at || rawSinger.CREATED_AT,
          updated_at: rawSinger.updated_at || rawSinger.UPDATED_AT,
        };
        
        // Write-through cache: Add to cache or create minimal cache with new singer
        const cached = this.get('singers:all');
        if (cached && Array.isArray(cached)) {
          const updated = [...cached, rawSinger].sort((a, b) => 
            (a.NAME || a.name || '').localeCompare(b.NAME || b.name || '')
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

  async updateSinger(id: string, name: string, gender?: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`
      UPDATE singers SET
        name = :1,
        gender = :2,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :3
    `, [name, gender || null, id]);
    
    // Write-through cache: Fetch only the updated singer
    const updatedSingers = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        gender,
        created_at,
        updated_at
      FROM singers
      WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    if (updatedSingers.length > 0) {
      const cached = this.get('singers:all');
      if (cached && Array.isArray(cached)) {
        const updated = cached
          .map((singer: any) => singer.ID === id ? updatedSingers[0] : singer)
          .sort((a, b) => (a.NAME || '').localeCompare(b.NAME || ''));
        this.set('singers:all', updated, 5 * 60 * 1000);
      }
    }
  }

  async deleteSinger(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM singers WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Write-through cache: Remove from cached list
    const cached = this.get('singers:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((singer: any) => singer.ID !== id);
      this.set('singers:all', updated, 5 * 60 * 1000);
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
      JOIN songs s ON ssp.song_id = s.id
      JOIN singers si ON ssp.singer_id = si.id
      ORDER BY s.name, si.name
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
      JOIN songs s ON ssp.song_id = s.id
      JOIN singers si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.id) = :1
    `, [id]);
    
    return pitches.length > 0 ? pitches[0] : null;
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
      JOIN singers si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.song_id) = :1
      ORDER BY si.name
    `, [songId]);
  }

  async createPitch(pitchData: any): Promise<any> {
    const db = await this.getDatabase();
    await db.query(`
      INSERT INTO song_singer_pitches (song_id, singer_id, pitch)
      VALUES (HEXTORAW(:1), HEXTORAW(:2), :3)
    `, [pitchData.song_id, pitchData.singer_id, pitchData.pitch]);
    
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
      JOIN singers si ON ssp.singer_id = si.id
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
      
      return normalizedPitch;
    }
    
    return null;
  }

  async updatePitch(id: string, pitch: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`
      UPDATE song_singer_pitches SET
        pitch = :1,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :2
    `, [pitch, id]);
    
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
      JOIN singers si ON ssp.singer_id = si.id
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
        created_at,
        updated_at
      FROM named_sessions 
      ORDER BY name
    `);

    const mappedSessions = sessions.map((row: any) => ({
      id: row.ID,
      name: row.NAME,
      description: row.DESCRIPTION,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));

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

    this.set(cacheKey, mappedTemplates, 5 * 60 * 1000);
    return mappedTemplates;
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
        created_at,
        updated_at
      FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (sessions.length === 0) return null;

    const sessionRow = sessions[0];

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
      FROM session_items si
      JOIN songs s ON si.song_id = s.id
      LEFT JOIN singers sg ON si.singer_id = sg.id
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
      createdAt: sessionRow.CREATED_AT,
      updatedAt: sessionRow.UPDATED_AT,
      items: mappedItems,
    };
  }

  async createSession(name: string, description?: string): Promise<any> {
    const db = await this.getDatabase();
    
    await db.query(`
      INSERT INTO named_sessions (name, description)
      VALUES (:1, :2)
    `, [String(name), String(description || '')]);

    // Fetch the created session
    const sessions = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM named_sessions 
      WHERE name = :1
    `, [name]);

    if (sessions.length === 0) throw new Error('Failed to retrieve created session');

    const session = sessions[0];
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

  async updateSession(id: string, updates: { name?: string; description?: string }): Promise<any> {
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

    if (updateParts.length === 0) throw new Error('No fields to update');

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`
      UPDATE named_sessions 
      SET ${updateParts.join(', ')} 
      WHERE RAWTOHEX(id) = :${paramIndex}
    `, params);

    // Fetch updated session
    const sessions = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (sessions.length === 0) return null;

    const session = sessions[0];
    const mappedSession = {
      id: session.ID,
      name: session.NAME,
      description: session.DESCRIPTION,
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
    await db.query(`DELETE FROM named_sessions WHERE RAWTOHEX(id) = :1`, [id]);
    
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
      FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (sessions.length === 0) throw new Error('Session not found');

    const originalSession = sessions[0];

    // Create new session
    await db.query(`
      INSERT INTO named_sessions (name, description)
      VALUES (:1, :2)
    `, [String(newName), String(originalSession.DESCRIPTION || '')]);

    // Get the new session ID
    const newSessions = await db.query(`
      SELECT RAWTOHEX(id) as id 
      FROM named_sessions 
      WHERE name = :1
    `, [newName]);

    if (newSessions.length === 0) throw new Error('Failed to retrieve duplicated session');

    const newSessionId = newSessions[0].ID;

    // Copy items
    await db.query(`
      INSERT INTO session_items (session_id, song_id, singer_id, pitch, sequence_order)
      SELECT HEXTORAW(:1), song_id, singer_id, pitch, sequence_order
      FROM session_items
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
      FROM named_sessions 
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
      FROM session_items si
      JOIN songs s ON si.song_id = s.id
      LEFT JOIN singers sg ON si.singer_id = sg.id
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
      INSERT INTO session_items (session_id, song_id, singer_id, pitch, sequence_order)
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
      UPDATE session_items 
      SET ${updateParts.join(', ')} 
      WHERE RAWTOHEX(id) = :${paramIndex}
    `, params);

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async deleteSessionItem(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM session_items WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async reorderSessionItems(sessionId: string, itemIds: string[]): Promise<void> {
    const db = await this.getDatabase();
    
    for (let i = 0; i < itemIds.length; i++) {
      await db.query(`
        UPDATE session_items 
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
      DELETE FROM session_items 
      WHERE RAWTOHEX(session_id) = :1
    `, [sessionId]);

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const { songId, singerId, pitch } = items[i];
      
      await db.query(`
        INSERT INTO session_items (session_id, song_id, singer_id, pitch, sequence_order)
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

  try {
    const songs = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        external_source_url,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        audio_link,
        video_link,
        golden_voice,
        reference_gents_pitch,
        reference_ladies_pitch,
        created_at,
        updated_at
      FROM songs
      ORDER BY name
    `);

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
        created_at,
        updated_at
      FROM singers
      ORDER BY name
    `);

    cacheService.set('singers:all', singers, CACHE_TTL);
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
      JOIN singers si ON ssp.singer_id = si.id
      ORDER BY s.name, si.name
    `);

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
      FROM named_sessions 
      ORDER BY name
    `);

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

  // Summary
  const total = successCount + failureCount;
  
  if (failureCount === total) {
    throw new Error('All cache warmup attempts failed - database may not be configured');
  }
}

export default cacheService;

