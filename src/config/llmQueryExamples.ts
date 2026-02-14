/**
 * Question → filter patterns for the LLM song/pitch search parser.
 * Add or edit entries here; the LLM uses these examples to map natural language to JSON filters.
 * Format: { query: "user phrase", filters: { field: "value", ... } }
 *
 * Song filters: name, deity, language, raga, tempo, beat, level, songTags
 * Pitch filters: songName, singerName, pitch, deity, language, raga
 */

export interface QueryExample {
  query: string;
  filters: Record<string, string>;
}

/** Examples for song search ("Show me X songs"). Add your patterns here. */
export const SONG_QUERY_EXAMPLES: QueryExample[] = [
  { query: 'show fast shiva bhajans', filters: { tempo: 'fast', deity: 'shiva' } },
  { query: 'fast shiva bhajans', filters: { tempo: 'fast', deity: 'shiva' } },
  { query: 'Find hamsadhwani raga songs', filters: { raga: 'hamsadhwani' } },
  { query: 'Show me sai bhajans in sanskrit', filters: { deity: 'sai', language: 'sanskrit' } },
  { query: 'Mohanam raga devi songs', filters: { raga: 'mohanam', deity: 'devi' } },
  { query: 'Fast tempo krishna bhajans', filters: { tempo: 'fast', deity: 'krishna' } },
  { query: 'Simple level songs in kalyani raga', filters: { level: 'simple', raga: 'kalyani' } },
  { query: 'Bhairavi raga slow songs', filters: { raga: 'bhairavi', tempo: 'slow' } },
  { query: 'rama songs in shankarabharanam / bilawal raga', filters: { deity: 'rama', raga: 'shankarabharanam / bilawal raga' } },
  { query: 'find songs which have the word rama', filters: { name: 'rama' } },
  { query: 'search for songs containing krishna', filters: { name: 'krishna' } },
  { query: 'songs with the word devi in the name', filters: { name: 'devi' } },
  { query: 'devi bhajans fast', filters: { deity: 'devi', tempo: 'fast' } },
  { query: 'slow sai songs', filters: { tempo: 'slow', deity: 'sai' } },
];

/** Examples for pitch/singer search. Add your patterns here. */
export const PITCH_QUERY_EXAMPLES: QueryExample[] = [
  { query: 'Show me C# pitches for sai songs', filters: { pitch: 'c#', deity: 'sai' } },
  { query: 'Find pitches for devi songs in hamsadhwani raga', filters: { deity: 'devi', raga: 'hamsadhwani' } },
  { query: 'Which singers sing krishna bhajans in sanskrit', filters: { deity: 'krishna', language: 'sanskrit' } },
  { query: 'Who sings devi songs', filters: { deity: 'devi' } },
  { query: 'C pitch for mohanam raga', filters: { pitch: 'c', raga: 'mohanam' } },
  { query: 'D# pitch kalyani raga', filters: { pitch: 'd#', raga: 'kalyani' } },
];
