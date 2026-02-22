/**
 * Utility for fuzzy matching song names
 */

import * as stringSimilarity from 'string-similarity';
import type { Song, Singer } from '../types';

export interface SingerMatch {
  singer: Singer;
  similarity: number;
  matched: boolean;
}

const BODY_COMPARE_LEN = 500;

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
    
    // Jai/Jaya variations
    [/\bjaya\b/gi, 'jai'],
    [/\bjai\b/gi, 'jai'],
    
    // Hey/He variations
    [/\bhey\b/gi, 'he'],
    [/\bhe\b/gi, 'he'],
    
    // Om variations
    [/\baum\b/gi, 'om'],
    [/\bohm\b/gi, 'om'],
    
    // Body/lyrics spelling variations
    [/\bmruthyunjaya\b/gi, 'mrityunjaya'],
    [/\bbhooshana\b/gi, 'bhushana'],
    [/\bneeraja\b/gi, 'niraja'],
    [/\bgowri\b/gi, 'gauri'],
    [/\bneelakanta\b/gi, 'neela kanta'],
    [/\bjatadhara\b/gi, 'jata dhara'],
    [/\bmano\b/gi, 'mana'],
    [/\bmanohara\b/gi, 'manohar'],
    [/\bjhulena\b/gi, 'jhulana'],
    [/\bjhuley\b/gi, 'jhule'],
    [/\braasa\b/gi, 'rasa'],
    [/\bdheerey\b/gi, 'dheere'],
    [/\bhauley\b/gi, 'holey'],
    [/\baavo\b/gi, 'aao'],
    [/\bdarshana\b/gi, 'darshan'],
    [/\bthum\b/gi, 'tum'],
    [/\bthumhi\b/gi, 'tum hi'],
    [/\bjagada\b/gi, 'jagat'],
    [/\bvidhatha\b/gi, 'vidhata'],
    [/\bviswa\b/gi, 'vishwa'],
    [/\bsainatha\b/gi, 'sai natha'],
    [/\bjaganatha\b/gi, 'jagannatha'],
    [/\bkey\b/gi, 'ke'],
    [/\btharas\b/gi, 'taras'],
    [/\bhein\b/gi, 'hain'],
    [/\bshankar\b/gi, 'shankara'],
    [/\bparameshwar\b/gi, 'parameshwara'],
    [/\bantharyami\b/gi, 'antaryami'],
    [/\bshanti\b/gi, 'shanthi'],
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
export function calculateSimilarity(str1: string, str2: string): number {
  // Normalize: lowercase, trim, remove trailing punctuation, and normalize variations
  let s1 = str1.toLowerCase().trim().replace(/[,.\s]+$/, '');
  let s2 = str2.toLowerCase().trim().replace(/[,.\s]+$/, '');
  
  // Apply variation normalization
  s1 = normalizeVariations(s1);
  s2 = normalizeVariations(s2);

  // Collapse spaces so "Guru Vara" and "Guruvara" compare equivalently
  s1 = s1.replace(/\s+/g, ' ');
  s2 = s2.replace(/\s+/g, ' ');
  const s1NoSpaces = s1.replace(/\s/g, '');
  const s2NoSpaces = s2.replace(/\s/g, '');
  // Use the higher of: normal comparison vs space-collapsed comparison
  const withSpaces = compareNormalized(s1, s2);
  const withoutSpaces = s1NoSpaces === s2NoSpaces ? 100 : compareNormalized(s1NoSpaces, s2NoSpaces);
  return Math.max(withSpaces, withoutSpaces);
}

function compareNormalized(s1: string, s2: string): number {
  
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
 * Find the best matching singer from database (for CSV import).
 * Handles slightly adjusted names like "Simleen" vs "Simleen (SSE)".
 * @param searchName - The singer name from CSV
 * @param singers - Array of singers from database
 * @param threshold - Minimum similarity percentage (default: 85)
 */
export function findBestSingerMatch(
  searchName: string,
  singers: Singer[],
  threshold: number = 85
): SingerMatch | null {
  if (!searchName || singers.length === 0) return null;

  let bestMatch: SingerMatch | null = null;
  let highestSimilarity = 0;

  for (const singer of singers) {
    const similarity = calculateSimilarity(searchName, singer.name ?? '');

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = {
        singer,
        similarity,
        matched: similarity >= threshold,
      };
    }

    if (similarity === 100) break;
  }

  return bestMatch && bestMatch.matched ? bestMatch : null;
}

/**
 * Find pairs of similar songs in the database (for deduplication).
 * Compares each song to every other song and returns pairs above the similarity threshold.
 * Yields to the event loop periodically when onProgress is provided so the UI can update.
 * @param songs - Array of songs from database
 * @param threshold - Minimum similarity percentage to consider a pair (default: 85)
 * @param onProgress - Optional callback (current, total) for progress updates
 * @returns Array of pairs with similarity scores, sorted by similarity descending
 */
export async function findSimilarSongPairs(
  songs: Song[],
  threshold: number = 85,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ song1: Song; song2: Song; similarity: number }>> {
  if (songs.length < 2) return [];

  const pairs: Array<{ song1: Song; song2: Song; similarity: number }> = [];
  const total = (songs.length * (songs.length - 1)) / 2;
  let comparisons = 0;
  const progressInterval = Math.max(1, Math.floor(total / 100)); // Report ~100 times

  for (let i = 0; i < songs.length; i++) {
    for (let j = i + 1; j < songs.length; j++) {
      const sim = calculateSimilarity(songs[i].name, songs[j].name);
      if (sim >= threshold) {
        pairs.push({ song1: songs[i], song2: songs[j], similarity: sim });
      }
      comparisons++;
      if (onProgress && comparisons % progressInterval === 0) {
        onProgress(comparisons, total);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  if (onProgress) onProgress(total, total);
  pairs.sort((a, b) => b.similarity - a.similarity);
  return pairs;
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

/**
 * Extract normalized word set from text (phonic-style: spelling variations normalized).
 * Used for fast body comparison without expensive Levenshtein.
 */
export function extractBodyWordSet(text: string): Set<string> {
  const raw = (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return new Set();
  const norm = normalizeVariations(raw);
  const normWord = (w: string) => normalizeVariations(w.replace(/[^a-z0-9]/g, ''));
  return new Set(norm.split(/\s+/).filter((w) => w.length > 1).map(normWord));
}

/**
 * Fast body similarity using word-set overlap (Jaccard-style).
 * Uses intersection/union to avoid inflating scores when one text has very few unique words
 * (e.g. "Hare Krishna Hare Rama" mantra vs a longer song that happens to mention Krishna/Rama).
 */
export function calculateWordSetSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 100;
  if (set1.size === 0 || set2.size === 0) return 0;
  let overlap = 0;
  const smaller = set1.size <= set2.size ? set1 : set2;
  const larger = set1.size <= set2.size ? set2 : set1;
  for (const w of smaller) {
    if (larger.has(w)) overlap++;
  }
  const unionSize = set1.size + set2.size - overlap;
  return Math.round((overlap / unionSize) * 100);
}

/**
 * Calculate approximate similarity between two long strings (e.g. lyrics/body).
 * Combines word-set overlap with string-similarity (Dice coefficient) for better matching.
 */
export function calculateBodySimilarity(str1: string, str2: string): number {
  const set1 = extractBodyWordSet(str1);
  const set2 = extractBodyWordSet(str2);
  const wordSim = calculateWordSetSimilarity(set1, set2);

  const raw1 = (str1 || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const raw2 = (str2 || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const norm1 = normalizeVariations(raw1).slice(0, BODY_COMPARE_LEN);
  const norm2 = normalizeVariations(raw2).slice(0, BODY_COMPARE_LEN);
  const diceSim = norm1 && norm2 ? Math.round(stringSimilarity.compareTwoStrings(norm1, norm2) * 100) : 0;

  return Math.max(wordSim, diceSim);
}
