/**
 * ImportService orchestrates the bulk import process from sairhythms.org
 * Handles song discovery, matching, and database operations
 */

import songService from './SongService';
import sairhythmsScraperService, { type DiscoveredSong } from './SairhythmsScraperService';

/**
 * Tracks progress during the import process
 */
export interface ImportProgress {
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  currentSong: string | null;
}

/**
 * Represents an error that occurred during import
 */
export interface ImportError {
  songName: string;
  error: string;
}

/**
 * Final result of the import operation
 */
export interface ImportResult {
  success: boolean;
  stats: ImportProgress;
  errors: ImportError[];
}

/**
 * Service for importing songs from sairhythms.org into the database
 */
class ImportService {


  /**
   * Processes a single discovered song (create or update)
   * Uses UPSERT so we don't need to check for existing songs
   * @param discovered - Song discovered from sairhythms.org
   * @returns 'created' or 'updated' to indicate the operation performed
   */
  private async processSong(
    discovered: DiscoveredSong
  ): Promise<'created' | 'updated'> {
    // Get the existing song count to determine if this is create or update
    const existingSongs = await songService.getAllSongs();
    const existingCount = existingSongs.filter(s => s.sairhythmsUrl === discovered.url).length;
    
    // Create/update song with all data (UPSERT handles duplicates)
    await songService.createSong({
      name: discovered.name,
      sairhythmsUrl: discovered.url,
      title: (discovered as any).title,
      title2: (discovered as any).title2,
      lyrics: (discovered as any).lyrics,
      meaning: (discovered as any).meaning,
      language: (discovered as any).language,
      deity: (discovered as any).deity,
      tempo: (discovered as any).tempo,
      beat: (discovered as any).beat,
      raga: (discovered as any).raga,
      level: (discovered as any).level,
      songTags: (discovered as any).songtags,
      audioLink: (discovered as any).audio_link,
      videoLink: (discovered as any).video_link,
      ulink: (discovered as any).ulink,
      goldenVoice: (discovered as any).golden_voice === 'yes',
    });
    
    return existingCount > 0 ? 'updated' : 'created';
  }

  /**
   * Imports songs from manually provided JSON data
   * @param songs - Array of songs with name and url (and optionally all other fields)
   * @param onProgress - Callback function to report progress updates
   * @returns Import result with statistics and errors
   */
  async importManualSongs(
    songs: DiscoveredSong[],
    onProgress: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    // Initialize progress statistics
    const stats: ImportProgress = {
      total: songs.length,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      currentSong: null
    };
    
    const errors: ImportError[] = [];
    
    try {
      // Process each song
      for (const discovered of songs) {
        stats.currentSong = discovered.name;
        
        try {
          // Process the song (UPSERT handles create or update)
          const operation = await this.processSong(discovered);
          
          // Update statistics
          if (operation === 'created') {
            stats.created++;
          } else {
            stats.updated++;
          }
          
          stats.processed++;
          
          // Report progress after each song with updated statistics
          onProgress({ ...stats });
          
        } catch (error) {
          // Collect error without stopping import process
          stats.failed++;
          
          // Include song name and error message in error collection
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            songName: discovered.name,
            error: errorMessage
          });
          
          // Log error for debugging
          console.error(`Failed to import song "${discovered.name}":`, errorMessage);
          
          // Report progress even after errors
          onProgress({ ...stats });
        }
      }
      
      // Clear current song after completion
      stats.currentSong = null;
      
      // Return final result
      return {
        success: true,
        stats,
        errors
      };
      
    } catch (error) {
      // Critical error during import
      return {
        success: false,
        stats,
        errors: [{
          songName: 'System',
          error: error instanceof Error ? error.message : 'Unknown critical error'
        }]
      };
    }
  }

  /**
   * Imports all songs from sairhythms.org
   * @param onProgress - Callback function to report progress updates
   * @returns Import result with statistics and errors
   */
  async importAllSongs(
    onProgress: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    // Initialize progress statistics
    const stats: ImportProgress = {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      currentSong: null
    };
    
    const errors: ImportError[] = [];
    
    try {
      // Step 1: Discover all songs from sairhythms.org
      const discoveredSongs = await sairhythmsScraperService.discoverAllSongs();
      stats.total = discoveredSongs.length;
      
      // Step 2: Process each discovered song
      for (const discovered of discoveredSongs) {
        stats.currentSong = discovered.name;
        
        try {
          // Process the song (UPSERT handles create or update)
          const operation = await this.processSong(discovered);
          
          // Update statistics
          if (operation === 'created') {
            stats.created++;
          } else {
            stats.updated++;
          }
          
          stats.processed++;
          
          // Report progress after each song with updated statistics
          onProgress({ ...stats });
          
        } catch (error) {
          // Collect error without stopping import process
          stats.failed++;
          
          // Include song name and error message in error collection
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            songName: discovered.name,
            error: errorMessage
          });
          
          // Log error for debugging
          console.error(`Failed to import song "${discovered.name}":`, errorMessage);
          
          // Report progress even after errors
          onProgress({ ...stats });
        }
      }
      
      // Clear current song after completion
      stats.currentSong = null;
      
      // Return final result
      return {
        success: true,
        stats,
        errors
      };
      
    } catch (error) {
      // Critical error during discovery or setup
      return {
        success: false,
        stats,
        errors: [{
          songName: 'System',
          error: error instanceof Error ? error.message : 'Unknown critical error'
        }]
      };
    }
  }
}

// Export singleton instance
export const importService = new ImportService();
export default importService;
