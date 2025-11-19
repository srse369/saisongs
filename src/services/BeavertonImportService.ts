/**
 * Service for importing Beaverton data into our database
 */

import apiClient from './ApiClient';
import type { Singer, Song, Pitch } from '../types';
import type { BeavertonPitchData } from './BeavertonScraperService';
import { normalizePitch, isRecognizedPitch } from '../utils/pitchNormalization';
import { findBestSongMatch } from '../utils/songMatcher';

export interface ImportPreviewItem {
  beavertonData: BeavertonPitchData;
  singerName: string;
  singerId?: string;
  singerExists: boolean;
  songName: string;
  songId?: string;
  songMatch: 'exact' | 'fuzzy' | 'manual' | 'none';
  songSimilarity?: number;
  originalSongName: string;
  normalizedPitch?: string;
  pitchRecognized: boolean;
  status: 'pending' | 'ready' | 'needs_song' | 'needs_pitch' | 'error';
  errorMessage?: string;
  manualSongName?: string; // User-provided song name
}

export interface ImportResult {
  success: boolean;
  singersCreated: number;
  pitchesCreated: number;
  pitchesUpdated: number;
  errors: string[];
}

export class BeavertonImportService {
  /**
   * Create a preview of what will be imported
   */
  static async createImportPreview(
    beavertonData: BeavertonPitchData[],
    existingSingers: Singer[],
    existingSongs: Song[]
  ): Promise<ImportPreviewItem[]> {
    const preview: ImportPreviewItem[] = [];
    
    for (const data of beavertonData) {
      const item: ImportPreviewItem = {
        beavertonData: data,
        singerName: data.singerName,
        singerExists: false,
        songName: data.songName,
        originalSongName: data.songName,
        pitchRecognized: isRecognizedPitch(data.pitch),
        normalizedPitch: normalizePitch(data.pitch) || undefined,
        songMatch: 'none',
        status: 'pending',
      };
      
      // Check if singer exists
      const singer = existingSingers.find(
        s => s.name.toLowerCase() === data.singerName.toLowerCase()
      );
      if (singer) {
        item.singerId = singer.id;
        item.singerExists = true;
      }
      
      // Try to match song
      const songMatch = findBestSongMatch(data.songName, existingSongs, 90);
      if (songMatch) {
        item.songId = songMatch.song.id;
        item.songName = songMatch.song.name;
        item.songMatch = songMatch.similarity === 100 ? 'exact' : 'fuzzy';
        item.songSimilarity = songMatch.similarity;
      } else {
        // If no match above threshold, check for songs that contain the entire Beaverton name at the start
        const beavertonLower = data.songName.toLowerCase().trim();
        const containsMatches = existingSongs.filter(song => 
          song.name.toLowerCase().trim().startsWith(beavertonLower)
        );
        
        // If there's exactly one song that starts with the Beaverton name, auto-select it
        if (containsMatches.length === 1) {
          item.songId = containsMatches[0].id;
          item.songName = containsMatches[0].name;
          item.songMatch = 'fuzzy';
          item.songSimilarity = 100; // Full containment from start
        }
      }
      
      // Determine status
      if (!item.pitchRecognized) {
        item.status = 'needs_pitch';
        item.errorMessage = `Pitch format "${data.pitch}" not recognized`;
      } else if (!item.songId) {
        item.status = 'needs_song';
        item.errorMessage = 'No matching song found';
      } else {
        item.status = 'ready';
      }
      
      preview.push(item);
    }
    
    return preview;
  }
  
  /**
   * Import singers from preview items
   */
  static async importSingers(previewItems: ImportPreviewItem[]): Promise<Map<string, string>> {
    const singerMap = new Map<string, string>(); // singerName -> singerId
    
    // Get unique singers - check ALL items that will be imported, not just 'ready' status
    const singersToCreate = new Set<string>();
    previewItems.forEach(item => {
      // If singer already exists, add to map
      if (item.singerId) {
        singerMap.set(item.singerName, item.singerId);
      }
      // If singer doesn't exist and this item will be processed, mark for creation
      if (!item.singerExists && (item.status === 'ready' || item.status === 'needs_song' || item.status === 'needs_pitch')) {
        singersToCreate.add(item.singerName);
      }
    });
    
    // Create singers
    for (const singerName of singersToCreate) {
      try {
        const newSinger = await apiClient.createSinger({ name: singerName });
        if (newSinger && newSinger.id) {
          singerMap.set(singerName, newSinger.id);
          console.log(`Created singer: ${singerName} with ID: ${newSinger.id}`);
        } else {
          console.error(`Failed to create singer ${singerName}: No ID returned`);
        }
      } catch (error) {
        console.error(`Failed to create singer ${singerName}:`, error);
      }
    }
    
    return singerMap;
  }
  
  /**
   * Import pitches from preview items
   */
  static async importPitches(
    previewItems: ImportPreviewItem[],
    singerMap: Map<string, string>
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      singersCreated: singerMap.size,
      pitchesCreated: 0,
      pitchesUpdated: 0,
      errors: [],
    };
    
    const readyItems = previewItems.filter(item => item.status === 'ready');
    
    for (const item of readyItems) {
      try {
        // Get singer ID (try both exact match and case-insensitive)
        let singerId = item.singerId;
        if (!singerId) {
          singerId = singerMap.get(item.singerName.toLowerCase().trim());
        }
        if (!singerId) {
          result.errors.push(`No singer ID for "${item.singerName}". Available singers: ${Array.from(singerMap.keys()).join(', ')}`);
          result.success = false;
          continue;
        }
        
        // Get song ID
        if (!item.songId) {
          result.errors.push(`No song ID for "${item.songName}"`);
          result.success = false;
          continue;
        }
        
        // Get normalized pitch
        if (!item.normalizedPitch) {
          result.errors.push(`No normalized pitch for "${item.beavertonData.pitch}"`);
          result.success = false;
          continue;
        }
        
        // Check if pitch already exists
        const existingPitches = await apiClient.getPitches();
        const existingPitch = existingPitches.find(
          (p: any) => p.singer_id === singerId && p.song_id === item.songId
        );
        
        // Server expects snake_case field names
        const pitchDataForServer = {
          song_id: item.songId,
          singer_id: singerId,
          pitch: item.normalizedPitch,
        };
        
        console.log('Creating pitch with data:', pitchDataForServer);
        
        if (existingPitch) {
          // Update existing pitch
          console.log(`Updating existing pitch ID: ${existingPitch.id}`);
          await apiClient.updatePitch(existingPitch.id!, { pitch: item.normalizedPitch });
          result.pitchesUpdated++;
        } else {
          // Create new pitch
          console.log(`Creating new pitch for singer ${item.singerName} - song ${item.songName}`);
          const createdPitch = await apiClient.createPitch(pitchDataForServer);
          console.log('Created pitch result:', createdPitch);
          result.pitchesCreated++;
        }
      } catch (error) {
        const errorMsg = `Failed to import pitch for ${item.singerName} - ${item.songName}: ${error}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
        result.success = false;
      }
    }
    
    return result;
  }
  
  /**
   * Execute full import
   */
  static async executeImport(
    previewItems: ImportPreviewItem[],
    existingSingers: Singer[]
  ): Promise<ImportResult> {
    try {
      // Build singer map from existing singers (case-insensitive matching)
      const singerMap = new Map<string, string>();
      existingSingers.forEach(s => {
        if (s.name && s.id) {
          singerMap.set(s.name.toLowerCase().trim(), s.id);
        }
      });
      
      // Import new singers
      const newSingerMap = await this.importSingers(previewItems);
      newSingerMap.forEach((id, name) => {
        if (name && id) {
          singerMap.set(name.toLowerCase().trim(), id);
        }
      });
      
      // Create a helper function to get singer ID (case-insensitive)
      const getSingerId = (singerName: string): string | undefined => {
        return singerMap.get(singerName.toLowerCase().trim());
      };
      
      // Update preview items with singer IDs for import
      const updatedItems = previewItems.map(item => ({
        ...item,
        singerId: item.singerId || getSingerId(item.singerName),
      }));
      
      // Import pitches
      const result = await this.importPitches(updatedItems, singerMap);
      
      return result;
    } catch (error) {
      return {
        success: false,
        singersCreated: 0,
        pitchesCreated: 0,
        pitchesUpdated: 0,
        errors: [`Import failed: ${error}`],
      };
    }
  }
}

