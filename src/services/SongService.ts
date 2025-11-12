import apiClient from './ApiClient';
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
      if (!createInput.sairhythmsUrl || createInput.sairhythmsUrl.trim().length === 0) {
        throw new ValidationError('Sairhythms.org URL is required', 'sairhythmsUrl');
      }
    }

    if (input.name && input.name.length > 255) {
      throw new ValidationError('Song name must be 255 characters or less', 'name');
    }

    if (input.sairhythmsUrl) {
      try {
        new URL(input.sairhythmsUrl);
      } catch {
        throw new ValidationError('Invalid URL format', 'sairhythmsUrl');
      }
    }
  }

  /**
   * Retrieves all songs
   */
  async getAllSongs(): Promise<Song[]> {
    try {
      return await apiClient.getSongs();
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
   * Retrieves a single song by ID
   */
  async getSongById(id: string): Promise<Song | null> {
    try {
      return await apiClient.getSong(id);
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
        sairhythms_url: input.sairhythmsUrl.trim(),
        title: input.title || null,
        title2: input.title2 || null,
        lyrics: input.lyrics || null,
        meaning: input.meaning || null,
        language: input.language || null,
        deity: input.deity || null,
        tempo: input.tempo || null,
        beat: input.beat || null,
        raga: input.raga || null,
        level: input.level || null,
        song_tags: input.songTags || null,
        audio_link: input.audioLink || null,
        video_link: input.videoLink || null,
        ulink: input.ulink || null,
        golden_voice: input.goldenVoice || 0,
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
      await apiClient.updateSong(id, {
        name: input.name?.trim(),
        sairhythms_url: input.sairhythmsUrl?.trim(),
        title: input.title,
        title2: input.title2,
        lyrics: input.lyrics,
        meaning: input.meaning,
        language: input.language,
        deity: input.deity,
        tempo: input.tempo,
        beat: input.beat,
        raga: input.raga,
        level: input.level,
        song_tags: input.songTags,
        audio_link: input.audioLink,
        video_link: input.videoLink,
        ulink: input.ulink,
        golden_voice: input.goldenVoice,
      });
      return this.getSongById(id);
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
      return true;
    } catch (error) {
      console.error('Error deleting song:', error);
      return false;
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
        song.name.toLowerCase().includes(lowerQuery) ||
        song.title?.toLowerCase().includes(lowerQuery) ||
        song.title2?.toLowerCase().includes(lowerQuery)
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
}

// Export singleton instance
export const songService = new SongService();
export default songService;
