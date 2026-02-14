import apiClient from './ApiClient';
import { CACHE_KEYS, getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from '../utils/cacheUtils';
import { normalizePitch } from '../utils/pitchNormalization';
import type {
  Song,
  CreateSongInput,
  UpdateSongInput,
} from '../types';
import {
  ValidationError,
  DatabaseError,
  ErrorCode,
} from '../types';

const SONG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Normalize reference pitch (e.g. "2 Pancham / D" → "D"); keep raw if unrecognized */
function normalizeRefPitch(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  const normalized = normalizePitch(trimmed);
  return normalized ?? trimmed;
}

/**
 * SongService handles all CRUD operations for songs via API
 */
class SongService {
  /**
   * Validates song input data
   * @throws ValidationError if validation fails
   */
  private validateSongInput(input: CreateSongInput | UpdateSongInput, isUpdate = false): void {
    if (!isUpdate) {
      const createInput = input as CreateSongInput;
      if (!createInput.name || createInput.name.trim().length === 0) {
        throw new ValidationError('Song name is required', 'name');
      }
      if (!createInput.language || createInput.language.trim().length === 0) {
        throw new ValidationError('Language is required', 'language');
      }
      if (!createInput.deity || createInput.deity.trim().length === 0) {
        throw new ValidationError('Deity is required', 'deity');
      }
      if (!createInput.lyrics || createInput.lyrics.trim().length === 0) {
        throw new ValidationError('Lyrics are required', 'lyrics');
      }
    }

    if (input.name && input.name.length > 255) {
      throw new ValidationError('Song name must be 255 characters or less', 'name');
    }

    if (input.externalSourceUrl) {
      try {
        new URL(input.externalSourceUrl);
      } catch {
        throw new ValidationError('Invalid URL format', 'externalSourceUrl');
      }
    }
  }

  /**
   * Retrieves all songs
   */
  async getAllSongs(nocache: boolean = false): Promise<Song[]> {
    try {
      return await apiClient.getSongs(nocache);
    } catch (error) {
      console.error('Error fetching all songs:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to fetch songs',
        error
      );
    }
  }

  /**
   * Retrieves a single song by ID (uses localStorage cache first to avoid backend fetch in new tabs)
   */
  async getSongById(id: string, nocache: boolean = false): Promise<Song | null> {
    if (!nocache && typeof window !== 'undefined') {
      // 1. Try individual song cache
      const songKey = `${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${id}`;
      const cachedRaw = getLocalStorageItem(songKey);
      if (cachedRaw) {
        try {
          const { timestamp, song } = JSON.parse(cachedRaw) as { timestamp: number; song: Song };
          if (song && Date.now() - timestamp < SONG_CACHE_TTL_MS) {
            return song;
          }
        } catch {
          // Ignore parse errors
        }
      }
      // 2. Try songs list cache (populated when user visited Songs tab)
      const listRaw = getLocalStorageItem(CACHE_KEYS.SAI_SONGS_SONGS);
      if (listRaw) {
        try {
          const { timestamp, songs } = JSON.parse(listRaw) as { timestamp: number; songs: Song[] };
          if (Array.isArray(songs) && Date.now() - timestamp < SONG_CACHE_TTL_MS) {
            const found = songs.find((s) => s.id === id);
            if (found && found.lyrics != null && found.lyrics !== undefined) {
              return found;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    try {
      const song = await apiClient.getSong(id, nocache);
      if (song && typeof window !== 'undefined') {
        const songKey = `${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${id}`;
        setLocalStorageItem(songKey, JSON.stringify({ timestamp: Date.now(), song }));
      }
      return song;
    } catch (error) {
      console.error('Error fetching song by ID:', error);
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to fetch song with ID: ${id}`,
        error
      );
    }
  }

  /**
   * Creates a new song
   */
  async createSong(input: CreateSongInput): Promise<Song> {
    this.validateSongInput(input);

    try {
      return await apiClient.createSong({
        name: input.name.trim(),
        externalSourceUrl: input.externalSourceUrl.trim(),
        lyrics: input.lyrics || null,
        meaning: input.meaning || null,
        language: input.language || null,
        deity: input.deity || null,
        tempo: input.tempo || null,
        beat: input.beat || null,
        raga: input.raga || null,
        level: input.level || null,
        songTags: input.songTags || null,
        audioLink: input.audioLink || null,
        videoLink: input.videoLink || null,
        goldenVoice: input.goldenVoice,
        refGents: normalizeRefPitch(input.refGents) || null,
        refLadies: normalizeRefPitch(input.refLadies) || null,
      });
    } catch (error) {
      console.error('Error creating song:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to create song',
        error
      );
    }
  }

  /**
   * Updates an existing song
   */
  async updateSong(id: string, input: UpdateSongInput): Promise<Song | null> {
    this.validateSongInput(input, true);

    try {
      const updateData = {
        name: input.name?.trim(),
        externalSourceUrl: input.externalSourceUrl?.trim(),
        lyrics: input.lyrics,
        meaning: input.meaning,
        language: input.language,
        deity: input.deity,
        tempo: input.tempo,
        beat: input.beat,
        raga: input.raga,
        level: input.level,
        songTags: input.songTags,
        audioLink: input.audioLink,
        videoLink: input.videoLink,
        goldenVoice: input.goldenVoice,
        refGents: input.refGents != null ? normalizeRefPitch(input.refGents) : undefined,
        refLadies: input.refLadies != null ? normalizeRefPitch(input.refLadies) : undefined,
      };
      await apiClient.updateSong(id, updateData);
      // Use nocache=true to ensure we get fresh data after the update
      return this.getSongById(id, true);
    } catch (error) {
      console.error('Error updating song:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to update song with ID: ${id}`,
        error
      );
    }
  }

  /**
   * Deletes a song by ID
   */
  async deleteSong(id: string): Promise<boolean> {
    try {
      await apiClient.deleteSong(id);
      if (typeof window !== 'undefined') {
        removeLocalStorageItem(`${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${id}`);
      }
      return true;
    } catch (error) {
      console.error('Error deleting song:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        error instanceof Error ? error.message : 'Failed to delete song',
        error
      );
    }
  }

  /**
   * Syncs a song from its external source URL
   * Fetches metadata (pitches, etc.) and updates the song
   */
  async syncSong(id: string): Promise<{ message: string; updates: Record<string, any> } | null> {
    try {
      // First, fetch the song to get its externalSourceUrl
      const song = await this.getSongById(id);
      if (!song || !song.externalSourceUrl) {
        console.error('Song not found or missing externalSourceUrl');
        return null;
      }

      const response = await apiClient.post<{ message: string; updates: Record<string, any> }>(
        `/songs/${id}/sync`,
        { externalUrl: song.externalSourceUrl }
      );
      return response;
    } catch (error) {
      console.error('Error syncing song:', error);
      return null;
    }
  }

  /**
   * Searches songs by name
   */
  async searchSongs(query: string): Promise<Song[]> {
    try {
      const allSongs = await this.getAllSongs();
      const lowerQuery = query.toLowerCase();
      return allSongs.filter(song => 
        song.name.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Error searching songs:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to search songs',
        error
      );
    }
  }

  /**
   * Searches songs with an optional singer filter.
   *
   * NOTE: Currently, singer filtering is not wired through the backend yet,
   * so this implementation performs a text search only and ignores the
   * singerId parameter. This preserves the API surface that the UI expects
   * and avoids runtime errors, while still providing useful search behavior.
   */
  async searchSongsWithFilter(query: string, _singerId?: string): Promise<Song[]> {
    // For now, reuse the existing text search; singer filter can be added later
    return this.searchSongs(query);
  }

  /**
   * Retrieves songs for a given singer.
   *
   * NOTE: The song–singer relationship is currently managed via the
   * song_singer_pitches table and a dedicated pitches API. Until a dedicated
   * backend endpoint exists, this returns all songs so that callers have a
   * safe fallback without breaking the UI.
   */
  async getSongsBySinger(_singerId: string): Promise<Song[]> {
    return this.getAllSongs();
  }
}

// Export singleton instance
export const songService = new SongService();
export default songService;

