import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvImportService } from './CsvImportService';
import apiClient from './ApiClient';
import type { Singer, Song } from '../types';
import type { CsvPitchData } from './CsvParserService';

// Mock modules
vi.mock('./ApiClient');
vi.mock('../utils/pitchNormalization', () => ({
  normalizePitch: vi.fn((pitch: string) => {
    const normalized: Record<string, string> = {
      'C': 'C',
      'C#': 'C#',
      'Db': 'C#',
      'D': 'D',
      'D#': 'D#',
      'Eb': 'D#',
      '-': null,
      'null': null,
    };
    return normalized[pitch] || null;
  }),
  isRecognizedPitch: vi.fn((pitch: string) => {
    return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].includes(pitch);
  }),
}));

vi.mock('../utils/songMatcher', () => ({
  findBestSongMatch: vi.fn((csvName: string, songs: Song[], threshold: number) => {
    const match = songs.find(s => s.name.toLowerCase() === csvName.toLowerCase());
    if (match) {
      return { song: match, similarity: 100 };
    }
    return null;
  }),
  normalizeSongNameForMapping: vi.fn((name: string) => name.toLowerCase().trim()),
}));

describe('CsvImportService', () => {
  let mockSingers: Singer[];
  let mockSongs: Song[];
  let mockCsvData: CsvPitchData[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSingers = [
      { id: 'singer1', name: 'John Doe' },
      { id: 'singer2', name: 'Jane Smith' },
    ] as Singer[];

    mockSongs = [
      { id: 'song1', name: 'Om Sai Ram', lyrics: 'Om Sai Ram...' },
      { id: 'song2', name: 'Bhaja Govindam', lyrics: 'Bhaja Govindam...' },
      { id: 'song3', name: 'Shiva Shiva Shankara', lyrics: 'Shiva...' },
    ] as Song[];

    mockCsvData = [
      { singerName: 'John Doe', songName: 'Om Sai Ram', pitch: 'C' },
      { singerName: 'Jane Smith', songName: 'Bhaja Govindam', pitch: 'D' },
      { singerName: 'New Singer', songName: 'Om Sai Ram', pitch: 'C#' },
    ];
  });

  describe('createImportPreview', () => {
    it('should create preview with all items ready', async () => {
      const preview = await CsvImportService.createImportPreview(
        mockCsvData,
        mockSingers,
        mockSongs
      );

      expect(preview).toHaveLength(3);
      expect(preview[0]).toMatchObject({
        singerName: 'John Doe',
        singerId: 'singer1',
        singerExists: true,
        songName: 'Om Sai Ram',
        songId: 'song1',
        songMatch: 'exact',
        songSimilarity: 100,
        normalizedPitch: 'C',
        pitchRecognized: true,
        status: 'ready',
      });
    });

    it('should mark singers that do not exist', async () => {
      const preview = await CsvImportService.createImportPreview(
        mockCsvData,
        mockSingers,
        mockSongs
      );

      const newSingerItem = preview.find(p => p.singerName === 'New Singer');
      expect(newSingerItem).toBeDefined();
      expect(newSingerItem!.singerExists).toBe(false);
      expect(newSingerItem!.singerId).toBeUndefined();
    });

    it('should mark items needing song when no match found', async () => {
      const csvData: CsvPitchData[] = [
        { singerName: 'John Doe', songName: 'Unknown Song', pitch: 'C' },
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs
      );

      expect(preview[0]).toMatchObject({
        status: 'needs_song',
        errorMessage: 'No matching song found',
      });
    });

    it('should mark items needing pitch when pitch not recognized', async () => {
      const csvData: CsvPitchData[] = [
        { singerName: 'John Doe', songName: 'Om Sai Ram', pitch: 'Invalid Pitch' },
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs
      );

      expect(preview[0]).toMatchObject({
        status: 'needs_pitch',
        errorMessage: 'Pitch format "Invalid Pitch" not recognized',
        pitchRecognized: false,
        normalizedPitch: undefined,
      });
    });

    it('should mark items as dropped when pitch is blank/null/hyphen', async () => {
      const csvData: CsvPitchData[] = [
        { singerName: 'John Doe', songName: 'Om Sai Ram', pitch: '' },
        { singerName: 'Jane Smith', songName: 'Bhaja Govindam', pitch: '-' },
        { singerName: 'New Singer', songName: 'Shiva Shiva Shankara', pitch: 'null' },
        { singerName: 'Another', songName: 'Song', pitch: 'N/A' },
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs
      );

      expect(preview).toHaveLength(4);
      expect(preview[0].status).toBe('dropped');
      expect(preview[0].errorMessage).toContain('Dropped: Pitch is blank/null/hyphen');
      expect(preview[1].status).toBe('dropped');
      expect(preview[2].status).toBe('dropped');
      expect(preview[3].status).toBe('dropped');
    });

    it('should use stored song mappings for matching', async () => {
      const songMappings = new Map<string, { dbSongId: string; dbSongName: string }>();
      songMappings.set('om sai ram', { dbSongId: 'song1', dbSongName: 'Om Sai Ram' });

      const csvData: CsvPitchData[] = [
        { singerName: 'John Doe', songName: 'Om Sai Ram', pitch: 'C' },
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs,
        songMappings
      );

      expect(preview[0]).toMatchObject({
        songId: 'song1',
        songName: 'Om Sai Ram',
        songMatch: 'exact',
        status: 'ready',
      });
    });

    it('should sort preview items with needs_song first, then needs_pitch, then ready, then dropped last', async () => {
      const csvData: CsvPitchData[] = [
        { singerName: 'John Doe', songName: 'Om Sai Ram', pitch: 'C' }, // ready
        { singerName: 'Jane Smith', songName: 'Unknown Song', pitch: 'D' }, // needs_song
        { singerName: 'New Singer', songName: 'Bhaja Govindam', pitch: 'Invalid' }, // needs_pitch
        { singerName: 'Another', songName: 'Song', pitch: '-' }, // dropped
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs
      );

      expect(preview[0].status).toBe('needs_song');
      expect(preview[1].status).toBe('needs_pitch');
      expect(preview[2].status).toBe('ready');
      expect(preview[3].status).toBe('dropped');
    });

    it('should trim singer names to prevent whitespace duplicates', async () => {
      const csvData: CsvPitchData[] = [
        { singerName: '  John Doe  ', songName: 'Om Sai Ram', pitch: 'C' },
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs
      );

      expect(preview[0].singerName).toBe('John Doe');
      expect(preview[0].singerId).toBe('singer1');
      expect(preview[0].singerExists).toBe(true);
    });

    it('should match singers case-insensitively', async () => {
      const csvData: CsvPitchData[] = [
        { singerName: 'JOHN DOE', songName: 'Om Sai Ram', pitch: 'C' },
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs
      );

      expect(preview[0].singerId).toBe('singer1');
      expect(preview[0].singerExists).toBe(true);
    });

    it('should auto-select song if exactly one song starts with CSV name', async () => {
      const csvData: CsvPitchData[] = [
        { singerName: 'John Doe', songName: 'Shiva', pitch: 'C' },
      ];

      const preview = await CsvImportService.createImportPreview(
        csvData,
        mockSingers,
        mockSongs
      );

      // Should match 'Shiva Shiva Shankara' as it starts with 'Shiva'
      expect(preview[0].songId).toBe('song3');
      expect(preview[0].songMatch).toBe('fuzzy');
      expect(preview[0].songSimilarity).toBe(100);
    });
  });

  describe('importSingers', () => {
    it('should create new singers and return singer map', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[2],
          singerName: 'New Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C#',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createSinger as any).mockResolvedValue({
        id: 'newsinger1',
        name: 'New Singer',
      });

      const result = await CsvImportService.importSingers(previewItems);

      expect(result.newSingersCount).toBe(1);
      expect(result.singerMap.get('new singer')).toBe('newsinger1');
      expect(apiClient.createSinger).toHaveBeenCalledWith({ name: 'New Singer' });
    });

    it('should handle existing singers in map', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      const result = await CsvImportService.importSingers(previewItems);

      expect(result.newSingersCount).toBe(0);
      expect(result.singerMap.get('john doe')).toBe('singer1');
      expect(apiClient.createSinger).not.toHaveBeenCalled();
    });

    it('should handle backend returning existing singer (duplicate)', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[2],
          singerName: 'New Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C#',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createSinger as any).mockResolvedValue({
        id: 'singer1',
        name: 'New Singer',
        message: 'Singer already exists',
      });

      const result = await CsvImportService.importSingers(previewItems);

      expect(result.newSingersCount).toBe(0); // Not counted as new
      expect(result.singerMap.get('new singer')).toBe('singer1');
    });

    it('should handle Oracle uppercase field names', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[2],
          singerName: 'New Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C#',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createSinger as any).mockResolvedValue({
        ID: 'newsinger1', // Oracle uppercase
        NAME: 'New Singer',
      });

      const result = await CsvImportService.importSingers(previewItems);

      expect(result.singerMap.get('new singer')).toBe('newsinger1');
    });

    it('should handle singer creation failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const previewItems = [
        {
          csvData: mockCsvData[2],
          singerName: 'New Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C#',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createSinger as any).mockRejectedValue(new Error('Database error'));

      const result = await CsvImportService.importSingers(previewItems);

      expect(result.newSingersCount).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle response without ID', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const previewItems = [
        {
          csvData: mockCsvData[2],
          singerName: 'New Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C#',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createSinger as any).mockResolvedValue({
        name: 'New Singer',
        // No ID field
      });

      const result = await CsvImportService.importSingers(previewItems);

      expect(result.singerMap.has('new singer')).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No ID in response'));
      
      consoleErrorSpy.mockRestore();
    });

    it('should only create singers for items that will be processed', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'Singer A',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
        {
          csvData: mockCsvData[1],
          singerName: 'Singer B',
          singerExists: false,
          songName: 'Song',
          originalSongName: 'Song',
          pitchRecognized: true,
          songMatch: 'none' as const,
          status: 'dropped' as const, // Dropped item
        },
      ];

      (apiClient.createSinger as any).mockResolvedValue({
        id: 'singera1',
        name: 'Singer A',
      });

      const result = await CsvImportService.importSingers(previewItems);

      // Should only create Singer A, not Singer B (dropped)
      expect(apiClient.createSinger).toHaveBeenCalledTimes(1);
      expect(apiClient.createSinger).toHaveBeenCalledWith({ name: 'Singer A' });
      expect(result.newSingersCount).toBe(1);
    });
  });

  describe('importPitches', () => {
    it('should import pitches successfully', async () => {
      const singerMap = new Map<string, string>();
      singerMap.set('john doe', 'singer1');

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createPitch as any).mockResolvedValue({
        created: true,
        updated: false,
      });

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      expect(result.success).toBe(true);
      expect(result.pitchesCreated).toBe(1);
      expect(result.pitchesUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(apiClient.createPitch).toHaveBeenCalledWith({
        song_id: 'song1',
        singer_id: 'singer1',
        pitch: 'C',
      });
    });

    it('should count updated pitches', async () => {
      const singerMap = new Map<string, string>();
      singerMap.set('john doe', 'singer1');

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createPitch as any).mockResolvedValue({
        created: false,
        updated: true,
      });

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      expect(result.pitchesCreated).toBe(0);
      expect(result.pitchesUpdated).toBe(1);
    });

    it('should count skipped pitches (already exists, no change)', async () => {
      const singerMap = new Map<string, string>();
      singerMap.set('john doe', 'singer1');

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createPitch as any).mockResolvedValue({
        created: false,
        updated: false,
      });

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      expect(result.pitchesCreated).toBe(0);
      expect(result.pitchesUpdated).toBe(0);
      expect(result.pitchesSkipped).toBe(1);
    });

    it('should handle missing singer ID error', async () => {
      const singerMap = new Map<string, string>();

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'Unknown Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No singer ID for "Unknown Singer"');
    });

    it('should handle missing song ID error', async () => {
      const singerMap = new Map<string, string>();
      singerMap.set('john doe', 'singer1');

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Unknown Song',
          originalSongName: 'Unknown Song',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'none' as const,
          status: 'ready' as const,
        },
      ];

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No song ID for "Unknown Song"');
    });

    it('should handle missing normalized pitch error', async () => {
      const singerMap = new Map<string, string>();
      singerMap.set('john doe', 'singer1');

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: false,
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No normalized pitch');
    });

    it('should handle pitch creation API error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const singerMap = new Map<string, string>();
      singerMap.set('john doe', 'singer1');

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createPitch as any).mockRejectedValue(new Error('Database error'));

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to import pitch');
      expect(result.errors[0]).toContain('Database error');
      
      consoleErrorSpy.mockRestore();
    });

    it('should only import items with ready status', async () => {
      const singerMap = new Map<string, string>();
      singerMap.set('john doe', 'singer1');

      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerId: 'singer1',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
        {
          csvData: mockCsvData[1],
          singerName: 'Jane Smith',
          singerId: 'singer2',
          singerExists: true,
          songName: 'Unknown Song',
          originalSongName: 'Unknown Song',
          pitchRecognized: true,
          normalizedPitch: 'D',
          songMatch: 'none' as const,
          status: 'needs_song' as const,
        },
      ];

      (apiClient.createPitch as any).mockResolvedValue({
        created: true,
        updated: false,
      });

      const result = await CsvImportService.importPitches(previewItems, singerMap, 0);

      // Should only import the first item (ready status)
      expect(apiClient.createPitch).toHaveBeenCalledTimes(1);
      expect(result.pitchesCreated).toBe(1);
    });

    it('should pass singersCreatedCount to result', async () => {
      const singerMap = new Map<string, string>();
      const previewItems: any[] = [];

      const result = await CsvImportService.importPitches(previewItems, singerMap, 5);

      expect(result.singersCreated).toBe(5);
    });
  });

  describe('executeImport', () => {
    it('should execute full import successfully', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
        {
          csvData: mockCsvData[2],
          singerName: 'New Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C#',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createSinger as any).mockResolvedValue({
        id: 'newsinger1',
        name: 'New Singer',
      });

      (apiClient.createPitch as any).mockResolvedValue({
        created: true,
        updated: false,
      });

      const result = await CsvImportService.executeImport(previewItems, mockSingers);

      expect(result.success).toBe(true);
      expect(result.singersCreated).toBe(1);
      expect(result.pitchesCreated).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should build singer map from existing singers', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createPitch as any).mockResolvedValue({
        created: true,
        updated: false,
      });

      const result = await CsvImportService.executeImport(previewItems, mockSingers);

      expect(result.success).toBe(true);
      expect(apiClient.createPitch).toHaveBeenCalledWith({
        song_id: 'song1',
        singer_id: 'singer1', // From existing mockSingers
        pitch: 'C',
      });
    });

    it('should handle errors gracefully', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[0],
          singerName: 'John Doe',
          singerExists: true,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createPitch as any).mockRejectedValue(new Error('Unexpected error'));

      const result = await CsvImportService.executeImport(previewItems, mockSingers);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to import pitch');
    });

    it('should merge new singers into main map', async () => {
      const previewItems = [
        {
          csvData: mockCsvData[2],
          singerName: 'New Singer',
          singerExists: false,
          songName: 'Om Sai Ram',
          songId: 'song1',
          originalSongName: 'Om Sai Ram',
          pitchRecognized: true,
          normalizedPitch: 'C#',
          songMatch: 'exact' as const,
          status: 'ready' as const,
        },
      ];

      (apiClient.createSinger as any).mockResolvedValue({
        id: 'newsinger1',
        name: 'New Singer',
      });

      (apiClient.createPitch as any).mockResolvedValue({
        created: true,
        updated: false,
      });

      const result = await CsvImportService.executeImport(previewItems, mockSingers);

      expect(result.success).toBe(true);
      expect(apiClient.createPitch).toHaveBeenCalledWith({
        song_id: 'song1',
        singer_id: 'newsinger1', // Newly created singer
        pitch: 'C#',
      });
    });

    it('should handle singers with null/undefined names or ids', async () => {
      const badSingers = [
        { id: 'singer1', name: 'John Doe' },
        { id: null, name: 'Bad Singer 1' } as any,
        { id: 'singer3', name: '' } as any,
        { id: 'singer4' } as any, // Missing name
      ];

      const previewItems: any[] = [];

      const result = await CsvImportService.executeImport(previewItems, badSingers);

      // Should not crash, should skip invalid singers
      expect(result.success).toBe(true);
    });
  });
});
