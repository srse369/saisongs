/**
 * CacheService - In-memory cache for database results
 * Reduces database load by caching query results with TTL
 */

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
      console.log(`🗑️  Cache expired for key: ${key} (age: ${Math.round(age / 1000)}s)`);
      return null;
    }

    console.log(`✅ Cache hit for key: ${key} (age: ${Math.round(age / 1000)}s)`);
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
    console.log(`💾 Cached data for key: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
  }

  /**
   * Invalidate a specific cache key
   * @param key Cache key to invalidate
   */
  invalidate(key: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      console.log(`🗑️  Invalidated cache for key: ${key}`);
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

    if (count > 0) {
      console.log(`🗑️  Invalidated ${count} cache entries matching pattern: ${pattern}`);
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️  Cleared ${size} cache entries`);
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

    if (count > 0) {
      console.log(`🧹 Cleaned up ${count} expired cache entries`);
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
        sairhythms_url,
        title,
        title2,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        audio_link,
        video_link,
        ulink,
        golden_voice,
        created_at,
        updated_at
      FROM songs
      ORDER BY name
    `);

    const mappedSongs = songs.map((song: any) => ({
      id: extractValue(song.ID),
      name: extractValue(song.NAME),
      sairhythmsUrl: extractValue(song.SAIRHYTHMS_URL),
      title: extractValue(song.TITLE),
      title2: extractValue(song.TITLE2),
      language: extractValue(song.LANGUAGE),
      deity: extractValue(song.DEITY),
      tempo: extractValue(song.TEMPO),
      beat: extractValue(song.BEAT),
      raga: extractValue(song.RAGA),
      level: extractValue(song.SONG_LEVEL),
      audioLink: extractValue(song.AUDIO_LINK),
      videoLink: extractValue(song.VIDEO_LINK),
      ulink: extractValue(song.ULINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
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
        sairhythms_url,
        title,
        title2,
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
        ulink,
        golden_voice,
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
      sairhythmsUrl: extractValue(song.SAIRHYTHMS_URL),
      title: extractValue(song.TITLE),
      title2: extractValue(song.TITLE2),
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
      ulink: extractValue(song.ULINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT)
    };
    
    // Cache individual song with CLOBs (5 min TTL)
    this.set(cacheKey, mappedSong, 5 * 60 * 1000);
    return mappedSong;
  }

  async createSong(songData: any): Promise<void> {
    const db = await this.getDatabase();
    const params = [
      String(songData.name || ''),
      String(songData.sairhythms_url || ''),
      String(songData.title || ''),
      String(songData.title2 || ''),
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
      String(songData.ulink || ''),
      Number(songData.golden_voice || 0)
    ];

    await db.query(`
      INSERT INTO songs (
        name, sairhythms_url, title, title2, lyrics, meaning,
        "LANGUAGE", deity, tempo, beat, raga, "LEVEL",
        song_tags, audio_link, video_link, ulink, golden_voice
      ) VALUES (
        :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17
      )
    `, params);

    // Write-through cache: Fetch only the newly created song
    const newSongs = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        sairhythms_url,
        title,
        title2,
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
        ulink,
        golden_voice,
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
        sairhythmsUrl: extractValue(newSong.SAIRHYTHMS_URL),
        title: extractValue(newSong.TITLE),
        title2: extractValue(newSong.TITLE2),
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
        ulink: extractValue(newSong.ULINK),
        goldenVoice: !!extractValue(newSong.GOLDEN_VOICE),
        createdAt: extractValue(newSong.CREATED_AT),
        updatedAt: extractValue(newSong.UPDATED_AT)
      };

      // Add to cached list and re-sort by name
      const cached = this.get('songs:all');
      if (cached && Array.isArray(cached)) {
        const updated = [...cached, mappedSong].sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
        this.set('songs:all', updated, 5 * 60 * 1000);
        console.log('✍️  Write-through: Added new song to cache (selective update)');
      }
    }
  }

  async updateSong(id: string, songData: any): Promise<void> {
    const db = await this.getDatabase();
    const params = [
      String(songData.name || ''),
      String(songData.sairhythms_url || ''),
      String(songData.title || ''),
      String(songData.title2 || ''),
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
      String(songData.ulink || ''),
      Number(songData.golden_voice || 0),
      String(id)
    ];

    await db.query(`
      UPDATE songs SET
        name = :1,
        sairhythms_url = :2,
        title = :3,
        title2 = :4,
        lyrics = :5,
        meaning = :6,
        "LANGUAGE" = :7,
        deity = :8,
        tempo = :9,
        beat = :10,
        raga = :11,
        "LEVEL" = :12,
        song_tags = :13,
        audio_link = :14,
        video_link = :15,
        ulink = :16,
        golden_voice = :17,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :18
    `, params);

    // Write-through cache: Fetch only the updated song
    const updatedSongs = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        sairhythms_url,
        title,
        title2,
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
        ulink,
        golden_voice,
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
        sairhythmsUrl: extractValue(updatedSong.SAIRHYTHMS_URL),
        title: extractValue(updatedSong.TITLE),
        title2: extractValue(updatedSong.TITLE2),
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
        ulink: extractValue(updatedSong.ULINK),
        goldenVoice: !!extractValue(updatedSong.GOLDEN_VOICE),
        createdAt: extractValue(updatedSong.CREATED_AT),
        updatedAt: extractValue(updatedSong.UPDATED_AT)
      };

      // Replace in cached list and re-sort (in case name changed)
      const cached = this.get('songs:all');
      if (cached && Array.isArray(cached)) {
        const updated = cached
          .map(song => song.id === id ? mappedSong : song)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.set('songs:all', updated, 5 * 60 * 1000);
        console.log('✍️  Write-through: Updated song in cache (selective update)');
      }
    }
  }

  async deleteSong(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM songs WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Write-through cache: Remove from cached list
    const cached = this.get('songs:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((song: any) => song.id !== id);
      this.set('songs:all', updated, 5 * 60 * 1000);
      console.log('✍️  Write-through: Removed song from cache after delete');
    }
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
        created_at,
        updated_at
      FROM singers
      ORDER BY name
    `);

    this.set(cacheKey, singers, 5 * 60 * 1000);
    return singers;
  }

  async getSinger(id: string): Promise<any> {
    const db = await this.getDatabase();
    const singers = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        created_at,
        updated_at
      FROM singers
      WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    return singers.length > 0 ? singers[0] : null;
  }

  async createSinger(name: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`INSERT INTO singers (name) VALUES (:1)`, [name]);
    
    // Write-through cache: Fetch only the newly created singer
    const newSingers = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        created_at,
        updated_at
      FROM singers
      WHERE name = :1
      ORDER BY created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, [name]);
    
    if (newSingers.length > 0) {
      const cached = this.get('singers:all');
      if (cached && Array.isArray(cached)) {
        const updated = [...cached, newSingers[0]].sort((a, b) => 
          (a.NAME || '').localeCompare(b.NAME || '')
        );
        this.set('singers:all', updated, 5 * 60 * 1000);
        console.log('✍️  Write-through: Added new singer to cache (selective update)');
      }
    }
  }

  async updateSinger(id: string, name: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`
      UPDATE singers SET
        name = :1,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :2
    `, [name, id]);
    
    // Write-through cache: Fetch only the updated singer
    const updatedSingers = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
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
        console.log('✍️  Write-through: Updated singer in cache (selective update)');
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
      console.log('✍️  Write-through: Removed singer from cache after delete');
    }
  }

  // ==================== PITCHES ====================

  async getAllPitches(): Promise<any[]> {
    const cacheKey = 'pitches:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

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

    this.set(cacheKey, pitches, 5 * 60 * 1000);
    return pitches;
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

  async createPitch(pitchData: any): Promise<void> {
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
      const cached = this.get('pitches:all');
      if (cached && Array.isArray(cached)) {
        const updated = [...cached, newPitches[0]].sort((a, b) => {
          const songCompare = (a.SONG_NAME || '').localeCompare(b.SONG_NAME || '');
          if (songCompare !== 0) return songCompare;
          return (a.SINGER_NAME || '').localeCompare(b.SINGER_NAME || '');
        });
        this.set('pitches:all', updated, 5 * 60 * 1000);
        console.log('✍️  Write-through: Added new pitch to cache (selective update)');
      }
    }
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
        const updated = cached.map((p: any) => p.ID === id ? updatedPitches[0] : p);
        this.set('pitches:all', updated, 5 * 60 * 1000);
        console.log('✍️  Write-through: Updated pitch in cache (selective update)');
      }
    }
  }

  async deletePitch(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM song_singer_pitches WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Write-through cache: Remove from cached list
    const cached = this.get('pitches:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((pitch: any) => pitch.ID !== id);
      this.set('pitches:all', updated, 5 * 60 * 1000);
      console.log('✍️  Write-through: Removed pitch from cache after delete');
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
      console.log('✍️  Write-through: Added new session to cache (selective update)');
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
      console.log('✍️  Write-through: Updated session in cache (selective update)');
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
      console.log('✍️  Write-through: Removed session from cache after delete');
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
      console.log('✍️  Write-through: Added duplicated session to cache (selective update)');
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
    console.log('✍️  Write-through: Invalidated sessions cache after item add');
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
    console.log('✍️  Write-through: Invalidated sessions cache after item update');
  }

  async deleteSessionItem(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.query(`DELETE FROM session_items WHERE RAWTOHEX(id) = :1`, [id]);
    
    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
    console.log('✍️  Write-through: Invalidated sessions cache after item delete');
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
    console.log('✍️  Write-through: Invalidated sessions cache after reorder');
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
    console.log('✍️  Write-through: Invalidated sessions cache after setting items');

    // Fetch all items with details
    return await this.getSessionItems(sessionId);
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

  console.log('  📚 Fetching songs (without CLOB fields)...');
  try {
    const songs = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        sairhythms_url,
        title,
        title2,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        audio_link,
        video_link,
        ulink,
        golden_voice,
        created_at,
        updated_at
      FROM songs
      ORDER BY name
    `);

    // Map WITHOUT CLOB fields (lyrics, meaning, song_tags)
    const mappedSongs = songs.map((song: any) => ({
      id: extractValue(song.ID),
      name: extractValue(song.NAME),
      sairhythmsUrl: extractValue(song.SAIRHYTHMS_URL),
      title: extractValue(song.TITLE),
      title2: extractValue(song.TITLE2),
      language: extractValue(song.LANGUAGE),
      deity: extractValue(song.DEITY),
      tempo: extractValue(song.TEMPO),
      beat: extractValue(song.BEAT),
      raga: extractValue(song.RAGA),
      level: extractValue(song.SONG_LEVEL),
      audioLink: extractValue(song.AUDIO_LINK),
      videoLink: extractValue(song.VIDEO_LINK),
      ulink: extractValue(song.ULINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT),
      // CLOB fields will be fetched on-demand:
      lyrics: null,
      meaning: null,
      songTags: null
    }));

    cacheService.set('songs:all', mappedSongs, CACHE_TTL);
    console.log(`  ✓ Cached ${mappedSongs.length} songs (without lyrics/meaning/tags)`);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache songs:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('  👥 Fetching singers...');
  try {
    const singers = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        created_at,
        updated_at
      FROM singers
      ORDER BY name
    `);

    cacheService.set('singers:all', singers, CACHE_TTL);
    console.log(`  ✓ Cached ${singers.length} singers`);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache singers:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('  🎵 Fetching pitches...');
  try {
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

    cacheService.set('pitches:all', pitches, CACHE_TTL);
    console.log(`  ✓ Cached ${pitches.length} pitches`);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache pitches:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Small delay between queries to avoid overwhelming the pool
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('  📅 Fetching sessions...');
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
    console.log(`  ✓ Cached ${mappedSessions.length} sessions`);
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache sessions:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  // Summary
  const total = successCount + failureCount;
  console.log(`  📊 Cache warmup summary: ${successCount}/${total} successful, ${failureCount}/${total} failed`);
  
  if (failureCount === total) {
    throw new Error('All cache warmup attempts failed - database may not be configured');
  }
}

export default cacheService;

