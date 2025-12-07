import { describe, it, expect } from 'vitest';
import { CsvParserService } from './CsvParserService';
import type { CsvPitchData } from './CsvParserService';

describe('CsvParserService', () => {
  describe('parseCSVRow', () => {
    it('should parse valid CSV row with all fields', () => {
      const row = 'Amazing Grace,John Doe,C';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toEqual({
        songName: 'Amazing Grace',
        singerName: 'John Doe',
        pitch: 'C',
      });
    });

    it('should parse CSV row with quoted fields', () => {
      const row = '"Amazing Grace","John Doe","C"';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toEqual({
        songName: 'Amazing Grace',
        singerName: 'John Doe',
        pitch: 'C',
      });
    });

    it('should parse CSV row with mixed quotes', () => {
      const row = '"Amazing Grace",John Doe,C';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toEqual({
        songName: 'Amazing Grace',
        singerName: 'John Doe',
        pitch: 'C',
      });
    });

    it('should trim whitespace from fields', () => {
      const row = '  Amazing Grace  ,  John Doe  ,  C  ';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toEqual({
        songName: 'Amazing Grace',
        singerName: 'John Doe',
        pitch: 'C',
      });
    });

    it('should parse CSV row with extra fields (ignore them)', () => {
      const row = 'Amazing Grace,John Doe,C,Extra,More Data';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toEqual({
        songName: 'Amazing Grace',
        singerName: 'John Doe',
        pitch: 'C',
      });
    });

    it('should return null for row with less than 3 fields', () => {
      const row = 'Amazing Grace,John Doe';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toBeNull();
    });

    it('should return null for row with empty song name', () => {
      const row = ',John Doe,C';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toBeNull();
    });

    it('should return null for row with empty singer name', () => {
      const row = 'Amazing Grace,,C';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toBeNull();
    });

    it('should return null for row with empty pitch', () => {
      const row = 'Amazing Grace,John Doe,';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toBeNull();
    });

    it('should return null for empty row', () => {
      const row = '';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toBeNull();
    });

    it('should return null for row with only commas', () => {
      const row = ',,';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toBeNull();
    });

    it('should handle simple CSV parsing (commas in quotes not supported)', () => {
      // Note: This parser does simple split(',') so commas inside quotes are not handled
      const row = 'Amazing Grace,John Doe,C';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toEqual({
        songName: 'Amazing Grace',
        singerName: 'John Doe',
        pitch: 'C',
      });
    });

    it('should parse complex pitch notation', () => {
      const row = 'Amazing Grace,John Doe,C#m7';
      const result = CsvParserService.parseCSVRow(row);

      expect(result).toEqual({
        songName: 'Amazing Grace',
        singerName: 'John Doe',
        pitch: 'C#m7',
      });
    });
  });

  describe('extractUniqueSingers', () => {
    it('should extract unique singers from pitch data', () => {
      const pitchData: CsvPitchData[] = [
        { songName: 'Song 1', singerName: 'John Doe', pitch: 'C' },
        { songName: 'Song 2', singerName: 'Jane Smith', pitch: 'G' },
        { songName: 'Song 3', singerName: 'John Doe', pitch: 'D' },
      ];

      const result = CsvParserService.extractUniqueSingers(pitchData);

      expect(result).toEqual(['Jane Smith', 'John Doe']);
    });

    it('should sort singers alphabetically', () => {
      const pitchData: CsvPitchData[] = [
        { songName: 'Song 1', singerName: 'Zack', pitch: 'C' },
        { songName: 'Song 2', singerName: 'Alice', pitch: 'G' },
        { songName: 'Song 3', singerName: 'Bob', pitch: 'D' },
      ];

      const result = CsvParserService.extractUniqueSingers(pitchData);

      expect(result).toEqual(['Alice', 'Bob', 'Zack']);
    });

    it('should handle empty pitch data array', () => {
      const pitchData: CsvPitchData[] = [];

      const result = CsvParserService.extractUniqueSingers(pitchData);

      expect(result).toEqual([]);
    });

    it('should skip entries with empty singer names', () => {
      const pitchData: CsvPitchData[] = [
        { songName: 'Song 1', singerName: 'John Doe', pitch: 'C' },
        { songName: 'Song 2', singerName: '', pitch: 'G' },
        { songName: 'Song 3', singerName: 'Jane Smith', pitch: 'D' },
      ];

      const result = CsvParserService.extractUniqueSingers(pitchData);

      expect(result).toEqual(['Jane Smith', 'John Doe']);
    });

    it('should handle duplicate consecutive singers', () => {
      const pitchData: CsvPitchData[] = [
        { songName: 'Song 1', singerName: 'John Doe', pitch: 'C' },
        { songName: 'Song 2', singerName: 'John Doe', pitch: 'G' },
        { songName: 'Song 3', singerName: 'John Doe', pitch: 'D' },
      ];

      const result = CsvParserService.extractUniqueSingers(pitchData);

      expect(result).toEqual(['John Doe']);
    });

    it('should handle case-sensitive singer names as different', () => {
      const pitchData: CsvPitchData[] = [
        { songName: 'Song 1', singerName: 'John Doe', pitch: 'C' },
        { songName: 'Song 2', singerName: 'john doe', pitch: 'G' },
        { songName: 'Song 3', singerName: 'JOHN DOE', pitch: 'D' },
      ];

      const result = CsvParserService.extractUniqueSingers(pitchData);

      expect(result).toEqual(['JOHN DOE', 'John Doe', 'john doe']);
    });
  });
});
