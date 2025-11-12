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
 * SongService handles all CRUD operations for songs
 * Uses parameterized queries to prevent SQL injection
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
    } else {
      const updateInput = input as UpdateSongInput;
      if (updateInput.name !== undefined && updateInput.name.trim().length === 0) {
        throw new ValidationError('Song name cannot be empty', 'name');
      }
      if (updateInput.sairhythmsUrl !== undefined && updateInput.sairhythmsUrl.trim().length === 0) {
        throw new ValidationError('Sairhythms.org URL cannot be empty', 'sairhythmsUrl');
      }
    }

    // Validate name length
    if (input.name && input.name.length > 255) {
      throw new ValidationError('Song name must be 255 characters or less', 'name');
    }

    // Validate URL format
    if (input.sairhythmsUrl) {
      try {
        new URL(input.sairhythmsUrl);
      } catch {
        throw new ValidationError('Invalid URL format', 'sairhythmsUrl');
      }
    }
  }

  /**
   * Converts database row to Song object with proper date parsing
   */
  private mapRowToSong(row: any): Song {
    return {
      id: row.id,
      name: row.name,
      sairhythmsUrl: row.sairhythms_url,
      title: row.title,
      title2: row.title2,
      lyrics: row.lyrics,
      meaning: row.meaning,
      language: row.language,
      deity: row.deity,
      tempo: row.tempo,
      beat: row.beat,
      raga: row.raga,
      level: row.level,
      songTags: row.song_tags,
      audioLink: row.audio_link,
      videoLink: row.video_link,
      ulink: row.ulink,
      goldenVoice: row.golden_voice,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Retrieves all songs from the database
   * @returns Array of all songs
   */
  async getAllSongs(): Promise<Song[]> {
    try {
      const sql = `
        SELECT id, name, sairhythms_url, title, title2, lyrics, meaning,
               "LANGUAGE", deity, tempo, beat, raga, "LEVEL", song_tags,
               audio_link, video_link, ulink, golden_voice,
               created_at, updated_at
        FROM songs
        ORDER BY name ASC
      `;
      const rows = await databaseService.query(sql);
      return rows.map(row => this.mapRowToSong(row));
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
   * @param id - Song UUID
   * @returns Song object or null if not found
   */
  async getSongById(id: string): Promise<Song | null> {
    try {
      const sql = `
        SELECT id, name, sairhythms_url, title, title2, lyrics, meaning,
               "LANGUAGE", deity, tempo, beat, raga, "LEVEL", song_tags,
               audio_link, video_link, ulink, golden_voice,
               created_at, updated_at
        FROM songs
        WHERE id = :1
      `;
      const rows = await databaseService.query(sql, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.mapRowToSong(rows[0]);
    } catch (error) {
      console.error('Error fetching song by ID:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to fetch song with ID: ${id}`,
        error
      );
    }
  }

  /**
   * Creates a new song or updates if URL already exists
   * @param input - Song creation data
   * @returns Newly created or updated song
   */
  async createSong(input: CreateSongInput): Promise<Song> {
    this.validateSongInput(input);

    try {
      // Oracle doesn't support ON CONFLICT, use MERGE instead
      const sql = `
        MERGE INTO songs s
        USING (SELECT :1 as name, :2 as sairhythms_url, :3 as title, :4 as title2, 
                      :5 as lyrics, :6 as meaning, :7 as language, :8 as deity,
                      :9 as tempo, :10 as beat, :11 as raga, :12 as level,
                      :13 as song_tags, :14 as audio_link, :15 as video_link,
                      :16 as ulink, :17 as golden_voice FROM DUAL) src
        ON (s.sairhythms_url = src.sairhythms_url)
        WHEN MATCHED THEN
          UPDATE SET
            s.name = src.name,
            s.title = src.title,
            s.title2 = src.title2,
            s.lyrics = src.lyrics,
            s.meaning = src.meaning,
            s."LANGUAGE" = src.language,
            s.deity = src.deity,
            s.tempo = src.tempo,
            s.beat = src.beat,
            s.raga = src.raga,
            s."LEVEL" = src.level,
            s.song_tags = src.song_tags,
            s.audio_link = src.audio_link,
            s.video_link = src.video_link,
            s.ulink = src.ulink,
            s.golden_voice = src.golden_voice,
            s.updated_at = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (name, sairhythms_url, title, title2, lyrics, meaning,
                  "LANGUAGE", deity, tempo, beat, raga, "LEVEL", song_tags,
                  audio_link, video_link, ulink, golden_voice)
          VALUES (src.name, src.sairhythms_url, src.title, src.title2,
                  src.lyrics, src.meaning, src.language, src.deity,
                  src.tempo, src.beat, src.raga, src.level,
                  src.song_tags, src.audio_link, src.video_link,
                  src.ulink, src.golden_voice)
      `;
      const rows = await databaseService.query(sql, [
        input.name.trim(),
        input.sairhythmsUrl.trim(),
        input.title || null,
        input.title2 || null,
        input.lyrics || null,
        input.meaning || null,
        input.language || null,
        input.deity || null,
        input.tempo || null,
        input.beat || null,
        input.raga || null,
        input.level || null,
        input.songTags || null,
        input.audioLink || null,
        input.videoLink || null,
        input.ulink || null,
        input.goldenVoice || false,
      ]);

      return this.mapRowToSong(rows[0]);
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
   * @param id - Song UUID
   * @param input - Song update data
   * @returns Updated song or null if not found
   */
  async updateSong(id: string, input: UpdateSongInput): Promise<Song | null> {
    this.validateSongInput(input, true);

    // Build dynamic update query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name.trim());
    }
    if (input.sairhythmsUrl !== undefined) {
      updates.push(`sairhythms_url = $${paramIndex++}`);
      values.push(input.sairhythmsUrl.trim());
    }

    if (updates.length === 0) {
      // No fields to update, just return the existing song
      return this.getSongById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    try {
      const sql = `
        UPDATE songs
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, sairhythms_url, created_at, updated_at
      `;
      const rows = await databaseService.query(sql, values);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToSong(rows[0]);
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
   * @param id - Song UUID
   * @returns true if deleted, false if not found
   */
  async deleteSong(id: string): Promise<boolean> {
    try {
      const sql = `
        DELETE FROM songs
        WHERE id = $1
        RETURNING id
      `;
      const rows = await databaseService.query(sql, [id]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error deleting song:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to delete song with ID: ${id}`,
        error
      );
    }
  }

  /**
   * Searches songs by name (case-insensitive partial match)
   * @param query - Search query string
   * @returns Array of matching songs
   */
  async searchSongs(query: string): Promise<Song[]> {
    try {
      const sql = `
        SELECT id, name, sairhythms_url, created_at, updated_at
        FROM songs
        WHERE LOWER(name) LIKE LOWER($1)
        ORDER BY name ASC
      `;
      const searchPattern = `%${query.trim()}%`;
      const rows = await databaseService.query(sql, [searchPattern]);
      return rows.map(row => this.mapRowToSong(row));
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
   * Retrieves songs associated with a specific singer
   * @param singerId - Singer UUID
   * @returns Array of songs for the singer
   */
  async getSongsBySinger(singerId: string): Promise<Song[]> {
    try {
      const sql = `
        SELECT DISTINCT s.id, s.name, s.sairhythms_url, s.created_at, s.updated_at
        FROM songs s
        INNER JOIN song_singer_pitches ssp ON s.id = ssp.song_id
        WHERE ssp.singer_id = $1
        ORDER BY s.name ASC
      `;
      const rows = await databaseService.query(sql, [singerId]);
      return rows.map(row => this.mapRowToSong(row));
    } catch (error) {
      console.error('Error fetching songs by singer:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to fetch songs for singer: ${singerId}`,
        error
      );
    }
  }

  /**
   * Searches songs by name and optionally filters by singer
   * @param query - Search query string
   * @param singerId - Optional singer UUID to filter by
   * @returns Array of matching songs
   */
  async searchSongsWithFilter(query: string, singerId?: string): Promise<Song[]> {
    try {
      let sql: string;
      let params: any[];

      if (singerId) {
        // Search with singer filter
        sql = `
          SELECT DISTINCT s.id, s.name, s.sairhythms_url, s.created_at, s.updated_at
          FROM songs s
          INNER JOIN song_singer_pitches ssp ON s.id = ssp.song_id
          WHERE ssp.singer_id = $1 AND LOWER(s.name) LIKE LOWER($2)
          ORDER BY s.name ASC
        `;
        const searchPattern = `%${query.trim()}%`;
        params = [singerId, searchPattern];
      } else {
        // Search without singer filter
        sql = `
          SELECT id, name, sairhythms_url, created_at, updated_at
          FROM songs
          WHERE LOWER(name) LIKE LOWER($1)
          ORDER BY name ASC
        `;
        const searchPattern = `%${query.trim()}%`;
        params = [searchPattern];
      }

      const rows = await databaseService.query(sql, params);
      return rows.map(row => this.mapRowToSong(row));
    } catch (error) {
      console.error('Error searching songs with filter:', error);
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
