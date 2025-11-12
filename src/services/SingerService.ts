import databaseService from './DatabaseService';
import type {
  Singer,
  CreateSingerInput,
  UpdateSingerInput,
} from '../types';
import {
  ValidationError,
  DatabaseError,
  ErrorCode,
} from '../types';

/**
 * SingerService handles all CRUD operations for singers
 * Uses parameterized queries to prevent SQL injection
 */
class SingerService {
  /**
   * Validates singer input data
   * @throws ValidationError if validation fails
   */
  private validateSingerInput(input: CreateSingerInput | UpdateSingerInput, isUpdate = false): void {
    if (!isUpdate) {
      const createInput = input as CreateSingerInput;
      if (!createInput.name || createInput.name.trim().length === 0) {
        throw new ValidationError('Singer name is required', 'name');
      }
    } else {
      const updateInput = input as UpdateSingerInput;
      if (updateInput.name !== undefined && updateInput.name.trim().length === 0) {
        throw new ValidationError('Singer name cannot be empty', 'name');
      }
    }

    // Validate name length
    if (input.name && input.name.length > 255) {
      throw new ValidationError('Singer name must be 255 characters or less', 'name');
    }
  }

  /**
   * Converts database row to Singer object with proper date parsing
   */
  private mapRowToSinger(row: any): Singer {
    return {
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Retrieves all singers from the database
   * @returns Array of all singers
   */
  async getAllSingers(): Promise<Singer[]> {
    try {
      const sql = `
        SELECT id, name, created_at, updated_at
        FROM singers
        ORDER BY name ASC
      `;
      const rows = await databaseService.query(sql);
      return rows.map(row => this.mapRowToSinger(row));
    } catch (error) {
      console.error('Error fetching all singers:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to fetch singers',
        error
      );
    }
  }

  /**
   * Retrieves a single singer by ID
   * @param id - Singer UUID
   * @returns Singer object or null if not found
   */
  async getSingerById(id: string): Promise<Singer | null> {
    try {
      const sql = `
        SELECT id, name, created_at, updated_at
        FROM singers
        WHERE id = $1
      `;
      const rows = await databaseService.query(sql, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.mapRowToSinger(rows[0]);
    } catch (error) {
      console.error('Error fetching singer by ID:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to fetch singer with ID: ${id}`,
        error
      );
    }
  }

  /**
   * Creates a new singer
   * @param input - Singer creation data
   * @returns Newly created singer
   */
  async createSinger(input: CreateSingerInput): Promise<Singer> {
    this.validateSingerInput(input);

    try {
      const sql = `
        INSERT INTO singers (name)
        VALUES ($1)
        RETURNING id, name, created_at, updated_at
      `;
      const rows = await databaseService.query(sql, [input.name.trim()]);

      return this.mapRowToSinger(rows[0]);
    } catch (error) {
      console.error('Error creating singer:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        'Failed to create singer',
        error
      );
    }
  }

  /**
   * Updates an existing singer
   * @param id - Singer UUID
   * @param input - Singer update data
   * @returns Updated singer or null if not found
   */
  async updateSinger(id: string, input: UpdateSingerInput): Promise<Singer | null> {
    this.validateSingerInput(input, true);

    if (input.name === undefined) {
      // No fields to update, just return the existing singer
      return this.getSingerById(id);
    }

    try {
      const sql = `
        UPDATE singers
        SET name = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, name, created_at, updated_at
      `;
      const rows = await databaseService.query(sql, [input.name.trim(), id]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToSinger(rows[0]);
    } catch (error) {
      console.error('Error updating singer:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to update singer with ID: ${id}`,
        error
      );
    }
  }

  /**
   * Deletes a singer by ID
   * @param id - Singer UUID
   * @returns true if deleted, false if not found
   */
  async deleteSinger(id: string): Promise<boolean> {
    try {
      const sql = `
        DELETE FROM singers
        WHERE id = $1
        RETURNING id
      `;
      const rows = await databaseService.query(sql, [id]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error deleting singer:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        `Failed to delete singer with ID: ${id}`,
        error
      );
    }
  }
}

// Export singleton instance
export const singerService = new SingerService();
export default singerService;
