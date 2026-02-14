import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizePitch,
  isRecognizedPitch,
  getUnmappedPitches,
  addPitchMapping,
  removePitchMapping,
  getPitchMappings,
} from './pitchNormalization';

describe('pitchNormalization', () => {
  describe('normalizePitch', () => {
    describe('basic note mappings', () => {
      it('should normalize numeric pitches to notes', () => {
        expect(normalizePitch('1')).toBe('C');
        expect(normalizePitch('2')).toBe('D');
        expect(normalizePitch('3')).toBe('E');
        expect(normalizePitch('4')).toBe('F');
        expect(normalizePitch('5')).toBe('G');
        expect(normalizePitch('6')).toBe('A');
        expect(normalizePitch('7')).toBe('B');
      });

      it('should normalize sharp numeric pitches', () => {
        expect(normalizePitch('1.5')).toBe('C#');
        expect(normalizePitch('2.5')).toBe('D#');
        expect(normalizePitch('3.5')).toBe('F');
        expect(normalizePitch('4.5')).toBe('F#');
        expect(normalizePitch('5.5')).toBe('G#');
        expect(normalizePitch('6.5')).toBe('A#');
        expect(normalizePitch('7.5')).toBe('C');
      });

      it('should preserve already normalized single notes', () => {
        expect(normalizePitch('C')).toBe('C');
        expect(normalizePitch('D')).toBe('D');
        expect(normalizePitch('E')).toBe('E');
        expect(normalizePitch('F')).toBe('F');
        expect(normalizePitch('G')).toBe('G');
        expect(normalizePitch('A')).toBe('A');
        expect(normalizePitch('B')).toBe('B');
      });

      it('should preserve sharp notes', () => {
        expect(normalizePitch('C#')).toBe('C#');
        expect(normalizePitch('D#')).toBe('D#');
        expect(normalizePitch('F#')).toBe('F#');
        expect(normalizePitch('G#')).toBe('G#');
        expect(normalizePitch('A#')).toBe('A#');
      });

      it('should handle lowercase single notes (case-insensitive)', () => {
        expect(normalizePitch('c')).toBe('C');
        expect(normalizePitch('d')).toBe('D');
        expect(normalizePitch('e')).toBe('E');
        expect(normalizePitch('f')).toBe('F');
        expect(normalizePitch('g')).toBe('G');
        expect(normalizePitch('a')).toBe('A');
        expect(normalizePitch('b')).toBe('B');
      });

      it('should handle lowercase sharp notes', () => {
        expect(normalizePitch('c#')).toBe('C#');
        expect(normalizePitch('d#')).toBe('D#');
        expect(normalizePitch('f#')).toBe('F#');
      });

      it('should handle enharmonic equivalents', () => {
        expect(normalizePitch('C(B#)')).toBe('C');
        expect(normalizePitch('FM(E#M)')).toBe('F major');
      });
    });

    describe('major key mappings', () => {
      it('should normalize numeric major keys', () => {
        expect(normalizePitch('1M')).toBe('C major');
        expect(normalizePitch('2M')).toBe('D major');
        expect(normalizePitch('3M')).toBe('E major');
        expect(normalizePitch('4M')).toBe('F major');
        expect(normalizePitch('5M')).toBe('G major');
        expect(normalizePitch('6M')).toBe('A major');
        expect(normalizePitch('7M')).toBe('B major');
      });

      it('should normalize sharp major keys', () => {
        expect(normalizePitch('1.5M')).toBe('C# major');
        expect(normalizePitch('2.5M')).toBe('D# major');
        expect(normalizePitch('4.5M')).toBe('F# major');
        expect(normalizePitch('5.5M')).toBe('G# major');
        expect(normalizePitch('6.5M')).toBe('A# major');
      });

      it('should normalize letter major keys', () => {
        expect(normalizePitch('CM')).toBe('C major');
        expect(normalizePitch('DM')).toBe('D major');
        expect(normalizePitch('EM')).toBe('E major');
        expect(normalizePitch('FM')).toBe('F major');
        expect(normalizePitch('GM')).toBe('G major');
        expect(normalizePitch('AM')).toBe('A major');
        expect(normalizePitch('BM')).toBe('B major');
      });

      it('should normalize letter sharp major keys', () => {
        expect(normalizePitch('C#M')).toBe('C# major');
        expect(normalizePitch('D#M')).toBe('D# major');
        expect(normalizePitch('E#M')).toBe('F major');
        expect(normalizePitch('F#M')).toBe('F# major');
        expect(normalizePitch('G#M')).toBe('G# major');
        expect(normalizePitch('A#M')).toBe('A# major');
        expect(normalizePitch('B#M')).toBe('C major');
      });

      it('should preserve case sensitivity (M = major)', () => {
        expect(normalizePitch('CM')).toBe('C major');
        expect(normalizePitch('Cm')).toBe('C minor');
      });
    });

    describe('minor key mappings', () => {
      it('should normalize numeric minor keys', () => {
        expect(normalizePitch('1m')).toBe('C minor');
        expect(normalizePitch('2m')).toBe('D minor');
        expect(normalizePitch('3m')).toBe('E minor');
        expect(normalizePitch('4m')).toBe('F minor');
        expect(normalizePitch('5m')).toBe('G minor');
        expect(normalizePitch('6m')).toBe('A minor');
        expect(normalizePitch('7m')).toBe('B minor');
      });

      it('should normalize sharp minor keys', () => {
        expect(normalizePitch('1.5m')).toBe('C# minor');
        expect(normalizePitch('2.5m')).toBe('D# minor');
        expect(normalizePitch('4.5m')).toBe('F# minor');
        expect(normalizePitch('5.5m')).toBe('G# minor');
        expect(normalizePitch('6.5m')).toBe('A# minor');
      });

      it('should normalize letter minor keys', () => {
        expect(normalizePitch('Cm')).toBe('C minor');
        expect(normalizePitch('Dm')).toBe('D minor');
        expect(normalizePitch('Em')).toBe('E minor');
        expect(normalizePitch('Fm')).toBe('F minor');
        expect(normalizePitch('Gm')).toBe('G minor');
        expect(normalizePitch('Am')).toBe('A minor');
        expect(normalizePitch('Bm')).toBe('B minor');
      });

      it('should normalize letter sharp minor keys', () => {
        expect(normalizePitch('C#m')).toBe('C# minor');
        expect(normalizePitch('D#m')).toBe('D# minor');
        expect(normalizePitch('E#m')).toBe('F minor');
        expect(normalizePitch('F#m')).toBe('F# minor');
        expect(normalizePitch('G#m')).toBe('G# minor');
        expect(normalizePitch('A#m')).toBe('A# minor');
        expect(normalizePitch('B#m')).toBe('C minor');
      });
    });

    describe('Madhyam notation', () => {
      it('should normalize numeric Madhyam notation', () => {
        expect(normalizePitch('1Madhyam')).toBe('1 Madhyam');
        expect(normalizePitch('2Madhyam')).toBe('2 Madhyam');
        expect(normalizePitch('3Madhyam')).toBe('3 Madhyam');
        expect(normalizePitch('4Madhyam')).toBe('4 Madhyam');
        expect(normalizePitch('5Madhyam')).toBe('5 Madhyam');
        expect(normalizePitch('6Madhyam')).toBe('6 Madhyam');
        expect(normalizePitch('7Madhyam')).toBe('7 Madhyam');
      });

      it('should normalize sharp Madhyam notation', () => {
        expect(normalizePitch('1.5Madhyam')).toBe('1.5 Madhyam');
        expect(normalizePitch('2.5Madhyam')).toBe('2.5 Madhyam');
        expect(normalizePitch('3.5Madhyam')).toBe('3.5 Madhyam');
        expect(normalizePitch('4.5Madhyam')).toBe('4.5 Madhyam');
        expect(normalizePitch('5.5Madhyam')).toBe('5.5 Madhyam');
        expect(normalizePitch('6.5Madhyam')).toBe('6.5 Madhyam');
      });

      it('should handle Madhyam with spaces (cleaned)', () => {
        expect(normalizePitch('1 Madhyam')).toBe('1 Madhyam');
        expect(normalizePitch('2  Madhyam')).toBe('2 Madhyam');
        expect(normalizePitch('3   Madhyam')).toBe('3 Madhyam');
      });
    });

    describe('Pancham format (reference pitches)', () => {
      it('should normalize Pancham / Western combined format', () => {
        expect(normalizePitch('2 Pancham / D')).toBe('D');
        expect(normalizePitch('6 Pancham / A')).toBe('A');
        expect(normalizePitch('1 Pancham / C')).toBe('C');
        expect(normalizePitch('5 Pancham / G')).toBe('G');
      });
      it('should normalize plain Pancham format', () => {
        expect(normalizePitch('2Pancham')).toBe('D');
        expect(normalizePitch('6Pancham')).toBe('A');
      });
    });

    describe('whitespace handling', () => {
      it('should trim leading and trailing whitespace', () => {
        expect(normalizePitch('  C  ')).toBe('C');
        expect(normalizePitch('  1M  ')).toBe('C major');
        expect(normalizePitch('\tD#\t')).toBe('D#');
      });

      it('should remove internal whitespace', () => {
        expect(normalizePitch('C M')).toBe('C major');
        expect(normalizePitch('1 M')).toBe('C major');
        expect(normalizePitch('C # M')).toBe('C# major');
      });

      it('should remove non-breaking spaces', () => {
        expect(normalizePitch('C\u00A0M')).toBe('C major');
        expect(normalizePitch('1\u00A0M')).toBe('C major');
      });

      it('should remove zero-width spaces', () => {
        expect(normalizePitch('C\u200BM')).toBe('C major');
        expect(normalizePitch('1\u200BM')).toBe('C major');
      });

      it('should handle multiple types of whitespace', () => {
        expect(normalizePitch('  C \u00A0 M \t ')).toBe('C major');
      });
    });

    describe('edge cases', () => {
      it('should return null for empty string', () => {
        expect(normalizePitch('')).toBeNull();
      });

      it('should return null for whitespace-only string', () => {
        expect(normalizePitch('   ')).toBeNull();
        expect(normalizePitch('\t\n')).toBeNull();
      });

      it('should return null for unrecognized format', () => {
        expect(normalizePitch('X')).toBeNull();
        expect(normalizePitch('Z#')).toBeNull();
        expect(normalizePitch('8')).toBeNull();
        expect(normalizePitch('0')).toBeNull();
      });

      it('should return null for invalid major/minor notations', () => {
        expect(normalizePitch('CX')).toBeNull();
        expect(normalizePitch('8M')).toBeNull();
        expect(normalizePitch('0m')).toBeNull();
      });

      it('should handle double sharps (not supported)', () => {
        expect(normalizePitch('C##')).toBeNull();
        expect(normalizePitch('D##')).toBeNull();
      });

      it('should handle flats (not supported)', () => {
        expect(normalizePitch('Db')).toBeNull();
        expect(normalizePitch('Eb')).toBeNull();
      });
    });
  });

  describe('isRecognizedPitch', () => {
    it('should return true for recognized pitches', () => {
      expect(isRecognizedPitch('C')).toBe(true);
      expect(isRecognizedPitch('1')).toBe(true);
      expect(isRecognizedPitch('CM')).toBe(true);
      expect(isRecognizedPitch('Cm')).toBe(true);
      expect(isRecognizedPitch('C#')).toBe(true);
      expect(isRecognizedPitch('1.5M')).toBe(true);
      expect(isRecognizedPitch('1Madhyam')).toBe(true);
    });

    it('should return false for unrecognized pitches', () => {
      expect(isRecognizedPitch('X')).toBe(false);
      expect(isRecognizedPitch('8')).toBe(false);
      expect(isRecognizedPitch('invalid')).toBe(false);
      expect(isRecognizedPitch('')).toBe(false);
      expect(isRecognizedPitch('Db')).toBe(false);
    });

    it('should handle whitespace correctly', () => {
      expect(isRecognizedPitch('  C  ')).toBe(true);
      expect(isRecognizedPitch('  invalid  ')).toBe(false);
    });
  });

  describe('getUnmappedPitches', () => {
    it('should return empty array when all pitches are recognized', () => {
      const pitches = ['C', '1', 'CM', 'Cm', 'C#', '1.5M'];
      expect(getUnmappedPitches(pitches)).toEqual([]);
    });

    it('should return unmapped pitches', () => {
      const pitches = ['C', 'X', '1', 'invalid', 'D', '8'];
      const unmapped = getUnmappedPitches(pitches);
      expect(unmapped).toEqual(['8', 'X', 'invalid']);
    });

    it('should remove duplicates from unmapped pitches', () => {
      const pitches = ['C', 'X', '1', 'X', 'D', 'invalid', 'X'];
      const unmapped = getUnmappedPitches(pitches);
      expect(unmapped).toEqual(['X', 'invalid']);
    });

    it('should return sorted unmapped pitches', () => {
      const pitches = ['C', 'zebra', '1', 'apple', 'D', 'banana'];
      const unmapped = getUnmappedPitches(pitches);
      expect(unmapped).toEqual(['apple', 'banana', 'zebra']);
    });

    it('should handle empty array', () => {
      expect(getUnmappedPitches([])).toEqual([]);
    });

    it('should handle all unmapped pitches', () => {
      const pitches = ['X', 'Y', 'Z'];
      expect(getUnmappedPitches(pitches)).toEqual(['X', 'Y', 'Z']);
    });
  });

  describe('addPitchMapping', () => {
    beforeEach(() => {
      // Clean up any custom mappings from previous tests
      const mappings = getPitchMappings();
      Object.keys(mappings).forEach(key => {
        if (key.startsWith('custom')) {
          removePitchMapping(key);
        }
      });
    });

    it('should add a new pitch mapping', () => {
      addPitchMapping('custom1', 'Custom Note 1');
      expect(normalizePitch('custom1')).toBe('Custom Note 1');
    });

    it('should override existing mapping', () => {
      addPitchMapping('1', 'Override C');
      expect(normalizePitch('1')).toBe('Override C');
      // Restore original mapping
      addPitchMapping('1', 'C');
    });

    it('should add multiple custom mappings', () => {
      addPitchMapping('custom2', 'Custom Note 2');
      addPitchMapping('custom3', 'Custom Note 3');
      expect(normalizePitch('custom2')).toBe('Custom Note 2');
      expect(normalizePitch('custom3')).toBe('Custom Note 3');
    });

    it('should allow complex normalized formats', () => {
      addPitchMapping('customComplex', 'C# major pentatonic');
      expect(normalizePitch('customComplex')).toBe('C# major pentatonic');
    });
  });

  describe('removePitchMapping', () => {
    beforeEach(() => {
      // Add a custom mapping for testing
      addPitchMapping('customToRemove', 'Test Note');
    });

    it('should remove an existing mapping', () => {
      expect(normalizePitch('customToRemove')).toBe('Test Note');
      removePitchMapping('customToRemove');
      expect(normalizePitch('customToRemove')).toBeNull();
    });

    it('should handle removing non-existent mapping', () => {
      expect(() => removePitchMapping('nonExistent')).not.toThrow();
    });

    it('should allow removing standard mappings', () => {
      removePitchMapping('1');
      expect(normalizePitch('1')).toBeNull();
      // Restore
      addPitchMapping('1', 'C');
    });

    it('should only remove specific mapping', () => {
      addPitchMapping('customA', 'Note A');
      addPitchMapping('customB', 'Note B');
      removePitchMapping('customA');
      expect(normalizePitch('customA')).toBeNull();
      expect(normalizePitch('customB')).toBe('Note B');
    });
  });

  describe('getPitchMappings', () => {
    it('should return all pitch mappings', () => {
      const mappings = getPitchMappings();
      expect(mappings).toBeTypeOf('object');
      expect(Object.keys(mappings).length).toBeGreaterThan(0);
    });

    it('should include standard mappings', () => {
      const mappings = getPitchMappings();
      expect(mappings['1']).toBe('C');
      expect(mappings['CM']).toBe('C major');
      expect(mappings['Cm']).toBe('C minor');
      expect(mappings['1Madhyam']).toBe('1 Madhyam');
    });

    it('should return a copy (not reference)', () => {
      const mappings1 = getPitchMappings();
      const mappings2 = getPitchMappings();
      expect(mappings1).not.toBe(mappings2);
      expect(mappings1).toEqual(mappings2);
    });

    it('should not allow mutation of internal state', () => {
      const mappings = getPitchMappings();
      mappings['testMutation'] = 'Test Value';
      // This should not affect the internal state
      expect(normalizePitch('testMutation')).toBeNull();
    });

    it('should reflect custom mappings', () => {
      addPitchMapping('customMapping', 'Custom Value');
      const mappings = getPitchMappings();
      expect(mappings['customMapping']).toBe('Custom Value');
    });
  });

  describe('integration tests', () => {
    it('should handle a complete CSV import workflow', () => {
      const csvPitches = ['1', '2M', 'Cm', '1.5', 'C#M', '1Madhyam', 'invalid'];
      const unmapped = getUnmappedPitches(csvPitches);
      expect(unmapped).toEqual(['invalid']);

      const normalized = csvPitches
        .map(p => normalizePitch(p))
        .filter(p => p !== null);
      
      expect(normalized).toEqual([
        'C',
        'D major',
        'C minor',
        'C#',
        'C# major',
        '1 Madhyam'
      ]);
    });

    it('should handle custom mapping workflow', () => {
      // Add custom mapping
      addPitchMapping('myKey', 'My Custom Key');
      expect(isRecognizedPitch('myKey')).toBe(true);
      expect(normalizePitch('myKey')).toBe('My Custom Key');

      // Verify it appears in mappings
      const mappings = getPitchMappings();
      expect(mappings['myKey']).toBe('My Custom Key');

      // Remove it
      removePitchMapping('myKey');
      expect(isRecognizedPitch('myKey')).toBe(false);
      expect(normalizePitch('myKey')).toBeNull();
    });

    it('should handle batch processing with error handling', () => {
      const pitches = ['1', 'invalid1', '2M', 'invalid2', 'Cm'];
      const results = pitches.map(p => ({
        original: p,
        normalized: normalizePitch(p),
        recognized: isRecognizedPitch(p)
      }));

      expect(results[0]).toEqual({ original: '1', normalized: 'C', recognized: true });
      expect(results[1]).toEqual({ original: 'invalid1', normalized: null, recognized: false });
      expect(results[2]).toEqual({ original: '2M', normalized: 'D major', recognized: true });
      expect(results[3]).toEqual({ original: 'invalid2', normalized: null, recognized: false });
      expect(results[4]).toEqual({ original: 'Cm', normalized: 'C minor', recognized: true });
    });
  });
});
