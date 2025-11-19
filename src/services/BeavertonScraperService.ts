/**
 * Service for scraping singer and pitch data from Beaverton Sai Bhajans website
 */

export interface BeavertonPitchData {
  singerName: string;
  songName: string;
  pitch: string;
  deity?: string;
  language?: string;
}

export interface BeavertonScrapedData {
  singers: string[];
  pitchData: BeavertonPitchData[];
}

/**
 * Note: This service provides the scraping logic structure.
 * Actual scraping should be done via browser automation in the UI component
 * due to the need for user interaction and confirmation.
 */
export class BeavertonScraperService {
  private static readonly BEAVERTON_URL = 'https://sycois.wixsite.com/beavertonsaibhajans';
  
  /**
   * Get the URL for the Beaverton site
   */
  static getUrl(): string {
    return this.BEAVERTON_URL;
  }
  
  /**
   * Parse singer table data from HTML table rows
   */
  static parseSingerTableRow(row: HTMLTableRowElement): BeavertonPitchData | null {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return null;
      
      const singerName = cells[0]?.textContent?.trim() || '';
      const pitch = cells[1]?.textContent?.trim() || '';
      const songName = cells[2]?.textContent?.trim() || '';
      const deity = cells[3]?.textContent?.trim() || '';
      const language = cells[4]?.textContent?.trim() || '';
      
      if (!singerName || !songName || !pitch) return null;
      
      return {
        singerName,
        songName,
        pitch,
        deity,
        language,
      };
    } catch (error) {
      console.error('Error parsing table row:', error);
      return null;
    }
  }
  
  /**
   * Extract unique singer names from pitch data
   */
  static extractUniqueSingers(pitchData: BeavertonPitchData[]): string[] {
    const uniqueSingers = new Set<string>();
    pitchData.forEach(data => {
      if (data.singerName) {
        uniqueSingers.add(data.singerName);
      }
    });
    return Array.from(uniqueSingers).sort();
  }
  
  /**
   * Get alphabet array for iteration
   */
  static getAlphabetArray(): string[] {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }
}

