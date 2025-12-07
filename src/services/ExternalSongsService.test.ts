import { describe, it, expect, beforeEach, vi } from 'vitest';
import { externalsongsService } from './ExternalSongsService';

describe('ExternalSongsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log and console.error in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('fetchSongData', () => {
    it('should return null for empty URL', async () => {
      const result = await externalsongsService.fetchSongData('');

      expect(result).toBeNull();
    });

    it('should return null for non-ExternalSongs URL', async () => {
      const result = await externalsongsService.fetchSongData('https://example.com/song');

      expect(result).toBeNull();
    });

    it('should return null for invalid URL', async () => {
      const result = await externalsongsService.fetchSongData('not-a-url');

      expect(result).toBeNull();
    });

    it('should accept externalsongs.org URL (returns null - TODO implementation)', async () => {
      const result = await externalsongsService.fetchSongData('https://externalsongs.org/song/123');

      // Currently returns null because it's a TODO implementation
      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith('Fetching metadata from:', 'https://externalsongs.org/song/123');
    });

    it('should accept www.externalsongs.org URL', async () => {
      const result = await externalsongsService.fetchSongData('https://www.externalsongs.org/song/456');

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith('Fetching metadata from:', 'https://www.externalsongs.org/song/456');
    });

    it('should reject URL with wrong hostname', async () => {
      const result = await externalsongsService.fetchSongData('https://fake-externalsongs.com/song');

      expect(result).toBeNull();
    });

    it('should handle URL with query parameters', async () => {
      const result = await externalsongsService.fetchSongData('https://externalsongs.org/song?id=123');

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith('Fetching metadata from:', 'https://externalsongs.org/song?id=123');
    });

    it('should handle URL with hash', async () => {
      const result = await externalsongsService.fetchSongData('https://externalsongs.org/song#section');

      expect(result).toBeNull();
    });
  });
});
