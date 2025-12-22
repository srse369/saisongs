import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pitchService } from './PitchService';
import apiClient from './ApiClient';
import type { SongSingerPitch, CreatePitchInput, UpdatePitchInput } from '../types';
import { ValidationError, DatabaseError } from '../types';

vi.mock('./ApiClient');

describe('PitchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllPitches', () => {
    it('should fetch all pitches successfully', async () => {
      const mockPitches = [
        {
          id: '1',
          song_id: 'song1',
          singer_id: 'singer1',
          pitch: 'C',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          song_id: 'song2',
          singer_id: 'singer2',
          pitch: 'G',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getAllPitches();

      expect(result).toHaveLength(2);
      expect(result[0].songId).toBe('song1');
      expect(result[0].singerId).toBe('singer1');
      expect(result[0].pitch).toBe('C');
      expect(result[1].pitch).toBe('G');
      expect(apiClient.getPitches).toHaveBeenCalledOnce();
    });

    it('should handle Oracle uppercase field names', async () => {
      const mockPitches = [
        {
          ID: '1',
          SONG_ID: 'song1',
          SINGER_ID: 'singer1',
          PITCH: 'C',
          CREATED_AT: '2024-01-01T00:00:00Z',
          UPDATED_AT: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getAllPitches();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].songId).toBe('song1');
      expect(result[0].singerId).toBe('singer1');
      expect(result[0].pitch).toBe('C');
    });

    it('should handle camelCase field names', async () => {
      const mockPitches = [
        {
          id: '1',
          songId: 'song1',
          singerId: 'singer1',
          pitch: 'D',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(apiClient.getPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getAllPitches();

      expect(result).toHaveLength(1);
      expect(result[0].pitch).toBe('D');
    });

    it('should throw DatabaseError when API call fails', async () => {
      vi.mocked(apiClient.getPitches).mockRejectedValue(new Error('API Error'));

      await expect(pitchService.getAllPitches()).rejects.toThrow(DatabaseError);
      await expect(pitchService.getAllPitches()).rejects.toThrow('Failed to fetch pitches');
    });
  });

  describe('getPitchesForSong', () => {
    it('should fetch pitches for a specific song with singer names', async () => {
      const mockPitches = [
        {
          id: '1',
          song_id: 'song1',
          singer_id: 'singer1',
          singer_name: 'John Doe',
          pitch: 'C',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          song_id: 'song1',
          singer_id: 'singer2',
          singer_name: 'Jane Smith',
          pitch: 'G',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getSongPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getPitchesForSong('song1');

      expect(result).toHaveLength(2);
      expect(result[0].singerName).toBe('John Doe');
      expect(result[0].pitch).toBe('C');
      expect(result[1].singerName).toBe('Jane Smith');
      expect(result[1].pitch).toBe('G');
      expect(apiClient.getSongPitches).toHaveBeenCalledWith('song1');
    });

    it('should handle uppercase singer name field', async () => {
      const mockPitches = [
        {
          id: '1',
          song_id: 'song1',
          singer_id: 'singer1',
          SINGER_NAME: 'John Doe',
          pitch: 'C',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getSongPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getPitchesForSong('song1');

      expect(result[0].singerName).toBe('John Doe');
    });

    it('should throw DatabaseError when API call fails', async () => {
      vi.mocked(apiClient.getSongPitches).mockRejectedValue(new Error('API Error'));

      await expect(pitchService.getPitchesForSong('song1')).rejects.toThrow(DatabaseError);
      await expect(pitchService.getPitchesForSong('song1')).rejects.toThrow(
        'Failed to fetch pitches for song ID: song1'
      );
    });
  });

  describe('getPitchesForSinger', () => {
    it('should fetch pitches for a specific singer with song names', async () => {
      const mockPitches = [
        {
          id: '1',
          song_id: 'song1',
          singer_id: 'singer1',
          song_name: 'Amazing Grace',
          singer_name: 'John Doe',
          pitch: 'C',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          song_id: 'song2',
          singer_id: 'singer1',
          song_name: 'How Great Thou Art',
          singer_name: 'John Doe',
          pitch: 'G',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
        {
          id: '3',
          song_id: 'song3',
          singer_id: 'singer2',
          song_name: 'Other Song',
          singer_name: 'Jane Smith',
          pitch: 'D',
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getPitchesForSinger('singer1');

      expect(result).toHaveLength(2);
      expect(result[0].songName).toBe('Amazing Grace');
      expect(result[0].pitch).toBe('C');
      expect(result[1].songName).toBe('How Great Thou Art');
      expect(result[1].pitch).toBe('G');
    });

    it('should handle uppercase song name field', async () => {
      const mockPitches = [
        {
          id: '1',
          song_id: 'song1',
          singer_id: 'singer1',
          SONG_NAME: 'Amazing Grace',
          pitch: 'C',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getPitchesForSinger('singer1');

      expect(result[0].songName).toBe('Amazing Grace');
    });

    it('should throw DatabaseError when API call fails', async () => {
      vi.mocked(apiClient.getPitches).mockRejectedValue(new Error('API Error'));

      await expect(pitchService.getPitchesForSinger('singer1')).rejects.toThrow(DatabaseError);
      await expect(pitchService.getPitchesForSinger('singer1')).rejects.toThrow(
        'Failed to fetch pitches for singer ID: singer1'
      );
    });
  });

  describe('createPitch', () => {
    it('should create pitch successfully', async () => {
      const input: CreatePitchInput = {
        songId: 'song1',
        singerId: 'singer1',
        pitch: 'C',
      };

      const mockCreatedPitch = {
        id: '1',
        song_id: 'song1',
        singer_id: 'singer1',
        pitch: 'C',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.createPitch).mockResolvedValue(mockCreatedPitch as any);

      const result = await pitchService.createPitch(input);

      expect(result.songId).toBe('song1');
      expect(result.singerId).toBe('singer1');
      expect(result.pitch).toBe('C');
      expect(apiClient.createPitch).toHaveBeenCalledWith({
        song_id: 'song1',
        singer_id: 'singer1',
        pitch: 'C',
      });
    });

    it('should trim whitespace from input', async () => {
      const input: CreatePitchInput = {
        songId: '  song1  ',
        singerId: '  singer1  ',
        pitch: '  C  ',
      };

      vi.mocked(apiClient.createPitch).mockResolvedValue({} as any);

      await pitchService.createPitch(input);

      expect(apiClient.createPitch).toHaveBeenCalledWith({
        song_id: 'song1',
        singer_id: 'singer1',
        pitch: 'C',
      });
    });

    it('should throw ValidationError when songId is missing', async () => {
      const input = {
        songId: '',
        singerId: 'singer1',
        pitch: 'C',
      } as CreatePitchInput;

      await expect(pitchService.createPitch(input)).rejects.toThrow(ValidationError);
      await expect(pitchService.createPitch(input)).rejects.toThrow('Song ID is required');
    });

    it('should throw ValidationError when singerId is missing', async () => {
      const input = {
        songId: 'song1',
        singerId: '',
        pitch: 'C',
      } as CreatePitchInput;

      await expect(pitchService.createPitch(input)).rejects.toThrow('Singer ID is required');
    });

    it('should throw ValidationError when pitch is missing', async () => {
      const input = {
        songId: 'song1',
        singerId: 'singer1',
        pitch: '',
      } as CreatePitchInput;

      await expect(pitchService.createPitch(input)).rejects.toThrow('Pitch value is required');
    });

    it('should throw ValidationError when pitch exceeds 50 characters', async () => {
      const input: CreatePitchInput = {
        songId: 'song1',
        singerId: 'singer1',
        pitch: 'A'.repeat(51),
      };

      await expect(pitchService.createPitch(input)).rejects.toThrow('Pitch value must be 50 characters or less');
    });

    it('should throw DatabaseError with duplicate entry for unique constraint violation', async () => {
      const input: CreatePitchInput = {
        songId: 'song1',
        singerId: 'singer1',
        pitch: 'C',
      };

      vi.mocked(apiClient.createPitch).mockRejectedValue(new Error('unique constraint violation'));

      await expect(pitchService.createPitch(input)).rejects.toThrow(DatabaseError);
      await expect(pitchService.createPitch(input)).rejects.toThrow(
        'A pitch association already exists for this song and singer combination'
      );
    });

    it('should throw DatabaseError with access denied message for permission errors', async () => {
      const input: CreatePitchInput = {
        songId: 'song1',
        singerId: 'singer1',
        pitch: 'C',
      };

      vi.mocked(apiClient.createPitch).mockRejectedValue(new Error('Access denied: insufficient privileges'));

      await expect(pitchService.createPitch(input)).rejects.toThrow('Access denied: insufficient privileges');
    });

    it('should throw generic DatabaseError for other errors', async () => {
      const input: CreatePitchInput = {
        songId: 'song1',
        singerId: 'singer1',
        pitch: 'C',
      };

      vi.mocked(apiClient.createPitch).mockRejectedValue(new Error('Database connection failed'));

      await expect(pitchService.createPitch(input)).rejects.toThrow('Failed to create pitch association');
    });
  });

  describe('updatePitch', () => {
    it('should update pitch successfully', async () => {
      const input: UpdatePitchInput = {
        pitch: 'G',
      };

      const mockUpdatedPitch = {
        id: '1',
        song_id: 'song1',
        singer_id: 'singer1',
        pitch: 'G',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(apiClient.updatePitch).mockResolvedValue(undefined);
      vi.mocked(apiClient.getPitch).mockResolvedValue(mockUpdatedPitch as any);

      const result = await pitchService.updatePitch('1', input);

      expect(result?.pitch).toBe('G');
      expect(apiClient.updatePitch).toHaveBeenCalledWith('1', { pitch: 'G' });
      // After update, getPitch is called with nocache=true to get fresh data
      expect(apiClient.getPitch).toHaveBeenCalledWith('1', true);
    });

    it('should trim whitespace from pitch', async () => {
      const input: UpdatePitchInput = {
        pitch: '  G  ',
      };

      vi.mocked(apiClient.updatePitch).mockResolvedValue(undefined);
      vi.mocked(apiClient.getPitch).mockResolvedValue({} as any);

      await pitchService.updatePitch('1', input);

      expect(apiClient.updatePitch).toHaveBeenCalledWith('1', { pitch: 'G' });
    });

    it('should return existing pitch when no fields to update', async () => {
      const input: UpdatePitchInput = {};

      const mockPitch = {
        id: '1',
        song_id: 'song1',
        singer_id: 'singer1',
        pitch: 'C',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.getPitch).mockResolvedValue(mockPitch as any);

      const result = await pitchService.updatePitch('1', input);

      expect(result?.pitch).toBe('C');
      expect(apiClient.updatePitch).not.toHaveBeenCalled();
      // No update was made, so getPitch is called without nocache (defaults to false)
      expect(apiClient.getPitch).toHaveBeenCalledWith('1', false);
    });

    it('should return null when pitch not found', async () => {
      const input: UpdatePitchInput = {
        pitch: 'G',
      };

      vi.mocked(apiClient.updatePitch).mockResolvedValue(undefined);
      vi.mocked(apiClient.getPitch).mockResolvedValue(null);

      const result = await pitchService.updatePitch('999', input);

      expect(result).toBeNull();
    });

    it('should throw ValidationError when pitch is empty string', async () => {
      const input: UpdatePitchInput = {
        pitch: '',
      };

      await expect(pitchService.updatePitch('1', input)).rejects.toThrow('Pitch value cannot be empty');
    });

    it('should throw ValidationError when pitch exceeds 50 characters', async () => {
      const input: UpdatePitchInput = {
        pitch: 'A'.repeat(51),
      };

      await expect(pitchService.updatePitch('1', input)).rejects.toThrow('Pitch value must be 50 characters or less');
    });

    it('should preserve access denied error message', async () => {
      const input: UpdatePitchInput = {
        pitch: 'G',
      };

      vi.mocked(apiClient.updatePitch).mockRejectedValue(new Error('Access denied: viewer role cannot modify'));

      await expect(pitchService.updatePitch('1', input)).rejects.toThrow('Access denied: viewer role cannot modify');
    });

    it('should throw DatabaseError for generic update failures', async () => {
      const input: UpdatePitchInput = {
        pitch: 'G',
      };

      vi.mocked(apiClient.updatePitch).mockRejectedValue(new Error('Update failed'));

      await expect(pitchService.updatePitch('1', input)).rejects.toThrow('Failed to update pitch association with ID: 1');
    });
  });

  describe('deletePitch', () => {
    it('should delete pitch successfully', async () => {
      vi.mocked(apiClient.deletePitch).mockResolvedValue(undefined);

      await pitchService.deletePitch('1');

      expect(apiClient.deletePitch).toHaveBeenCalledWith('1');
    });
  });

  describe('getPitchBySongAndSinger', () => {
    it('should find pitch by song and singer IDs', async () => {
      const mockPitches = [
        {
          id: '1',
          song_id: 'song1',
          singer_id: 'singer1',
          pitch: 'C',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          song_id: 'song1',
          singer_id: 'singer2',
          pitch: 'G',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getSongPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getPitchBySongAndSinger('song1', 'singer1');

      expect(result).not.toBeNull();
      expect(result?.singerId).toBe('singer1');
      expect(result?.pitch).toBe('C');
    });

    it('should return null when pitch not found', async () => {
      const mockPitches = [
        {
          id: '1',
          song_id: 'song1',
          singer_id: 'singer1',
          pitch: 'C',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.getSongPitches).mockResolvedValue(mockPitches as any);

      const result = await pitchService.getPitchBySongAndSinger('song1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError when API call fails', async () => {
      vi.mocked(apiClient.getSongPitches).mockRejectedValue(new Error('API Error'));

      await expect(pitchService.getPitchBySongAndSinger('song1', 'singer1')).rejects.toThrow(DatabaseError);
      await expect(pitchService.getPitchBySongAndSinger('song1', 'singer1')).rejects.toThrow(
        'Failed to fetch pitch association'
      );
    });
  });
});
