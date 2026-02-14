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
const DEITY_KEYWORDS = ['allah', 'anjaneya', 'ayyappa', 'buddha', 'devi', 'durga', 'ganesha', 'guru', 'hanuman', 'krishna', 'lakshmi', 'narayana', 'narasimha', 'rama', 'sai', 'sarva dharma', 'saraswati', 'shiva', 'surya', 'vittala'];
const LANGUAGE_KEYWORDS = ['arabic', 'bengali', 'chinese', 'dutch', 'french', 'german', 'greek', 'hebrew', 'hindi', 'italian', 'japanese', 'kannada', 'korean', 'latin', 'malayalam', 'marathi', 'multi-lingual', 'portuguese', 'punjabi', 'russian', 'sanskrit', 'spanish', 'tamil', 'telugu', 'turkish', 'urdu', 'zulu'];
const TEMPO_KEYWORDS = ['fast', 'fast medium', 'medium', 'medium fast', 'medium slow', 'slow', 'slow medium'];
const LEVEL_KEYWORDS = ['advanced', 'basic', 'difficult', 'easy', 'hard', 'intermediate', 'simple'];
const PITCH_KEYWORDS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A minor', 'A# minor', 'B minor', 'C minor', 'C# minor', 'D minor', 'D# minor', 'E minor', 'F minor', 'F# minor', 'G minor', 'G# minor', 'A major', 'A# major', 'B major', 'C major', 'C# major', 'D major', 'D# major', 'E major', 'F major', 'F# major', 'G major', 'G# major'];

// Synonyms for better matching
const DEITY_SYNONYMS: Record<string, string[]> = {
  'devi': ['devi', 'durga', 'lakshmi', 'saraswati'],
  'hanuman': ['anjaneya', 'hanuman', 'maruti'],
  'sarva dharma': ['multi faith', 'sarva dharma', 'sarva dharm'],
  'ganesha': ['ganesh', 'ganesha', 'lambodara', 'vighneshwara', 'vinayaka'],
};

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

const PITCH_SYNONYMS: Record<string, string[]> = {
  'C': ['1'],
  'C major': ['1M', 'CM', 'C major'],
  'C minor': ['1m', 'Cm', 'C minor'],
  'C#': ['1.5'],
  'C# major': ['1.5M', 'C#M', 'C# major'],
  'C# minor': ['1.5m', 'C#m', 'C# minor'],
  'D': ['2'],
  'D major': ['2M', 'DM', 'D major'],
  'D minor': ['2m', 'Dm', 'D minor'],
  'D#': ['2.5'],
  'D# major': ['2.5M', 'D#M', 'D# major'],
  'D# minor': ['2.5m', 'D#m', 'D# minor'],
  'E': ['3'],
  'E major': ['3M', 'EM', 'E major'],
  'E minor': ['3m', 'Em', 'E minor'],
  'F': ['4'],
  'F major': ['4M', 'FM', 'F major'],
  'F minor': ['4m', 'Fm', 'F minor'],
  'F#': ['4.5'],
  'F# major': ['4.5M', 'F#M', 'F# major'],
  'F# minor': ['4.5m', 'F#m', 'F# minor'],
  'G': ['5'],
  'G major': ['5M', 'GM', 'G major'],
  'G minor': ['5m', 'Gm', 'G minor'],
  'G#': ['5.5'],
  'G# major': ['5.5M', 'G#M', 'G# major'],
  'G# minor': ['5.5m', 'G#m', 'G# minor'],
  'A': ['6'],
  'A major': ['6M', 'AM', 'A major'],
  'A minor': ['6m', 'Am', 'A minor'],
  'A#': ['6.5'],
  'A# major': ['6.5M', 'A#M', 'A# major'],
  'A# minor': ['6.5m', 'A#m', 'A# minor'],
  'B': ['7'],
  'B major': ['7M', 'BM', 'B major'],
  'B minor': ['7m', 'Bm', 'B minor']
};

/** Set of words that are structured filter keywords (tempo, level, deity, language) or noise — never use in name/general search. */
const STRUCTURED_KEYWORD_WORDS = new Set([
  ...DEITY_KEYWORDS.flatMap(w => w.split(/\s+/)),
  ...Object.values(DEITY_SYNONYMS).flat().flatMap(w => w.split(/\s+/)),
  ...LANGUAGE_KEYWORDS.flatMap(w => w.split(/\s+/)),
  ...TEMPO_KEYWORDS.flatMap(t => t.split(/\s+/)),
  ...Object.values(TEMPO_SYNONYMS).flat(),
  ...LEVEL_KEYWORDS,
  ...Object.values(LEVEL_SYNONYMS).flat(),
  'bhajan', 'bhajans', 'songs', 'song', 'show', 'display', 'list',
].map(w => w.toLowerCase()));

/**
 * Remove tempo, deity, language, level keywords from a name string (e.g. LLM-returned "name" filter).
 * Use when the same word is mapped to both name and a structured filter (e.g. "slow shiva" -> name should not contain "slow").
 */
export function stripStructuredKeywordsFromName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const words = name.trim().split(/\s+/).filter(w => {
    const lower = w.toLowerCase();
    return !STRUCTURED_KEYWORD_WORDS.has(lower);
  });
  return words.join(' ').trim();
}

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

  // Check for deity (with synonyms)
  for (const [deity, synonyms] of Object.entries(DEITY_SYNONYMS)) {
    if (synonyms.some(syn => lowerQuery.includes(syn))) {
      parsed.deity = deity;
      break;
    }
  }

  // Check for deity
  if (!parsed.deity) {
    for (const deity of DEITY_KEYWORDS) {
      if (lowerQuery.includes(deity)) {
        parsed.deity = deity;
        break;
      }
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
  for (const [pitch, synonyms] of Object.entries(PITCH_SYNONYMS)) {
    if (synonyms.some(syn => lowerQuery.includes(syn))) {
      parsed.pitch = pitch;
      break;
    }
  }

  // Words that must never appear in general (song name) search - only in structured filters
  const stoplist = new Set([
    'in', 'the', 'a', 'an', 'of', 'for', 'with', 'by', 'songs', 'song', 'bhajan', 'bhajans',
    'pitch', 'tempo', 'level', 'language', 'deity', 'raga', 'singer', 'show', 'display', 'list',
    ...TEMPO_KEYWORDS.flatMap(t => t.split(/\s+/)),
    ...Object.values(TEMPO_SYNONYMS).flat(),
    ...LEVEL_KEYWORDS,
    ...Object.values(LEVEL_SYNONYMS).flat(),
  ].map(w => w.toLowerCase()));

  const extractedKeywords = [
    parsed.deity,
    parsed.language,
    parsed.tempo,
    parsed.level,
    parsed.pitch,
  ].filter(Boolean);

  const remainingWords = words.filter(word => {
    const lower = word.toLowerCase();
    if (stoplist.has(lower)) return false;
    // Exclude if word equals or is contained in an extracted keyword (e.g. "slow" when tempo is "slow")
    if (extractedKeywords.some(keyword => keyword && (lower === keyword.toLowerCase() || lower.includes(keyword.toLowerCase())))) return false;
    return true;
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
      { name: 'deity', weight: 1 },
      { name: 'language', weight: 1 },
      { name: 'raga', weight: 1 },
      { name: 'tempo', weight: 0.8 },
      { name: 'beat', weight: 0.8 },
      { name: 'level', weight: 0.8 },
    ],
    threshold: 0.4, // 0 = exact match, 1 = match anything
    includeScore: true,
    minMatchCharLength: 3,
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

    // Sort results: prioritize songs that start with the search term
    const lowerQuery = parsed.general.toLowerCase();
    results = results.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStartsWith = aName.startsWith(lowerQuery);
      const bStartsWith = bName.startsWith(lowerQuery);

      // Prefix matches come first
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // If both start with query or neither does, sort alphabetically
      return aName.localeCompare(bName);
    });
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


