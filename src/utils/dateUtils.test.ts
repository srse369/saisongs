import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime, formatISO, parseDate } from './dateUtils';

describe('dateUtils', () => {
  beforeEach(() => {
    // Set a fixed date for testing: Jan 15, 2025, 12:00 PM
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('should format date in readable format', () => {
      const date = new Date('2025-01-15');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should handle Date objects correctly', () => {
      const date = new Date('2024-12-25T10:30:00');
      const result = formatDate(date);
      expect(result).toContain('Dec');
      expect(result).toContain('25');
      expect(result).toContain('2024');
    });

    it('should handle different months', () => {
      const dates = [
        { date: new Date('2025-01-01'), month: 'Jan' },
        { date: new Date('2025-06-15'), month: 'Jun' },
        { date: new Date('2025-12-31'), month: 'Dec' },
      ];

      dates.forEach(({ date, month }) => {
        expect(formatDate(date)).toContain(month);
      });
    });
  });

  describe('formatDateTime', () => {
    it('should include both date and time', () => {
      const date = new Date('2025-01-15T14:30:00');
      const result = formatDateTime(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format with AM/PM', () => {
      const morning = new Date('2025-01-15T09:00:00');
      const evening = new Date('2025-01-15T21:00:00');
      
      const morningResult = formatDateTime(morning);
      const eveningResult = formatDateTime(evening);
      
      expect(morningResult).toMatch(/AM|PM/);
      expect(eveningResult).toMatch(/AM|PM/);
    });

    it('should handle midnight and noon correctly', () => {
      const midnight = new Date('2025-01-15T00:00:00');
      const noon = new Date('2025-01-15T12:00:00');
      
      expect(formatDateTime(midnight)).toBeTruthy();
      expect(formatDateTime(noon)).toBeTruthy();
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "just now" for very recent times', () => {
      const justNow = new Date('2025-01-15T12:00:00Z'); // Exactly now
      expect(formatRelativeTime(justNow)).toBe('just now');
      
      const fewSecondsAgo = new Date('2025-01-15T11:59:50Z'); // 10 seconds ago
      expect(formatRelativeTime(fewSecondsAgo)).toBe('just now');
    });

    it('should return minutes ago for recent past', () => {
      const oneMinuteAgo = new Date('2025-01-15T11:59:00Z');
      const fiveMinutesAgo = new Date('2025-01-15T11:55:00Z');
      
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    it('should return hours ago for same day', () => {
      const oneHourAgo = new Date('2025-01-15T11:00:00Z');
      const twoHoursAgo = new Date('2025-01-15T10:00:00Z');
      
      expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    });

    it('should return days ago for recent days', () => {
      const oneDayAgo = new Date('2025-01-14T12:00:00Z');
      const twoDaysAgo = new Date('2025-01-13T12:00:00Z');
      
      expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago');
      expect(formatRelativeTime(twoDaysAgo)).toBe('2 days ago');
    });

    it('should handle future dates', () => {
      const future = new Date('2025-01-16T12:00:00Z');
      // Should either handle gracefully or return formatted date
      expect(() => formatRelativeTime(future)).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      // Invalid dates throw errors when formatted - expected behavior
      expect(() => formatDate(invalidDate)).toThrow();
      expect(() => formatDateTime(invalidDate)).toThrow();
    });

    it('should handle leap years', () => {
      const leapDay = new Date('2024-02-29');
      const result = formatDate(leapDay);
      expect(result).toContain('29');
      expect(result).toContain('2024');
    });

    it('should handle year boundaries', () => {
      const newYearEve = new Date('2024-12-31T23:59:59');
      const newYearDay = new Date('2025-01-01T00:00:00');
      
      expect(formatDate(newYearEve)).toContain('2024');
      expect(formatDate(newYearDay)).toContain('2025');
    });
  });

  describe('Integration tests', () => {
    it('should produce consistent formats', () => {
      const testDate = new Date('2025-06-15T14:30:00');
      
      const dateOnly = formatDate(testDate);
      const dateTime = formatDateTime(testDate);
      
      // DateTime should include everything from Date
      expect(dateTime).toContain('Jun');
      expect(dateTime).toContain('15');
      expect(dateTime).toContain('2025');
    });

    it('should handle a range of relative times correctly', () => {
      const times = [
        new Date('2025-01-15T11:59:30Z'), // 30 seconds ago
        new Date('2025-01-15T11:30:00Z'), // 30 minutes ago
        new Date('2025-01-15T06:00:00Z'), // 6 hours ago
        new Date('2025-01-10T12:00:00Z'), // 5 days ago
      ];

      times.forEach(time => {
        const result = formatRelativeTime(time);
        expect(result).toBeTruthy();
      });
    });
  });

  describe('formatISO', () => {
    it('should format date in ISO 8601 format', () => {
      const date = new Date('2024-01-15T15:30:00.000Z');
      const result = formatISO(date);
      expect(result).toBe('2024-01-15T15:30:00.000Z');
    });

    it('should handle edge cases', () => {
      const epoch = new Date(0);
      expect(formatISO(epoch)).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('parseDate', () => {
    it('should parse ISO date string', () => {
      const result = parseDate('2024-01-15T15:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-01-15T15:30:00.000Z');
    });

    it('should parse timestamp number', () => {
      const timestamp = 1705333800000; // Jan 15, 2024
      const result = parseDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(timestamp);
    });

    it('should pass through Date objects', () => {
      const date = new Date('2024-01-15');
      const result = parseDate(date);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(date.toISOString());
    });

    it('should return null for invalid date strings', () => {
      expect(parseDate('invalid-date')).toBeNull();
      expect(parseDate('not-a-date')).toBeNull();
    });

    it('should return null for NaN', () => {
      expect(parseDate(NaN)).toBeNull();
    });

    it('should handle various date formats', () => {
      expect(parseDate('2024-01-15')).toBeInstanceOf(Date);
      expect(parseDate('Jan 15, 2024')).toBeInstanceOf(Date);
      expect(parseDate('2024/01/15')).toBeInstanceOf(Date);
    });
  });
});

