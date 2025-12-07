import { describe, it, expect, vi, beforeEach } from 'vitest';
import { externalsongsDataService } from './ExternalSongsDataService';

describe('ExternalSongsDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Mock DOMParser as a class constructor
    (global as any).DOMParser = class {
      parseFromString = vi.fn();
    };
  });

  describe('fetchSongData', () => {
    it('should fetch and parse song data successfully', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="song-lyrics">Om Sai Namo Namaha</div>
            <div class="translation">Victory to Sai</div>
            <div class="tempo">Medium</div>
            <div class="beat">4/4</div>
            <div class="raga">Hamsadhwani</div>
            <div class="deity">Sai Baba</div>
          </body>
        </html>
      `;

      const mockDoc = {
        querySelector: vi.fn((selector: string) => {
          if (selector.includes('lyrics')) {
            return { textContent: 'Om Sai Namo Namaha' };
          }
          if (selector.includes('translation')) {
            return { textContent: 'Victory to Sai' };
          }
          if (selector.includes('tempo')) {
            return { textContent: 'Medium' };
          }
          if (selector.includes('beat')) {
            return { textContent: '4/4' };
          }
          if (selector.includes('raga')) {
            return { textContent: 'Hamsadhwani' };
          }
          if (selector.includes('deity')) {
            return { textContent: 'Sai Baba' };
          }
          return null;
        }),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const mockParseFromString = vi.fn(() => mockDoc);
      (global as any).DOMParser = class {
        parseFromString = mockParseFromString;
      };

      const result = await externalsongsDataService.fetchSongData('https://externalsongs.org/song/123');

      expect(result).toEqual({
        lyrics: { default: 'Om Sai Namo Namaha' },
        translation: 'Victory to Sai',
        languages: ['default'],
        tempo: 'Medium',
        beat: '4/4',
        raga: 'Hamsadhwani',
        deity: 'Sai Baba',
      });
    });

    it('should handle HTTP error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        externalsongsDataService.fetchSongData('https://externalsongs.org/song/999')
      ).rejects.toThrow('Failed to fetch song data: HTTP 404: Not Found');
    });

    it('should handle missing lyrics element', async () => {
      const mockDoc = {
        querySelector: vi.fn(() => null),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      });

      const mockParseFromString = vi.fn(() => mockDoc);
      (global as any).DOMParser = class {
        parseFromString = mockParseFromString;
      };

      const result = await externalsongsDataService.fetchSongData('https://externalsongs.org/song/123');

      expect(result).toEqual({
        lyrics: {},
        translation: undefined,
        languages: [],
        tempo: undefined,
        beat: undefined,
        raga: undefined,
        deity: undefined,
      });
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        externalsongsDataService.fetchSongData('https://externalsongs.org/song/123')
      ).rejects.toThrow('Failed to fetch song data: Network error');
    });

    it('should trim whitespace from extracted content', async () => {
      const mockDoc = {
        querySelector: vi.fn((selector: string) => {
          if (selector.includes('lyrics')) {
            return { textContent: '  Om Sai Namo Namaha  \n\n' };
          }
          if (selector.includes('translation')) {
            return { textContent: '  Victory to Sai  ' };
          }
          if (selector.includes('tempo')) {
            return { textContent: '  Medium  ' };
          }
          return null;
        }),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      });

      const mockParseFromString = vi.fn(() => mockDoc);
      (global as any).DOMParser = class {
        parseFromString = mockParseFromString;
      };

      const result = await externalsongsDataService.fetchSongData('https://externalsongs.org/song/123');

      expect(result.lyrics.default).toBe('Om Sai Namo Namaha');
      expect(result.translation).toBe('Victory to Sai');
      expect(result.tempo).toBe('Medium');
    });

    it('should handle null textContent', async () => {
      const mockDoc = {
        querySelector: vi.fn((selector: string) => {
          if (selector.includes('lyrics')) {
            return { textContent: null };
          }
          if (selector.includes('translation')) {
            return { textContent: null };
          }
          return null;
        }),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      });

      const mockParseFromString = vi.fn(() => mockDoc);
      (global as any).DOMParser = class {
        parseFromString = mockParseFromString;
      };

      const result = await externalsongsDataService.fetchSongData('https://externalsongs.org/song/123');

      expect(result).toEqual({
        lyrics: { default: '' },
        translation: undefined,
        languages: ['default'],
        tempo: undefined,
        beat: undefined,
        raga: undefined,
        deity: undefined,
      });
    });

    it('should log fetch URL', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const mockDoc = { querySelector: vi.fn(() => null) };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      });

      const mockParseFromString = vi.fn(() => mockDoc);
      (global as any).DOMParser = class {
        parseFromString = mockParseFromString;
      };

      await externalsongsDataService.fetchSongData('https://externalsongs.org/song/123');

      expect(consoleLogSpy).toHaveBeenCalledWith('Fetching song data from: https://externalsongs.org/song/123');
      
      consoleLogSpy.mockRestore();
    });

    it('should handle non-Error thrown values', async () => {
      global.fetch = vi.fn().mockRejectedValue('String error');

      await expect(
        externalsongsDataService.fetchSongData('https://externalsongs.org/song/123')
      ).rejects.toThrow('Failed to fetch song data: Unknown error');
    });
  });
});
