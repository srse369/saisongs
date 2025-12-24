import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredSongMappings,
  saveSongMapping,
  findStoredSongMapping,
  getStoredPitchMappings,
  savePitchMapping,
  findStoredPitchMapping,
  deleteSongMapping,
  deletePitchMapping,
} from './ImportMappingService';
import apiClient from './ApiClient';
import * as songMatcher from '../utils/songMatcher';

vi.mock('./ApiClient');
vi.mock('../utils/songMatcher', async () => {
  const actual = await vi.importActual('../utils/songMatcher');
  return {
    ...actual,
    normalizeSongNameForMapping: vi.fn((name: string) => name.toLowerCase().trim()),
  };
});

describe('ImportMappingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Song Mappings', () => {
    describe('getStoredSongMappings', () => {
      it('should fetch all song mappings', async () => {
        const mockMappings = [
          {
            csvSongName: 'amazing grace',
            dbSongId: '1',
            dbSongName: 'Amazing Grace',
          },
        ];

        vi.mocked(apiClient.get).mockResolvedValue(mockMappings);

        const result = await getStoredSongMappings();

        expect(result).toEqual(mockMappings);
        expect(apiClient.get).toHaveBeenCalledWith('/import-mappings/songs');
      });

      it('should return empty array on error', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));

        const result = await getStoredSongMappings();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalledWith(
          'Error loading song mappings from database:',
          expect.any(Error)
        );
      });
    });

    describe('saveSongMapping', () => {
      it('should save song mapping with normalized name', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({});
        vi.mocked(songMatcher.normalizeSongNameForMapping).mockReturnValue('amazing grace');

        const result = await saveSongMapping('Amazing Grace', '1', 'Amazing Grace');

        expect(result).toBe(true);
        expect(apiClient.post).toHaveBeenCalledWith('/import-mappings/songs', {
          csv_song_name: 'amazing grace',
          dbSongId: '1',
          db_song_name: 'Amazing Grace',
        });
      });

      it('should return false on error', async () => {
        vi.mocked(apiClient.post).mockRejectedValue(new Error('API Error'));

        const result = await saveSongMapping('Song', '1', 'Song');

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Error saving song mapping:', expect.any(Error));
      });
    });

    describe('findStoredSongMapping', () => {
      it('should find mapping with normalized name', async () => {
        const mockMapping = {
          csvSongName: 'amazing grace',
          dbSongId: '1',
          dbSongName: 'Amazing Grace',
        };

        vi.mocked(apiClient.get).mockResolvedValue(mockMapping);
        vi.mocked(songMatcher.normalizeSongNameForMapping).mockReturnValue('amazing grace');

        const result = await findStoredSongMapping('Amazing Grace');

        expect(result).toEqual(mockMapping);
        expect(apiClient.get).toHaveBeenCalledWith('/import-mappings/songs/amazing%20grace');
      });

      it('should fallback to exact match for backward compatibility', async () => {
        const mockMapping = {
          csvSongName: 'Amazing Grace',
          dbSongId: '1',
          dbSongName: 'Amazing Grace',
        };

        // First call fails (normalized), second succeeds (exact match)
        vi.mocked(apiClient.get)
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce(mockMapping);
        
        vi.mocked(songMatcher.normalizeSongNameForMapping).mockReturnValue('amazing grace');
        vi.mocked(apiClient.post).mockResolvedValue({});

        const result = await findStoredSongMapping('Amazing Grace');

        expect(result).toEqual(mockMapping);
        // Should have tried normalized first, then exact match
        expect(apiClient.get).toHaveBeenCalledTimes(2);
        // Should re-save with normalized format
        expect(apiClient.post).toHaveBeenCalledWith('/import-mappings/songs', {
          csv_song_name: 'amazing grace',
          dbSongId: '1',
          db_song_name: 'Amazing Grace',
        });
      });

      it('should return null when mapping not found', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(new Error('404 Not found'));
        vi.mocked(songMatcher.normalizeSongNameForMapping).mockReturnValue('unknown');

        const result = await findStoredSongMapping('Unknown Song');

        expect(result).toBeNull();
      });

      it('should skip fallback if normalized name equals trimmed name', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'));
        vi.mocked(songMatcher.normalizeSongNameForMapping).mockReturnValue('test');

        const result = await findStoredSongMapping('test');

        expect(result).toBeNull();
        expect(apiClient.get).toHaveBeenCalledTimes(1);
      });
    });

    describe('deleteSongMapping', () => {
      it('should delete song mapping with normalized name', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue(undefined);
        vi.mocked(songMatcher.normalizeSongNameForMapping).mockReturnValue('amazing grace');

        const result = await deleteSongMapping('Amazing Grace');

        expect(result).toBe(true);
        expect(apiClient.delete).toHaveBeenCalledWith('/import-mappings/songs/amazing%20grace');
      });

      it('should return false on error', async () => {
        vi.mocked(apiClient.delete).mockRejectedValue(new Error('API Error'));

        const result = await deleteSongMapping('Song');

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Error deleting song mapping:', expect.any(Error));
      });
    });
  });

  describe('Pitch Mappings', () => {
    describe('getStoredPitchMappings', () => {
      it('should fetch all pitch mappings', async () => {
        const mockMappings = [
          {
            originalFormat: 'C#',
            normalizedFormat: 'C#',
          },
        ];

        vi.mocked(apiClient.get).mockResolvedValue(mockMappings);

        const result = await getStoredPitchMappings();

        expect(result).toEqual(mockMappings);
        expect(apiClient.get).toHaveBeenCalledWith('/import-mappings/pitches');
      });

      it('should return empty array on error', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));

        const result = await getStoredPitchMappings();

        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalledWith(
          'Error loading pitch mappings from database:',
          expect.any(Error)
        );
      });
    });

    describe('savePitchMapping', () => {
      it('should save pitch mapping', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({});

        const result = await savePitchMapping('C#', 'C#');

        expect(result).toBe(true);
        expect(apiClient.post).toHaveBeenCalledWith('/import-mappings/pitches', {
          original_format: 'C#',
          normalized_format: 'C#',
        });
      });

      it('should return false on error', async () => {
        vi.mocked(apiClient.post).mockRejectedValue(new Error('API Error'));

        const result = await savePitchMapping('C#', 'C#');

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Error saving pitch mapping:', expect.any(Error));
      });
    });

    describe('findStoredPitchMapping', () => {
      it('should find pitch mapping by original format', async () => {
        const mockMapping = {
          originalFormat: 'C#',
          normalizedFormat: 'C#',
        };

        vi.mocked(apiClient.get).mockResolvedValue(mockMapping);

        const result = await findStoredPitchMapping('C#');

        expect(result).toEqual(mockMapping);
        expect(apiClient.get).toHaveBeenCalledWith('/import-mappings/pitches/C%23');
      });

      it('should return null when mapping not found', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(new Error('404 Not found'));

        const result = await findStoredPitchMapping('Unknown');

        expect(result).toBeNull();
      });
    });

    describe('deletePitchMapping', () => {
      it('should delete pitch mapping', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue(undefined);

        const result = await deletePitchMapping('C#');

        expect(result).toBe(true);
        expect(apiClient.delete).toHaveBeenCalledWith('/import-mappings/pitches/C%23');
      });

      it('should return false on error', async () => {
        vi.mocked(apiClient.delete).mockRejectedValue(new Error('API Error'));

        const result = await deletePitchMapping('C#');

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Error deleting pitch mapping:', expect.any(Error));
      });
    });
  });
});
