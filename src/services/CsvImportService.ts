/**
 * Service for importing CSV pitch data into our database
 */

import apiClient from './ApiClient';
import type { Singer, Song } from '../types';
import type { CsvPitchData } from './CsvParserService';
import { normalizePitch, isRecognizedPitch } from '../utils/pitchNormalization';

/** Compare DB pitch with normalized CSV pitch (handles Db vs C#, 2M vs D major, etc.) */
function pitchesMatch(dbPitch: string, normalizedPitch: string): boolean {
  if (!dbPitch) return false;
  const dbNorm = normalizePitch(dbPitch) ?? dbPitch.trim();
  return dbNorm === normalizedPitch;
}
import { findBestSongMatch, findBestSingerMatch, normalizeSongNameForMapping } from '../utils/songMatcher';

export interface ImportPreviewItem {
  csvData: CsvPitchData;
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
  status: 'pending' | 'ready' | 'needs_song' | 'needs_pitch' | 'error' | 'dropped';
  errorMessage?: string;
  manualSongName?: string; // User-provided song name
}

export interface ImportResult {
  success: boolean;
  singersCreated: number;
  pitchesCreated: number;
  pitchesUpdated: number;
  pitchesSkipped: number; // Already exists, no change needed
  errors: string[];
}

export type ImportProgressPhase = 'singers' | 'pitches';

/** User chooses to map CSV singer to existing singer */
export interface ResolveSingerMap {
  singerId: string;
}

/** User chooses to create a new singer */
export interface ResolveSingerCreate {
  create: true;
}

export type ResolveSingerResult = ResolveSingerMap | ResolveSingerCreate;

/** Callback to resolve a singer not in db/cache: map to existing or create new */
export type ResolveSingerCallback = (singerName: string) => Promise<ResolveSingerResult>;

export interface CreateImportPreviewResult {
  items: ImportPreviewItem[];
  alreadyExistsCount: number;
}

export class CsvImportService {
  /**
   * Create a preview of what will be imported.
   * Items that already exist in the database (same song, singer, pitch) are excluded from the preview.
   */
  static async createImportPreview(
    csvData: CsvPitchData[],
    existingSingers: Singer[],
    existingSongs: Song[],
    songMappings?: Map<string, { dbSongId: string; dbSongName: string }>,
    onProgress?: (current: number, total: number) => void,
    existingPitches?: Array<{ songId: string; singerId: string; pitch: string }>
  ): Promise<CreateImportPreviewResult> {
    const preview: ImportPreviewItem[] = [];
    let alreadyExistsCount = 0;
    const total = csvData.length;
    
    for (let i = 0; i < csvData.length; i++) {
      const data = csvData[i];
      onProgress?.(i + 1, total);
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      // Clean singer name to prevent whitespace duplicates
      const cleanSingerName = data.singerName.trim();
      
      // Check if pitch is blank, null, hyphen, or similar - these rows will be marked as dropped
      const pitchValue = data.pitch?.trim() || '';
      const isBlankPitch = !pitchValue || pitchValue === '-' || pitchValue.toLowerCase() === 'null' || pitchValue.toLowerCase() === 'n/a';
      
      if (isBlankPitch) {
        // Mark rows with blank/null/hyphen pitches as dropped
        const item: ImportPreviewItem = {
          csvData: data,
          singerName: cleanSingerName,
          singerExists: false,
          songName: data.songName.trim(),
          originalSongName: data.songName.trim(),
          pitchRecognized: false,
          songMatch: 'none',
          status: 'dropped',
          errorMessage: `Dropped: Pitch is blank/null/hyphen (${data.pitch || 'empty'})`,
        };
        preview.push(item);
        continue;
      }
      
      // Normalize pitch (uses pre-loaded in-memory PITCH_MAPPINGS)
      let normalizedPitch = normalizePitch(data.pitch);
      let pitchRecognized = normalizedPitch !== null;
      
      const item: ImportPreviewItem = {
        csvData: data,
        singerName: cleanSingerName,
        singerExists: false,
        songName: data.songName.trim(),
        originalSongName: data.songName.trim(),
        pitchRecognized,
        normalizedPitch: normalizedPitch || undefined,
        songMatch: 'none',
        status: 'pending',
      };
      
      // Check if singer exists: exact match first, then fuzzy match for slightly adjusted names
      let singer = existingSingers.find(
        s => s.name.toLowerCase().trim() === cleanSingerName.toLowerCase()
      );
      if (!singer) {
        const singerMatch = findBestSingerMatch(cleanSingerName, existingSingers, 85);
        if (singerMatch) singer = singerMatch.singer;
      }
      if (singer) {
        item.singerId = singer.id;
        item.singerExists = true;
      }
      
      // Try to match song
      
      // Check stored mappings first (in-memory lookup for performance)
      // Normalize the song name to match against stored mappings
      if (songMappings) {
        const normalizedKey = normalizeSongNameForMapping(data.songName);
        const storedMapping = songMappings.get(normalizedKey);
        
        if (storedMapping) {
          const mappedSong = existingSongs.find(s => s.id === storedMapping.dbSongId);
          if (mappedSong) {
            item.songId = mappedSong.id;
            item.songName = mappedSong.name;
            item.songMatch = 'exact';
            item.songSimilarity = 100;
            
            // Update status based on pitch
            if (item.pitchRecognized) {
              item.status = 'ready';
            } else {
              item.status = 'needs_pitch';
            }
            
            // Skip items that already exist in DB (same song, singer, pitch)
            if (existingPitches && item.status === 'ready' && item.singerId && item.normalizedPitch) {
              const alreadyExists = existingPitches.some((p) =>
                p.songId === item.songId &&
                p.singerId === item.singerId &&
                pitchesMatch(p.pitch, item.normalizedPitch!)
              );
              if (alreadyExists) {
                alreadyExistsCount++;
                continue;
              }
            }
            
            preview.push(item);
            continue; // Skip fuzzy matching
          }
        }
      }
      
      const songMatch = findBestSongMatch(data.songName, existingSongs, 90);
      
      if (songMatch) {
        item.songId = songMatch.song.id;
        item.songName = songMatch.song.name;
        item.songMatch = songMatch.similarity === 100 ? 'exact' : 'fuzzy';
        item.songSimilarity = songMatch.similarity;
      } else {
        // If no match above threshold, check for songs that contain the entire CSV name at the start
        const csvLower = data.songName.toLowerCase().trim();
        const containsMatches = existingSongs.filter(song => 
          song.name.toLowerCase().trim().startsWith(csvLower)
        );
        
        // If there's exactly one song that starts with the CSV name, auto-select it
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

      // Skip items that already exist in DB (same song, singer, pitch)
      if (existingPitches && item.status === 'ready' && item.singerId && item.normalizedPitch) {
        const alreadyExists = existingPitches.some((p) =>
          p.songId === item.songId &&
          p.singerId === item.singerId &&
          pitchesMatch(p.pitch, item.normalizedPitch!)
        );
        if (alreadyExists) {
          alreadyExistsCount++;
          continue; // Don't add to preview
        }
      }
      
      preview.push(item);
    }
    
    // Sort preview: items needing attention first (needs_song, needs_pitch), then ready, then dropped at bottom
    preview.sort((a, b) => {
      const statusPriority: Record<string, number> = {
        'needs_song': 1,
        'needs_pitch': 2,
        'ready': 3,
        'pending': 4,
        'error': 5,
        'dropped': 99, // Dropped items go to the bottom
      };
      
      const aPriority = statusPriority[a.status] || 50;
      const bPriority = statusPriority[b.status] || 50;
      
      return aPriority - bPriority;
    });
    
    return { items: preview, alreadyExistsCount };
  }
  
  /**
   * Import singers from preview items.
   * For singers not in db/cache, calls resolveSinger to let user map to existing or create new.
   * Returns a Map with lowercase singer names as keys and the count of newly created singers.
   */
  static async importSingers(
    previewItems: ImportPreviewItem[],
    onProgress?: (current: number, total: number) => void,
    resolveSinger?: ResolveSingerCallback
  ): Promise<{ singerMap: Map<string, string>; newSingersCount: number }> {
    const singerMap = new Map<string, string>(); // lowercase singerName -> singerId
    let newSingersCount = 0;
    
    // Get unique singers - check ALL items that will be imported, not just 'ready' status
    const singersToResolve = new Set<string>();
    previewItems.forEach(item => {
      // If singer already exists, add to map (lowercase key for consistency)
      if (item.singerId) {
        singerMap.set(item.singerName.toLowerCase().trim(), item.singerId);
      }
      // If singer doesn't exist and this item will be processed, needs resolution
      if (!item.singerExists && (item.status === 'ready' || item.status === 'needs_song' || item.status === 'needs_pitch')) {
        singersToResolve.add(item.singerName);
      }
    });
    
    const singersArray = Array.from(singersToResolve);
    const total = singersArray.length;
    
    for (let i = 0; i < singersArray.length; i++) {
      const singerName = singersArray[i];
      onProgress?.(i + 1, total);
      const key = singerName.toLowerCase().trim();
      
      try {
        let singerId: string | undefined;
        
        if (resolveSinger) {
          const resolution = await resolveSinger(singerName);
          if ('singerId' in resolution) {
            singerId = resolution.singerId;
          } else {
            // User chose to create new singer
            const result = await apiClient.createSinger({ name: singerName });
            singerId = result?.id || result?.ID;
            if (singerId && !result?.message) newSingersCount++;
          }
        } else {
          // No callback: create singer as before (backward compatible)
          const result = await apiClient.createSinger({ name: singerName });
          singerId = result?.id || result?.ID;
          if (singerId && !result?.message) newSingersCount++;
        }
        
        if (singerId) {
          singerMap.set(key, singerId);
        } else {
          console.error(`Failed to create singer "${singerName}": No ID in response`);
        }
      } catch (error) {
        console.error(`Failed to resolve singer "${singerName}":`, error);
        // When using resolveSinger callback, re-throw so caller can handle (e.g. user cancelled)
        if (resolveSinger) throw error;
        // Without callback: log and continue (backward compatible)
      }
    }
    
    return { singerMap, newSingersCount };
  }
  
  /**
   * Import pitches from preview items
   */
  static async importPitches(
    previewItems: ImportPreviewItem[],
    singerMap: Map<string, string>,
    singersCreatedCount: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      singersCreated: singersCreatedCount,
      pitchesCreated: 0,
      pitchesUpdated: 0,
      pitchesSkipped: 0,
      errors: [],
    };
    
    const readyItems = previewItems.filter(item => item.status === 'ready');
    const total = readyItems.length;
    
    for (let i = 0; i < readyItems.length; i++) {
      const item = readyItems[i];
      onProgress?.(i + 1, total);
      try {
        // Get singer ID (case-insensitive lookup)
        let singerId = item.singerId;
        if (!singerId) {
          const lookupKey = item.singerName.toLowerCase().trim();
          singerId = singerMap.get(lookupKey);
        }
        
        if (!singerId) {
          result.errors.push(`No singer ID for "${item.singerName}"`);
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
          result.errors.push(`No normalized pitch for "${item.csvData.pitch}"`);
          result.success = false;
          continue;
        }
        
        // Server expects snake_case field names
        const pitchDataForServer = {
          songId: item.songId,
          singerId: singerId,
          pitch: item.normalizedPitch,
        };
        
        // Backend handles duplicate detection and returns { created: bool, updated: bool }
        const response = await apiClient.createPitch(pitchDataForServer);
        
        // Backend returns:
        // - created: true, updated: false -> newly created
        // - created: false, updated: true -> existing pitch updated
        // - created: false, updated: false -> already exists (no change)
        if (response?.created) {
          result.pitchesCreated++;
        } else if (response?.updated) {
          result.pitchesUpdated++;
        } else {
          result.pitchesSkipped++;
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
    existingSingers: Singer[],
    onProgress?: (phase: ImportProgressPhase, current: number, total: number) => void,
    resolveSinger?: ResolveSingerCallback
  ): Promise<ImportResult> {
    try {
      // Build singer map from existing singers (case-insensitive matching)
      const singerMap = new Map<string, string>();
      existingSingers.forEach(s => {
        if (s.name && s.id) {
          singerMap.set(s.name.toLowerCase().trim(), s.id);
        }
      });
      
      // Import new singers (resolveSinger prompts user for unknown singers)
      const { singerMap: newSingerMap, newSingersCount } = await this.importSingers(
        previewItems,
        (current, total) => onProgress?.('singers', current, total),
        resolveSinger
      );
      
      // Merge new singers into main map
      newSingerMap.forEach((id, name) => {
        if (name && id) {
          const key = name.toLowerCase().trim();
          singerMap.set(key, id);
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
      const result = await this.importPitches(
        updatedItems,
        singerMap,
        newSingersCount,
        (current, total) => onProgress?.('pitches', current, total)
      );
      
      return result;
    } catch (error) {
      return {
        success: false,
        singersCreated: 0,
        pitchesCreated: 0,
        pitchesUpdated: 0,
        pitchesSkipped: 0,
        errors: [`Import failed: ${error}`],
      };
    }
  }
}
