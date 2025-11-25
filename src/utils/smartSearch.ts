import Fuse from 'fuse.js';
import type { Song, SongSingerPitch, Singer } from '../types';

// Smart query parser for natural language-like searches
export interface ParsedQuery {
  general?: string;
  deity?: string;
  language?: string;
  raga?: string;
  tempo?: string;
  beat?: string;
  level?: string;
  pitch?: string;
  singer?: string;
}

// Common keywords and their mappings
const DEITY_KEYWORDS = ['sai', 'devi', 'krishna', 'rama', 'shiva', 'ganesh', 'hanuman', 'durga', 'lakshmi', 'saraswati'];
const LANGUAGE_KEYWORDS = ['sanskrit', 'hindi', 'telugu', 'tamil', 'kannada', 'malayalam', 'bengali', 'marathi'];
const TEMPO_KEYWORDS = ['slow', 'medium', 'fast', 'quick', 'slow-medium', 'medium-fast'];
const LEVEL_KEYWORDS = ['simple', 'easy', 'basic', 'intermediate', 'advanced', 'difficult', 'hard'];
const PITCH_KEYWORDS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Synonyms for better matching
const TEMPO_SYNONYMS: Record<string, string[]> = {
  'slow': ['slow', 'slower', 'slowly'],
  'medium': ['medium', 'moderate', 'normal'],
  'fast': ['fast', 'faster', 'quick', 'quickly', 'rapid'],
};

const LEVEL_SYNONYMS: Record<string, string[]> = {
  'simple': ['simple', 'easy', 'basic', 'beginner'],
  'intermediate': ['intermediate', 'medium'],
  'advanced': ['advanced', 'difficult', 'hard', 'complex'],
};

/**
 * Parse a natural language query into structured filters
 * Examples:
 *  - "sai songs in sanskrit" -> { deity: "sai", language: "sanskrit" }
 *  - "fast tempo devi" -> { tempo: "fast", deity: "devi" }
 *  - "C# pitch" -> { pitch: "C#" }
 */
export function parseNaturalQuery(query: string): ParsedQuery {
  const parsed: ParsedQuery = {};
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  // Check for deity
  for (const deity of DEITY_KEYWORDS) {
    if (lowerQuery.includes(deity)) {
      parsed.deity = deity;
      break;
    }
  }

  // Check for language
  for (const lang of LANGUAGE_KEYWORDS) {
    if (lowerQuery.includes(lang)) {
      parsed.language = lang;
      break;
    }
  }

  // Check for tempo (with synonyms)
  for (const [tempo, synonyms] of Object.entries(TEMPO_SYNONYMS)) {
    if (synonyms.some(syn => lowerQuery.includes(syn))) {
      parsed.tempo = tempo;
      break;
    }
  }

  // Check for level (with synonyms)
  for (const [level, synonyms] of Object.entries(LEVEL_SYNONYMS)) {
    if (synonyms.some(syn => lowerQuery.includes(syn))) {
      parsed.level = level;
      break;
    }
  }

  // Check for pitch (case-sensitive match)
  for (const pitch of PITCH_KEYWORDS) {
    const pitchRegex = new RegExp(`\\b${pitch.replace('#', '\\#')}\\b`, 'i');
    if (pitchRegex.test(query)) {
      parsed.pitch = pitch;
      break;
    }
  }

  // Extract any remaining words as general search
  const extractedKeywords = [
    parsed.deity,
    parsed.language,
    parsed.tempo,
    parsed.level,
    parsed.pitch,
  ].filter(Boolean);

  const remainingWords = words.filter(word => {
    return !extractedKeywords.some(keyword => 
      keyword && word.includes(keyword.toLowerCase())
    ) && !['in', 'the', 'a', 'an', 'of', 'for', 'with', 'by', 'songs', 'song', 'pitch'].includes(word);
  });

  if (remainingWords.length > 0) {
    parsed.general = remainingWords.join(' ');
  }

  return parsed;
}

/**
 * Create Fuse.js instance for fuzzy song search
 */
export function createSongFuzzySearch(songs: Song[]) {
  return new Fuse(songs, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'title', weight: 1.5 },
      { name: 'title2', weight: 1.5 },
      { name: 'deity', weight: 1 },
      { name: 'language', weight: 1 },
      { name: 'raga', weight: 1 },
      { name: 'tempo', weight: 0.8 },
      { name: 'beat', weight: 0.8 },
      { name: 'level', weight: 0.8 },
    ],
    threshold: 0.4, // 0 = exact match, 1 = match anything
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });
}

/**
 * Create Fuse.js instance for fuzzy singer search
 */
export function createSingerFuzzySearch(singers: Singer[]) {
  return new Fuse(singers, {
    keys: ['name'],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

/**
 * Perform smart search on songs with fuzzy matching and natural language parsing
 */
export function smartSearchSongs(
  songs: Song[],
  query: string,
  fuzzySearch: Fuse<Song>
): Song[] {
  if (!query.trim()) return songs;

  // Parse the query for structured filters
  const parsed = parseNaturalQuery(query);

  // Start with all songs
  let results = songs;

  // Apply structured filters first
  if (parsed.deity) {
    results = results.filter(s => 
      s.deity?.toLowerCase().includes(parsed.deity!)
    );
  }
  if (parsed.language) {
    results = results.filter(s => 
      s.language?.toLowerCase().includes(parsed.language!)
    );
  }
  if (parsed.raga) {
    results = results.filter(s => 
      s.raga?.toLowerCase().includes(parsed.raga!)
    );
  }
  if (parsed.tempo) {
    results = results.filter(s => {
      const songTempo = s.tempo?.toLowerCase();
      const searchTempo = parsed.tempo!;
      // Exact match for tempo to avoid "fast" matching "medium-fast"
      return songTempo === searchTempo;
    });
  }
  if (parsed.level) {
    results = results.filter(s => 
      s.level?.toLowerCase().includes(parsed.level!)
    );
  }

  // If there's a general search term, use fuzzy search on remaining results
  if (parsed.general) {
    const fuzzyResults = fuzzySearch.search(parsed.general);
    const fuzzyIds = new Set(fuzzyResults.map(r => r.item.id));
    results = results.filter(s => fuzzyIds.has(s.id));
  }

  return results;
}

/**
 * Generate search suggestions based on common patterns
 */
export function generateSearchSuggestions(
  songs: Song[],
  singers: Singer[],
  currentQuery: string
): string[] {
  const suggestions: string[] = [];
  const lowerQuery = currentQuery.toLowerCase();

  if (lowerQuery.length < 2) {
    // Show popular searches when empty
    return [
      'sai songs',
      'devi songs in sanskrit',
      'fast tempo',
      'simple level songs',
      'C# pitch',
    ];
  }

  // Extract unique values from songs
  const deities = new Set(songs.map(s => s.deity).filter(Boolean));
  const languages = new Set(songs.map(s => s.language).filter(Boolean));
  const ragas = new Set(songs.map(s => s.raga).filter(Boolean));

  // Suggest deity-based searches
  deities.forEach(deity => {
    if (deity && deity.toLowerCase().includes(lowerQuery)) {
      suggestions.push(`${deity} songs`);
      languages.forEach(lang => {
        if (lang) suggestions.push(`${deity} songs in ${lang}`);
      });
    }
  });

  // Suggest language-based searches
  languages.forEach(lang => {
    if (lang && lang.toLowerCase().includes(lowerQuery)) {
      suggestions.push(`songs in ${lang}`);
    }
  });

  // Suggest raga-based searches
  ragas.forEach(raga => {
    if (raga && raga.toLowerCase().includes(lowerQuery)) {
      suggestions.push(`${raga} raga`);
    }
  });

  // Suggest tempo searches
  if ('slow'.includes(lowerQuery)) suggestions.push('slow tempo songs');
  if ('fast'.includes(lowerQuery)) suggestions.push('fast tempo songs');

  // Limit suggestions
  return suggestions.slice(0, 5);
}

/**
 * Highlight matching terms in text
 */
export function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  let highlighted = text;
  
  words.forEach(word => {
    const regex = new RegExp(`(${word})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });
  
  return highlighted;
}


