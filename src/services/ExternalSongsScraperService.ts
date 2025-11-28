/**
 * ExternalSongsScraperService handles discovering and extracting song data from externalsongs.org
 */

/**
 * Represents a song discovered from externalsongs.org
 */
export interface DiscoveredSong {
  name: string;
  url: string;
}

/**
 * Service for scraping song data from externalsongs.sathyasai.org
 */
class ExternalSongsScraperService {
  private readonly EXTERNALSONGS_BASE_URL = 'https://externalsongs.sathyasai.org';

  /**
   * Discovers all songs available on externalsongs.sathyasai.org
   * 
   * Due to CORS restrictions, we need to open the website in a new window
   * and extract the song data from there.
   * 
   * @returns Array of discovered songs with names and URLs
   * @throws Error if unable to fetch or parse after retries
   */
  async discoverAllSongs(): Promise<DiscoveredSong[]> {
    try {
      console.log('Opening externalsongs.sathyasai.org in a new window...');
      console.log('Please wait while we extract song data...');
      
      // Open the website in a new window to bypass CORS
      const songs = await this.loadSongsViaNewWindow();
      
      if (songs.length === 0) {
        throw new Error('No songs found. The website may have changed its structure.');
      }
      
      // Remove duplicates
      const uniqueSongs = this.removeDuplicates(songs);
      
      console.log(`Discovered ${uniqueSongs.length} unique songs from externalsongs.sathyasai.org`);
      return uniqueSongs;
    } catch (error) {
      console.error('Error discovering songs:', error);
      
      // Provide helpful error message with manual instructions
      const helpMessage = `
Unable to automatically import songs due to browser security restrictions.

MANUAL IMPORT INSTRUCTIONS:
1. Open https://externalsongs.sathyasai.org/songs in a new tab
2. Wait for the page to fully load
3. Open browser console (F12 or Cmd+Option+I on Mac)
4. Copy and paste this command:
   copy(JSON.stringify(window.superSongJson))
5. The song data will be copied to your clipboard
6. Use the "Manual Import (Paste JSON)" option in the import dialog
7. Paste the data and click "Import from JSON"

Note: Automatic import is currently not possible due to CORS restrictions.
      `.trim();
      
      throw new Error(helpMessage);
    }
  }

  /**
   * Loads songs by opening the website in a new window
   * This bypasses CORS restrictions by using window.open
   * @returns Array of discovered songs
   */
  private async loadSongsViaNewWindow(): Promise<DiscoveredSong[]> {
    return new Promise((resolve, reject) => {
      // Open the website in a new window
      const newWindow = window.open(`${this.EXTERNALSONGS_BASE_URL}/songs`, '_blank', 'width=800,height=600');
      
      if (!newWindow) {
        reject(new Error('Failed to open new window. Please allow popups for this site.'));
        return;
      }
      
      let timeoutId: NodeJS.Timeout;
      let checkInterval: NodeJS.Timeout;
      
      // Set timeout for loading
      const timeout = 30000; // 30 seconds
      timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        newWindow.close();
        reject(new Error('Timeout loading songs from website'));
      }, timeout);
      
      // Check periodically if the data is loaded
      checkInterval = setInterval(() => {
        try {
          // Try to access the superSongJson data
          const superSongJson = (newWindow as any).superSongJson;
          
          if (superSongJson && Array.isArray(superSongJson) && superSongJson.length > 0) {
            console.log(`Found ${superSongJson.length} songs in JavaScript data`);
            
            // Convert to our format
            const songs: DiscoveredSong[] = superSongJson.map((song: any) => ({
              name: song.name || 'Unknown Song',
              url: `${this.EXTERNALSONGS_BASE_URL}/node/${song.song_id}`
            })).filter((song: DiscoveredSong) => song.name !== 'Unknown Song');
            
            clearTimeout(timeoutId);
            clearInterval(checkInterval);
            newWindow.close();
            resolve(songs);
          }
        } catch (error) {
          // CORS error or data not yet loaded, keep trying
        }
      }, 1000); // Check every second
    });
  }





  /**
   * Removes duplicate songs based on URL
   * @param songs - Array of discovered songs
   * @returns Array with duplicates removed
   */
  private removeDuplicates(songs: DiscoveredSong[]): DiscoveredSong[] {
    const seenUrls = new Set<string>();
    const uniqueSongs: DiscoveredSong[] = [];
    
    for (const song of songs) {
      if (!seenUrls.has(song.url)) {
        seenUrls.add(song.url);
        uniqueSongs.push(song);
      }
    }
    
    console.log(`Removed ${songs.length - uniqueSongs.length} duplicate songs`);
    return uniqueSongs;
  }


}

// Export singleton instance
export const externalsongsScraperService = new ExternalSongsScraperService();
export default externalsongsScraperService;
