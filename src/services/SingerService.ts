import apiClient from './ApiClient';
import { getCacheItem } from '../utils/cacheUtils';
import { CACHE_KEYS } from '../utils/cacheUtils';
import type {
  Singer,
  CreateSingerInput,
  UpdateSingerInput,
} from '../types';

const SINGERS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
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
    const centerIds = row.centerIds ?? row.center_ids ?? row.CENTER_IDS;
    const editorFor = row.editorFor ?? row.editor_for ?? row.EDITOR_FOR;
    const isAdmin = row.isAdmin ?? row.is_admin ?? row.IS_ADMIN;
    const pitchCount = row.pitchCount ?? row.pitch_count ?? row.PITCH_COUNT;
    const createdRaw = row.createdAt ?? row.created_at ?? row.CREATED_AT;
    const updatedRaw = row.updatedAt ?? row.updated_at ?? row.UPDATED_AT;

    return {
      id,
      name,
      gender,
      email,
      centerIds: centerIds,
      editorFor: editorFor,
      isAdmin: isAdmin,
      pitchCount: pitchCount !== undefined ? Number(pitchCount) : undefined,
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
  async getAllSingers(nocache: boolean = false): Promise<Singer[]> {
    try {
      const raw = await apiClient.getSingers(nocache);
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
   * Retrieves a single singer by ID (browser cache first, then backend)
   * @param id - Singer UUID
   * @returns Singer object or null if not found
   */
  async getSingerById(id: string, nocache: boolean = false): Promise<Singer | null> {
    if (!nocache && typeof window !== 'undefined') {
      const listRaw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SINGERS);
      if (listRaw) {
        try {
          const { timestamp, singers } = JSON.parse(listRaw) as { timestamp: number; singers: any[] };
          if (Array.isArray(singers) && Date.now() - timestamp < SINGERS_CACHE_TTL_MS) {
            const found = singers.find((s: any) => s?.id === id);
            if (found) return this.mapApiSinger(found);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    try {
      const raw = await apiClient.getSinger(id, nocache);
      if (!raw) return null;
      return this.mapApiSinger(raw as any);
    } catch (error) {
      if (!nocache && typeof window !== 'undefined') {
        const listRaw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SINGERS);
        if (listRaw) {
          try {
            const { singers } = JSON.parse(listRaw) as { timestamp: number; singers: any[] };
            if (Array.isArray(singers)) {
              const found = singers.find((s: any) => s?.id === id);
              if (found) return this.mapApiSinger(found);
            }
          } catch {
            // Fall through
          }
        }
      }
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
        centerIds: input.centerIds,
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
        centerIds: input.centerIds,
      });
      // Use nocache=true to ensure we get fresh data after the update
      return this.getSingerById(id, true);
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

  /**
   * Merges multiple singers into one target singer
   * @param targetSingerId - The singer ID to keep
   * @param singerIdsToMerge - Array of singer IDs to merge into the target
   * @returns Result of the merge operation
   */
  async mergeSingers(targetSingerId: string, singerIdsToMerge: string[]): Promise<{ message: string; targetSingerPitchCountUp: number; songIdsPitchCountDown: Map<string, number>; centerIdsSingerCountDown: Map<number, number> }> {
    if (!targetSingerId || !singerIdsToMerge || singerIdsToMerge.length === 0) {
      throw new ValidationError('Target singer and at least one singer to merge are required', 'merge');
    }

    if (singerIdsToMerge.includes(targetSingerId)) {
      throw new ValidationError('Target singer cannot be in the list of singers to merge', 'merge');
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || (
        import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
      );

      const response = await fetch(`${API_BASE_URL}/singers/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetSingerId, singerIdsToMerge }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to merge singers');
      }

      return await response.json();
    } catch (error) {
      console.error('Error merging singers:', error);
      throw new DatabaseError(
        ErrorCode.QUERY_ERROR,
        error instanceof Error ? error.message : 'Failed to merge singers',
        error
      );
    }
  }
}

// Export singleton instance
export const singerService = new SingerService();
export default singerService;
