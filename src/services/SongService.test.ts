import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { songService } from './SongService';
import apiClient from './ApiClient';
import type { Song, CreateSongInput, UpdateSongInput } from '../types';
import { ValidationError, DatabaseError } from '../types';

vi.mock('./ApiClient');

describe('SongService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllSongs', () => {
    it('should fetch all songs successfully', async () => {
      const mockSongs: Song[] = [
        {
          id: '1',
          name: 'Song 1',
          externalSourceUrl: 'https://example.com/song1',
          lyrics: 'Lyrics 1',
          meaning: null,
          language: 'English',
          deity: 'Deity 1',
          tempo: null,
          beat: null,
          raga: null,
          level: null,
          songTags: null,
          audioLink: null,
          videoLink: null,
          goldenVoice: false,
          refGents: null,
          refLadies: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.getSongs).mockResolvedValue(mockSongs);

      const result = await songService.getAllSongs();

      expect(result).toEqual(mockSongs);
      expect(apiClient.getSongs).toHaveBeenCalledOnce();
    });

    it('should throw DatabaseError when API call fails', async () => {
      vi.mocked(apiClient.getSongs).mockRejectedValue(new Error('API Error'));

      await expect(songService.getAllSongs()).rejects.toThrow(DatabaseError);
      await expect(songService.getAllSongs()).rejects.toThrow('Failed to fetch songs');
    });
  });

  describe('getSongById', () => {
    it('should fetch song by ID successfully', async () => {
      const mockSong: Song = {
        id: '1',
        name: 'Test Song',
        externalSourceUrl: 'https://example.com/song',
        lyrics: 'Test Lyrics',
        meaning: null,
        language: 'English',
        deity: 'Test Deity',
        tempo: null,
        beat: null,
        raga: null,
        level: null,
        songTags: null,
        audioLink: null,
        videoLink: null,
        goldenVoice: false,
        refGents: null,
        refLadies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.getSong).mockResolvedValue(mockSong);

      const result = await songService.getSongById('1');

      expect(result).toEqual(mockSong);
      expect(apiClient.getSong).toHaveBeenCalledWith('1', false);
    });

    it('should return null when song not found (404)', async () => {
      vi.mocked(apiClient.getSong).mockRejectedValue(new Error('404 Not Found'));

      const result = await songService.getSongById('999');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError for other errors', async () => {
      vi.mocked(apiClient.getSong).mockRejectedValue(new Error('Server Error'));

      await expect(songService.getSongById('1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('createSong', () => {
    it('should create song successfully with all required fields', async () => {
      const input: CreateSongInput = {
        name: 'New Song',
        externalSourceUrl: 'https://example.com/new',
        lyrics: 'New Lyrics',
        language: 'English',
        deity: 'Test Deity',
      };

      const mockCreatedSong: Song = {
        id: '1',
        ...input,
        meaning: null,
        tempo: null,
        beat: null,
        raga: null,
        level: null,
        songTags: null,
        audioLink: null,
        videoLink: null,
        goldenVoice: false,
        refGents: null,
        refLadies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.createSong).mockResolvedValue(mockCreatedSong);

      const result = await songService.createSong(input);

      expect(result).toEqual(mockCreatedSong);
      expect(apiClient.createSong).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Song',
          lyrics: 'New Lyrics',
          language: 'English',
          deity: 'Test Deity',
        })
      );
    });

    it('should create song with optional fields', async () => {
      const input: CreateSongInput = {
        name: 'Complete Song',
        externalSourceUrl: 'https://example.com/complete',
        lyrics: 'Complete Lyrics',
        language: 'Sanskrit',
        deity: 'Krishna',
        meaning: 'Song meaning',
        tempo: 'Medium',
        beat: '4/4',
        raga: 'Bhairavi',
        level: 'Intermediate',
        songTags: 'devotional,classical',
        audioLink: 'https://audio.com/song.mp3',
        videoLink: 'https://video.com/song',
        goldenVoice: true,
        refGents: 'C',
        refLadies: 'G',
      };

      const mockCreatedSong: Song = {
        id: '1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.createSong).mockResolvedValue(mockCreatedSong);

      const result = await songService.createSong(input);

      expect(result).toEqual(mockCreatedSong);
      expect(apiClient.createSong).toHaveBeenCalledWith(
        expect.objectContaining({
          goldenVoice: true,
          refGents: 'C',
          refLadies: 'G',
        })
      );
    });

    it('should throw ValidationError when name is missing', async () => {
      const input = {
        name: '',
        externalSourceUrl: 'https://example.com',
        lyrics: 'Lyrics',
        language: 'English',
        deity: 'Deity',
      } as CreateSongInput;

      await expect(songService.createSong(input)).rejects.toThrow(ValidationError);
      await expect(songService.createSong(input)).rejects.toThrow('Song name is required');
    });

    it('should throw ValidationError when language is missing', async () => {
      const input = {
        name: 'Song',
        externalSourceUrl: 'https://example.com',
        lyrics: 'Lyrics',
        language: '',
        deity: 'Deity',
      } as CreateSongInput;

      await expect(songService.createSong(input)).rejects.toThrow('Language is required');
    });

    it('should throw ValidationError when deity is missing', async () => {
      const input = {
        name: 'Song',
        externalSourceUrl: 'https://example.com',
        lyrics: 'Lyrics',
        language: 'English',
        deity: '',
      } as CreateSongInput;

      await expect(songService.createSong(input)).rejects.toThrow('Deity is required');
    });

    it('should throw ValidationError when lyrics are missing', async () => {
      const input = {
        name: 'Song',
        externalSourceUrl: 'https://example.com',
        lyrics: '',
        language: 'English',
        deity: 'Deity',
      } as CreateSongInput;

      await expect(songService.createSong(input)).rejects.toThrow('Lyrics are required');
    });

    it('should throw ValidationError when name exceeds 255 characters', async () => {
      const input: CreateSongInput = {
        name: 'A'.repeat(256),
        externalSourceUrl: 'https://example.com',
        lyrics: 'Lyrics',
        language: 'English',
        deity: 'Deity',
      };

      await expect(songService.createSong(input)).rejects.toThrow('Song name must be 255 characters or less');
    });

    it('should throw ValidationError when URL is invalid', async () => {
      const input: CreateSongInput = {
        name: 'Song',
        externalSourceUrl: 'not-a-valid-url',
        lyrics: 'Lyrics',
        language: 'English',
        deity: 'Deity',
      };

      await expect(songService.createSong(input)).rejects.toThrow('Invalid URL format');
    });

    it('should trim whitespace from name', async () => {
      const input: CreateSongInput = {
        name: '  Trimmed Song  ',
        externalSourceUrl: '  https://example.com  ',
        lyrics: 'Lyrics',
        language: 'English',
        deity: 'Deity',
      };

      vi.mocked(apiClient.createSong).mockResolvedValue({} as Song);

      await songService.createSong(input);

      expect(apiClient.createSong).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Song',
          externalSourceUrl: 'https://example.com',
        })
      );
    });

    it('should throw DatabaseError when API fails', async () => {
      const input: CreateSongInput = {
        name: 'Song',
        externalSourceUrl: 'https://example.com',
        lyrics: 'Lyrics',
        language: 'English',
        deity: 'Deity',
      };

      vi.mocked(apiClient.createSong).mockRejectedValue(new Error('Database error'));

      await expect(songService.createSong(input)).rejects.toThrow(DatabaseError);
      await expect(songService.createSong(input)).rejects.toThrow('Failed to create song');
    });
  });

  describe('updateSong', () => {
    it('should update song successfully', async () => {
      const input: UpdateSongInput = {
        name: 'Updated Song',
        lyrics: 'Updated Lyrics',
      };

      const mockUpdatedSong: Song = {
        id: '1',
        name: 'Updated Song',
        externalSourceUrl: 'https://example.com',
        lyrics: 'Updated Lyrics',
        meaning: null,
        language: 'English',
        deity: 'Deity',
        tempo: null,
        beat: null,
        raga: null,
        level: null,
        songTags: null,
        audioLink: null,
        videoLink: null,
        goldenVoice: false,
        refGents: null,
        refLadies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.updateSong).mockResolvedValue(undefined);
      vi.mocked(apiClient.getSong).mockResolvedValue(mockUpdatedSong);

      const result = await songService.updateSong('1', input);

      expect(result).toEqual(mockUpdatedSong);
      expect(apiClient.updateSong).toHaveBeenCalledWith('1', expect.any(Object));
      // After update, getSong is called with nocache=true to get fresh data
      expect(apiClient.getSong).toHaveBeenCalledWith('1', true);
    });

    it('should not require all fields for update', async () => {
      const input: UpdateSongInput = {
        tempo: 'Fast',
      };

      vi.mocked(apiClient.updateSong).mockResolvedValue(undefined);
      vi.mocked(apiClient.getSong).mockResolvedValue({} as Song);

      await songService.updateSong('1', input);

      expect(apiClient.updateSong).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ tempo: 'Fast' })
      );
    });

    it('should throw ValidationError when name exceeds 255 characters', async () => {
      const input: UpdateSongInput = {
        name: 'A'.repeat(256),
      };

      await expect(songService.updateSong('1', input)).rejects.toThrow('Song name must be 255 characters or less');
    });

    it('should throw ValidationError when URL is invalid', async () => {
      const input: UpdateSongInput = {
        externalSourceUrl: 'invalid-url',
      };

      await expect(songService.updateSong('1', input)).rejects.toThrow('Invalid URL format');
    });

    it('should throw DatabaseError when API fails', async () => {
      const input: UpdateSongInput = {
        name: 'Updated',
      };

      vi.mocked(apiClient.updateSong).mockRejectedValue(new Error('Update failed'));

      await expect(songService.updateSong('1', input)).rejects.toThrow(DatabaseError);
    });
  });

  describe('deleteSong', () => {
    it('should delete song successfully', async () => {
      vi.mocked(apiClient.deleteSong).mockResolvedValue(undefined);

      const result = await songService.deleteSong('1');

      expect(result).toBe(true);
      expect(apiClient.deleteSong).toHaveBeenCalledWith('1');
    });

    it('should throw DatabaseError when delete fails', async () => {
      vi.mocked(apiClient.deleteSong).mockRejectedValue(new Error('Delete failed'));

      await expect(songService.deleteSong('1')).rejects.toThrow(DatabaseError);
      await expect(songService.deleteSong('1')).rejects.toThrow('Delete failed');
    });
  });

  describe('syncSong', () => {
    it('should sync song from external source', async () => {
      const mockSong: Song = {
        id: '1',
        name: 'Song',
        externalSourceUrl: 'https://example.com/song',
        lyrics: 'Lyrics',
        meaning: null,
        language: 'English',
        deity: 'Deity',
        tempo: null,
        beat: null,
        raga: null,
        level: null,
        songTags: null,
        audioLink: null,
        videoLink: null,
        goldenVoice: false,
        refGents: null,
        refLadies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSyncResponse = {
        message: 'Synced successfully',
        updates: { pitches: 2 },
      };

      vi.mocked(apiClient.getSong).mockResolvedValue(mockSong);
      vi.mocked(apiClient.post).mockResolvedValue(mockSyncResponse);

      const result = await songService.syncSong('1');

      expect(result).toEqual(mockSyncResponse);
      expect(apiClient.post).toHaveBeenCalledWith('/songs/1/sync', {
        externalUrl: 'https://example.com/song',
      });
    });

    it('should return null when song not found', async () => {
      vi.mocked(apiClient.getSong).mockResolvedValue(null);

      const result = await songService.syncSong('999');

      expect(result).toBeNull();
    });

    it('should return null when song has no externalSourceUrl', async () => {
      const mockSong: Song = {
        id: '1',
        name: 'Song',
        externalSourceUrl: '',
        lyrics: 'Lyrics',
        meaning: null,
        language: 'English',
        deity: 'Deity',
        tempo: null,
        beat: null,
        raga: null,
        level: null,
        songTags: null,
        audioLink: null,
        videoLink: null,
        goldenVoice: false,
        refGents: null,
        refLadies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.getSong).mockResolvedValue(mockSong);

      const result = await songService.syncSong('1');

      expect(result).toBeNull();
    });

    it('should return null when sync fails', async () => {
      const mockSong: Song = {
        id: '1',
        name: 'Song',
        externalSourceUrl: 'https://example.com/song',
        lyrics: 'Lyrics',
        meaning: null,
        language: 'English',
        deity: 'Deity',
        tempo: null,
        beat: null,
        raga: null,
        level: null,
        songTags: null,
        audioLink: null,
        videoLink: null,
        goldenVoice: false,
        refGents: null,
        refLadies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.getSong).mockResolvedValue(mockSong);
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Sync failed'));

      const result = await songService.syncSong('1');

      expect(result).toBeNull();
    });
  });

  describe('searchSongs', () => {
    it('should search songs by name (case-insensitive)', async () => {
      const mockSongs: Song[] = [
        {
          id: '1',
          name: 'Amazing Grace',
          externalSourceUrl: 'https://example.com/1',
          lyrics: 'Lyrics 1',
          meaning: null,
          language: 'English',
          deity: 'Deity',
          tempo: null,
          beat: null,
          raga: null,
          level: null,
          songTags: null,
          audioLink: null,
          videoLink: null,
          goldenVoice: false,
          refGents: null,
          refLadies: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Grace of God',
          externalSourceUrl: 'https://example.com/2',
          lyrics: 'Lyrics 2',
          meaning: null,
          language: 'English',
          deity: 'Deity',
          tempo: null,
          beat: null,
          raga: null,
          level: null,
          songTags: null,
          audioLink: null,
          videoLink: null,
          goldenVoice: false,
          refGents: null,
          refLadies: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          name: 'Other Song',
          externalSourceUrl: 'https://example.com/3',
          lyrics: 'Lyrics 3',
          meaning: null,
          language: 'English',
          deity: 'Deity',
          tempo: null,
          beat: null,
          raga: null,
          level: null,
          songTags: null,
          audioLink: null,
          videoLink: null,
          goldenVoice: false,
          refGents: null,
          refLadies: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.getSongs).mockResolvedValue(mockSongs);

      const result = await songService.searchSongs('grace');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Amazing Grace');
      expect(result[1].name).toBe('Grace of God');
    });

    it('should return empty array when no matches found', async () => {
      const mockSongs: Song[] = [
        {
          id: '1',
          name: 'Song 1',
          externalSourceUrl: 'https://example.com',
          lyrics: 'Lyrics',
          meaning: null,
          language: 'English',
          deity: 'Deity',
          tempo: null,
          beat: null,
          raga: null,
          level: null,
          songTags: null,
          audioLink: null,
          videoLink: null,
          goldenVoice: false,
          refGents: null,
          refLadies: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.getSongs).mockResolvedValue(mockSongs);

      const result = await songService.searchSongs('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should throw DatabaseError when search fails', async () => {
      vi.mocked(apiClient.getSongs).mockRejectedValue(new Error('Search failed'));

      await expect(songService.searchSongs('query')).rejects.toThrow(DatabaseError);
    });
  });

  describe('searchSongsWithFilter', () => {
    it('should perform text search (singer filter not yet implemented)', async () => {
      const mockSongs: Song[] = [
        {
          id: '1',
          name: 'Test Song',
          externalSourceUrl: 'https://example.com',
          lyrics: 'Lyrics',
          meaning: null,
          language: 'English',
          deity: 'Deity',
          tempo: null,
          beat: null,
          raga: null,
          level: null,
          songTags: null,
          audioLink: null,
          videoLink: null,
          goldenVoice: false,
          refGents: null,
          refLadies: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.getSongs).mockResolvedValue(mockSongs);

      const result = await songService.searchSongsWithFilter('test', '123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Song');
    });
  });

  describe('getSongsBySinger', () => {
    it('should return all songs (relationship not yet implemented)', async () => {
      const mockSongs: Song[] = [
        {
          id: '1',
          name: 'Song 1',
          externalSourceUrl: 'https://example.com',
          lyrics: 'Lyrics',
          meaning: null,
          language: 'English',
          deity: 'Deity',
          tempo: null,
          beat: null,
          raga: null,
          level: null,
          songTags: null,
          audioLink: null,
          videoLink: null,
          goldenVoice: false,
          refGents: null,
          refLadies: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.getSongs).mockResolvedValue(mockSongs);

      const result = await songService.getSongsBySinger('123');

      expect(result).toEqual(mockSongs);
    });
  });
});
