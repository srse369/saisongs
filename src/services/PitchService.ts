import apiClient from './ApiClient';
import type {
  SongSingerPitch,
  CreatePitchInput,
  UpdatePitchInput,
} from '../types';
import {
  ValidationError,
  DatabaseError,
  ErrorCode,
} from '../types';

/**
 * PitchService handles CRUD operations for pitch associations
 * Manages the many-to-many relationship between songs and singers.
 * All API rows are normalized into the core SongSingerPitch shape so
 * the rest of the app can rely on consistent field names.
 */
class PitchService {
  /**
   * Validates pitch input data
   * @throws ValidationError if validation fails
   */
  private validatePitchInput(input: CreatePitchInput | UpdatePitchInput, isUpdate = false): void {
    if (!isUpdate) {
      const createInput = input as CreatePitchInput;
      if (!createInput.songId || createInput.songId.trim().length === 0) {
        throw new ValidationError('Song ID is required', 'songId');
      }
      if (!createInput.singerId || createInput.singerId.trim().length === 0) {
        throw new ValidationError('Singer ID is required', 'singerId');
      }
      if (!createInput.pitch || createInput.pitch.trim().length === 0) {
        throw new ValidationError('Pitch value is required', 'pitch');
      }
    } else {
      const updateInput = input as UpdatePitchInput;
      if (updateInput.pitch !== undefined && updateInput.pitch.trim().length === 0) {
        throw new ValidationError('Pitch value cannot be empty', 'pitch');
      }
    }

    // Validate pitch length
    if (input.pitch && input.pitch.length > 50) {
      throw new ValidationError('Pitch value must be 50 characters or less', 'pitch');
    }
  }

  /**
   * Converts a raw API/database row to SongSingerPitch with proper field names
   * and date parsing. Handles different key casings.
   */
  private mapRowToPitch(row: any): SongSingerPitch {
    const id = row.id ?? row.ID;
    const songId = row.songId ?? row.song_id ?? row.SONG_ID;
    const singerId = row.singerId ?? row.singer_id ?? row.SINGER_ID;
    const createdRaw = row.createdAt ?? row.created_at ?? row.CREATED_AT;
    const updatedRaw = row.updatedAt ?? row.updated_at ?? row.UPDATED_AT;

    return {
      id,
      songId,
      singerId,
      // Oracle / driver may expose this as `pitch` or `PITCH`
      pitch: row.pitch ?? row.PITCH,
      createdAt: createdRaw ? new Date(createdRaw) : new Date(),
      updatedAt: updatedRaw ? new Date(updatedRaw) : new Date(),
    };
  }

  /**
   * Retrieves all pitch associations in the system.
   * @returns Array of normalized pitch associations
   */
  async getAllPitches(): Promise<SongSingerPitch[]> {
    try {
      const raw = await apiClient.getPitches();
      return (raw as any[]).map((row) => this.mapRowToPitch(row));
    } catch (error) {
      console.error('Error fetching all pitches:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to fetch pitches',
        error
      );
    }
  }

  /**
   * Retrieves all pitch associations for a specific song
   * @param songId - Song UUID
   * @returns Array of pitch associations with singer details
   */
  async getPitchesForSong(songId: string): Promise<Array<SongSingerPitch & { singerName: string }>> {
    try {
      const raw = await apiClient.getSongPitches(songId);
      return (raw as any[]).map((row) => {
        const base = this.mapRowToPitch(row) as any;
        base.singerName = row.singer_name ?? row.SINGER_NAME;
        return base;
      });
    } catch (error) {
      console.error('Error fetching pitches for song:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to fetch pitches for song ID: ${songId}`,
        error
      );
    }
  }

  /**
   * Retrieves all pitch associations for a specific singer
   * @param singerId - Singer UUID
   * @returns Array of pitch associations with song details
   */
  async getPitchesForSinger(singerId: string): Promise<Array<SongSingerPitch & { songName: string }>> {
    try {
      // For now, get all pitches and filter - the API can be enhanced later
      const raw = await apiClient.getPitches();
      const mapped = (raw as any[]).map((row) => {
        const base = this.mapRowToPitch(row) as any;
        base.songName = row.song_name ?? row.SONG_NAME;
        base.singerName = row.singer_name ?? row.SINGER_NAME;
        return base;
      });
      return mapped.filter((p) => p.singerId === singerId);
    } catch (error) {
      console.error('Error fetching pitches for singer:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to fetch pitches for singer ID: ${singerId}`,
        error
      );
    }
  }

  /**
   * Creates a new pitch association between a song and singer
   * @param input - Pitch creation data
   * @returns Newly created pitch association
   */
  async createPitch(input: CreatePitchInput): Promise<SongSingerPitch> {
    this.validatePitchInput(input);

    try {
      // Create the association on the server
      await apiClient.createPitch({
        song_id: input.songId.trim(),
        singer_id: input.singerId.trim(),
        pitch: input.pitch.trim(),
      });

      // Fetch all pitches and find the one we just created by (songId, singerId, pitch)
      const raw = await apiClient.getPitches();
      const match = (raw as any[]).find(
        (row) =>
          (row.song_id ?? row.SONG_ID) === input.songId.trim() &&
          (row.singer_id ?? row.SINGER_ID) === input.singerId.trim() &&
          row.pitch === input.pitch.trim()
      );

      if (!match) {
        // Fallback: just map the last row if we can't find an exact match
        const last = (raw as any[])[(raw as any[]).length - 1];
        return this.mapRowToPitch(last);
      }

      return this.mapRowToPitch(match);
    } catch (error: any) {
      console.error('Error creating pitch:', error);
      
      // Check for unique constraint violation
      if (error.message && error.message.includes('unique')) {
        throw new DatabaseError(
          ErrorCode.DUPLICATE_ENTRY,
          'A pitch association already exists for this song and singer combination',
          error
        );
      }
      
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to create pitch association',
        error
      );
    }
  }

  /**
   * Updates an existing pitch association
   * @param id - Pitch association UUID
   * @param input - Pitch update data
   * @returns Updated pitch association or null if not found
   */
  async updatePitch(id: string, input: UpdatePitchInput): Promise<SongSingerPitch | null> {
    this.validatePitchInput(input, true);

    if (input.pitch === undefined) {
      // No fields to update, fetch and return existing pitch
      const raw = await apiClient.getPitch(id);
      return raw ? this.mapRowToPitch(raw as any) : null;
    }

    try {
      await apiClient.updatePitch(id, {
        pitch: input.pitch.trim(),
      });
      const raw = await apiClient.getPitch(id);
      return raw ? this.mapRowToPitch(raw as any) : null;
    } catch (error) {
      console.error('Error updating pitch:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to update pitch association with ID: ${id}`,
        error
      );
    }
  }

  /**
   * Deletes a pitch association by ID
   * @param id - Pitch association UUID
   * @returns true if deleted, false if not found
   */
  async deletePitch(id: string): Promise<boolean> {
    try {
      await apiClient.deletePitch(id);
      return true;
    } catch (error) {
      console.error('Error deleting pitch:', error);
      return false;
    }
  }

  /**
   * Gets a specific pitch association by song and singer IDs
   * @param songId - Song UUID
   * @param singerId - Singer UUID
   * @returns Pitch association or null if not found
   */
  async getPitchBySongAndSinger(songId: string, singerId: string): Promise<SongSingerPitch | null> {
    try {
      const raw = await apiClient.getSongPitches(songId);
      const mapped = (raw as any[]).map((row) => this.mapRowToPitch(row));
      const pitch = mapped.find((p) => p.singerId === singerId);
      return pitch || null;
    } catch (error) {
      console.error('Error fetching pitch by song and singer:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to fetch pitch association',
        error
      );
    }
  }
}

// Export singleton instance
export const pitchService = new PitchService();
export default pitchService;
