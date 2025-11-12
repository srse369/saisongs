import databaseService from './DatabaseService';
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
 * Manages the many-to-many relationship between songs and singers
 * Uses parameterized queries to prevent SQL injection
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
   * Converts database row to SongSingerPitch object with proper date parsing
   */
  private mapRowToPitch(row: any): SongSingerPitch {
    return {
      id: row.id,
      songId: row.song_id,
      singerId: row.singer_id,
      pitch: row.pitch,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Retrieves all pitch associations for a specific song
   * @param songId - Song UUID
   * @returns Array of pitch associations with singer details
   */
  async getPitchesForSong(songId: string): Promise<Array<SongSingerPitch & { singerName: string }>> {
    try {
      const sql = `
        SELECT 
          ssp.id, 
          ssp.song_id, 
          ssp.singer_id, 
          ssp.pitch, 
          ssp.created_at, 
          ssp.updated_at,
          s.name as singer_name
        FROM song_singer_pitches ssp
        JOIN singers s ON ssp.singer_id = s.id
        WHERE ssp.song_id = $1
        ORDER BY s.name ASC
      `;
      const rows = await databaseService.query(sql, [songId]);
      return rows.map(row => ({
        ...this.mapRowToPitch(row),
        singerName: row.singer_name,
      }));
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
      const sql = `
        SELECT 
          ssp.id, 
          ssp.song_id, 
          ssp.singer_id, 
          ssp.pitch, 
          ssp.created_at, 
          ssp.updated_at,
          s.name as song_name
        FROM song_singer_pitches ssp
        JOIN songs s ON ssp.song_id = s.id
        WHERE ssp.singer_id = $1
        ORDER BY s.name ASC
      `;
      const rows = await databaseService.query(sql, [singerId]);
      return rows.map(row => ({
        ...this.mapRowToPitch(row),
        songName: row.song_name,
      }));
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
      const sql = `
        INSERT INTO song_singer_pitches (song_id, singer_id, pitch)
        VALUES ($1, $2, $3)
        RETURNING id, song_id, singer_id, pitch, created_at, updated_at
      `;
      const rows = await databaseService.query(sql, [
        input.songId.trim(),
        input.singerId.trim(),
        input.pitch.trim(),
      ]);

      return this.mapRowToPitch(rows[0]);
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
      const sql = `
        SELECT id, song_id, singer_id, pitch, created_at, updated_at
        FROM song_singer_pitches
        WHERE id = $1
      `;
      const rows = await databaseService.query(sql, [id]);
      return rows.length > 0 ? this.mapRowToPitch(rows[0]) : null;
    }

    try {
      const sql = `
        UPDATE song_singer_pitches
        SET pitch = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, song_id, singer_id, pitch, created_at, updated_at
      `;
      const rows = await databaseService.query(sql, [input.pitch.trim(), id]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToPitch(rows[0]);
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
      const sql = `
        DELETE FROM song_singer_pitches
        WHERE id = $1
        RETURNING id
      `;
      const rows = await databaseService.query(sql, [id]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error deleting pitch:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to delete pitch association with ID: ${id}`,
        error
      );
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
      const sql = `
        SELECT id, song_id, singer_id, pitch, created_at, updated_at
        FROM song_singer_pitches
        WHERE song_id = $1 AND singer_id = $2
      `;
      const rows = await databaseService.query(sql, [songId, singerId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.mapRowToPitch(rows[0]);
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
