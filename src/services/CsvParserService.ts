/**
 * Service for parsing CSV data for pitch imports
 */

export interface CsvPitchData {
  songName: string;
  singerName: string;
  pitch: string;
}

export interface CsvScrapedData {
  singers: string[];
  pitchData: CsvPitchData[];
}

/**
 * CSV Parser Service for handling pitch import data
 */
export class CsvParserService {
  /**
   * Parse CSV row data (Song Title, Singer, Pitch)
   */
  static parseCSVRow(row: string): CsvPitchData | null {
    try {
      const parts = row.split(',').map(p => p.trim().replace(/^"|"$/g, '')); // Remove quotes
      if (parts.length < 3) return null;
      
      const songName = parts[0];
      const singerName = parts[1];
      const pitch = parts[2];
      
      if (!singerName || !songName || !pitch) return null;
      
      return {
        songName,
        singerName,
        pitch,
      };
    } catch (error) {
      console.error('Error parsing CSV row:', error);
      return null;
    }
  }
  
  /**
   * Extract unique singer names from pitch data
   */
  static extractUniqueSingers(pitchData: CsvPitchData[]): string[] {
    const uniqueSingers = new Set<string>();
    pitchData.forEach(data => {
      if (data.singerName) {
        uniqueSingers.add(data.singerName);
      }
    });
    return Array.from(uniqueSingers).sort();
  }
}

