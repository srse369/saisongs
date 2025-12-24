/**
 * Service for persisting import mappings (songs and pitches) in database
 * Stores manual matches to improve future imports
 */

import apiClient from './ApiClient';
import { normalizeSongNameForMapping } from '../utils/songMatcher';

export interface SongMapping {
  csvSongName: string;
  dbSongId: string;
  dbSongName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PitchMapping {
  originalFormat: string;
  normalizedFormat: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get all stored song mappings from database
 */
export async function getStoredSongMappings(): Promise<SongMapping[]> {
  try {
    const response = await apiClient.get('/import-mappings/songs');
    return response;
  } catch (error) {
    console.error('Error loading song mappings from database:', error);
    return [];
  }
}

/**
 * Save a song mapping to database
 * Normalizes the CSV song name for consistent storage and lookup
 */
export async function saveSongMapping(csvSongName: string, dbSongId: string, dbSongName: string): Promise<boolean> {
  try {
    // Normalize the CSV song name for consistent storage
    const normalizedCsvName = normalizeSongNameForMapping(csvSongName);
    
    await apiClient.post('/import-mappings/songs', {
      csv_song_name: normalizedCsvName,
      dbSongId: dbSongId,
      db_song_name: dbSongName,
    });
    return true;
  } catch (error) {
    console.error('Error saving song mapping:', error);
    return false;
  }
}

/**
 * Find a stored song mapping by CSV name from database
 * Normalizes the CSV song name for consistent lookup
 * Falls back to exact match for backward compatibility with old mappings
 */
export async function findStoredSongMapping(csvSongName: string): Promise<SongMapping | null> {
  try {
    // First try with normalized name (for new mappings)
    const normalizedCsvName = normalizeSongNameForMapping(csvSongName);
    
    const response = await apiClient.get(`/import-mappings/songs/${encodeURIComponent(normalizedCsvName)}`);
    return response;
  } catch (error) {
    // If not found, try exact match for backward compatibility with old non-normalized mappings
    try {
      const trimmedName = csvSongName.trim();
      if (trimmedName !== normalizeSongNameForMapping(csvSongName)) {
        const response = await apiClient.get(`/import-mappings/songs/${encodeURIComponent(trimmedName)}`);
        
        // If found with old format, re-save with normalized format for future
        if (response) {
          await saveSongMapping(csvSongName, response.dbSongId, response.dbSongName);
        }
        
        return response;
      }
    } catch (fallbackError) {
      // Both lookups failed - mapping doesn't exist
    }
    
    // 404 is expected if mapping doesn't exist
    return null;
  }
}

/**
 * Get all stored pitch mappings from database
 */
export async function getStoredPitchMappings(): Promise<PitchMapping[]> {
  try {
    const response = await apiClient.get('/import-mappings/pitches');
    return response;
  } catch (error) {
    console.error('Error loading pitch mappings from database:', error);
    return [];
  }
}

/**
 * Save a pitch mapping to database
 */
export async function savePitchMapping(originalFormat: string, normalizedFormat: string): Promise<boolean> {
  try {
    await apiClient.post('/import-mappings/pitches', {
      original_format: originalFormat,
      normalized_format: normalizedFormat,
    });
    return true;
  } catch (error) {
    console.error('Error saving pitch mapping:', error);
    return false;
  }
}

/**
 * Find a stored pitch mapping by original format from database
 */
export async function findStoredPitchMapping(originalFormat: string): Promise<PitchMapping | null> {
  try {
    const response = await apiClient.get(`/import-mappings/pitches/${encodeURIComponent(originalFormat)}`);
    return response;
  } catch (error) {
    // 404 is expected if mapping doesn't exist
    return null;
  }
}

/**
 * Delete a stored song mapping from database
 */
export async function deleteSongMapping(csvSongName: string): Promise<boolean> {
  try {
    const normalizedCsvName = normalizeSongNameForMapping(csvSongName);
    await apiClient.delete(`/import-mappings/songs/${encodeURIComponent(normalizedCsvName)}`);
    return true;
  } catch (error) {
    console.error('Error deleting song mapping:', error);
    return false;
  }
}

/**
 * Delete a stored pitch mapping from database
 */
export async function deletePitchMapping(originalFormat: string): Promise<boolean> {
  try {
    await apiClient.delete(`/import-mappings/pitches/${encodeURIComponent(originalFormat)}`);
    return true;
  } catch (error) {
    console.error('Error deleting pitch mapping:', error);
    return false;
  }
}

