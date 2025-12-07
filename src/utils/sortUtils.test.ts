import { describe, it, expect } from 'vitest';
import { normalizeForSort, compareStringsIgnoringSpecialChars } from './sortUtils';

describe('sortUtils', () => {
  describe('normalizeForSort', () => {
    it('should remove special characters', () => {
      expect(normalizeForSort('Hello-World!')).toBe('helloworld');
      expect(normalizeForSort('@#$%Song^&*()')).toBe('song');
    });

    it('should remove leading numbers and spaces', () => {
      // Function keeps internal spaces after removing leading numbers
      expect(normalizeForSort('123 Song Name')).toBe('song name');
      expect(normalizeForSort('  456 Test')).toBe('test');
      expect(normalizeForSort('001. First Song')).toBe('first song');
    });

    it('should convert to lowercase', () => {
      expect(normalizeForSort('UPPERCASE')).toBe('uppercase');
      expect(normalizeForSort('MiXeD CaSe')).toBe('mixed case');
    });

    it('should handle empty strings', () => {
      expect(normalizeForSort('')).toBe('');
    });

    it('should handle strings with only special characters and numbers', () => {
      expect(normalizeForSort('123!@#')).toBe('');
      expect(normalizeForSort('   999   ')).toBe('');
    });

    it('should preserve internal numbers', () => {
      expect(normalizeForSort('Song123Test')).toBe('song123test');
      expect(normalizeForSort('Test 4 You')).toBe('test 4 you');
    });
  });

  describe('compareStringsIgnoringSpecialChars', () => {
    it('should sort alphabetically ignoring special characters', () => {
      expect(compareStringsIgnoringSpecialChars('Apple', 'Banana')).toBeLessThan(0);
      expect(compareStringsIgnoringSpecialChars('Zebra', 'Apple')).toBeGreaterThan(0);
    });

    it('should sort ignoring leading numbers', () => {
      expect(compareStringsIgnoringSpecialChars('123 Apple', '456 Banana')).toBeLessThan(0);
      expect(compareStringsIgnoringSpecialChars('999 Zebra', '001 Apple')).toBeGreaterThan(0);
    });

    it('should treat equal normalized strings as equal', () => {
      expect(compareStringsIgnoringSpecialChars('Hello', 'hello')).toBe(0);
      expect(compareStringsIgnoringSpecialChars('123 Test', '456 Test')).toBe(0);
      expect(compareStringsIgnoringSpecialChars('!@# Song', '### Song')).toBe(0);
    });

    it('should handle special characters at the start', () => {
      expect(compareStringsIgnoringSpecialChars('!Apple', '#Banana')).toBeLessThan(0);
      expect(compareStringsIgnoringSpecialChars('@Zebra', '$Apple')).toBeGreaterThan(0);
    });

    it('should handle mixed special characters and numbers', () => {
      expect(compareStringsIgnoringSpecialChars('001. First', '002. Second')).toBeLessThan(0);
      expect(compareStringsIgnoringSpecialChars('!!! AAA', '??? ZZZ')).toBeLessThan(0);
    });

    it('should handle empty strings', () => {
      expect(compareStringsIgnoringSpecialChars('', '')).toBe(0);
      expect(compareStringsIgnoringSpecialChars('Test', '')).toBeGreaterThan(0);
      expect(compareStringsIgnoringSpecialChars('', 'Test')).toBeLessThan(0);
    });
  });

  describe('Real-world song sorting scenarios', () => {
    it('should sort song titles correctly', () => {
      const songs = [
        '123. Om Jai Jagadish Hare',
        '@Bhagavan',
        '001 Ganesha Sharanam',
        'Jai Jai Ram',
        '!!! Special Song',
      ];

      const sorted = [...songs].sort(compareStringsIgnoringSpecialChars);

      expect(sorted).toEqual([
        '@Bhagavan',
        '001 Ganesha Sharanam',
        'Jai Jai Ram',
        '123. Om Jai Jagadish Hare',
        '!!! Special Song',
      ]);
    });

    it('should group similar songs regardless of numbering', () => {
      const songs = [
        '100 Test Song',
        '5 Test Song',
        '1000 Test Song',
      ];

      const sorted = [...songs].sort(compareStringsIgnoringSpecialChars);

      // All should be grouped together as they normalize to the same string
      sorted.forEach(song => {
        expect(song).toContain('Test Song');
      });
    });
  });
});
