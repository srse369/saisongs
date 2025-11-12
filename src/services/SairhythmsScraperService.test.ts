import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sairhythmsScraperService, DiscoveredSong } from './SairhythmsScraperService';

describe('SairhythmsScraperService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('discoverAllSongs', () => {
    it('should extract songs from valid HTML with song links', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="songs">
              <a href="/song/amazing-grace">Amazing Grace</a>
              <a href="/song/how-great-thou-art">How Great Thou Art</a>
              <a href="/songs/blessed-assurance">Blessed Assurance</a>
            </div>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(songs).toHaveLength(3);
      expect(songs).toEqual([
        { name: 'Amazing Grace', url: 'https://sairhythms.org/song/amazing-grace' },
        { name: 'How Great Thou Art', url: 'https://sairhythms.org/song/how-great-thou-art' },
        { name: 'Blessed Assurance', url: 'https://sairhythms.org/songs/blessed-assurance' },
      ]);
    });

    it('should handle absolute URLs correctly', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <a href="https://sairhythms.org/song/joyful-joyful">Joyful Joyful</a>
            <a href="http://sairhythms.org/song/holy-holy-holy">Holy Holy Holy</a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(songs).toHaveLength(2);
      expect(songs[0].url).toBe('https://sairhythms.org/song/joyful-joyful');
      expect(songs[1].url).toBe('http://sairhythms.org/song/holy-holy-holy');
    });

    it('should extract song names from title attribute when text is empty', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <a href="/song/silent-night" title="Silent Night"></a>
            <a href="/song/o-come-all-ye-faithful">O Come All Ye Faithful</a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(songs).toHaveLength(2);
      expect(songs[0].name).toBe('Silent Night');
      expect(songs[1].name).toBe('O Come All Ye Faithful');
    });

    it('should remove duplicate songs by URL', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <a href="/song/amazing-grace">Amazing Grace</a>
            <a href="/song/amazing-grace">Amazing Grace (Duplicate)</a>
            <a href="/song/how-great-thou-art">How Great Thou Art</a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(songs).toHaveLength(2);
      expect(songs.map(s => s.url)).toEqual([
        'https://sairhythms.org/song/amazing-grace',
        'https://sairhythms.org/song/how-great-thou-art',
      ]);
    });

    it('should ignore links without song patterns', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/song/amazing-grace">Amazing Grace</a>
            <a href="/home">Home</a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(songs).toHaveLength(1);
      expect(songs[0].name).toBe('Amazing Grace');
    });

    it('should ignore links without song names', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <a href="/song/amazing-grace">Amazing Grace</a>
            <a href="/song/empty-link"></a>
            <a href="/song/whitespace-only">   </a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(songs).toHaveLength(1);
      expect(songs[0].name).toBe('Amazing Grace');
    });

    it('should handle empty HTML gracefully', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body></body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(songs).toHaveLength(0);
    });

    it('should handle malformed HTML and return partial results', async () => {
      const mockHTML = `
        <html>
          <body>
            <a href="/song/amazing-grace">Amazing Grace</a>
            <div unclosed
            <a href="/song/how-great-thou-art">How Great Thou Art</a>
          </body>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      // DOMParser is forgiving and should still extract songs
      expect(songs.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject URLs from non-sairhythms domains', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <a href="https://example.com/song/test">External Song</a>
            <a href="https://sairhythms.org/song/valid">Valid Song</a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      // Only the sairhythms.org song should be included
      expect(songs).toHaveLength(1);
      expect(songs[0].name).toBe('Valid Song');
      expect(songs[0].url).toBe('https://sairhythms.org/song/valid');
    });
  });

  describe('fetchWithRetry', () => {
    it('should retry on network failure and succeed on second attempt', async () => {
      const mockHTML = '<html><body><a href="/song/test">Test Song</a></body></html>';
      
      let attemptCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          text: async () => mockHTML,
        });
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(songs).toHaveLength(1);
    });

    it('should retry on HTTP error and succeed on third attempt', async () => {
      const mockHTML = '<html><body><a href="/song/test">Test Song</a></body></html>';
      
      let attemptCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        return Promise.resolve({
          ok: true,
          text: async () => mockHTML,
        });
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(songs).toHaveLength(1);
    });

    it('should throw error after max retries exceeded', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(sairhythmsScraperService.discoverAllSongs()).rejects.toThrow(
        /Failed to discover songs from sairhythms.org/
      );

      expect(fetch).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });

    it('should throw error when HTTP status is not ok after all retries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(sairhythmsScraperService.discoverAllSongs()).rejects.toThrow(
        /Failed to discover songs from sairhythms.org/
      );

      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(sairhythmsScraperService.discoverAllSongs()).rejects.toThrow(
        /Failed to discover songs from sairhythms.org.*Connection refused/
      );
    });

    it('should handle invalid response text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => {
          throw new Error('Failed to read response');
        },
      });

      await expect(sairhythmsScraperService.discoverAllSongs()).rejects.toThrow(
        /Failed to discover songs from sairhythms.org/
      );
    });

    it('should continue processing when individual song parsing fails', async () => {
      const mockHTML = `
        <!DOCTYPE html>
        <html>
          <body>
            <a href="/song/valid-song">Valid Song</a>
            <a href="invalid-url-format">Invalid</a>
            <a href="/song/another-valid">Another Valid</a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHTML,
      });

      const songs = await sairhythmsScraperService.discoverAllSongs();

      // Should get the valid songs despite one invalid entry
      expect(songs.length).toBeGreaterThanOrEqual(2);
      expect(songs.some(s => s.name === 'Valid Song')).toBe(true);
      expect(songs.some(s => s.name === 'Another Valid')).toBe(true);
    });
  });
});
