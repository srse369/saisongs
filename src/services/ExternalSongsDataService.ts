/**
 * ExternalSongsDataService fetches song data (lyrics, translation, metadata) from externalsongs.org
 */

import type { ExternalSongsData } from '../types';

/**
 * Service for fetching song data from externalsongs.org URLs
 */
class ExternalSongsDataService {
  /**
   * Fetches song data from a externalsongs.org URL
   * @param url - The externalsongs.org song URL
   * @returns Song data including lyrics, translation, and metadata
   */
  async fetchSongData(url: string): Promise<ExternalSongsData> {
    try {
      console.log(`Fetching song data from: ${url}`);
      
      // Fetch the HTML page
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Parse the HTML to extract song data
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract lyrics (this will need to be adjusted based on actual HTML structure)
      const lyricsData = this.extractLyrics(doc);
      const translation = this.extractTranslation(doc);
      const metadata = this.extractMetadata(doc);
      
      return {
        lyrics: lyricsData.lyrics,
        translation,
        languages: lyricsData.languages,
        ...metadata,
      };
    } catch (error) {
      console.error('Error fetching song data:', error);
      throw new Error(`Failed to fetch song data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extracts lyrics from the parsed HTML document
   * @param doc - Parsed HTML document
   * @returns Object with lyrics by language and available languages
   */
  private extractLyrics(doc: Document): { lyrics: Record<string, string>; languages: string[] } {
    const lyrics: Record<string, string> = {};
    const languages: string[] = [];
    
    // TODO: Adjust selectors based on actual externalsongs.org HTML structure
    // For now, return a placeholder
    // Look for elements with class 'song-lyrics' or similar
    const lyricsElement = doc.querySelector('.song-lyrics, .lyrics, [class*="lyrics"]');
    
    if (lyricsElement) {
      const text = lyricsElement.textContent?.trim() || '';
      lyrics['default'] = text;
      languages.push('default');
    }
    
    return { lyrics, languages };
  }

  /**
   * Extracts translation from the parsed HTML document
   * @param doc - Parsed HTML document
   * @returns Translation text or undefined
   */
  private extractTranslation(doc: Document): string | undefined {
    // TODO: Adjust selectors based on actual externalsongs.org HTML structure
    const translationElement = doc.querySelector('.translation, [class*="translation"]');
    return translationElement?.textContent?.trim();
  }

  /**
   * Extracts metadata (tempo, beat, raga, deity) from the parsed HTML document
   * @param doc - Parsed HTML document
   * @returns Metadata object
   */
  private extractMetadata(doc: Document): {
    tempo?: string;
    beat?: string;
    raga?: string;
    deity?: string;
  } {
    // TODO: Adjust selectors based on actual externalsongs.org HTML structure
    return {
      tempo: doc.querySelector('[data-tempo], .tempo')?.textContent?.trim(),
      beat: doc.querySelector('[data-beat], .beat')?.textContent?.trim(),
      raga: doc.querySelector('[data-raga], .raga')?.textContent?.trim(),
      deity: doc.querySelector('[data-deity], .deity')?.textContent?.trim(),
    };
  }
}

// Export singleton instance
export const externalsongsDataService = new ExternalSongsDataService();
export default externalsongsDataService;
