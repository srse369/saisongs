/**
 * CacheService - In-memory cache for database results
 * Reduces database load by caching query results with TTL
 */

import { PresentationTemplate, SongSingerPitch } from '../../src/types/index';
import databaseReadService from './DatabaseReadService.js';
import databaseWriteService from './DatabaseWriteService.js';
import templateService from './TemplateService.js';

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
    console.log('Clearing cache of size: ${size}', size);
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
  // All database operations MUST go through DatabaseReadService (for SELECT) or DatabaseWriteService (for INSERT/UPDATE/DELETE)
  // Routes should NEVER import DatabaseService directly
  private readonly databaseReadService = databaseReadService;
  private readonly databaseWriteService = databaseWriteService;
  private readonly templateService = templateService;

  /**
   * Filter resources by center access permissions
   * Implements the same logic as user_has_center_access Oracle function
   * @param resources Array of resources with center_ids property
   * @param userRole User's role ('admin', 'editor', or 'viewer')
   * @param centerIds User's accessible center IDs (centerIds + editorFor combined)
   * @returns Filtered array of resources the user can access
   */
  filterByCenterAccess<T extends { centerIds?: number[] }>(
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
      if (!resource.centerIds || resource.centerIds.length === 0) {
        return true;
      }

      // Check if user has access to any of the resource's centers
      return resource.centerIds.some(contentCenterId =>
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

    const songs = await this.databaseReadService.getAllSongsForCache();

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
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      refGents: extractValue(song.REFERENCE_GENTS_PITCH),
      refLadies: extractValue(song.REFERENCE_LADIES_PITCH),
      pitchCount: parseInt(song.PITCH_COUNT || song.pitch_count || '0', 10),
      // CLOB fields set to null - fetch on-demand via getSong(id)
      lyrics: null,
      meaning: null,
      songTags: null
    }));

    this.set(cacheKey, mappedSongs, this.DEFAULT_TTL_MS);
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

    const songs = await this.databaseReadService.getSongWithClobsForCache(id);

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
      refGents: extractValue(song.REFERENCE_GENTS_PITCH),
      refLadies: extractValue(song.REFERENCE_LADIES_PITCH),
      pitchCount: parseInt(song.PITCH_COUNT || song.pitch_count || '0', 10),
    };

    // Cache individual song with CLOBs
    this.set(cacheKey, mappedSong, this.DEFAULT_TTL_MS);
    return mappedSong;
  }

  async createSong(songData: any): Promise<any> {

    // Accept both camelCase (frontend) and snake_case (legacy) - normalize to snake_case for DB
    const data = {
      name: songData.name,
      external_source_url: songData.externalSourceUrl ?? songData.external_source_url,
      language: songData.language,
      deity: songData.deity,
      tempo: songData.tempo,
      beat: songData.beat,
      raga: songData.raga,
      level: songData.level,
      lyrics: songData.lyrics,
      meaning: songData.meaning,
      song_tags: songData.songTags ?? songData.song_tags,
      audio_link: songData.audioLink ?? songData.audio_link,
      video_link: songData.videoLink ?? songData.video_link,
      golden_voice: songData.goldenVoice ?? songData.golden_voice,
      reference_gents_pitch: songData.refGents ?? songData.reference_gents_pitch,
      reference_ladies_pitch: songData.refLadies ?? songData.reference_ladies_pitch,
      created_by: songData.createdBy ?? songData.created_by,
    };

    // Step 1: Insert along with all CLOB fields
    await this.databaseWriteService.createSongForCache(data);

    // Write-through cache: Fetch only the newly created song
    const newSongs = await this.databaseReadService.getNewSongByNameForCache(songData.name);

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
        goldenVoice: !!extractValue(newSong.GOLDEN_VOICE),
        refGents: extractValue(newSong.REFERENCE_GENTS_PITCH),
        refLadies: extractValue(newSong.REFERENCE_LADIES_PITCH),
        pitchCount: 0, // New songs have no pitches yet
      };

      // Update cache directly - add to existing cache or invalidate to force fresh fetch
      const cached = this.get('songs:all');
      if (cached && Array.isArray(cached)) {
        const updated = [...cached, mappedSong].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        this.set('songs:all', updated, this.DEFAULT_TTL_MS);
      } else {
        // No cache exists - invalidate to force fresh fetch on next request
        // This ensures all songs (including the new one) will be included
        this.invalidate('songs:all');
      }

      // Also cache the individual song
      this.set(`song:${mappedSong.id}`, mappedSong, this.DEFAULT_TTL_MS);

      return mappedSong;
    }

    return null;
  }

  async updateSong(id: string, songData: any): Promise<any> {

    // Accept both camelCase (frontend) and snake_case (legacy) - normalize to snake_case for DB
    const data = {
      name: songData.name,
      external_source_url: songData.externalSourceUrl ?? songData.external_source_url,
      language: songData.language,
      deity: songData.deity,
      tempo: songData.tempo,
      beat: songData.beat,
      raga: songData.raga,
      level: songData.level,
      lyrics: songData.lyrics,
      meaning: songData.meaning,
      song_tags: songData.songTags ?? songData.song_tags,
      audio_link: songData.audioLink ?? songData.audio_link,
      video_link: songData.videoLink ?? songData.video_link,
      golden_voice: songData.goldenVoice ?? songData.golden_voice,
      reference_gents_pitch: songData.refGents ?? songData.reference_gents_pitch,
      reference_ladies_pitch: songData.refLadies ?? songData.reference_ladies_pitch,
      updated_by: songData.updatedBy ?? songData.updated_by,
    };

    await this.databaseWriteService.updateSongForCache(id, data);

    // Write-through cache: Fetch only the updated song
    const updatedSongs = await this.databaseReadService.getUpdatedSongByIdForCache(id);

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
        goldenVoice: !!extractValue(updatedSong.GOLDEN_VOICE),
        refGents: extractValue(updatedSong.REFERENCE_GENTS_PITCH),
        refLadies: extractValue(updatedSong.REFERENCE_LADIES_PITCH),
        pitchCount: cachedSong?.pitchCount ?? 0, // Preserve from cache since update doesn't change pitches
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
        this.set('songs:all', updated, this.DEFAULT_TTL_MS);
      } else {
        // Cache doesn't exist - invalidate to force fresh fetch on next request
        // This ensures the new song will be included
        this.invalidate('songs:all');
      }

      // Update the individual song cache directly
      this.set(`song:${id}`, mappedSong, this.DEFAULT_TTL_MS);

      return mappedSong;
    }

    return null;
  }

  async deleteSong(id: string): Promise<void> {
    await this.databaseWriteService.deleteSongForCache(id);

    // Remove from individual song cache
    this.invalidate(`song:${id}`);

    // Update songs cache directly - remove from list
    let cached = this.get('songs:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((song: any) => song.id !== id);
      this.set('songs:all', updated, this.DEFAULT_TTL_MS);
    }

    // Update piches cache directly - remove from list
    cached = this.get('pitches:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((pitch: any) => pitch.songId !== id);
      this.set('pitches:all', updated, this.DEFAULT_TTL_MS);
    }

    // Note: Cannot invalidate individual pitch caches without querying which pitches were affected
  }

  // ==================== SINGERS ====================

  async getAllSingers(): Promise<any[]> {
    const cacheKey = 'singers:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const singers = await this.databaseReadService.getAllSingersForCache();

    // Normalize field names (Oracle returns uppercase: ID, NAME, GENDER, CENTER_IDS, EDITOR_FOR)
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

      // Get is_admin value (Oracle returns uppercase)
      const isAdminVal = s.is_admin ?? s.IS_ADMIN ?? 0;

      return {
        id: s.id || s.ID,
        name: s.name || s.NAME,
        gender: s.gender || s.GENDER,
        email: s.email || s.EMAIL,
        isAdmin: isAdminVal === 1 || isAdminVal === '1' || isAdminVal === true,
        centerIds: centerIds,
        editorFor: editorFor,
        pitchCount: parseInt(s.pitch_count || s.PITCH_COUNT || '0', 10),
      };
    }).filter((s: any) => s.name); // Filter out any singers with no name

    this.set(cacheKey, normalizedSingers, this.DEFAULT_TTL_MS);
    return normalizedSingers;
  }

  async getSinger(id: string): Promise<any> {
    const singers = await this.databaseReadService.getSingerByIdForCache(id);

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

    // Get is_admin value (Oracle returns uppercase)
    const isAdminVal = s.is_admin ?? s.IS_ADMIN ?? 0;

    return {
      id: s.id || s.ID,
      name: s.name || s.NAME,
      gender: s.gender || s.GENDER,
      email: s.email || s.EMAIL,
      isAdmin: isAdminVal === 1 || isAdminVal === '1' || isAdminVal === true,
      centerIds: centerIds,
      editorFor: editorFor,
      pitchCount: parseInt(s.pitch_count || s.PITCH_COUNT || '0', 10),
    };
  }

  async createSinger(singerData: any, gender?: string, email?: string, centerIds?: number[], editorFor?: number[], createdBy?: string): Promise<any> {
    try {

      // Accept both object (new) and positional args (legacy)
      let data: { name: string; gender?: string; email?: string; centerIds?: number[]; editorFor?: number[]; createdBy?: string };

      if (typeof singerData === 'string') {
        // Legacy call with positional args
        data = {
          name: singerData,
          gender: gender,
          email: email,
          centerIds: centerIds,
          editorFor: editorFor,
          createdBy: createdBy,
        };
      } else {
        // Object call with camelCase support
        data = {
          name: singerData.name,
          gender: singerData.gender,
          email: singerData.email,
          centerIds: singerData.centerIds ?? singerData.center_ids,
          editorFor: singerData.editorFor ?? singerData.editor_for,
          createdBy: singerData.createdBy ?? singerData.created_by,
        };
      }

      // Prepare center_ids as JSON string
      const centerIdsJson = data.centerIds && data.centerIds.length > 0
        ? JSON.stringify(data.centerIds)
        : null;

      // Prepare editor_for as JSON string
      const editorForJson = data.editorFor && data.editorFor.length > 0
        ? JSON.stringify(data.editorFor)
        : null;

      await this.databaseWriteService.createSingerForCache(data.name, data.gender || null, data.email || null, centerIdsJson, editorForJson, data.createdBy || null);

      // Write-through cache: Fetch only the newly created singer
      const newSingers = await this.databaseReadService.getNewSingerByNameForCache(data.name);

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

        let parsedEditorFor: number[] = [];
        try {
          if (rawSinger.EDITOR_FOR || rawSinger.editor_for) {
            parsedEditorFor = JSON.parse(rawSinger.EDITOR_FOR || rawSinger.editor_for);
          }
        } catch (e) {
          console.error('Error parsing editor_for:', e);
        }

        // Normalize field names to lowercase (Oracle might return uppercase)
        // New singer always has pitchCount = 0
        const normalizedSinger = {
          id: rawSinger.id || rawSinger.ID,
          name: rawSinger.name || rawSinger.NAME,
          gender: rawSinger.gender || rawSinger.GENDER,
          email: rawSinger.email || rawSinger.EMAIL,
          centerIds: parsedCenterIds,
          editorFor: parsedEditorFor,
          pitchCount: 0,
        };

        // Write-through cache: Add to cache or create minimal cache with new singer
        const cached = this.get('singers:all');
        if (cached && Array.isArray(cached)) {
          const updated = [...cached, normalizedSinger].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          );
          this.set('singers:all', updated, this.DEFAULT_TTL_MS);
        } else {
          // Cache doesn't exist - invalidate to force fresh fetch on next request
          // This ensures the new singer will be included
          this.invalidate('singers:all');
        }

        // Invalidate centers cache since singer count changed
        this.invalidate('centers:all');

        // Return the normalized singer object
        return normalizedSinger;
      }

      console.error(`  ❌ No singer found after INSERT`);
      throw new Error('Failed to create singer: No singer returned after insert');
    } catch (error) {
      console.error(`❌ CacheService.createSinger failed for "${typeof singerData === 'string' ? singerData : singerData?.name}":`, error);
      throw error;
    }
  }

  async updateSinger(id: string, singerData: any): Promise<void> {
    let dbIsAdmin: number = 0;
    let dbParsedCenterIds: number[] = [];
    let dbParsedEditorFor: number[] = [];
    let incomingIsAdmin: number = 0;
    let incomingParsedCenterIds: number[] = [];
    let incomingParsedEditorFor: number[] = [];

    // Object call with camelCase support
    const incomingData = {
      name: singerData.name,
      gender: singerData.gender,
      email: singerData.email,
      isAdmin: singerData.isAdmin ?? singerData.is_admin,
      centerIds: singerData.centerIds ?? singerData.center_ids,
      editorFor: singerData.editorFor ?? singerData.editor_for,
      updatedBy: singerData.updatedBy ?? singerData.updated_by,
    };

    const dbSingers = await this.databaseReadService.getSingerForUpdateForCache(id);

    if (dbSingers.length > 0) {
      const dbSinger = dbSingers[0];
      dbIsAdmin = dbSinger.is_admin ?? dbSinger.IS_ADMIN ?? 0;
      
      // Parse center_ids - handle null/undefined
      const centerIdsValue = dbSinger.CENTER_IDS || dbSinger.center_ids;
      if (centerIdsValue && centerIdsValue !== 'null' && centerIdsValue !== 'undefined') {
        try {
          dbParsedCenterIds = JSON.parse(centerIdsValue);
        } catch (e) {
          console.error('Error parsing center_ids:', e);
          dbParsedCenterIds = [];
        }
      } else {
        dbParsedCenterIds = [];
      }
      
      // Parse editor_for - handle null/undefined
      const editorForValue = dbSinger.EDITOR_FOR || dbSinger.editor_for;
      if (editorForValue && editorForValue !== 'null' && editorForValue !== 'undefined') {
        try {
          dbParsedEditorFor = JSON.parse(editorForValue);
        } catch (e) {
          console.error('Error parsing editor_for:', e);
          dbParsedEditorFor = [];
        }
      } else {
        dbParsedEditorFor = [];
      }
    }

    // Prepare is_admin as number
    incomingIsAdmin = incomingData.isAdmin ?? incomingData.isAdmin ?? 0;

    // Prepare center_ids as JSON string
    const incomingCenterIdsJson = incomingData.centerIds && incomingData.centerIds.length > 0
      ? JSON.stringify(incomingData.centerIds)
      : null;

    // Prepare editor_for as JSON string
    const incomingEditorForJson = incomingData.editorFor && incomingData.editorFor.length > 0
      ? JSON.stringify(incomingData.editorFor)
      : null;

    await this.databaseWriteService.updateSingerForCache(id, incomingData.name, incomingData.gender || null, incomingData.email || null, incomingIsAdmin, incomingCenterIdsJson, incomingEditorForJson, incomingData.updatedBy || null);

    // Write-through cache: Fetch the complete updated singer with all fields including pitch_count
    const updatedSingers = await this.databaseReadService.getUpdatedSingerByIdForCache(id);

    if (updatedSingers.length > 0) {
      const s = updatedSingers[0];
      try {
        if (s.CENTER_IDS || s.center_ids) {
          incomingParsedCenterIds = JSON.parse(s.CENTER_IDS || s.center_ids);
        }
      } catch (e) {
        console.error('Error parsing center_ids:', e);
      }
      try {
        if (s.EDITOR_FOR || s.editor_for) {
          incomingParsedEditorFor = JSON.parse(s.EDITOR_FOR || s.editor_for);
        }
      } catch (e) {
        console.error('Error parsing editor_for:', e);
      }

      // Get is_admin value (Oracle returns uppercase)
      incomingIsAdmin = s.is_admin ?? s.IS_ADMIN ?? 0;

      const normalizedSinger = {
        id: s.id || s.ID,
        name: s.name || s.NAME,
        gender: s.gender || s.GENDER,
        email: s.email || s.EMAIL,
        isAdmin: incomingIsAdmin,
        centerIds: incomingParsedCenterIds,
        editorFor: incomingParsedEditorFor,
        pitchCount: parseInt(s.pitch_count || s.PITCH_COUNT || '0', 10),
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
        this.set('singers:all', updated, this.DEFAULT_TTL_MS);
      }
    }

    // If center associations changed, invalidate center caches
    if (incomingIsAdmin !== dbIsAdmin ||
      incomingParsedCenterIds !== dbParsedCenterIds ||
      incomingParsedEditorFor !== dbParsedEditorFor) {
      this.invalidatePattern('centers:');
    }
  }

  async deleteSinger(id: string): Promise<void> {
    await this.databaseWriteService.deleteSingerForCache(id);

    // Write-through cache: Remove from cached list
    let cached = this.get('singers:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((singer: any) => singer.id !== id);
      this.set('singers:all', updated, this.DEFAULT_TTL_MS);
    }

    // CASCADE will delete associated pitches - invalidate pitch cache
    cached = this.get('pitches:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((pitch: any) => pitch.singerId !== id);
      this.set('pitches:all', updated, this.DEFAULT_TTL_MS);
    }

    // Invalidate centers cache since singer count changed
    this.invalidate('centers:all');
  }

  async updateSingerAdminStatus(id: string, isAdmin: number): Promise<void> {

    // First check if user has email (required for admin)
    const users = await this.databaseReadService.getUserEmailByIdForCache(id);

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    const email = user.email || user.EMAIL;

    if (isAdmin === 1 && !email) {
      throw new Error('Cannot set admin flag: user must have an email address');
    }

    // Update admin status
    await this.databaseWriteService.updateUserAdminStatusForCache(id, isAdmin);

    // Invalidate user-related caches
    this.invalidateUserRelatedCaches();
  }

  async updateUserEditorFor(id: string, editorFor: number[]): Promise<void> {

    // Validate that user exists
    const users = await this.databaseReadService.getUserEmailByIdForCache(id);

    if (users.length === 0) {
      throw new Error('User not found');
    }

    // Convert editor_for array to JSON string
    const editorForJson = editorFor.length > 0
      ? JSON.stringify(editorFor)
      : null;

    // Update editor_for
    await this.databaseWriteService.updateUserEditorForForCache(id, editorForJson);

    // Invalidate user-related caches (affects singers view and centers editor lists)
    this.invalidateUserRelatedCaches();
  }

  async addUserEditorAccess(userId: string, centerId: number): Promise<void> {

    // Get current editor_for array (userId is hex string from RAWTOHEX)
    const users = await this.databaseReadService.getUserEditorForByIdForCache(userId);

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

      await this.databaseWriteService.addUserEditorAccessForCache(userId, editorForJson);

      // Invalidate user-related caches
      this.invalidateUserRelatedCaches();
    }
  }

  async removeUserEditorAccess(userId: string, centerId: number): Promise<void> {

    // Get current editor_for array (userId is hex string from RAWTOHEX)
    const users = await this.databaseReadService.getUserEditorForByIdForCache(userId);

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

      await this.databaseWriteService.removeUserEditorAccessForCache(userId, editorForJson);

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
    const pitches = await this.databaseReadService.getAllPitchesForCache();

    // Normalize field names (Oracle returns uppercase)
    const normalizedPitches = pitches.map((p: any) => ({
      id: p.id || p.ID,
      songId: p.song_id || p.SONG_ID,
      singerId: p.singer_id || p.SINGER_ID,
      pitch: p.pitch || p.PITCH,
      songName: p.song_name || p.SONG_NAME,
      singerName: p.singer_name || p.SINGER_NAME,
    }));

    this.set(cacheKey, normalizedPitches, this.DEFAULT_TTL_MS);
    return normalizedPitches;
  }

  async getPitch(id: string): Promise<any> {
    const cacheKey = 'pitches:all';
    const cached: any[] | null = this.get(cacheKey);

    if (cached) {
      const entry = cached.find((p: any) => p.id === id);
      if (entry) {
        return entry;
      }
    }

    const pitches: any[] = await this.databaseReadService.getPitchByIdForCache(id);

    // Normalize field names (Oracle returns uppercase)
    const p: any = pitches[0];
    const normalized: SongSingerPitch = {
      id: p.id || p.ID,
      songId: p.song_id || p.SONG_ID,
      singerId: p.singer_id || p.SINGER_ID,
      pitch: p.pitch || p.PITCH,
      songName: p.song_name || p.SONG_NAME,
      singerName: p.singer_name || p.SINGER_NAME,
    };

    if (cached) {
      this.set(cacheKey, [...cached, normalized], this.DEFAULT_TTL_MS);
    } else {
      this.set(cacheKey, [normalized], this.DEFAULT_TTL_MS);
    }

    return normalized;
  }

  async getSongPitches(songId: string): Promise<any[]> {
    const cached = await this.getAllPitches();
    return cached.filter((p: any) => p.songId === songId);
  }

  async getSingerPitches(singerId: string): Promise<any[]> {
    const cached = await this.getAllPitches();
    return cached.filter((p: any) => p.singerId === singerId);
  }

  async createPitch(pitchData: Partial<SongSingerPitch>): Promise<any> {
    const data = {
      song_id: pitchData.songId,
      singer_id: pitchData.singerId,
      pitch: pitchData.pitch,
      created_by: pitchData.createdBy,
    };

    if (!data.song_id || !data.singer_id) {
      throw new Error('song_id and singer_id are required');
    }
    await this.databaseWriteService.createPitchForCache(data.song_id, data.singer_id, data.pitch || '', data.created_by || null);

    // Write-through cache: Fetch only the newly created pitch with joins
    const newPitches = await this.databaseReadService.getNewPitchForCache(data.song_id, data.singer_id);

    if (newPitches.length > 0) {
      // Normalize the new pitch data
      const rawPitch = newPitches[0];
      const normalizedPitch: SongSingerPitch = {
        id: rawPitch.id || rawPitch.ID,
        songId: rawPitch.song_id || rawPitch.SONG_ID,
        singerId: rawPitch.singer_id || rawPitch.SINGER_ID,
        pitch: rawPitch.pitch || rawPitch.PITCH,
        songName: rawPitch.song_name || rawPitch.SONG_NAME,
        singerName: rawPitch.singer_name || rawPitch.SINGER_NAME,
      } as SongSingerPitch;

      // Write-through cache: Add to existing cache or invalidate
      const cached = this.get('pitches:all');
      if (cached && Array.isArray(cached)) {
        // Add to cache and sort
        const updated = [...cached, normalizedPitch].sort((a, b) => {
          const songCompare = (a.songName || '').localeCompare(b.songName || '');
          if (songCompare !== 0) return songCompare;
          return (a.singer_name || '').localeCompare(b.singer_name || '');
        });
        this.set('pitches:all', updated, this.DEFAULT_TTL_MS);
      } else {
        this.set('pitches:all', [normalizedPitch], this.DEFAULT_TTL_MS);
      }

      // Update specific song and singer in cache instead of invalidating everything
      // This is more efficient than refetching all songs/singers
      // Fire-and-forget: these are cache updates, not critical for the response
      if (normalizedPitch.songId) {
        this.updateSongPitchCountInCache(normalizedPitch.songId).catch(() => {
          // Silently fail - cache will be refreshed on next fetch
        });
      }
      if (normalizedPitch.singerId) {
        this.updateSingerPitchCountInCache(normalizedPitch.singerId).catch(() => {
          // Silently fail - cache will be refreshed on next fetch
        });
      }

      return normalizedPitch;
    }

    return null;
  }

  async updatePitch(id: string, pitchData: Partial<SongSingerPitch>): Promise<void> {
    let pitch: string;
    let updated_by: string | null;

    pitch = pitchData.pitch ?? '';
    updated_by = pitchData.updatedBy ?? null;

    await this.databaseWriteService.updatePitchForCache(id, pitch, updated_by);

    // Write-through cache: Fetch only the updated pitch with joins
    const updatedPitches = await this.databaseReadService.getUpdatedPitchForCache(id);

    if (updatedPitches.length > 0) {
      const cached = this.get('pitches:all');
      if (cached && Array.isArray(cached)) {
        // Normalize the updated pitch data
        const rawPitch = updatedPitches[0];
        const normalizedPitch = {
          id: rawPitch.id || rawPitch.ID,
          songId: rawPitch.song_id || rawPitch.SONG_ID,
          singerId: rawPitch.singer_id || rawPitch.SINGER_ID,
          pitch: rawPitch.pitch || rawPitch.PITCH,
          songName: rawPitch.song_name || rawPitch.SONG_NAME,
          singerName: rawPitch.singer_name || rawPitch.SINGER_NAME,
        };

        // Replace the pitch in cache (use lowercase 'id' to match normalized cache)
        const updated = cached.map((p: any) => p.id === id ? normalizedPitch : p);
        this.set('pitches:all', updated, this.DEFAULT_TTL_MS);
      }
    }
  }

  /**
   * Update pitch count for a specific song in the songs:all cache
   * More efficient than invalidating the entire cache
   * Returns a Promise that resolves when the cache is updated
   */
  private async updateSongPitchCountInCache(songId: string): Promise<void> {
    const cached = this.get('songs:all');
    if (cached && Array.isArray(cached)) {
      try {
        // Fetch updated pitch count from database
        const result = await this.databaseReadService.getSongPitchCountForCache(songId);

        if (result && result.length > 0) {
          const newPitchCount = parseInt(result[0].PITCH_COUNT || result[0].pitch_count || '0', 10);
          // Update the specific song in the cache array
          const updated = cached.map((song: any) =>
            song.id === songId ? { ...song, pitchCount: newPitchCount } : song
          );
          this.set('songs:all', updated, this.DEFAULT_TTL_MS);
        }
      } catch (err) {
        // If update fails, invalidate cache as fallback
        console.error('Failed to update song pitch count in cache:', err);
        this.invalidate('songs:all');
        throw err; // Re-throw so caller can handle if needed
      }
    }
  }

  /**
   * Update pitch count for a specific singer in the singers:all cache
   * More efficient than invalidating the entire cache
   * Returns a Promise that resolves when the cache is updated
   */
  private async updateSingerPitchCountInCache(singerId: string): Promise<void> {
    const cached = this.get('singers:all');
    if (cached && Array.isArray(cached)) {
      try {
        // Fetch updated pitch count from database
        const result = await this.databaseReadService.getSingerPitchCountForCache(singerId);

        if (result && result.length > 0) {
          const newPitchCount = parseInt(result[0].PITCH_COUNT || result[0].pitch_count || '0', 10);
          // Update the specific singer in the cache array
          const updated = cached.map((singer: any) =>
            singer.id === singerId ? { ...singer, pitchCount: newPitchCount } : singer
          );
          this.set('singers:all', updated, this.DEFAULT_TTL_MS);
        }
      } catch (err) {
        // If update fails, invalidate cache as fallback
        console.error('Failed to update singer pitch count in cache:', err);
        this.invalidate('singers:all');
        throw err; // Re-throw so caller can handle if needed
      }
    }
  }

  async deletePitch(id: string): Promise<void> {
    // Get pitch info before deleting to know which song/singer to update
    const cachedPitches = this.get('pitches:all');
    let songId: string | null = null;
    let singerId: string | null = null;

    if (cachedPitches && Array.isArray(cachedPitches)) {
      const pitchToDelete = cachedPitches.find((p: any) => p.id === id);
      if (pitchToDelete) {
        songId = pitchToDelete.songId;
        singerId = pitchToDelete.singerId;
      }
    }

    await this.databaseWriteService.deletePitchForCache(id);

    // Write-through cache: Remove from cached list
    const cached = this.get('pitches:all');
    if (cached && Array.isArray(cached)) {
      // Use lowercase 'id' to match normalized cache
      const updated = cached.filter((pitch: any) => pitch.id !== id);
      this.set('pitches:all', updated, this.DEFAULT_TTL_MS);
    }

    // Update specific song and singer in cache instead of invalidating everything
    // This is more efficient than refetching all songs/singers
    // Fire-and-forget: these are cache updates, not critical for the response
    if (songId) {
      this.updateSongPitchCountInCache(songId).catch(() => {
        // Silently fail - cache will be refreshed on next fetch
      });
    }
    if (singerId) {
      this.updateSingerPitchCountInCache(singerId).catch(() => {
        // Silently fail - cache will be refreshed on next fetch
      });
    }
  }

  // ==================== TEMPLATES ====================

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<PresentationTemplate[]> {
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const mappedTemplates = templateService.getAllTemplates();
    this.set(cacheKey, mappedTemplates, this.DEFAULT_TTL_MS);
    return mappedTemplates;
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<PresentationTemplate | null> {
    const cacheKey = 'templates:all';
    const cached: any[] | null = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      const template = cached.find((t: PresentationTemplate) => t.id === id);
      if (template)
        return template;
    }

    const template = templateService.getTemplate(id);

    console.log('cached', cached);
    console.log('template', template);

    if (cached && Array.isArray(cached) && template) {
      this.set(cacheKey, [...cached, template], this.DEFAULT_TTL_MS);
    } else if (template) {
      this.set(cacheKey, [template], this.DEFAULT_TTL_MS);
    }

    return template;
  }

  /**
   * Create a template with write-through cache update
   */
  async createTemplate(template: PresentationTemplate): Promise<any> {
    const created = await this.templateService.createTemplate(template);
    
    // Write-through: add to cache directly
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      cached.push(created);
      this.set(cacheKey, cached, this.DEFAULT_TTL_MS);
    }
    
    return created;
  }
  
  /**
   * Update a template with write-through cache update
   */
  async updateTemplate(id: string, updates: any): Promise<any> {
    const updated = await this.templateService.updateTemplate(id, updates);

    // Write-through: update in cache directly
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      const index = cached.findIndex((t: any) => t.id === id);
      if (index !== -1) {
        cached[index] = updated;
        this.set(cacheKey, cached, this.DEFAULT_TTL_MS);
      }
    }

    return updated;
  }

  /**
   * Delete a template with write-through cache update
   */
  async deleteTemplate(id: string): Promise<void> {
    await this.templateService.deleteTemplate(id);

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
  async setTemplateAsDefault(id: string, updatedBy: string): Promise<any> {
    const updated = await this.templateService.setAsDefault(id, updatedBy);

    // Write-through: update all templates in cache to reflect new default
    const cacheKey = 'templates:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      const updatedCache = cached.map((t: any) => ({
        ...t,
        isDefault: t.id === id
      }));
      this.set(cacheKey, updatedCache, this.DEFAULT_TTL_MS);
    }

    return updated;
  }

  // ==================== SESSIONS ====================

  async getAllSessions(): Promise<any[]> {
    const cacheKey = 'sessions:all';
    const cached = this.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    const sessions = await this.databaseReadService.getAllSessionsForCache();

    const mappedSessions = sessions.map((row: any) => {
      let centerIds: number[] | undefined = undefined;
      try {
        if (row.CENTER_IDS || row.center_ids) {
          const parsed = JSON.parse(row.CENTER_IDS || row.center_ids);
          // Only set centerIds if it's a non-empty array
          if (Array.isArray(parsed) && parsed.length > 0) {
            centerIds = parsed;
          }
        }
      } catch (e) {
        console.error('Error parsing center_ids for session:', row.NAME, e);
      }

      return {
        id: row.ID || row.id,
        name: row.NAME || row.name,
        description: row.DESCRIPTION || row.description,
        centerIds: centerIds,
        createdAt: row.CREATED_AT || row.created_at,
        createdBy: row.CREATED_BY || row.created_by,
        updatedAt: row.UPDATED_AT || row.updated_at,
        updatedBy: row.UPDATED_BY || row.updated_by,
      };
    });

    this.set(cacheKey, mappedSessions, this.DEFAULT_TTL_MS);
    return mappedSessions;
  }

  async getSession(id: string): Promise<any> {

    // Get session
    const sessions = await this.databaseReadService.getSessionByIdForCache(id);

    if (sessions.length === 0) return null;

    const sessionRow = sessions[0];

    // Parse center_ids
    let centerIds: number[] | undefined = undefined;
    try {
      if (sessionRow.CENTER_IDS || sessionRow.center_ids) {
        const parsed = JSON.parse(sessionRow.CENTER_IDS || sessionRow.center_ids);
        // Only set centerIds if it's a non-empty array
        if (Array.isArray(parsed) && parsed.length > 0) {
          centerIds = parsed;
        }
      }
    } catch (e) {
      console.error('Error parsing center_ids for session:', sessionRow.NAME, e);
    }

    // Get session items with details
    const items = await this.databaseReadService.getSessionItemsForCache(id);

    const mappedItems = items.map((row: any) => {
      // Parse singer center IDs
      let singerCenterIds: number[] | undefined = undefined;
      try {
        if (row.SINGER_CENTER_IDS || row.singer_center_ids) {
          const parsed = JSON.parse(row.SINGER_CENTER_IDS || row.singer_center_ids);
          if (Array.isArray(parsed) && parsed.length > 0) {
            singerCenterIds = parsed;
          }
        }
      } catch (e) {
        console.error('Error parsing singer center_ids:', e);
      }

      return {
        id: row.ID || row.id,
        sessionId: row.SESSION_ID || row.session_id,
        songId: row.SONG_ID || row.song_id,
        singerId: row.SINGER_ID || row.singer_id || undefined,
        pitch: row.PITCH || row.pitch,
        sequenceOrder: row.SEQUENCE_ORDER || row.sequence_order,
        songName: row.SONG_NAME || row.song_name,
        songDeity: row.SONG_DEITY || row.song_deity,
        songLanguage: row.SONG_LANGUAGE || row.song_language,
        songTempo: row.SONG_TEMPO || row.song_tempo,
        songRaga: row.SONG_RAGA || row.song_raga,
        singerName: row.SINGER_NAME || row.singer_name,
        singerGender: row.SINGER_GENDER || row.singer_gender,
        singerCenterIds: singerCenterIds,
        createdAt: row.CREATED_AT || row.created_at,
        updatedAt: row.UPDATED_AT || row.updated_at,
      };
    });

    return {
      id: sessionRow.ID || sessionRow.id,
      name: sessionRow.NAME || sessionRow.name,
      description: sessionRow.DESCRIPTION || sessionRow.description,
      centerIds: centerIds,
      createdBy: sessionRow.CREATED_BY || sessionRow.created_by,
      createdAt: sessionRow.CREATED_AT || sessionRow.created_at,
      updatedAt: sessionRow.UPDATED_AT || sessionRow.updated_at,
      items: mappedItems,
    };
  }

  async createSession(sessionData: any): Promise<any> {

    // Accept both camelCase (frontend) and snake_case (legacy)
    // Also support legacy positional args: createSession(name, description, centerIds, createdBy)
    let data: { name: string; description?: string; centerIds?: number[]; createdBy?: string };

    if (typeof sessionData === 'string') {
      // Legacy call with positional args
      data = {
        name: sessionData,
        description: arguments[1],
        centerIds: arguments[2],
        createdBy: arguments[3],
      };
    } else {
      data = {
        name: sessionData.name,
        description: sessionData.description,
        centerIds: sessionData.centerIds ?? sessionData.center_ids,
        createdBy: sessionData.createdBy ?? sessionData.created_by,
      };
    }

    // Prepare center_ids as JSON string
    const centerIdsJson = data.centerIds && data.centerIds.length > 0
      ? JSON.stringify(data.centerIds)
      : null;

    await this.databaseWriteService.createSessionForCache(String(data.name), String(data.description || ''), centerIdsJson, data.createdBy || null);

    // Fetch the created session
    const sessions = await this.databaseReadService.getNewSessionByNameForCache(data.name);

    if (sessions.length === 0) throw new Error('Failed to retrieve created session');

    const session = sessions[0];
    let parsedCenterIds: number[] = [];
    try {
      if (session.CENTER_IDS || session.center_ids) {
        parsedCenterIds = JSON.parse(session.CENTER_IDS || session.center_ids);
      }
    } catch (e) {
      console.error('Error parsing center_ids:', e);
    }

    const mappedSession = {
      id: session.ID || session.id,
      name: session.NAME || session.name,
      description: session.DESCRIPTION || session.description,
      centerIds: parsedCenterIds,
      createdBy: session.CREATED_BY || session.created_by,
      createdAt: session.CREATED_AT || session.created_at,
      updatedAt: session.UPDATED_AT || session.updated_at,
    };

    // Write-through cache: Add to cached list and re-sort
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = [...cached, mappedSession].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
      this.set('sessions:all', updated, this.DEFAULT_TTL_MS);
    }

    return mappedSession;
  }

  async updateSession(id: string, updates: any): Promise<any> {

    // Accept both camelCase (frontend) and snake_case (legacy)
    const data = {
      name: updates.name,
      description: updates.description,
      centerIds: updates.centerIds ?? updates.center_ids,
      updatedBy: updates.updatedBy ?? updates.updated_by,
    };

    const updateParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updateParts.push(`name = :${paramIndex++}`);
      params.push(String(data.name));
    }
    if (data.description !== undefined) {
      updateParts.push(`description = :${paramIndex++}`);
      params.push(String(data.description || ''));
    }
    if (data.centerIds !== undefined) {
      updateParts.push(`center_ids = :${paramIndex++}`);
      const centerIdsJson = data.centerIds && data.centerIds.length > 0
        ? JSON.stringify(data.centerIds)
        : null;
      params.push(centerIdsJson);
    }
    if (data.updatedBy !== undefined) {
      updateParts.push(`updated_by = :${paramIndex++}`);
      params.push(data.updatedBy);
    }

    if (updateParts.length === 0) throw new Error('No fields to update');

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await this.databaseWriteService.updateSessionForCache(id, updateParts, params);

    // Fetch updated session
    const sessions = await this.databaseReadService.getUpdatedSessionByIdForCache(id);

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
      centerIds: parsedCenterIds,
      createdAt: session.CREATED_AT,
      updatedAt: session.UPDATED_AT,
    };

    // Write-through cache: Replace in cached list and re-sort (in case name changed)
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached
        .map((s: any) => s.id === id ? mappedSession : s)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      this.set('sessions:all', updated, this.DEFAULT_TTL_MS);
    }

    return mappedSession;
  }

  async deleteSession(id: string): Promise<void> {
    await this.databaseWriteService.deleteSessionForCache(id);

    // Write-through cache: Remove from cached list
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = cached.filter((session: any) => session.id !== id);
      this.set('sessions:all', updated, this.DEFAULT_TTL_MS);
    }
  }

  async duplicateSession(id: string, newName: string): Promise<any> {

    // Get original session
    const sessions = await this.databaseReadService.getSessionForDuplicateForCache(id);

    if (sessions.length === 0) throw new Error('Session not found');

    const originalSession = sessions[0];

    // Create new session
    await this.databaseWriteService.duplicateSessionForCache(newName, String(originalSession.DESCRIPTION || ''));

    // Get the new session ID
    const newSessions = await this.databaseReadService.getNewSessionIdByNameForCache(newName);

    if (newSessions.length === 0) throw new Error('Failed to retrieve duplicated session');

    const newSessionId = newSessions[0].ID;

    // Copy items
    await this.databaseWriteService.copySessionItemsForCache(newSessionId, id);

    // Fetch new session with full details
    const result = await this.databaseReadService.getDuplicatedSessionForCache(newSessionId);

    const session = result[0];
    const mappedSession = {
      id: session.ID || session.id,
      name: session.NAME || session.name,
      description: session.DESCRIPTION || session.description,
      createdAt: session.CREATED_AT || session.created_at,
      updatedAt: session.UPDATED_AT || session.updated_at,
    };

    // Write-through cache: Add to cached list and re-sort
    const cached = this.get('sessions:all');
    if (cached && Array.isArray(cached)) {
      const updated = [...cached, mappedSession].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
      this.set('sessions:all', updated, this.DEFAULT_TTL_MS);
    }

    return mappedSession;
  }

  async getSessionItems(sessionId: string): Promise<any[]> {
    const items = await this.databaseReadService.getSessionItemsForReorderForCache(sessionId);

    return items.map((row: any) => ({
      id: row.ID || row.id,
      sessionId: row.SESSION_ID || row.session_id,
      songId: row.SONG_ID || row.song_id,
      singerId: row.SINGER_ID || row.singer_id || undefined,
      pitch: row.PITCH || row.pitch,
      sequenceOrder: row.SEQUENCE_ORDER || row.sequence_order,
      songName: row.SONG_NAME || row.song_name,
      singerName: row.SINGER_NAME || row.singer_name,
      createdAt: row.CREATED_AT || row.created_at,
      updatedAt: row.UPDATED_AT || row.updated_at,
    }));
  }

  async addSessionItem(sessionId: string, itemData: any): Promise<void> {
    const { songId, singerId, pitch, sequenceOrder } = itemData;

    await this.databaseWriteService.addSessionItemForCache(sessionId, songId, singerId || null, String(pitch || ''), sequenceOrder);

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async updateSessionItem(id: string, updates: any): Promise<void> {
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

    await this.databaseWriteService.updateSessionItemForCache(id, updateParts, params);

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async deleteSessionItem(id: string): Promise<void> {
    await this.databaseWriteService.deleteSessionItemForCache(id);

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async reorderSessionItems(sessionId: string, itemIds: string[]): Promise<void> {

    await this.databaseWriteService.reorderSessionItemsForCache(sessionId, itemIds);

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');
  }

  async setSessionItems(sessionId: string, items: any[]): Promise<any[]> {

    // Delete existing items
    await this.databaseWriteService.deleteAllSessionItemsForCache(sessionId);

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const { songId, singerId, pitch } = items[i];
      await this.databaseWriteService.addSessionItemForCache(sessionId, songId, singerId || null, String(pitch || ''), i + 1);
    }

    // Session items don't have separate cache, just invalidate sessions
    this.invalidatePattern('sessions:');

    // Fetch all items with details
    return await this.getSessionItems(sessionId);
  }

  // ==================== IMPORT MAPPINGS ====================

  async getAllSongMappings(): Promise<any[]> {
    const mappings = await this.databaseReadService.getAllSongMappingsForCache();

    return mappings.map((m: any) => ({
      id: m.id || m.ID,
      csvSongName: m.csv_song_name || m.CSV_SONG_NAME,
      dbSongId: m.db_song_id || m.DB_SONG_ID,
      dbSongName: m.db_song_name || m.DB_SONG_NAME,
    }));
  }

  async getSongMappingByName(csvName: string): Promise<any | null> {
    const mappings = await this.databaseReadService.getSongMappingByNameForCache(csvName);

    if (mappings.length === 0) return null;

    const m = mappings[0];
    return {
      id: m.id || m.ID,
      csvSongName: m.csv_song_name || m.CSV_SONG_NAME,
      dbSongId: m.db_song_id || m.DB_SONG_ID,
      dbSongName: m.db_song_name || m.DB_SONG_NAME,
    };
  }

  async saveSongMapping(csvSongName: string, dbSongId: string, dbSongName: string): Promise<void> {

    // Check if mapping already exists
    const existing = await this.getSongMappingByName(csvSongName);

    await this.databaseWriteService.saveSongMappingForCache(csvSongName, dbSongId, dbSongName, !!existing);
  }

  async deleteSongMapping(id: string): Promise<void> {
    await this.databaseWriteService.deleteSongMappingForCache(id);
  }

  async getAllPitchMappings(): Promise<any[]> {
    const mappings = await this.databaseReadService.getAllPitchMappingsForCache();

    return mappings.map((m: any) => ({
      id: m.id || m.ID,
      originalFormat: m.original_format || m.ORIGINAL_FORMAT,
      normalizedFormat: m.normalized_format || m.NORMALIZED_FORMAT,
    }));
  }

  async getPitchMappingByFormat(originalFormat: string): Promise<any | null> {
    const mappings = await this.databaseReadService.getPitchMappingByFormatForCache(originalFormat);

    if (mappings.length === 0) return null;

    const m = mappings[0];
    return {
      id: m.id || m.ID,
      originalFormat: m.original_format || m.ORIGINAL_FORMAT,
      normalizedFormat: m.normalized_format || m.NORMALIZED_FORMAT,
    };
  }

  async savePitchMapping(originalFormat: string, normalizedFormat: string): Promise<void> {

    // Check if mapping already exists
    const existing = await this.getPitchMappingByFormat(originalFormat);

    await this.databaseWriteService.savePitchMappingForCache(originalFormat, normalizedFormat, !!existing);
  }

  async deletePitchMapping(id: string): Promise<void> {
    await this.databaseWriteService.deletePitchMappingForCache(id);
  }

  // ============================================================================
  // CENTERS
  // ============================================================================

  async getAllCenters(): Promise<any[]> {
    console.log('getAllCenters');
    const cacheKey = 'centers:all';
    const cached = this.get<any[]>(cacheKey);

    // Ensure cached value is an array
    if (cached && Array.isArray(cached)) {
      console.log('cached', cached);
      return cached;
    }

    // If cache exists but is not an array, invalidate it
    if (cached) {
      this.invalidate(cacheKey);
    }

    try {
      const centers = await this.databaseReadService.getAllCentersForCache();

      // Ensure centers is an array
      if (!Array.isArray(centers)) {
        console.error('getAllCentersForCache did not return an array:', centers);
        return [];
      }

      // Get all users with their editor_for and center_ids arrays
      let users: any[] = [];
      try {
        users = await this.databaseReadService.getAllUsersForCentersCache();
      } catch (error) {
        console.error('Error fetching users for centers cache:', error);
        // Continue with empty users array - centers will still be returned without editor/singer counts
      }

      // Ensure users is an array
      if (!Array.isArray(users)) {
        console.error('getAllUsersForCentersCache did not return an array:', users);
        users = [];
      }

      // Build maps for center_id -> user_ids who are editors, and center_id -> singer count
      // Use Number keys for consistent lookups (JSON parse may return numbers, Oracle may return strings)
      const centerEditors = new Map<number, string[]>();
      const centerSingerCount = new Map<number, number>();

      for (const user of users) {
        try {
          // Count editors
          const editorFor = user.EDITOR_FOR || user.editor_for;
          if (editorFor && editorFor !== 'null' && editorFor !== 'undefined') {
            const centerIds = JSON.parse(editorFor);
            for (const centerId of centerIds) {
              const numCenterId = Number(centerId);
              if (!centerEditors.has(numCenterId)) {
                centerEditors.set(numCenterId, []);
              }
              centerEditors.get(numCenterId)!.push(user.ID || user.id);
            }
          }

          // Count singers (users with center_ids)
          const centerIds = user.CENTER_IDS || user.center_ids;
          if (centerIds && centerIds !== 'null' && centerIds !== 'undefined') {
            const parsedCenterIds = JSON.parse(centerIds);
            for (const centerId of parsedCenterIds) {
              const numCenterId = Number(centerId);
              centerSingerCount.set(numCenterId, (centerSingerCount.get(numCenterId) || 0) + 1);
            }
          }
        } catch (error) {
          // Skip invalid JSON - log for debugging but continue processing
          console.warn('Error parsing user center data:', error, 'User:', user.ID || user.id);
        }
      }

      // Normalize Oracle uppercase column names to camelCase and add editorIds and singerCount
      const normalizedCenters = centers.map(center => {
        const id = Number(center.ID || center.id);
        return {
          id,
          name: center.NAME || center.name,
          badgeTextColor: center.BADGE_TEXT_COLOR || center.badge_text_color || '#1e40af',
          editorIds: centerEditors.get(id) || [],
          singerCount: centerSingerCount.get(id) || 0,
          createdAt: center.CREATED_AT || center.created_at,
          createdBy: center.CREATED_BY || center.created_by,
          updatedAt: center.UPDATED_AT || center.updated_at,
          updatedBy: center.UPDATED_BY || center.updated_by,
        };
      });

      this.set(cacheKey, normalizedCenters);
      console.log('set', cacheKey, normalizedCenters);
      console.log('immediate get', this.get(cacheKey));
      return normalizedCenters;
    } catch (error) {
      console.error('Error in getAllCenters:', error);
      // Return empty array on error to prevent breaking the request
      // The route handler will catch this and return appropriate error response
      throw error;
    }
  }

  async getCenterById(id: string | number): Promise<any> {
    // Convert id to number for Oracle (centers table uses numeric ID)
    const centerId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(centerId)) {
      return null;
    }

    const cacheKey = 'centers:all';
    const cached = this.get<any[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      if (cached.find((c: any) => c.id === centerId)) {
        return cached.find((c: any) => c.id === centerId);
      }
    }

    const centers = await this.databaseReadService.getCenterByIdForCache(centerId);

    if (centers.length === 0) {
      return null;
    }

    const center = centers[0];

    // Get all users who have this center in their editor_for array
    const editors = await this.databaseReadService.getCenterEditorsForCache(centerId);

    const editor_ids = editors.map((e: any) => e.ID || e.id);

    const normalizedCenter = {
      id: center.ID || center.id,
      name: center.NAME || center.name,
      badgeTextColor: center.BADGE_TEXT_COLOR || center.badge_text_color || '#1e40af',
      editorIds: editor_ids,
      createdAt: center.CREATED_AT || center.created_at,
      createdBy: center.CREATED_BY || center.created_by,
      updatedAt: center.UPDATED_AT || center.updated_at,
      updatedBy: center.UPDATED_BY || center.updated_by,
    };

    if (cached) {
      this.set(cacheKey, [...cached, normalizedCenter], this.DEFAULT_TTL_MS);
    } else {
      this.set(cacheKey, [normalizedCenter], this.DEFAULT_TTL_MS);
    }
    return normalizedCenter;
  }

  async createCenter(centerData: any): Promise<any> {

    // Accept both camelCase (frontend) and snake_case (legacy)
    const data = {
      name: centerData.name,
      badgeTextColor: centerData.badgeTextColor ?? centerData.badge_text_color,
      editorIds: centerData.editorIds ?? centerData.editor_ids,
      createdBy: centerData.createdBy ?? centerData.created_by,
    };

    // Insert center
    await this.databaseWriteService.createCenterForCache(data.name, data.badgeTextColor, data.createdBy || null);

    // Get the newly created center
    const result = await this.databaseReadService.getNewCenterByNameForCache(data.name);

    // Invalidate center-related caches
    this.invalidateCenterRelatedCaches();

    if (result.length > 0) {
      const center = result[0];

      return {
        id: center.ID || center.id,
        name: center.NAME || center.name,
        badgeTextColor: center.BADGE_TEXT_COLOR || center.badge_text_color || '#1e40af',
        createdAt: center.CREATED_AT || center.created_at,
        createdBy: center.CREATED_BY || center.created_by,
      };
    }

    return null;
  }

  async updateCenter(id: string | number, centerData: any): Promise<any> {

    // Accept both camelCase (frontend) and snake_case (legacy)
    const data = {
      name: centerData.name,
      badgeTextColor: centerData.badgeTextColor ?? centerData.badge_text_color,
      editorIds: centerData.editorIds ?? centerData.editor_ids,
      updatedBy: centerData.updatedBy ?? centerData.updated_by,
    };

    // Convert id to number for Oracle (centers table uses numeric ID)
    const centerId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(centerId)) {
      throw new Error('Invalid center ID');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = :' + (params.length + 1));
      params.push(data.name);
    }

    if (data.badgeTextColor !== undefined) {
      updates.push('badge_text_color = :' + (params.length + 1));
      params.push(data.badgeTextColor);
    }

    if (data.updatedBy !== undefined) {
      updates.push('updated_by = :' + (params.length + 1));
      params.push(data.updatedBy);
    }

    updates.push('updated_at = SYSTIMESTAMP');
    params.push(centerId);

    await this.databaseWriteService.updateCenterForCache(centerId, updates, params);

    // Invalidate center-related caches
    this.invalidateCenterRelatedCaches();

    // Return updated center
    return this.getCenterById(centerId);
  }

  async deleteCenter(id: string | number): Promise<void> {
    await this.databaseWriteService.deleteCenterForCache(id);

    // Invalidate center-related caches
    this.invalidateCenterRelatedCaches();
  }

  // ============================================================================
  // FEEDBACK
  // ============================================================================

  async createFeedback(feedbackData: any): Promise<any> {

    // Accept both camelCase (frontend) and snake_case (legacy)
    const data = {
      feedback: feedbackData.feedback,
      category: feedbackData.category,
      email: feedbackData.email,
      userAgent: feedbackData.userAgent ?? feedbackData.user_agent,
      url: feedbackData.url,
      ipAddress: feedbackData.ipAddress ?? feedbackData.ip_address,
    };

    await this.databaseWriteService.createFeedbackForCache(data.feedback, data.category, data.email, data.userAgent || null, data.url || null, data.ipAddress || null);

    // Invalidate feedback cache
    this.invalidatePattern(/^feedback:/);

    return { success: true };
  }

  async mapFeedbackRow(row: any): Promise<any> {
    return {
      id: row.ID || row.id,
      feedback: row.FEEDBACK || row.feedback,
      category: row.CATEGORY || row.category,
      email: row.EMAIL || row.email,
      user_agent: row.USER_AGENT || row.user_agent,
      url: row.URL || row.url,
      ip_address: row.IP_ADDRESS || row.ip_address,
      status: row.STATUS || row.status,
      admin_notes: row.ADMIN_NOTES || row.admin_notes,
      createdAt: row.CREATED_AT || row.created_at,
      updatedAt: row.UPDATED_AT || row.updated_at,
    };
  }

  async getAllFeedback(): Promise<any[]> {
    const cacheKey = 'feedback:all';
    const cached = this.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const feedback = await this.databaseReadService.getAllFeedbackForCache();

    // Normalize Oracle uppercase column names
    const normalizedFeedback = feedback.map((row: any) => this.mapFeedbackRow(row));
    this.set(cacheKey, normalizedFeedback);
    return normalizedFeedback;
  }

  /*
   * Get a feedback item by ID
   */
  async getFeedbackById(id: string | number): Promise<any> {
    const cacheKey = 'feedback:all';
    const cached = this.get<any>(cacheKey);

    if (cached) {
      const entry = cached.find((f: any) => f.id === id);
      if (entry) {
        return entry;
      }
    }

    const feedback = await this.databaseReadService.getFeedbackByIdForCache(id);

    if (feedback.length === 0) {
      return null;
    }

    const normalizedFeedback = this.mapFeedbackRow(feedback[0]);
    if (cached) {
      this.set(cacheKey, [...cached, normalizedFeedback], this.DEFAULT_TTL_MS);
    } else {
      this.set(cacheKey, [normalizedFeedback], this.DEFAULT_TTL_MS);
    }
    return normalizedFeedback;
  }

  /**
   * Update a feedback item with write-through cache update
   */
  async updateFeedback(id: string | number, feedbackData: any): Promise<any> {
    // Accept both camelCase (frontend) and snake_case (legacy)
    const data = {
      status: feedbackData.status,
      adminNotes: feedbackData.adminNotes,
    };

    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = :' + (params.length + 1));
      params.push(data.status);
    }

    if (data.adminNotes !== undefined) {
      updates.push('admin_notes = :' + (params.length + 1));
      params.push(data.adminNotes);
    }

    updates.push('updated_at = SYSTIMESTAMP');
    params.push(id);

    await this.databaseWriteService.updateFeedbackForCache(id, updates, params);

    const feedback = await this.getFeedbackById(id);
    const cacheKey = 'feedback:all';
    const cached = this.get<any>(cacheKey);
    if (cached) {
      const updated = cached.map((f: any) => f.id === id ? feedback : f);
      this.set(cacheKey, updated, this.DEFAULT_TTL_MS);
    } else {
      this.set(cacheKey, [feedback], this.DEFAULT_TTL_MS);
    }
    return feedback;
  }

  /**
   * Delete a feedback item with write-through cache update
   */
  async deleteFeedback(id: string | number): Promise<void> {
    await this.databaseWriteService.deleteFeedbackForCache(id);

    const cacheKey = 'feedback:all';
    const cached = this.get<any>(cacheKey);
    if (cached) {
      const updated = cached.filter((f: any) => f.id !== id);
      this.set(cacheKey, updated, this.DEFAULT_TTL_MS);
    } else {
      this.set(cacheKey, [], this.DEFAULT_TTL_MS);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Run cleanup every 10 minutes
setInterval(() => {
  cacheService.cleanupExpired();
}, 10 * 60 * 1000);

// Helper function to safely extract Oracle values (handles CLOBs and circular refs)
function extractValue(value: any): any {
  if (value === null || value === undefined) {
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
  const { databaseReadService: databaseService } = await import('./DatabaseReadService.js');
  const { cacheService } = await import('./CacheService.js');
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Track overall success
  let successCount = 0;
  let failureCount = 0;
  const stats: { table: string; count: number }[] = [];

  try {
    const songs = await cacheService.getAllSongs();
    stats.push({ table: 'songs', count: songs.length });
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache songs:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  try {
    // Small delay between queries to avoid overwhelming the pool
    await new Promise(resolve => setTimeout(resolve, 500));
    const singers = await cacheService.getAllSingers();
    stats.push({ table: 'singers', count: singers.length });
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache singers:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  try {
    // Small delay between queries to avoid overwhelming the pool
    await new Promise(resolve => setTimeout(resolve, 500));
    const pitches = await cacheService.getAllPitches();
    stats.push({ table: 'pitches', count: pitches.length });
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache pitches:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  try {
    // Small delay between queries to avoid overwhelming the pool
    await new Promise(resolve => setTimeout(resolve, 500));
    const sessions = await cacheService.getAllSessions();
    stats.push({ table: 'sessions', count: sessions.length });
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache sessions:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  try {
    // Small delay between queries to avoid overwhelming the pool
    await new Promise(resolve => setTimeout(resolve, 500));
    const templates = await cacheService.getAllTemplates();
    stats.push({ table: 'templates', count: templates.length });
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache templates:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  try {
    // Small delay between queries to avoid overwhelming the pool
    await new Promise(resolve => setTimeout(resolve, 500));
    const centers = await cacheService.getAllCenters();
    stats.push({ table: 'centers', count: centers.length });
    successCount++;
  } catch (error) {
    console.error('  ✗ Failed to cache templates:', error instanceof Error ? error.message : error);
    failureCount++;
  }

  try {
    // Small delay between queries to avoid overwhelming the pool
    await new Promise(resolve => setTimeout(resolve, 500));
    const feedback = await cacheService.getAllFeedback();
    stats.push({ table: 'feedback', count: feedback.length });
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

