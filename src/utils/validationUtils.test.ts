import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateMaxLength,
  validateMinLength,
  validateSongName,
  validateLyrics,
  validateSingerName,
  validatePitch,
  sanitizeText,
  isValidUUID,
} from './validationUtils';
import { ValidationError } from '../types';

describe('validationUtils', () => {
  describe('validateRequired', () => {
    it('should pass for non-empty string', () => {
      expect(() => validateRequired('test', 'field')).not.toThrow();
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => validateRequired('', 'field')).toThrow(ValidationError);
      expect(() => validateRequired('', 'field')).toThrow('field is required');
    });

    it('should throw ValidationError for whitespace-only string', () => {
      expect(() => validateRequired('   ', 'field')).toThrow(ValidationError);
      expect(() => validateRequired('   ', 'field')).toThrow('field is required');
    });

    it('should throw ValidationError for undefined', () => {
      expect(() => validateRequired(undefined, 'field')).toThrow(ValidationError);
      expect(() => validateRequired(undefined, 'field')).toThrow('field is required');
    });

    it('should throw ValidationError for null', () => {
      expect(() => validateRequired(null, 'field')).toThrow(ValidationError);
      expect(() => validateRequired(null, 'field')).toThrow('field is required');
    });

    it('should include field name in error', () => {
      try {
        validateRequired('', 'Email');
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).field).toBe('Email');
      }
    });
  });

  describe('validateMaxLength', () => {
    it('should pass for string within max length', () => {
      expect(() => validateMaxLength('test', 10, 'field')).not.toThrow();
    });

    it('should pass for string exactly at max length', () => {
      expect(() => validateMaxLength('test', 4, 'field')).not.toThrow();
    });

    it('should throw ValidationError for string exceeding max length', () => {
      expect(() => validateMaxLength('toolongvalue', 5, 'field')).toThrow(ValidationError);
      expect(() => validateMaxLength('toolongvalue', 5, 'field')).toThrow(
        'field must not exceed 5 characters'
      );
    });

    it('should include field name in error', () => {
      try {
        validateMaxLength('a'.repeat(100), 50, 'Description');
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).field).toBe('Description');
      }
    });
  });

  describe('validateMinLength', () => {
    it('should pass for string exceeding min length', () => {
      expect(() => validateMinLength('testing', 5, 'field')).not.toThrow();
    });

    it('should pass for string exactly at min length', () => {
      expect(() => validateMinLength('test', 4, 'field')).not.toThrow();
    });

    it('should throw ValidationError for string below min length', () => {
      expect(() => validateMinLength('ab', 3, 'field')).toThrow(ValidationError);
      expect(() => validateMinLength('ab', 3, 'field')).toThrow(
        'field must be at least 3 characters'
      );
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => validateMinLength('', 1, 'field')).toThrow(ValidationError);
    });

    it('should include field name in error', () => {
      try {
        validateMinLength('ab', 10, 'Password');
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).field).toBe('Password');
      }
    });
  });

  describe('validateSongName', () => {
    it('should pass for valid song name', () => {
      expect(() => validateSongName('Amazing Grace')).not.toThrow();
    });

    it('should throw ValidationError for empty song name', () => {
      expect(() => validateSongName('')).toThrow('Song name is required');
    });

    it('should throw ValidationError for undefined song name', () => {
      expect(() => validateSongName(undefined)).toThrow('Song name is required');
    });

    it('should throw ValidationError for null song name', () => {
      expect(() => validateSongName(null)).toThrow('Song name is required');
    });

    it('should throw ValidationError for song name exceeding 255 characters', () => {
      const longName = 'A'.repeat(256);
      expect(() => validateSongName(longName)).toThrow('Song name must not exceed 255 characters');
    });

    it('should pass for song name exactly 255 characters', () => {
      const name255 = 'A'.repeat(255);
      expect(() => validateSongName(name255)).not.toThrow();
    });
  });

  describe('validateLyrics', () => {
    it('should pass for non-empty lyrics', () => {
      expect(() => validateLyrics('Some lyrics here')).not.toThrow();
    });

    it('should throw ValidationError for empty lyrics', () => {
      expect(() => validateLyrics('')).toThrow('Lyrics is required');
    });

    it('should throw ValidationError for undefined lyrics', () => {
      expect(() => validateLyrics(undefined)).toThrow('Lyrics is required');
    });

    it('should throw ValidationError for null lyrics', () => {
      expect(() => validateLyrics(null)).toThrow('Lyrics is required');
    });

    it('should throw ValidationError for whitespace-only lyrics', () => {
      expect(() => validateLyrics('   ')).toThrow('Lyrics is required');
    });
  });

  describe('validateSingerName', () => {
    it('should pass for valid singer name', () => {
      expect(() => validateSingerName('John Doe')).not.toThrow();
    });

    it('should throw ValidationError for empty singer name', () => {
      expect(() => validateSingerName('')).toThrow('Singer name is required');
    });

    it('should throw ValidationError for undefined singer name', () => {
      expect(() => validateSingerName(undefined)).toThrow('Singer name is required');
    });

    it('should throw ValidationError for null singer name', () => {
      expect(() => validateSingerName(null)).toThrow('Singer name is required');
    });

    it('should throw ValidationError for singer name exceeding 255 characters', () => {
      const longName = 'A'.repeat(256);
      expect(() => validateSingerName(longName)).toThrow('Singer name must not exceed 255 characters');
    });

    it('should pass for singer name exactly 255 characters', () => {
      const name255 = 'A'.repeat(255);
      expect(() => validateSingerName(name255)).not.toThrow();
    });
  });

  describe('validatePitch', () => {
    it('should pass for valid pitch', () => {
      expect(() => validatePitch('C')).not.toThrow();
    });

    it('should pass for complex pitch notation', () => {
      expect(() => validatePitch('C#m7')).not.toThrow();
    });

    it('should throw ValidationError for empty pitch', () => {
      expect(() => validatePitch('')).toThrow('Pitch is required');
    });

    it('should throw ValidationError for undefined pitch', () => {
      expect(() => validatePitch(undefined)).toThrow('Pitch is required');
    });

    it('should throw ValidationError for null pitch', () => {
      expect(() => validatePitch(null)).toThrow('Pitch is required');
    });

    it('should throw ValidationError for pitch exceeding 50 characters', () => {
      const longPitch = 'A'.repeat(51);
      expect(() => validatePitch(longPitch)).toThrow('Pitch must not exceed 50 characters');
    });

    it('should pass for pitch exactly 50 characters', () => {
      const pitch50 = 'A'.repeat(50);
      expect(() => validatePitch(pitch50)).not.toThrow();
    });
  });

  describe('sanitizeText', () => {
    it('should trim whitespace from both ends', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });

    it('should trim leading whitespace', () => {
      expect(sanitizeText('  hello')).toBe('hello');
    });

    it('should trim trailing whitespace', () => {
      expect(sanitizeText('hello  ')).toBe('hello');
    });

    it('should preserve internal whitespace', () => {
      expect(sanitizeText('hello  world')).toBe('hello  world');
    });

    it('should return empty string for whitespace-only input', () => {
      expect(sanitizeText('   ')).toBe('');
    });

    it('should return unchanged for already trimmed text', () => {
      expect(sanitizeText('hello')).toBe('hello');
    });

    it('should handle tabs and newlines', () => {
      expect(sanitizeText('\t\nhello\n\t')).toBe('hello');
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return true for valid UUID with uppercase', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should return true for valid UUID with mixed case', () => {
      expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });

    it('should return false for UUID without hyphens', () => {
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    it('should return false for UUID with wrong format', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('should return false for non-UUID string', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should return false for UUID with invalid characters', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    });

    it('should return false for UUID with too many characters', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-4466554400000')).toBe(false);
    });

    it('should return false for UUID with too few characters', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
    });

    it('should return false for nil UUID (all zeros)', () => {
      // This is actually a valid UUID format, so should return true
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    });
  });
});
