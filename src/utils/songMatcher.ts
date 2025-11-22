/**
 * Utility for fuzzy matching song names
 */

import type { Song } from '../types';

/**
 * Normalize common name variations to canonical forms
 * This helps match songs with slight spelling differences
 */
function normalizeVariations(str: string): string {
  let normalized = str;
  
  // Common variations - map to canonical form
  const variations: Array<[RegExp, string]> = [
    // Double vowels to single (but preserve when significant)
    [/\baadi\b/gi, 'adi'],
    [/\bsaai\b/gi, 'sai'],
    [/\bshree\b/gi, 'sri'],
    [/\bshri\b/gi, 'sri'],
    [/\bshree\b/gi, 'sri'],
    
    // Jai/Jaya variations
    [/\bjaya\b/gi, 'jai'],
    [/\bjai\b/gi, 'jai'],
    
    // Hey/He variations
    [/\bhey\b/gi, 'he'],
    [/\bhe\b/gi, 'he'],
    
    // Om variations
    [/\baum\b/gi, 'om'],
    [/\bohm\b/gi, 'om'],
  ];
  
  for (const [pattern, replacement] of variations) {
    normalized = normalized.replace(pattern, replacement);
  }
  
  return normalized;
}

/**
 * Calculate how many characters match from the start (left-to-right)
 */
function calculatePrefixMatch(str1: string, str2: string): number {
  // Normalize: lowercase, trim, remove trailing punctuation, and normalize variations
  let s1 = str1.toLowerCase().trim().replace(/[,.\s]+$/, '');
  let s2 = str2.toLowerCase().trim().replace(/[,.\s]+$/, '');
  
  // Apply variation normalization
  s1 = normalizeVariations(s1);
  s2 = normalizeVariations(s2);
  
  let matchCount = 0;
  const minLength = Math.min(s1.length, s2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (s1[i] === s2[i]) {
      matchCount++;
    } else {
      break; // Stop at first mismatch
    }
  }
  
  return matchCount;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * with heavy emphasis on left-to-right prefix matches
 * Returns a percentage (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Normalize: lowercase, trim, remove trailing punctuation, and normalize variations
  let s1 = str1.toLowerCase().trim().replace(/[,.\s]+$/, '');
  let s2 = str2.toLowerCase().trim().replace(/[,.\s]+$/, '');
  
  // Apply variation normalization
  s1 = normalizeVariations(s1);
  s2 = normalizeVariations(s2);
  
  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Calculate prefix match - this is now the primary ranking factor
  const prefixMatchCount = calculatePrefixMatch(s1, s2);
  const minLength = Math.min(s1.length, s2.length);
  const maxLength = Math.max(s1.length, s2.length);
  
  // Prefix match score (0-70 points) - heavily weighted
  // The more characters match from the left, the higher the score
  const prefixScore = (prefixMatchCount / minLength) * 70;
  
  // Create matrix for Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  // Overall similarity score (0-30 points) - secondary factor
  const distance = matrix[s2.length][s1.length];
  const overallSimilarity = ((maxLength - distance) / maxLength) * 30;
  
  // Combine: 70% weight on prefix match, 30% on overall similarity
  const finalSimilarity = prefixScore + overallSimilarity;
  
  return Math.round(Math.min(100, finalSimilarity));
}

export interface SongMatch {
  song: Song;
  similarity: number;
  matched: boolean;
}

/**
 * Find the best matching song from database
 * @param searchName - The song name to search for
 * @param songs - Array of songs from database
 * @param threshold - Minimum similarity percentage (default: 90)
 * @returns Best match if found, null otherwise
 */
export function findBestSongMatch(
  searchName: string,
  songs: Song[],
  threshold: number = 90
): SongMatch | null {
  if (!searchName || songs.length === 0) return null;
  
  let bestMatch: SongMatch | null = null;
  let highestSimilarity = 0;
  const topMatches: Array<{name: string, similarity: number}> = [];
  
  for (const song of songs) {
    const similarity = calculateSimilarity(searchName, song.name);
    
    // Track top 5 matches for debugging
    if (topMatches.length < 5 || similarity > topMatches[topMatches.length - 1].similarity) {
      topMatches.push({ name: song.name, similarity });
      topMatches.sort((a, b) => b.similarity - a.similarity);
      if (topMatches.length > 5) topMatches.pop();
    }
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = {
        song,
        similarity,
        matched: similarity >= threshold,
      };
    }
    
    // Perfect match, no need to continue
    if (similarity === 100) break;
  }
  
  // Best match was below threshold
  
  return bestMatch && bestMatch.matched ? bestMatch : null;
}

/**
 * Find top N matching songs from database
 * @param searchName - The song name to search for
 * @param songs - Array of songs from database
 * @param topN - Number of top matches to return (default: 5)
 * @returns Array of top matches sorted by similarity
 */
export function findTopSongMatches(
  searchName: string,
  songs: Song[],
  topN: number = 5
): SongMatch[] {
  if (!searchName || songs.length === 0) return [];
  
  const matches: SongMatch[] = songs.map(song => ({
    song,
    similarity: calculateSimilarity(searchName, song.name),
    matched: false,
  }));
  
  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);
  
  // Return top N
  return matches.slice(0, topN);
}

/**
 * Normalize song name for better matching
 * Removes common prefixes, suffixes, and special characters
 */
export function normalizeSongName(songName: string): string {
  // Remove trailing punctuation first
  let normalized = songName.toLowerCase().trim().replace(/[,.\s]+$/, '');
  
  // Apply variation normalization
  normalized = normalizeVariations(normalized);
  
  // Remove common prefixes
  const prefixes = ['sri', 'shri', 'jai', 'jaya', 'om', 'hey', 'he'];
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+`, 'i');
    normalized = normalized.replace(regex, '');
  }
  
  // Remove special characters but keep spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Normalize song name for import mapping storage and lookup
 * Less aggressive than normalizeSongName - preserves song identity
 * while handling common variations like spacing, case, and punctuation
 */
export function normalizeSongNameForMapping(songName: string): string {
  // 1. Trim and lowercase
  let normalized = songName.trim().toLowerCase();
  
  // 2. Remove trailing punctuation and extra spaces
  normalized = normalized.replace(/[,.\s]+$/, '');
  
  // 3. Apply variation normalization for common spelling differences
  normalized = normalizeVariations(normalized);
  
  // 4. Normalize internal whitespace (multiple spaces -> single space)
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized;
}

