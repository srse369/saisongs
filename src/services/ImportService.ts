/**
 * ImportService orchestrates the bulk import process from external sources.
 * Handles song discovery, matching, and database operations.
 */

import apiClient from './ApiClient';
import songService from './SongService';
import externalSongsScraperService, { type DiscoveredSong } from './ExternalSongsScraperService';
import type { Song } from '../types';

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
 * Service for importing songs from external sources into the database
 */
class ImportService {

  /**
   * Maximum number of songs to process concurrently during import.
   * This allows us to perform "batched" imports without overloading the API/DB.
   */
  private static readonly BATCH_SIZE = 10;

  /**
   * Extracts reference pitches from a song URL via backend proxy to avoid CORS
   * @param url - Song URL from external source
   * @returns Object with reference gents and ladies pitches, or nulls if not found
   */
  private async extractReferencePitches(url: string): Promise<{
    referenceGentsPitch: string | null;
    referenceLadiesPitch: string | null;
  }> {
    try {
      console.log(`📊 Fetching reference pitches from: ${url}`);
      const response = await apiClient.post<{
        referenceGentsPitch: string | null;
        referenceLadiesPitch: string | null;
      }>('/songs/extract-pitches', { url });
      
      console.log(`✅ Extracted pitches - Gents: ${response.referenceGentsPitch}, Ladies: ${response.referenceLadiesPitch}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to extract reference pitches from ${url}:`, error);
      return { referenceGentsPitch: null, referenceLadiesPitch: null };
    }
  }

  /**
   * Processes a single discovered song (create or update) using an in-memory cache
   * of existing songs keyed by externalSourceUrl. This avoids fetching all songs
   * for every record and lets us perform a true UPSERT behavior.
   *
   * @param discovered - Song discovered from external source
   * @param existingByUrl - Map of existing songs keyed by externalSourceUrl
   * @returns 'created' or 'updated' to indicate the operation performed
   */
  private async processSong(
    discovered: DiscoveredSong,
    existingByUrl: Map<string, Song>
  ): Promise<'created' | 'updated'> {
    const existing = existingByUrl.get(discovered.url);

    // Debug: Log data being passed
    console.log('🔍 ImportService.processSong:', {
      name: discovered.name,
      url: discovered.url?.substring(0, 80),
      has_lyrics: !!(discovered as any).lyrics,
      lyrics_length: ((discovered as any).lyrics || '').length,
      has_meaning: !!(discovered as any).meaning,
      meaning_length: ((discovered as any).meaning || '').length,
      operation: existing ? 'update' : 'create',
    });

    // Extract reference pitches from the song URL
    const { referenceGentsPitch, referenceLadiesPitch } = await this.extractReferencePitches(discovered.url);

    const payload = {
      name: discovered.name,
      externalSourceUrl: discovered.url,
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
      goldenVoice: (discovered as any).golden_voice === 'yes',
      referenceGentsPitch: referenceGentsPitch || undefined,
      referenceLadiesPitch: referenceLadiesPitch || undefined,
    };

    if (existing) {
      // Update existing song
      const updated = await songService.updateSong(existing.id, payload as any);
      if (updated) {
        existingByUrl.set(discovered.url, updated);
      }
      return 'updated';
    } else {
      // Create new song
      const created = await songService.createSong(payload);
      existingByUrl.set(discovered.url, created);
      return 'created';
    }
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
      // Build a cache of existing songs keyed by externalSourceUrl so we can do UPSERTs efficiently
      const existingSongs = await songService.getAllSongs();
      const existingByUrl = new Map<string, Song>(
        existingSongs
          .filter(s => !!s.externalSourceUrl)
          .map(s => [s.externalSourceUrl, s])
      );

      // Process songs in small concurrent batches to speed up imports
      for (let i = 0; i < songs.length; i += ImportService.BATCH_SIZE) {
        const batch = songs.slice(i, i + ImportService.BATCH_SIZE);

        await Promise.all(
          batch.map(async (discovered) => {
            stats.currentSong = discovered.name;

            try {
              const operation = await this.processSong(discovered, existingByUrl);

              // Update statistics
              if (operation === 'created') {
                stats.created++;
              } else {
                stats.updated++;
              }

              stats.processed++;
            } catch (error) {
              // Collect error without stopping import process
              stats.failed++;

              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              errors.push({
                songName: discovered.name,
                error: errorMessage,
              });

              console.error(`Failed to import song "${discovered.name}":`, errorMessage);
            } finally {
              // Report progress after each song with updated statistics
              onProgress({ ...stats });
            }
          })
        );
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
   * Imports all songs from external sources
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
      // Step 1: Discover all songs from external sources
      const discoveredSongs = await externalSongsScraperService.discoverAllSongs();
      stats.total = discoveredSongs.length;

      // Step 2: Build a cache of existing songs keyed by externalSourceUrl
      const existingSongs = await songService.getAllSongs();
      const existingByUrl = new Map<string, Song>(
        existingSongs
          .filter(s => !!s.externalSourceUrl)
          .map(s => [s.externalSourceUrl, s])
      );
      
      // Step 3: Process discovered songs in concurrent batches
      for (let i = 0; i < discoveredSongs.length; i += ImportService.BATCH_SIZE) {
        const batch = discoveredSongs.slice(i, i + ImportService.BATCH_SIZE);

        await Promise.all(
          batch.map(async (discovered) => {
            stats.currentSong = discovered.name;

            try {
              const operation = await this.processSong(discovered, existingByUrl);

              if (operation === 'created') {
                stats.created++;
              } else {
                stats.updated++;
              }

              stats.processed++;
            } catch (error) {
              stats.failed++;

              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              errors.push({
                songName: discovered.name,
                error: errorMessage,
              });

              console.error(`Failed to import song "${discovered.name}":`, errorMessage);
            } finally {
              onProgress({ ...stats });
            }
          })
        );
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
