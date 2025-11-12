import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importService } from './ImportService';
import songService from './SongService';
import sairhythmsScraperService from './SairhythmsScraperService';
import type { Song } from '../types';

// Mock the dependencies
vi.mock('./SongService');
vi.mock('./SairhythmsScraperService');

describe('ImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('song matching by URL and name', () => {
    it('should match existing song by URL', async () => {
      // Arrange: Set up existing songs in database
      const existingSongs: Song[] = [
        {
          id: 'song-1',
          name: 'Amazing Grace',
          sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      // Mock discovered songs from scraper
      const discoveredSongs = [
        {
          name: 'Amazing Grace (Updated)',
          url: 'https://sairhythms.org/song/amazing-grace',
        },
      ];

      vi.mocked(songService.getAllSongs).mockResolvedValue(existingSongs);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.updateSong).mockResolvedValue({
        ...existingSongs[0],
        name: 'Amazing Grace (Updated)',
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act: Import songs
      const result = await importService.importAllSongs(progressCallback);

      // Assert: Song should be updated (matched by URL)
      expect(result.success).toBe(true);
      expect(result.stats.updated).toBe(1);
      expect(result.stats.created).toBe(0);
      expect(songService.updateSong).toHaveBeenCalledWith('song-1', {
        name: 'Amazing Grace (Updated)',
        sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
      });
    });

    it('should match existing song by name when URL does not match', async () => {
      // Arrange: Existing song with different URL
      const existingSongs: Song[] = [
        {
          id: 'song-1',
          name: 'Amazing Grace',
          sairhythmsUrl: 'https://sairhythms.org/old-url/amazing-grace',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      // Discovered song with new URL but same name
      const discoveredSongs = [
        {
          name: 'Amazing Grace',
          url: 'https://sairhythms.org/song/amazing-grace',
        },
      ];

      vi.mocked(songService.getAllSongs).mockResolvedValue(existingSongs);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.updateSong).mockResolvedValue({
        ...existingSongs[0],
        sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert: Song should be updated (matched by name)
      expect(result.success).toBe(true);
      expect(result.stats.updated).toBe(1);
      expect(result.stats.created).toBe(0);
      expect(songService.updateSong).toHaveBeenCalledWith('song-1', {
        name: 'Amazing Grace',
        sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
      });
    });

    it('should match by name case-insensitively', async () => {
      // Arrange: Existing song with lowercase name
      const existingSongs: Song[] = [
        {
          id: 'song-1',
          name: 'amazing grace',
          sairhythmsUrl: 'https://sairhythms.org/song/old',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      // Discovered song with mixed case name
      const discoveredSongs = [
        {
          name: 'Amazing Grace',
          url: 'https://sairhythms.org/song/amazing-grace',
        },
      ];

      vi.mocked(songService.getAllSongs).mockResolvedValue(existingSongs);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.updateSong).mockResolvedValue({
        ...existingSongs[0],
        name: 'Amazing Grace',
        sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert: Should match despite case difference
      expect(result.success).toBe(true);
      expect(result.stats.updated).toBe(1);
      expect(result.stats.created).toBe(0);
    });

    it('should prioritize URL matching over name matching', async () => {
      // Arrange: Two existing songs
      const existingSongs: Song[] = [
        {
          id: 'song-1',
          name: 'Amazing Grace',
          sairhythmsUrl: 'https://sairhythms.org/song/different',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'song-2',
          name: 'Different Song',
          sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      // Discovered song matches song-2 by URL and song-1 by name
      const discoveredSongs = [
        {
          name: 'Amazing Grace',
          url: 'https://sairhythms.org/song/amazing-grace',
        },
      ];

      vi.mocked(songService.getAllSongs).mockResolvedValue(existingSongs);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.updateSong).mockResolvedValue({
        ...existingSongs[1],
        name: 'Amazing Grace',
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert: Should match song-2 by URL (not song-1 by name)
      expect(result.success).toBe(true);
      expect(songService.updateSong).toHaveBeenCalledWith('song-2', {
        name: 'Amazing Grace',
        sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
      });
    });
  });

  describe('ID preservation for existing songs', () => {
    it('should preserve song ID when updating existing song', async () => {
      // Arrange
      const existingSongs: Song[] = [
        {
          id: 'original-id-123',
          name: 'Test Song',
          sairhythmsUrl: 'https://sairhythms.org/song/test',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const discoveredSongs = [
        {
          name: 'Test Song Updated',
          url: 'https://sairhythms.org/song/test',
        },
      ];

      vi.mocked(songService.getAllSongs).mockResolvedValue(existingSongs);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.updateSong).mockResolvedValue({
        ...existingSongs[0],
        name: 'Test Song Updated',
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      await importService.importAllSongs(progressCallback);

      // Assert: updateSong should be called with original ID
      expect(songService.updateSong).toHaveBeenCalledWith('original-id-123', {
        name: 'Test Song Updated',
        sairhythmsUrl: 'https://sairhythms.org/song/test',
      });
      expect(songService.createSong).not.toHaveBeenCalled();
    });

    it('should update multiple existing songs while preserving their IDs', async () => {
      // Arrange
      const existingSongs: Song[] = [
        {
          id: 'id-1',
          name: 'Song One',
          sairhythmsUrl: 'https://sairhythms.org/song/one',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'id-2',
          name: 'Song Two',
          sairhythmsUrl: 'https://sairhythms.org/song/two',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const discoveredSongs = [
        { name: 'Song One Updated', url: 'https://sairhythms.org/song/one' },
        { name: 'Song Two Updated', url: 'https://sairhythms.org/song/two' },
      ];

      vi.mocked(songService.getAllSongs).mockResolvedValue(existingSongs);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.updateSong)
        .mockResolvedValueOnce({ ...existingSongs[0], name: 'Song One Updated', updatedAt: new Date() })
        .mockResolvedValueOnce({ ...existingSongs[1], name: 'Song Two Updated', updatedAt: new Date() });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.stats.updated).toBe(2);
      expect(songService.updateSong).toHaveBeenCalledWith('id-1', expect.any(Object));
      expect(songService.updateSong).toHaveBeenCalledWith('id-2', expect.any(Object));
    });
  });

  describe('new song creation', () => {
    it('should create new song when no match is found', async () => {
      // Arrange: Empty database
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        {
          name: 'New Song',
          url: 'https://sairhythms.org/song/new-song',
        },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.createSong).mockResolvedValue({
        id: 'new-id',
        name: 'New Song',
        sairhythmsUrl: 'https://sairhythms.org/song/new-song',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats.created).toBe(1);
      expect(result.stats.updated).toBe(0);
      expect(songService.createSong).toHaveBeenCalledWith({
        name: 'New Song',
        sairhythmsUrl: 'https://sairhythms.org/song/new-song',
      });
    });

    it('should create multiple new songs', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        { name: 'Song A', url: 'https://sairhythms.org/song/a' },
        { name: 'Song B', url: 'https://sairhythms.org/song/b' },
        { name: 'Song C', url: 'https://sairhythms.org/song/c' },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.createSong)
        .mockResolvedValueOnce({ id: 'id-a', name: 'Song A', sairhythmsUrl: 'https://sairhythms.org/song/a', createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ id: 'id-b', name: 'Song B', sairhythmsUrl: 'https://sairhythms.org/song/b', createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ id: 'id-c', name: 'Song C', sairhythmsUrl: 'https://sairhythms.org/song/c', createdAt: new Date(), updatedAt: new Date() });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats.created).toBe(3);
      expect(result.stats.updated).toBe(0);
      expect(songService.createSong).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed scenario: some new, some existing songs', async () => {
      // Arrange
      const existingSongs: Song[] = [
        {
          id: 'existing-1',
          name: 'Existing Song',
          sairhythmsUrl: 'https://sairhythms.org/song/existing',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const discoveredSongs = [
        { name: 'Existing Song', url: 'https://sairhythms.org/song/existing' },
        { name: 'New Song', url: 'https://sairhythms.org/song/new' },
      ];

      vi.mocked(songService.getAllSongs).mockResolvedValue(existingSongs);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.updateSong).mockResolvedValue({
        ...existingSongs[0],
        updatedAt: new Date(),
      });
      vi.mocked(songService.createSong).mockResolvedValue({
        id: 'new-id',
        name: 'New Song',
        sairhythmsUrl: 'https://sairhythms.org/song/new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats.created).toBe(1);
      expect(result.stats.updated).toBe(1);
      expect(result.stats.processed).toBe(2);
    });
  });

  describe('error collection', () => {
    it('should collect errors without stopping import process', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        { name: 'Song 1', url: 'https://sairhythms.org/song/1' },
        { name: 'Song 2', url: 'https://sairhythms.org/song/2' },
        { name: 'Song 3', url: 'https://sairhythms.org/song/3' },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      
      // Song 2 will fail
      vi.mocked(songService.createSong)
        .mockResolvedValueOnce({ id: 'id-1', name: 'Song 1', sairhythmsUrl: 'https://sairhythms.org/song/1', createdAt: new Date(), updatedAt: new Date() })
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockResolvedValueOnce({ id: 'id-3', name: 'Song 3', sairhythmsUrl: 'https://sairhythms.org/song/3', createdAt: new Date(), updatedAt: new Date() });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert: Import should continue despite error
      expect(result.success).toBe(true);
      expect(result.stats.created).toBe(2);
      expect(result.stats.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        songName: 'Song 2',
        error: 'Database connection failed',
      });
    });

    it('should collect multiple errors', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        { name: 'Song 1', url: 'https://sairhythms.org/song/1' },
        { name: 'Song 2', url: 'https://sairhythms.org/song/2' },
        { name: 'Song 3', url: 'https://sairhythms.org/song/3' },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      
      // Songs 1 and 3 will fail
      vi.mocked(songService.createSong)
        .mockRejectedValueOnce(new Error('Validation error'))
        .mockResolvedValueOnce({ id: 'id-2', name: 'Song 2', sairhythmsUrl: 'https://sairhythms.org/song/2', createdAt: new Date(), updatedAt: new Date() })
        .mockRejectedValueOnce(new Error('Network timeout'));

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats.created).toBe(1);
      expect(result.stats.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].songName).toBe('Song 1');
      expect(result.errors[0].error).toBe('Validation error');
      expect(result.errors[1].songName).toBe('Song 3');
      expect(result.errors[1].error).toBe('Network timeout');
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        { name: 'Song 1', url: 'https://sairhythms.org/song/1' },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.createSong).mockRejectedValueOnce('String error');

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.errors[0].error).toBe('Unknown error');
    });

    it('should report progress after each error', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        { name: 'Song 1', url: 'https://sairhythms.org/song/1' },
        { name: 'Song 2', url: 'https://sairhythms.org/song/2' },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.createSong)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      const progressCallback = vi.fn();

      // Act
      await importService.importAllSongs(progressCallback);

      // Assert: Progress should be reported after each song (including errors)
      expect(progressCallback).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenNthCalledWith(1, expect.objectContaining({
        failed: 1,
        currentSong: 'Song 1',
      }));
      expect(progressCallback).toHaveBeenNthCalledWith(2, expect.objectContaining({
        failed: 2,
        currentSong: 'Song 2',
      }));
    });
  });

  describe('progress reporting', () => {
    it('should report progress after each song', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        { name: 'Song 1', url: 'https://sairhythms.org/song/1' },
        { name: 'Song 2', url: 'https://sairhythms.org/song/2' },
        { name: 'Song 3', url: 'https://sairhythms.org/song/3' },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.createSong)
        .mockResolvedValueOnce({ id: 'id-1', name: 'Song 1', sairhythmsUrl: 'https://sairhythms.org/song/1', createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ id: 'id-2', name: 'Song 2', sairhythmsUrl: 'https://sairhythms.org/song/2', createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ id: 'id-3', name: 'Song 3', sairhythmsUrl: 'https://sairhythms.org/song/3', createdAt: new Date(), updatedAt: new Date() });

      const progressCallback = vi.fn();

      // Act
      await importService.importAllSongs(progressCallback);

      // Assert
      expect(progressCallback).toHaveBeenCalledTimes(3);
      
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        total: 3,
        processed: 1,
        created: 1,
        updated: 0,
        failed: 0,
        currentSong: 'Song 1',
      });
      
      expect(progressCallback).toHaveBeenNthCalledWith(2, {
        total: 3,
        processed: 2,
        created: 2,
        updated: 0,
        failed: 0,
        currentSong: 'Song 2',
      });
      
      expect(progressCallback).toHaveBeenNthCalledWith(3, {
        total: 3,
        processed: 3,
        created: 3,
        updated: 0,
        failed: 0,
        currentSong: 'Song 3',
      });
    });

    it('should include current song name in progress updates', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      
      const discoveredSongs = [
        { name: 'Amazing Grace', url: 'https://sairhythms.org/song/amazing-grace' },
      ];

      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue(discoveredSongs);
      vi.mocked(songService.createSong).mockResolvedValue({
        id: 'id-1',
        name: 'Amazing Grace',
        sairhythmsUrl: 'https://sairhythms.org/song/amazing-grace',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      await importService.importAllSongs(progressCallback);

      // Assert
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentSong: 'Amazing Grace',
        })
      );
    });

    it('should clear current song after completion', async () => {
      // Arrange
      vi.mocked(songService.getAllSongs).mockResolvedValue([]);
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue([
        { name: 'Song 1', url: 'https://sairhythms.org/song/1' },
      ]);
      vi.mocked(songService.createSong).mockResolvedValue({
        id: 'id-1',
        name: 'Song 1',
        sairhythmsUrl: 'https://sairhythms.org/song/1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.stats.currentSong).toBeNull();
    });
  });

  describe('critical errors', () => {
    it('should handle scraper failure gracefully', async () => {
      // Arrange
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockRejectedValue(
        new Error('Failed to fetch sairhythms.org')
      );

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].songName).toBe('System');
      expect(result.errors[0].error).toBe('Failed to fetch sairhythms.org');
    });

    it('should handle database fetch failure', async () => {
      // Arrange
      vi.mocked(sairhythmsScraperService.discoverAllSongs).mockResolvedValue([
        { name: 'Song 1', url: 'https://sairhythms.org/song/1' },
      ]);
      vi.mocked(songService.getAllSongs).mockRejectedValue(
        new Error('Database connection failed')
      );

      const progressCallback = vi.fn();

      // Act
      const result = await importService.importAllSongs(progressCallback);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors[0].error).toBe('Database connection failed');
    });
  });
});
