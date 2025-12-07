import { describe, it, expect } from 'vitest';
import { formatPitch, formatPitchWithName, isValidPitch, ALL_PITCH_OPTIONS } from './pitchUtils';

describe('pitchUtils', () => {
  describe('isValidPitch', () => {
    it('should validate base pitches', () => {
      expect(isValidPitch('C')).toBe(true);
      expect(isValidPitch('D')).toBe(true);
      expect(isValidPitch('C#')).toBe(true);
    });

    it('should validate major and minor pitches', () => {
      expect(isValidPitch('C major')).toBe(true);
      expect(isValidPitch('D# minor')).toBe(true);
      expect(isValidPitch('G major')).toBe(true);
    });

    it('should validate Madhyam pitches', () => {
      expect(isValidPitch('1 Madhyam')).toBe(true);
      expect(isValidPitch('2.5 Madhyam')).toBe(true);
      expect(isValidPitch('7 Madhyam')).toBe(true);
    });

    it('should reject invalid pitches', () => {
      expect(isValidPitch('X')).toBe(false);
      expect(isValidPitch('H#')).toBe(false);
      expect(isValidPitch('')).toBe(false);
      expect(isValidPitch('C flat')).toBe(false);
    });
  });

  describe('formatPitch', () => {
    it('should format base pitches to numeric notation', () => {
      expect(formatPitch('C')).toBe('1');
      expect(formatPitch('D')).toBe('2');
      expect(formatPitch('E')).toBe('3');
    });

    it('should format sharp pitches with decimal notation', () => {
      expect(formatPitch('C#')).toBe('1.5');
      expect(formatPitch('D#')).toBe('2.5');
      expect(formatPitch('F#')).toBe('4.5');
    });

    it('should format major pitches with M suffix', () => {
      expect(formatPitch('C major')).toBe('1M');
      expect(formatPitch('D major')).toBe('2M');
      expect(formatPitch('G# major')).toBe('5.5M');
    });

    it('should format minor pitches with m suffix', () => {
      expect(formatPitch('C minor')).toBe('1m');
      expect(formatPitch('D minor')).toBe('2m');
      expect(formatPitch('A# minor')).toBe('6.5m');
    });

    it('should preserve Madhyam pitch format', () => {
      expect(formatPitch('1 Madhyam')).toBe('1 Madhyam');
      expect(formatPitch('4.5 Madhyam')).toBe('4.5 Madhyam');
    });
  });

  describe('formatPitchWithName', () => {
    it('should include both numeric and name for base pitches', () => {
      const result = formatPitchWithName('C');
      expect(result).toContain('1');
      expect(result).toContain('C');
    });

    it('should include both numeric and name for major/minor', () => {
      const majorResult = formatPitchWithName('C major');
      expect(majorResult).toContain('1M');
      expect(majorResult).toContain('C major');

      const minorResult = formatPitchWithName('D# minor');
      expect(minorResult).toContain('2.5m');
    });
  });

  describe('ALL_PITCH_OPTIONS', () => {
    it('should contain all base pitches', () => {
      expect(ALL_PITCH_OPTIONS).toContain('C');
      expect(ALL_PITCH_OPTIONS).toContain('C#');
      expect(ALL_PITCH_OPTIONS).toContain('D');
    });

    it('should contain major and minor variations', () => {
      expect(ALL_PITCH_OPTIONS).toContain('C major');
      expect(ALL_PITCH_OPTIONS).toContain('C minor');
      expect(ALL_PITCH_OPTIONS).toContain('D# major');
    });

    it('should contain all Madhyam pitches', () => {
      expect(ALL_PITCH_OPTIONS).toContain('1 Madhyam');
      expect(ALL_PITCH_OPTIONS).toContain('2.5 Madhyam');
      expect(ALL_PITCH_OPTIONS).toContain('7 Madhyam');
    });

    it('should have expected total number of options', () => {
      // 12 base pitches * 3 variations (base, major, minor) + 12 Madhyam = 48
      expect(ALL_PITCH_OPTIONS.length).toBe(48);
    });

    it('should not have duplicates', () => {
      const unique = new Set(ALL_PITCH_OPTIONS);
      expect(unique.size).toBe(ALL_PITCH_OPTIONS.length);
    });
  });

  describe('Integration tests', () => {
    it('should handle all valid pitches consistently', () => {
      ALL_PITCH_OPTIONS.forEach(pitch => {
        expect(isValidPitch(pitch)).toBe(true);
        const formatted = formatPitch(pitch);
        expect(formatted).toBeTruthy();
      });
    });

    it('should format common use cases correctly', () => {
      const testCases = [
        { pitch: 'C', expected: '1' },
        { pitch: 'C major', expected: '1M' },
        { pitch: 'C# minor', expected: '1.5m' },
        { pitch: 'G', expected: '5' },
        { pitch: 'B', expected: '7' },
        { pitch: '3 Madhyam', expected: '3 Madhyam' },
      ];

      testCases.forEach(({ pitch, expected }) => {
        expect(formatPitch(pitch)).toBe(expected);
      });
    });
  });
});

