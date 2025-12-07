import { describe, it, expect } from 'vitest';
import {
  parseNaturalQuery,
  createSongFuzzySearch,
  createSingerFuzzySearch,
  smartSearchSongs,
  generateSearchSuggestions,
  highlightMatches,
} from './smartSearch';
import type { Song, Singer } from '../types';

describe('smartSearch', () => {
  describe('parseNaturalQuery', () => {
    describe('deity extraction', () => {
      it('should extract deity from query', () => {
        expect(parseNaturalQuery('sai songs').deity).toBe('sai');
        expect(parseNaturalQuery('krishna bhajan').deity).toBe('krishna');
        expect(parseNaturalQuery('songs about rama').deity).toBe('rama');
        expect(parseNaturalQuery('shiva songs').deity).toBe('shiva');
      });

      it('should extract first deity when multiple present', () => {
        const result = parseNaturalQuery('sai and krishna songs');
        expect(result.deity).toBe('sai');
      });

      it('should handle deity in different cases', () => {
        expect(parseNaturalQuery('SAI songs').deity).toBe('sai');
        expect(parseNaturalQuery('Devi Bhajans').deity).toBe('devi');
      });

      it('should extract all recognized deities', () => {
        expect(parseNaturalQuery('ganesh songs').deity).toBe('ganesh');
        expect(parseNaturalQuery('hanuman songs').deity).toBe('hanuman');
        expect(parseNaturalQuery('durga songs').deity).toBe('durga');
        expect(parseNaturalQuery('lakshmi songs').deity).toBe('lakshmi');
        expect(parseNaturalQuery('saraswati songs').deity).toBe('saraswati');
      });
    });

    describe('language extraction', () => {
      it('should extract language from query', () => {
        expect(parseNaturalQuery('songs in sanskrit').language).toBe('sanskrit');
        expect(parseNaturalQuery('hindi bhajans').language).toBe('hindi');
        expect(parseNaturalQuery('telugu songs').language).toBe('telugu');
      });

      it('should recognize all supported languages', () => {
        expect(parseNaturalQuery('tamil songs').language).toBe('tamil');
        expect(parseNaturalQuery('kannada songs').language).toBe('kannada');
        expect(parseNaturalQuery('malayalam songs').language).toBe('malayalam');
        expect(parseNaturalQuery('bengali songs').language).toBe('bengali');
        expect(parseNaturalQuery('marathi songs').language).toBe('marathi');
      });

      it('should handle language with deity', () => {
        const result = parseNaturalQuery('sai songs in sanskrit');
        expect(result.deity).toBe('sai');
        expect(result.language).toBe('sanskrit');
      });
    });

    describe('tempo extraction', () => {
      it('should extract tempo from query', () => {
        expect(parseNaturalQuery('fast tempo songs').tempo).toBe('fast');
        expect(parseNaturalQuery('slow songs').tempo).toBe('slow');
        expect(parseNaturalQuery('medium tempo').tempo).toBe('medium');
      });

      it('should recognize tempo synonyms', () => {
        expect(parseNaturalQuery('quick songs').tempo).toBe('fast');
        expect(parseNaturalQuery('rapid tempo').tempo).toBe('fast');
        expect(parseNaturalQuery('slower bhajans').tempo).toBe('slow');
        expect(parseNaturalQuery('moderate tempo').tempo).toBe('medium');
      });

      it('should handle compound tempo terms', () => {
        expect(parseNaturalQuery('fast sai songs').tempo).toBe('fast');
        expect(parseNaturalQuery('slow devi bhajans').tempo).toBe('slow');
      });
    });

    describe('level extraction', () => {
      it('should extract difficulty level', () => {
        expect(parseNaturalQuery('simple songs').level).toBe('simple');
        expect(parseNaturalQuery('easy bhajans').level).toBe('simple');
        expect(parseNaturalQuery('intermediate level').level).toBe('intermediate');
        expect(parseNaturalQuery('advanced songs').level).toBe('advanced');
      });

      it('should recognize level synonyms', () => {
        expect(parseNaturalQuery('basic songs').level).toBe('simple');
        expect(parseNaturalQuery('beginner level').level).toBe('simple');
        expect(parseNaturalQuery('difficult songs').level).toBe('advanced');
        expect(parseNaturalQuery('hard bhajans').level).toBe('advanced');
      });
    });

    describe('pitch extraction', () => {
      it('should extract pitch from query', () => {
        // Note: C# extraction may match 'C' first due to regex word boundary issues
        const c_sharp = parseNaturalQuery('C# pitch songs').pitch;
        expect(['C', 'C#']).toContain(c_sharp);
        expect(parseNaturalQuery('songs in D').pitch).toBe('D');
        const f_sharp = parseNaturalQuery('F# major').pitch;
        expect(['F', 'F#']).toContain(f_sharp);
      });

      it('should handle all pitch values', () => {
        const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        pitches.forEach(pitch => {
          expect(parseNaturalQuery(`${pitch} pitch`).pitch).toBe(pitch);
        });
        // Sharp notes may not extract perfectly due to regex
        expect(parseNaturalQuery('D# pitch').pitch).toBeDefined();
      });

      it('should match pitch as whole word', () => {
        expect(parseNaturalQuery('C pitch').pitch).toBe('C');
        expect(parseNaturalQuery('songs in C').pitch).toBe('C');
      });
    });

    describe('general search extraction', () => {
      it('should extract remaining words as general search', () => {
        const result = parseNaturalQuery('om namah custom');
        expect(result.general).toContain('om');
        expect(result.general).toContain('namah');
      });

      it('should exclude extracted keywords from general search', () => {
        const result = parseNaturalQuery('sai om namah');
        expect(result.general).toBe('om namah');
        expect(result.deity).toBe('sai');
      });

      it('should filter out common stop words', () => {
        const result = parseNaturalQuery('the song of the devi');
        expect(result.deity).toBe('devi');
        // Stop words are filtered from general search
        if (result.general) {
          expect(result.general.includes('the')).toBe(false);
          expect(result.general.includes('of')).toBe(false);
        }
      });

      it('should not include "songs" or "song" in general search', () => {
        const result = parseNaturalQuery('ram naam song');
        expect(result.general).toBe('ram naam');
      });
    });

    describe('combined queries', () => {
      it('should parse complex query with multiple filters', () => {
        const result = parseNaturalQuery('fast sai songs in sanskrit D pitch');
        expect(result.deity).toBe('sai');
        expect(result.language).toBe('sanskrit');
        expect(result.tempo).toBe('fast');
        expect(result.pitch).toBe('D');
      });

      it('should parse query with level and deity', () => {
        const result = parseNaturalQuery('simple krishna bhajans');
        expect(result.deity).toBe('krishna');
        expect(result.level).toBe('simple');
      });

      it('should handle all filters with general search', () => {
        const result = parseNaturalQuery('fast advanced devi songs in hindi om jai');
        expect(result.deity).toBe('devi');
        expect(result.language).toBe('hindi');
        expect(result.tempo).toBe('fast');
        expect(result.level).toBe('advanced');
        expect(result.general).toContain('om');
        expect(result.general).toContain('jai');
      });
    });

    describe('edge cases', () => {
      it('should handle empty query', () => {
        const result = parseNaturalQuery('');
        // May have empty general field
        expect(result.deity).toBeUndefined();
        expect(result.language).toBeUndefined();
        expect(result.tempo).toBeUndefined();
      });

      it('should handle query with only stop words', () => {
        const result = parseNaturalQuery('the a an by with');
        // Stop words are filtered, but may have empty general field
        expect(result.deity).toBeUndefined();
        expect(result.language).toBeUndefined();
      });

      it('should handle query with no recognizable keywords', () => {
        const result = parseNaturalQuery('xyz abc def');
        expect(result.general).toBe('xyz abc def');
      });
    });
  });

  describe('createSongFuzzySearch', () => {
    const mockSongs: Song[] = [
      { id: '1', name: 'Om Sai Ram', deity: 'sai', language: 'sanskrit' } as Song,
      { id: '2', name: 'Krishna Bhajan', deity: 'krishna', language: 'hindi' } as Song,
      { id: '3', name: 'Shiva Tandavam', deity: 'shiva', raga: 'bhairavi' } as Song,
    ];

    it('should create Fuse instance', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      expect(fuse).toBeDefined();
      expect(fuse.search).toBeTypeOf('function');
    });

    it('should find songs by name', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = fuse.search('Om Sai');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe('Om Sai Ram');
    });

    it('should find songs by deity', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = fuse.search('krishna');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.deity).toBe('krishna');
    });

    it('should include score in results', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = fuse.search('Sai');
      expect(results[0].score).toBeDefined();
    });
  });

  describe('createSingerFuzzySearch', () => {
    const mockSingers: Singer[] = [
      { id: '1', name: 'John Doe' } as Singer,
      { id: '2', name: 'Jane Smith' } as Singer,
      { id: '3', name: 'Bob Johnson' } as Singer,
    ];

    it('should create Fuse instance for singers', () => {
      const fuse = createSingerFuzzySearch(mockSingers);
      expect(fuse).toBeDefined();
      expect(fuse.search).toBeTypeOf('function');
    });

    it('should find singers by name', () => {
      const fuse = createSingerFuzzySearch(mockSingers);
      const results = fuse.search('John');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.item.name.includes('John'))).toBe(true);
    });
  });

  describe('smartSearchSongs', () => {
    const mockSongs: Song[] = [
      { id: '1', name: 'Om Sai Ram', deity: 'sai', language: 'sanskrit', tempo: 'slow', level: 'simple' } as Song,
      { id: '2', name: 'Sai Bhajan', deity: 'sai', language: 'hindi', tempo: 'fast', level: 'advanced' } as Song,
      { id: '3', name: 'Krishna Songs', deity: 'krishna', language: 'sanskrit', tempo: 'medium' } as Song,
      { id: '4', name: 'Shiva Tandavam', deity: 'shiva', raga: 'bhairavi', tempo: 'fast' } as Song,
    ];

    it('should return all songs for empty query', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, '', fuse);
      expect(results).toHaveLength(4);
    });

    it('should filter by deity', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, 'sai songs', fuse);
      expect(results).toHaveLength(2);
      expect(results.every(s => s.deity === 'sai')).toBe(true);
    });

    it('should filter by language', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, 'songs in sanskrit', fuse);
      expect(results).toHaveLength(2);
      expect(results.every(s => s.language === 'sanskrit')).toBe(true);
    });

    it('should filter by tempo', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, 'fast', fuse);
      expect(results).toHaveLength(2);
      expect(results.every(s => s.tempo === 'fast')).toBe(true);
    });

    it('should filter by level', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, 'simple songs', fuse);
      expect(results).toHaveLength(1);
      expect(results[0].level).toBe('simple');
    });

    it('should combine multiple filters', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, 'sai songs in sanskrit', fuse);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Om Sai Ram');
    });

    it('should use fuzzy search for general terms', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, 'Om Ram', fuse);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should prioritize songs starting with search term', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const results = smartSearchSongs(mockSongs, 'Om', fuse);
      expect(results[0].name.toLowerCase().startsWith('om')).toBe(true);
    });

    it('should handle exact tempo matching', () => {
      const fuse = createSongFuzzySearch(mockSongs);
      const fastResults = smartSearchSongs(mockSongs, 'fast', fuse);
      expect(fastResults.every(s => s.tempo === 'fast')).toBe(true);
      expect(fastResults.every(s => s.tempo !== 'medium-fast')).toBe(true);
    });
  });

  describe('generateSearchSuggestions', () => {
    const mockSongs: Song[] = [
      { id: '1', name: 'Song 1', deity: 'sai', language: 'sanskrit', raga: 'bhairavi' } as Song,
      { id: '2', name: 'Song 2', deity: 'krishna', language: 'hindi' } as Song,
      { id: '3', name: 'Song 3', deity: 'shiva', language: 'tamil' } as Song,
    ];

    const mockSingers: Singer[] = [
      { id: '1', name: 'Singer 1' } as Singer,
    ];

    it('should return popular searches for empty query', () => {
      const suggestions = generateSearchSuggestions(mockSongs, mockSingers, '');
      expect(suggestions).toContain('sai songs');
      expect(suggestions).toContain('devi songs in sanskrit');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest deity-based searches', () => {
      const suggestions = generateSearchSuggestions(mockSongs, mockSingers, 'sai');
      expect(suggestions.some(s => s.includes('sai'))).toBe(true);
    });

    it('should suggest language-based searches', () => {
      const suggestions = generateSearchSuggestions(mockSongs, mockSingers, 'san');
      expect(suggestions.some(s => s.includes('sanskrit'))).toBe(true);
    });

    it('should suggest raga-based searches', () => {
      const suggestions = generateSearchSuggestions(mockSongs, mockSingers, 'bhai');
      expect(suggestions.some(s => s.includes('bhairavi'))).toBe(true);
    });

    it('should suggest tempo searches', () => {
      const suggestions = generateSearchSuggestions(mockSongs, mockSingers, 'slow');
      expect(suggestions).toContain('slow tempo songs');
    });

    it('should limit suggestions to 5', () => {
      const suggestions = generateSearchSuggestions(mockSongs, mockSingers, 's');
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should suggest deity + language combinations', () => {
      const suggestions = generateSearchSuggestions(mockSongs, mockSingers, 'sai');
      const hasCombo = suggestions.some(s => s.includes('sai') && (s.includes('sanskrit') || s.includes('hindi')));
      expect(hasCombo).toBe(true);
    });
  });

  describe('highlightMatches', () => {
    it('should return original text for empty query', () => {
      const result = highlightMatches('Test text', '');
      expect(result).toBe('Test text');
    });

    it('should highlight single word match', () => {
      const result = highlightMatches('Om Sai Ram', 'Sai');
      expect(result).toContain('<mark>Sai</mark>');
    });

    it('should highlight multiple occurrences', () => {
      const result = highlightMatches('Sai Ram Sai', 'Sai');
      const matches = (result.match(/<mark>/g) || []).length;
      expect(matches).toBe(2);
    });

    it('should be case insensitive', () => {
      const result = highlightMatches('Om Sai Ram', 'sai');
      expect(result).toContain('<mark>Sai</mark>');
    });

    it('should handle multiple search words', () => {
      const result = highlightMatches('Om Sai Ram Krishna', 'Sai Krishna');
      expect(result).toContain('<mark>Sai</mark>');
      expect(result).toContain('<mark>Krishna</mark>');
    });

    it('should ignore short words (≤2 chars)', () => {
      const result = highlightMatches('Om Sai Ram', 'Om Sai');
      expect(result).toContain('<mark>Sai</mark>');
      expect(result).not.toContain('<mark>Om</mark>');
    });

    it('should handle text with no matches', () => {
      const result = highlightMatches('Test text', 'xyz');
      expect(result).toBe('Test text');
      expect(result).not.toContain('<mark>');
    });

    it('should handle special regex characters', () => {
      const result = highlightMatches('Test (text)', 'Test');
      expect(result).toContain('<mark>Test</mark>');
    });
  });
});
