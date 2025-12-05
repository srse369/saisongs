import apiClient from './ApiClient';
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
 * SingerService handles all CRUD operations for singers via API
 */
class SingerService {
  /**
   * Maps a raw API row into the strongly typed Singer shape,
   * normalizing key casing and converting timestamps to Date.
   */
  private mapApiSinger(row: any): Singer {
    const id = row.id ?? row.ID;
    const name = row.name ?? row.NAME;
    const gender = row.gender ?? row.GENDER;
    const email = row.email ?? row.EMAIL;
    const centerIds = row.center_ids ?? row.CENTER_IDS;
    const editorFor = row.editor_for ?? row.EDITOR_FOR;
    const isAdmin = row.is_admin ?? row.IS_ADMIN;
    const createdRaw = row.createdAt ?? row.created_at ?? row.CREATED_AT;
    const updatedRaw = row.updatedAt ?? row.updated_at ?? row.UPDATED_AT;

    return {
      id,
      name,
      gender,
      email,
      center_ids: centerIds,
      editor_for: editorFor,
      is_admin: isAdmin,
      createdAt: createdRaw ? new Date(createdRaw) : new Date(),
      updatedAt: updatedRaw ? new Date(updatedRaw) : new Date(),
    };
  }
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

    // Validate gender if provided
    if (input.gender && !['Male', 'Female', 'Boy', 'Girl', 'Other'].includes(input.gender)) {
      throw new ValidationError('Gender must be one of: Male, Female, Boy, Girl, Other', 'gender');
    }
  }

  /**
   * Retrieves all singers from the database
   * @returns Array of all singers
   */
  async getAllSingers(): Promise<Singer[]> {
    try {
      const raw = await apiClient.getSingers();
      return (raw as any[]).map((row) => this.mapApiSinger(row));
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
      const raw = await apiClient.getSinger(id);
      if (!raw) return null;
      return this.mapApiSinger(raw as any);
    } catch (error) {
      console.error('Error fetching singer by ID:', error);
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
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
      // Create on the server and use the returned singer directly
      const raw = await apiClient.createSinger({
        name: input.name.trim(),
        gender: input.gender,
        email: input.email,
        center_ids: input.center_ids,
      });

      // Map and return the created singer
      return this.mapApiSinger(raw);
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

    try {
      await apiClient.updateSinger(id, {
        name: input.name?.trim(),
        gender: input.gender,
        email: input.email,
        center_ids: input.center_ids,
      });
      return this.getSingerById(id);
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
   * @throws {DatabaseError} if deletion fails
   */
  async deleteSinger(id: string): Promise<void> {
    await apiClient.deleteSinger(id);
  }
}

// Export singleton instance
export const singerService = new SingerService();
export default singerService;
