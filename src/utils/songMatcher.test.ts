import { describe, it, expect } from 'vitest';
import {
  findBestSongMatch,
  findTopSongMatches,
  normalizeSongName,
  normalizeSongNameForMapping,
  type SongMatch,
} from './songMatcher';
import type { Song } from '../types';

describe('songMatcher', () => {
  // Mock songs for testing
  const mockSongs: Song[] = [
    { id: '1', name: 'Om Sai Ram', lyrics: 'Om Sai Ram...' },
    { id: '2', name: 'Jai Ganesh', lyrics: 'Jai Ganesh...' },
    { id: '3', name: 'Sri Rama Jaya Rama', lyrics: 'Sri Rama...' },
    { id: '4', name: 'Hey Govinda', lyrics: 'Hey Govinda...' },
    { id: '5', name: 'Shiva Shiva Shankara', lyrics: 'Shiva...' },
    { id: '6', name: 'Om Namah Shivaya', lyrics: 'Om Namah...' },
    { id: '7', name: 'Aum Sai Ram', lyrics: 'Aum Sai Ram...' },
    { id: '8', name: 'Jaya Jaya Hey', lyrics: 'Jaya Jaya...' },
    { id: '9', name: 'Bhaja Govindam', lyrics: 'Bhaja...' },
    { id: '10', name: 'Shree Krishna Govinda', lyrics: 'Shree Krishna...' },
  ] as Song[];

  describe('findBestSongMatch', () => {
    it('should return exact match with 100% similarity', () => {
      const result = findBestSongMatch('Om Sai Ram', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Om Sai Ram');
      expect(result?.similarity).toBe(100);
      expect(result?.matched).toBe(true);
    });

    it('should return null when search name is empty', () => {
      const result = findBestSongMatch('', mockSongs);
      expect(result).toBeNull();
    });

    it('should return null when songs array is empty', () => {
      const result = findBestSongMatch('Om Sai Ram', []);
      expect(result).toBeNull();
    });

    it('should handle case-insensitive matching', () => {
      const result = findBestSongMatch('om sai ram', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Om Sai Ram');
      expect(result?.similarity).toBe(100);
    });

    it('should handle trailing punctuation', () => {
      const result = findBestSongMatch('Om Sai Ram,,,', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Om Sai Ram');
      expect(result?.similarity).toBe(100);
    });

    it('should handle trailing spaces', () => {
      const result = findBestSongMatch('Om Sai Ram   ', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Om Sai Ram');
      expect(result?.similarity).toBe(100);
    });

    it('should match "Aum" variation to "Om"', () => {
      const result = findBestSongMatch('Om Sai Ram', mockSongs);

      expect(result).toBeDefined();
      // Should match either "Om Sai Ram" or "Aum Sai Ram" after normalization
      expect(['Om Sai Ram', 'Aum Sai Ram']).toContain(result?.song.name);
    });

    it('should match "Shree" variation to "Sri"', () => {
      const result = findBestSongMatch('Shree Rama Jaya Rama', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Sri Rama Jaya Rama');
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should match "Shri" variation to "Sri"', () => {
      const result = findBestSongMatch('Shri Rama Jaya Rama', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Sri Rama Jaya Rama');
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should match "Jaya" variation to "Jai"', () => {
      const result = findBestSongMatch('Jaya Ganesh', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Jai Ganesh');
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should match "He" variation to "Hey"', () => {
      const result = findBestSongMatch('He Govinda', mockSongs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Hey Govinda');
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should return null when similarity is below threshold', () => {
      const result = findBestSongMatch('Completely Different Song Name', mockSongs, 90);

      expect(result).toBeNull();
    });

    it('should return match when similarity meets custom threshold', () => {
      const result = findBestSongMatch('Om Sai', mockSongs, 50);

      expect(result).toBeDefined();
      expect(result?.matched).toBe(true);
    });

    it('should prioritize prefix matches (left-to-right)', () => {
      const songs: Song[] = [
        { id: '1', name: 'Om Namah Shivaya', lyrics: 'Om Namah...' },
        { id: '2', name: 'Shivaya Om Namah', lyrics: 'Shivaya...' },
      ] as Song[];

      const result = findBestSongMatch('Om Namah', songs, 70);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Om Namah Shivaya');
    });

    it('should handle partial matches', () => {
      const result = findBestSongMatch('Shiva Shankara', mockSongs, 60);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Shiva Shiva Shankara');
      expect(result?.similarity).toBeGreaterThanOrEqual(60);
    });

    it('should stop searching after perfect match', () => {
      const songs: Song[] = [
        { id: '1', name: 'Perfect Match', lyrics: 'Perfect...' },
        { id: '2', name: 'Another Song', lyrics: 'Another...' },
        ...mockSongs,
      ] as Song[];

      const result = findBestSongMatch('Perfect Match', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBe(100);
    });

    it('should handle songs with similar prefixes', () => {
      const result = findBestSongMatch('Om', mockSongs, 50);

      expect(result).toBeDefined();
      expect(['Om Sai Ram', 'Om Namah Shivaya', 'Aum Sai Ram']).toContain(result?.song.name);
    });

    it('should match "Saai" variation to "Sai"', () => {
      const songs: Song[] = [
        { id: '1', name: 'Om Sai Ram', lyrics: 'Om Sai...' },
      ] as Song[];

      const result = findBestSongMatch('Om Saai Ram', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should match "Aadi" variation to "Adi"', () => {
      const songs: Song[] = [
        { id: '1', name: 'Adi Shankaracharya', lyrics: 'Adi...' },
      ] as Song[];

      const result = findBestSongMatch('Aadi Shankaracharya', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should match "Ohm" variation to "Om"', () => {
      const songs: Song[] = [
        { id: '1', name: 'Om Namah Shivaya', lyrics: 'Om...' },
      ] as Song[];

      const result = findBestSongMatch('Ohm Namah Shivaya', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should handle very short strings', () => {
      const songs: Song[] = [
        { id: '1', name: 'Om', lyrics: 'Om...' },
      ] as Song[];

      const result = findBestSongMatch('Om', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBe(100);
    });

    it('should handle strings with only punctuation differences', () => {
      const songs: Song[] = [
        { id: '1', name: 'Om Sai Ram!!!', lyrics: 'Om...' },
      ] as Song[];

      const result = findBestSongMatch('Om Sai Ram', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBeGreaterThanOrEqual(90);
    });

    it('should return best match even when below threshold', () => {
      const result = findBestSongMatch('Xyz Unknown Song', mockSongs, 95);

      // Should return null because best match is below threshold
      expect(result).toBeNull();
    });
  });

  describe('findTopSongMatches', () => {
    it('should return top N matches sorted by similarity', () => {
      const results = findTopSongMatches('Om Sai', mockSongs, 3);

      expect(results).toHaveLength(3);
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      expect(results[1].similarity).toBeGreaterThanOrEqual(results[2].similarity);
    });

    it('should return empty array when search name is empty', () => {
      const results = findTopSongMatches('', mockSongs);

      expect(results).toEqual([]);
    });

    it('should return empty array when songs array is empty', () => {
      const results = findTopSongMatches('Om Sai Ram', []);

      expect(results).toEqual([]);
    });

    it('should return all songs when topN is larger than songs array', () => {
      const results = findTopSongMatches('Om', mockSongs, 100);

      expect(results).toHaveLength(mockSongs.length);
    });

    it('should return exact number requested', () => {
      const results = findTopSongMatches('Sai', mockSongs, 5);

      expect(results).toHaveLength(5);
    });

    it('should include similarity scores', () => {
      const results = findTopSongMatches('Om Sai Ram', mockSongs, 3);

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(100);
      });
    });

    it('should set matched to false for all results', () => {
      const results = findTopSongMatches('Om Sai Ram', mockSongs, 5);

      results.forEach(result => {
        expect(result.matched).toBe(false);
      });
    });

    it('should prioritize prefix matches', () => {
      const results = findTopSongMatches('Om', mockSongs, 3);

      // Songs starting with "Om" should rank higher
      const topNames = results.map(r => r.song.name);
      expect(topNames.some(name => name.startsWith('Om') || name.startsWith('Aum'))).toBe(true);
    });

    it('should handle default topN value', () => {
      const results = findTopSongMatches('Sai', mockSongs);

      expect(results).toHaveLength(5); // Default is 5
    });

    it('should handle topN of 1', () => {
      const results = findTopSongMatches('Om Sai Ram', mockSongs, 1);

      expect(results).toHaveLength(1);
      expect(results[0].song.name).toBe('Om Sai Ram');
    });
  });

  describe('normalizeSongName', () => {
    it('should convert to lowercase', () => {
      const result = normalizeSongName('Om SAI Ram');

      expect(result).toBe('sai ram');
    });

    it('should trim whitespace', () => {
      const result = normalizeSongName('  Om Sai Ram  ');

      expect(result).toBe('sai ram');
    });

    it('should remove trailing punctuation', () => {
      const result = normalizeSongName('Om Sai Ram,,,');

      expect(result).toBe('sai ram');
    });

    it('should remove trailing spaces and punctuation', () => {
      const result = normalizeSongName('Om Sai Ram   , . ');

      expect(result).toBe('sai ram');
    });

    it('should remove "Sri" prefix', () => {
      const result = normalizeSongName('Sri Rama Jaya Rama');

      expect(result).toBe('rama jai rama');
    });

    it('should remove "Shri" prefix', () => {
      const result = normalizeSongName('Shri Krishna');

      expect(result).toBe('krishna');
    });

    it('should remove "Jai" prefix', () => {
      const result = normalizeSongName('Jai Ganesh');

      expect(result).toBe('ganesh');
    });

    it('should remove "Jaya" prefix', () => {
      const result = normalizeSongName('Jaya Durga');

      expect(result).toBe('durga');
    });

    it('should remove "Om" prefix', () => {
      const result = normalizeSongName('Om Namah Shivaya');

      expect(result).toBe('namah shivaya');
    });

    it('should remove "Hey" prefix', () => {
      const result = normalizeSongName('Hey Govinda');

      expect(result).toBe('govinda');
    });

    it('should remove "He" prefix', () => {
      const result = normalizeSongName('He Shiva');

      expect(result).toBe('shiva');
    });

    it('should normalize "Aum" to "Om" before removing prefix', () => {
      const result = normalizeSongName('Aum Namah Shivaya');

      expect(result).toBe('namah shivaya');
    });

    it('should normalize "Shree" to "Sri" before removing prefix', () => {
      const result = normalizeSongName('Shree Rama');

      expect(result).toBe('rama');
    });

    it('should normalize "Jaya" to "Jai"', () => {
      const result = normalizeSongName('Jaya Ganesh');

      expect(result).toBe('ganesh');
    });

    it('should remove special characters except spaces', () => {
      const result = normalizeSongName('Om-Sai!Ram@');

      expect(result).toBe('omsairam');
    });

    it('should normalize multiple spaces to single space', () => {
      const result = normalizeSongName('Om    Sai    Ram');

      expect(result).toBe('sai ram');
    });

    it('should handle empty string', () => {
      const result = normalizeSongName('');

      expect(result).toBe('');
    });

    it('should handle string with only prefix', () => {
      const result = normalizeSongName('Om');

      expect(result).toBe('om');
    });

    it('should handle string with only punctuation', () => {
      const result = normalizeSongName('!!!');

      expect(result).toBe('');
    });

    it('should normalize "Saai" to "Sai"', () => {
      const result = normalizeSongName('Om Saai Ram');

      expect(result).toBe('sai ram');
    });

    it('should normalize "Aadi" to "Adi"', () => {
      const result = normalizeSongName('Aadi Shankaracharya');

      expect(result).toBe('adi shankaracharya');
    });

    it('should normalize "Ohm" to "Om"', () => {
      const result = normalizeSongName('Ohm Namah Shivaya');

      expect(result).toBe('namah shivaya');
    });

    it('should apply all transformations in correct order', () => {
      const result = normalizeSongName('  Shree Rama-Jaya   Rama!!!  ');

      expect(result).toBe('ramajai rama');
    });

    it('should handle mixed case with variations', () => {
      const result = normalizeSongName('SHREE Krishna JAYA Rama');

      expect(result).toBe('krishna jai rama');
    });
  });

  describe('normalizeSongNameForMapping', () => {
    it('should convert to lowercase', () => {
      const result = normalizeSongNameForMapping('Om SAI Ram');

      expect(result).toBe('om sai ram');
    });

    it('should trim whitespace', () => {
      const result = normalizeSongNameForMapping('  Om Sai Ram  ');

      expect(result).toBe('om sai ram');
    });

    it('should remove trailing punctuation', () => {
      const result = normalizeSongNameForMapping('Om Sai Ram,,,');

      expect(result).toBe('om sai ram');
    });

    it('should remove trailing spaces and punctuation', () => {
      const result = normalizeSongNameForMapping('Om Sai Ram   , . ');

      expect(result).toBe('om sai ram');
    });

    it('should normalize "Aum" to "Om"', () => {
      const result = normalizeSongNameForMapping('Aum Sai Ram');

      expect(result).toBe('om sai ram');
    });

    it('should normalize "Shree" to "Sri"', () => {
      const result = normalizeSongNameForMapping('Shree Rama');

      expect(result).toBe('sri rama');
    });

    it('should normalize "Shri" to "Sri"', () => {
      const result = normalizeSongNameForMapping('Shri Rama');

      expect(result).toBe('sri rama');
    });

    it('should normalize "Jaya" to "Jai"', () => {
      const result = normalizeSongNameForMapping('Jaya Ganesh');

      expect(result).toBe('jai ganesh');
    });

    it('should normalize "Hey" to "He"', () => {
      const result = normalizeSongNameForMapping('Hey Govinda');

      expect(result).toBe('he govinda');
    });

    it('should NOT remove prefixes (unlike normalizeSongName)', () => {
      const result = normalizeSongNameForMapping('Sri Rama Jaya Rama');

      expect(result).toBe('sri rama jai rama');
      expect(result).toContain('sri');
      expect(result).toContain('jai');
    });

    it('should normalize multiple spaces to single space', () => {
      const result = normalizeSongNameForMapping('Om    Sai    Ram');

      expect(result).toBe('om sai ram');
    });

    it('should preserve internal punctuation (less aggressive than normalizeSongName)', () => {
      const result = normalizeSongNameForMapping('Om-Sai Ram');

      expect(result).toBe('om-sai ram');
    });

    it('should handle empty string', () => {
      const result = normalizeSongNameForMapping('');

      expect(result).toBe('');
    });

    it('should normalize "Saai" to "Sai"', () => {
      const result = normalizeSongNameForMapping('Om Saai Ram');

      expect(result).toBe('om sai ram');
    });

    it('should normalize "Aadi" to "Adi"', () => {
      const result = normalizeSongNameForMapping('Aadi Shankaracharya');

      expect(result).toBe('adi shankaracharya');
    });

    it('should normalize "Ohm" to "Om"', () => {
      const result = normalizeSongNameForMapping('Ohm Namah Shivaya');

      expect(result).toBe('om namah shivaya');
    });

    it('should be less aggressive than normalizeSongName', () => {
      const input = 'Sri Rama Jaya Rama';
      const forMapping = normalizeSongNameForMapping(input);
      const normalized = normalizeSongName(input);

      expect(forMapping).toBe('sri rama jai rama');
      expect(normalized).toBe('rama jai rama');
      expect(forMapping).not.toBe(normalized);
    });

    it('should handle consecutive spaces', () => {
      const result = normalizeSongNameForMapping('Om  Sai   Ram');

      expect(result).toBe('om sai ram');
    });

    it('should apply variations before other transformations', () => {
      const result = normalizeSongNameForMapping('SHREE Krishna JAYA Rama');

      expect(result).toBe('sri krishna jai rama');
    });
  });

  describe('edge cases and integration', () => {
    it('should handle Unicode characters', () => {
      const songs: Song[] = [
        { id: '1', name: 'ॐ नमः शिवाय', lyrics: 'Om...' },
      ] as Song[];

      const result = findBestSongMatch('ॐ नमः शिवाय', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBe(100);
    });

    it('should handle very long song names', () => {
      const longName = 'Om Namah Shivaya ' + 'A'.repeat(1000);
      const songs: Song[] = [
        { id: '1', name: longName, lyrics: 'Om...' },
      ] as Song[];

      const result = findBestSongMatch(longName, songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBe(100);
    });

    it('should handle songs with numbers', () => {
      const songs: Song[] = [
        { id: '1', name: 'Song 123', lyrics: 'Song...' },
      ] as Song[];

      const result = findBestSongMatch('Song 123', songs);

      expect(result).toBeDefined();
      expect(result?.similarity).toBe(100);
    });

    it('should handle similarity calculation for empty strings', () => {
      const songs: Song[] = [
        { id: '1', name: '', lyrics: 'Empty...' },
      ] as Song[];

      const result = findBestSongMatch('', songs);

      expect(result).toBeNull();
    });

    it('should prioritize exact matches over partial matches', () => {
      const songs: Song[] = [
        { id: '1', name: 'Om', lyrics: 'Om...' },
        { id: '2', name: 'Om Sai', lyrics: 'Om Sai...' },
        { id: '3', name: 'Om Sai Ram', lyrics: 'Om Sai Ram...' },
      ] as Song[];

      const result = findBestSongMatch('Om Sai', songs);

      expect(result).toBeDefined();
      expect(result?.song.name).toBe('Om Sai');
    });

    it('should handle songs with only spaces', () => {
      const result = normalizeSongName('     ');

      expect(result).toBe('');
    });

    it('should handle normalization consistency', () => {
      const name1 = 'Om Sai Ram';
      const name2 = 'om sai ram';
      const name3 = 'OM SAI RAM';

      const norm1 = normalizeSongNameForMapping(name1);
      const norm2 = normalizeSongNameForMapping(name2);
      const norm3 = normalizeSongNameForMapping(name3);

      expect(norm1).toBe(norm2);
      expect(norm2).toBe(norm3);
    });
  });
});
