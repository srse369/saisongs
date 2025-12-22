import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { singerService } from './SingerService';
import apiClient from './ApiClient';
import type { Singer, CreateSingerInput, UpdateSingerInput } from '../types';
import { ValidationError, DatabaseError } from '../types';

vi.mock('./ApiClient');

describe('SingerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllSingers', () => {
    it('should fetch all singers successfully', async () => {
      const mockSingers = [
        {
          id: '1',
          name: 'John Doe',
          gender: 'Male',
          email: 'john@example.com',
          center_ids: 'center1',
          editor_for: null,
          is_admin: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Jane Smith',
          gender: 'Female',
          email: 'jane@example.com',
          center_ids: 'center2',
          editor_for: null,
          is_admin: 0,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getSingers).mockResolvedValue(mockSingers as any);

      const result = await singerService.getAllSingers();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Doe');
      expect(result[0].gender).toBe('Male');
      expect(result[1].name).toBe('Jane Smith');
      expect(result[1].gender).toBe('Female');
      expect(apiClient.getSingers).toHaveBeenCalledOnce();
    });

    it('should handle Oracle uppercase field names', async () => {
      const mockSingers = [
        {
          ID: '1',
          NAME: 'John Doe',
          GENDER: 'Male',
          EMAIL: 'john@example.com',
          CENTER_IDS: 'center1',
          EDITOR_FOR: null,
          IS_ADMIN: 0,
          CREATED_AT: '2024-01-01T00:00:00Z',
          UPDATED_AT: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getSingers).mockResolvedValue(mockSingers as any);

      const result = await singerService.getAllSingers();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].name).toBe('John Doe');
      expect(result[0].gender).toBe('Male');
      expect(result[0].email).toBe('john@example.com');
    });

    it('should handle camelCase field names', async () => {
      const mockSingers = [
        {
          id: '1',
          name: 'John Doe',
          gender: 'Male',
          email: 'john@example.com',
          center_ids: 'center1',
          editor_for: null,
          is_admin: 1,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(apiClient.getSingers).mockResolvedValue(mockSingers as any);

      const result = await singerService.getAllSingers();

      expect(result).toHaveLength(1);
      expect(result[0].is_admin).toBe(1);
    });

    it('should throw DatabaseError when API call fails', async () => {
      vi.mocked(apiClient.getSingers).mockRejectedValue(new Error('API Error'));

      await expect(singerService.getAllSingers()).rejects.toThrow(DatabaseError);
      await expect(singerService.getAllSingers()).rejects.toThrow('Failed to fetch singers');
    });
  });

  describe('getSingerById', () => {
    it('should fetch singer by ID successfully', async () => {
      const mockSinger = {
        id: '1',
        name: 'John Doe',
        gender: 'Male',
        email: 'john@example.com',
        center_ids: 'center1',
        editor_for: null,
        is_admin: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.getSinger).mockResolvedValue(mockSinger as any);

      const result = await singerService.getSingerById('1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('John Doe');
      expect(result?.gender).toBe('Male');
      expect(apiClient.getSinger).toHaveBeenCalledWith('1', false);
    });

    it('should return null when singer not found', async () => {
      vi.mocked(apiClient.getSinger).mockResolvedValue(null);

      const result = await singerService.getSingerById('999');

      expect(result).toBeNull();
    });

    it('should return null when API returns 404', async () => {
      vi.mocked(apiClient.getSinger).mockRejectedValue(new Error('404 Not Found'));

      const result = await singerService.getSingerById('999');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError for other errors', async () => {
      vi.mocked(apiClient.getSinger).mockRejectedValue(new Error('Server Error'));

      await expect(singerService.getSingerById('1')).rejects.toThrow(DatabaseError);
      await expect(singerService.getSingerById('1')).rejects.toThrow('Failed to fetch singer with ID: 1');
    });
  });

  describe('createSinger', () => {
    it('should create singer successfully with required fields', async () => {
      const input: CreateSingerInput = {
        name: 'New Singer',
        gender: 'Male',
      };

      const mockCreatedSinger = {
        id: '1',
        name: 'New Singer',
        gender: 'Male',
        email: null,
        center_ids: null,
        editor_for: null,
        is_admin: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.createSinger).mockResolvedValue(mockCreatedSinger as any);

      const result = await singerService.createSinger(input);

      expect(result.name).toBe('New Singer');
      expect(result.gender).toBe('Male');
      expect(apiClient.createSinger).toHaveBeenCalledWith({
        name: 'New Singer',
        gender: 'Male',
        email: undefined,
        center_ids: undefined,
      });
    });

    it('should create singer with all optional fields', async () => {
      const input: CreateSingerInput = {
        name: 'Complete Singer',
        gender: 'Female',
        email: 'singer@example.com',
        center_ids: [],
      };

      const mockCreatedSinger = {
        id: '1',
        name: 'Complete Singer',
        gender: 'Female',
        email: 'singer@example.com',
        center_ids: [],
        editor_for: null,
        is_admin: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.createSinger).mockResolvedValue(mockCreatedSinger as any);

      const result = await singerService.createSinger(input);

      expect(result.name).toBe('Complete Singer');
      expect(result.email).toBe('singer@example.com');
      expect(result.center_ids).toEqual([]);
    });

    it('should trim whitespace from name', async () => {
      const input: CreateSingerInput = {
        name: '  Trimmed Name  ',
        gender: 'Male',
      };

      vi.mocked(apiClient.createSinger).mockResolvedValue({} as any);

      await singerService.createSinger(input);

      expect(apiClient.createSinger).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Name',
        })
      );
    });

    it('should throw ValidationError when name is missing', async () => {
      const input = {
        name: '',
        gender: 'Male',
      } as CreateSingerInput;

      await expect(singerService.createSinger(input)).rejects.toThrow(ValidationError);
      await expect(singerService.createSinger(input)).rejects.toThrow('Singer name is required');
    });

    it('should throw ValidationError when name exceeds 255 characters', async () => {
      const input: CreateSingerInput = {
        name: 'A'.repeat(256),
        gender: 'Male',
      };

      await expect(singerService.createSinger(input)).rejects.toThrow('Singer name must be 255 characters or less');
    });

    it('should throw ValidationError for invalid gender', async () => {
      const input = {
        name: 'Singer',
        gender: 'Invalid',
      } as unknown as CreateSingerInput;

      await expect(singerService.createSinger(input)).rejects.toThrow(
        'Gender must be one of: Male, Female, Boy, Girl, Other'
      );
    });

    it('should accept valid gender values', async () => {
      const validGenders = ['Male', 'Female', 'Boy', 'Girl', 'Other'];

      for (const gender of validGenders) {
        vi.clearAllMocks();
        const input: CreateSingerInput = {
          name: 'Singer',
          gender: gender as any,
        };

        vi.mocked(apiClient.createSinger).mockResolvedValue({} as any);

        await expect(singerService.createSinger(input)).resolves.toBeDefined();
      }
    });

    it('should throw DatabaseError when API fails', async () => {
      const input: CreateSingerInput = {
        name: 'Singer',
        gender: 'Male',
      };

      vi.mocked(apiClient.createSinger).mockRejectedValue(new Error('Database error'));

      await expect(singerService.createSinger(input)).rejects.toThrow(DatabaseError);
      await expect(singerService.createSinger(input)).rejects.toThrow('Failed to create singer');
    });
  });

  describe('updateSinger', () => {
    it('should update singer successfully', async () => {
      const input: UpdateSingerInput = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const mockUpdatedSinger = {
        id: '1',
        name: 'Updated Name',
        gender: 'Male',
        email: 'updated@example.com',
        center_ids: 'center1',
        editor_for: null,
        is_admin: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(apiClient.updateSinger).mockResolvedValue(undefined);
      vi.mocked(apiClient.getSinger).mockResolvedValue(mockUpdatedSinger as any);

      const result = await singerService.updateSinger('1', input);

      expect(result?.name).toBe('Updated Name');
      expect(result?.email).toBe('updated@example.com');
      expect(apiClient.updateSinger).toHaveBeenCalledWith('1', {
        name: 'Updated Name',
        email: 'updated@example.com',
        gender: undefined,
        center_ids: undefined,
      });
      // After update, getSinger is called with nocache=true to get fresh data
      expect(apiClient.getSinger).toHaveBeenCalledWith('1', true);
    });

    it('should trim whitespace from name', async () => {
      const input: UpdateSingerInput = {
        name: '  Trimmed  ',
      };

      vi.mocked(apiClient.updateSinger).mockResolvedValue(undefined);
      vi.mocked(apiClient.getSinger).mockResolvedValue({} as any);

      await singerService.updateSinger('1', input);

      expect(apiClient.updateSinger).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ name: 'Trimmed' })
      );
    });

    it('should update partial fields', async () => {
      const input: UpdateSingerInput = {
        gender: 'Female',
      };

      vi.mocked(apiClient.updateSinger).mockResolvedValue(undefined);
      vi.mocked(apiClient.getSinger).mockResolvedValue({} as any);

      await singerService.updateSinger('1', input);

      expect(apiClient.updateSinger).toHaveBeenCalledWith('1', {
        name: undefined,
        gender: 'Female',
        email: undefined,
        center_ids: undefined,
      });
    });

    it('should throw ValidationError when name is empty string', async () => {
      const input: UpdateSingerInput = {
        name: '',
      };

      await expect(singerService.updateSinger('1', input)).rejects.toThrow('Singer name cannot be empty');
    });

    it('should throw ValidationError when name exceeds 255 characters', async () => {
      const input: UpdateSingerInput = {
        name: 'A'.repeat(256),
      };

      await expect(singerService.updateSinger('1', input)).rejects.toThrow('Singer name must be 255 characters or less');
    });

    it('should throw ValidationError for invalid gender', async () => {
      const input: UpdateSingerInput = {
        gender: 'InvalidGender' as any,
      };

      await expect(singerService.updateSinger('1', input)).rejects.toThrow(
        'Gender must be one of: Male, Female, Boy, Girl, Other'
      );
    });

    it('should throw DatabaseError when API fails', async () => {
      const input: UpdateSingerInput = {
        name: 'Updated',
      };

      vi.mocked(apiClient.updateSinger).mockRejectedValue(new Error('Update failed'));

      await expect(singerService.updateSinger('1', input)).rejects.toThrow(DatabaseError);
      await expect(singerService.updateSinger('1', input)).rejects.toThrow('Failed to update singer with ID: 1');
    });
  });

  describe('deleteSinger', () => {
    it('should delete singer successfully', async () => {
      vi.mocked(apiClient.deleteSinger).mockResolvedValue(undefined);

      await singerService.deleteSinger('1');

      expect(apiClient.deleteSinger).toHaveBeenCalledWith('1');
    });
  });
});
