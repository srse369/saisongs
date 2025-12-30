import * as webllm from "@mlc-ai/web-llm";
import type { SongSearchFilters } from '../components/common/AdvancedSongSearch';
import type { PitchSearchFilters } from '../components/common/AdvancedPitchSearch';
import { ALL_PITCH_OPTIONS } from '../utils/pitchUtils';
import type { Song } from '../types';

export type SearchType = 'song' | 'pitch';

export interface LLMSearchResult {
  filters: SongSearchFilters | PitchSearchFilters;
  explanation?: string;
  confidence?: number;
}

export interface AvailableValues {
  ragas?: string[];
  deities?: string[];
  languages?: string[];
  tempos?: string[];
  beats?: string[];
  levels?: string[];
  pitches?: string[];
  singerNames?: string[];
}

export class WebLLMService {
  private engine: webllm.MLCEngine | null = null;
  private isInitializing = false;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private availableValues: AvailableValues = {};
  
  // Using the smallest available model for better performance and reliability
  // Qwen2-0.5B is the smallest model (~100-150MB) perfect for simple parsing tasks
  private readonly MODEL = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
  
  constructor() {}
  
  /**
   * Set available values from the database to help WebLLM make better classifications
   */
  setAvailableValues(values: AvailableValues): void {
    this.availableValues = { ...values };
    // Always include all pitch options
    this.availableValues.pitches = ALL_PITCH_OPTIONS;
  }
  
  /**
   * Extract unique values from songs and singers arrays
   */
  static extractAvailableValues(songs: Song[] = [], singers: { name: string }[] = []): AvailableValues {
    const getUniqueValues = (field: keyof Song): string[] => {
      const values = new Set<string>();
      songs.forEach(song => {
        const value = song[field];
        if (value && typeof value === 'string' && value.trim()) {
          values.add(value.trim());
        }
      });
      return Array.from(values).sort((a, b) => a.localeCompare(b));
    };

    const singerNames = singers
      .map(s => s.name)
      .filter(name => name && name.trim())
      .sort((a, b) => a.localeCompare(b));

    return {
      ragas: getUniqueValues('raga'),
      deities: getUniqueValues('deity'),
      languages: getUniqueValues('language'),
      tempos: getUniqueValues('tempo'),
      beats: getUniqueValues('beat'),
      levels: getUniqueValues('level'),
      pitches: ALL_PITCH_OPTIONS,
      singerNames: Array.from(new Set(singerNames)),
    };
  }

  async initialize(onProgress?: (report: webllm.InitProgressReport) => void): Promise<void> {
    if (this.isReady) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.isInitializing = true;
        
        this.engine = await webllm.CreateMLCEngine(this.MODEL, {
          initProgressCallback: onProgress,
        });
        
        this.isReady = true;
        this.isInitializing = false;
      } catch (error) {
        this.isInitializing = false;
        this.isReady = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to initialize WebLLM:', errorMessage, error);
        
        // Provide more helpful error messages
        if (errorMessage.includes('WebGPU')) {
          throw new Error('WebGPU not available. Please use Chrome/Edge 113+ with hardware acceleration enabled.');
        } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
          throw new Error('Network error loading model. Check your internet connection and try again.');
        } else if (errorMessage.includes('memory') || errorMessage.includes('OOM')) {
          throw new Error('Insufficient memory. Please close other tabs and try again.');
        }
        
        throw new Error(`Failed to load AI model: ${errorMessage}`);
      }
    })();

    return this.initPromise;
  }

  isModelReady(): boolean {
    return this.isReady;
  }

  isModelInitializing(): boolean {
    return this.isInitializing;
  }

  async parseNaturalLanguageQuery(
    query: string, 
    searchType: SearchType
  ): Promise<LLMSearchResult> {
    if (!this.isReady || !this.engine) {
      throw new Error('WebLLM not initialized');
    }

    // Preprocess query to add hints for better mapping
    const enhancedQuery = this.preprocessQuery(query, searchType);
    
    const systemPrompt = this.getSystemPrompt(searchType);
    const userPrompt = this.getUserPrompt(enhancedQuery, searchType);

    try {
      console.log('🤖 WebLLM Request:', {
        originalQuery: query,
        enhancedQuery: enhancedQuery,
        searchType,
        systemPrompt: systemPrompt.substring(0, 150) + '...',
        userPrompt
      });

      const response = await this.engine.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 256,
      });

      const content = response.choices[0]?.message?.content || '{}';
      console.log('🤖 WebLLM Raw Response:', content);
      
      const parsed = this.parseResponse(content, searchType);
      console.log('🤖 WebLLM Parsed Result:', parsed);
      
      return parsed;
    } catch (error) {
      console.error('❌ WebLLM query failed:', error);
      throw error;
    }
  }

  private preprocessQuery(query: string, searchType: SearchType): string {
    // Add explicit hints when certain keywords are detected
    // Collect all hints first, then append them all at once
    const hints: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Common ragas - if detected, add hint
    const commonRagas = [
      'hamsadhwani', 'mohanam', 'kalyani', 'shankarabharanam', 'kharaharapriya',
      'bhairavi', 'sankarabharanam', 'todi', 'kambhoji', 'bilahari', 'dhanyasi',
      'bilawal', 'kapi', 'arabhi', 'natabhairavi', 'sahana', 'begada', 'mayamalavagowla'
    ];
    
    for (const raga of commonRagas) {
      if (lowerQuery.includes(raga)) {
        hints.push(`"${raga}" is a RAGA name`);
      }
    }
    
    // Common deities
    const deities = ['sai', 'devi', 'krishna', 'rama', 'shiva', 'ganesh', 'hanuman', 
                     'durga', 'lakshmi', 'saraswati', 'ganesha', 'vishnu', 'muruga', 
                     'murugan', 'ayyappa'];
    for (const deity of deities) {
      if (lowerQuery.includes(deity)) {
        hints.push(`"${deity}" is a DEITY name`);
      }
    }
    
    // Language detection
    const languages = ['sanskrit', 'hindi', 'telugu', 'tamil', 'kannada', 'malayalam', 
                      'bengali', 'marathi', 'gujarati', 'punjabi', 'oriya'];
    for (const lang of languages) {
      if (lowerQuery.includes(lang)) {
        hints.push(`"${lang}" is a LANGUAGE`);
      }
    }
    
    // Tempo detection
    const tempos = ['slow', 'medium', 'fast', 'medium-fast', 'medium-slow'];
    for (const tempo of tempos) {
      if (lowerQuery.includes(tempo)) {
        hints.push(`"${tempo}" is a TEMPO`);
      }
    }
    
    // Level detection
    const levels = ['simple', 'intermediate', 'advanced', 'beginner', 'difficult', 'hard', 'complex'];
    for (const level of levels) {
      if (lowerQuery.includes(level)) {
        hints.push(`"${level}" is a LEVEL`);
      }
    }
    
    // If we found any hints, append them to the query
    if (hints.length > 0) {
      const hintsText = hints.map(hint => `[HINT: ${hint}]`).join(' ');
      return `${query} ${hintsText}`;
    }
    
    return query;
  }

  private formatValueList(values: string[] | undefined, maxItems: number = 50): string {
    if (!values || values.length === 0) {
      return 'none available';
    }
    if (values.length <= maxItems) {
      return values.join(', ');
    }
    return `${values.slice(0, maxItems).join(', ')} ... (${values.length} total)`;
  }

  private getSystemPrompt(searchType: SearchType): string {
    const { ragas, deities, languages, tempos, beats, levels, pitches, singerNames } = this.availableValues;
    
    // Format available values for the prompt
    const availableRagas = this.formatValueList(ragas);
    const availableDeities = this.formatValueList(deities);
    const availableLanguages = this.formatValueList(languages);
    const availableTempos = this.formatValueList(tempos);
    const availableBeats = this.formatValueList(beats);
    const availableLevels = this.formatValueList(levels);
    const availablePitches = this.formatValueList(pitches);
    const availableSingerNames = this.formatValueList(singerNames);
    
    if (searchType === 'song') {
      return `You are a search query parser. Extract filters from natural language and output ONLY valid JSON.

CRITICAL RULES FOR CLASSIFICATION:
1. RAGA = Musical raga names (see VALID RAGAS below)
2. DEITY = Gods/goddesses (see VALID DEITIES below)
3. LANGUAGE = Languages (see VALID LANGUAGES below)
4. TEMPO = Speed (see VALID TEMPOS below)
5. LEVEL = Difficulty (see VALID LEVELS below)
6. NAME = Actual song title/name

VALID RAGAS (use exact match from this list): ${availableRagas}

VALID DEITIES (use exact match from this list): ${availableDeities}

VALID LANGUAGES (use exact match from this list): ${availableLanguages}

VALID TEMPOS (use exact match from this list): ${availableTempos}

VALID BEATS (use exact match from this list): ${availableBeats}

VALID LEVELS (use exact match from this list): ${availableLevels}

AVAILABLE FILTERS:
- name: song name/title
- deity: ONLY deity names from VALID DEITIES list (not ragas!)
- language: ONLY language names from VALID LANGUAGES list
- raga: ONLY raga names from VALID RAGAS list (not deities!)
- tempo: ONLY tempo values from VALID TEMPOS list
- beat: beat pattern from VALID BEATS list
- level: ONLY difficulty levels from VALID LEVELS list
- songTags: tags/categories

TEXT SEARCH vs FILTERS:
- If query asks to "find/search songs which have/contain the word X" or similar text search phrases, use name filter for text search
- If query mentions a deity/raga/language directly (e.g., "rama songs", "hamsadhwani raga"), use the appropriate filter
- Text search queries should extract the search term into the "name" field

EXAMPLES:
Input: "Find hamsadhwani raga songs"
Output: {"raga":"hamsadhwani"}

Input: "Show me sai bhajans in sanskrit"
Output: {"deity":"sai","language":"sanskrit"}

Input: "Mohanam raga devi songs"
Output: {"raga":"mohanam","deity":"devi"}

Input: "Fast tempo krishna bhajans"
Output: {"tempo":"fast","deity":"krishna"}

Input: "Simple level songs in kalyani raga"
Output: {"level":"simple","raga":"kalyani"}

Input: "Bhairavi raga slow songs"
Output: {"raga":"bhairavi","tempo":"slow"}

Input: "rama songs in shankarabharanam / bilawal raga"
Output: {"deity":"rama","raga":"shankarabharanam / bilawal raga"}

Input: "find songs which have the word rama"
Output: {"name":"rama"}

Input: "search for songs containing krishna"
Output: {"name":"krishna"}

Input: "songs with the word devi in the name"
Output: {"name":"devi"}

PAY ATTENTION TO HINTS: If query contains [HINT: "word" is a TYPE], use that TYPE for classification.

IMPORTANT: If multiple ragas are mentioned (e.g., "raga1 / raga2"), include the full raga string including the slash separator in the raga field.

Output ONLY the JSON object, nothing else.`;
    } else {
      return `You are a search query parser. Extract filters from natural language and output ONLY valid JSON.

CRITICAL RULES FOR CLASSIFICATION:
1. PITCH = Musical notes (see VALID PITCHES below)
2. RAGA = Musical raga names (see VALID RAGAS below)
3. DEITY = Gods/goddesses (see VALID DEITIES below)
4. LANGUAGE = Languages (see VALID LANGUAGES below)
5. SINGER = Singer names (see VALID SINGER NAMES below)

VALID PITCHES (use exact match from this list): ${availablePitches}

VALID RAGAS (use exact match from this list): ${availableRagas}

VALID DEITIES (use exact match from this list): ${availableDeities}

VALID LANGUAGES (use exact match from this list): ${availableLanguages}

VALID SINGER NAMES (use exact match from this list): ${availableSingerNames}

AVAILABLE FILTERS:
- songName: name of the song
- singerName: name of the singer from VALID SINGER NAMES list
- pitch: ONLY musical pitches from VALID PITCHES list
- deity: ONLY deity names from VALID DEITIES list (not ragas or languages!)
- language: ONLY language names from VALID LANGUAGES list (NOT ragas! Languages like sanskrit, hindi, telugu are NEVER ragas)
- raga: ONLY raga names from VALID RAGAS list (not deities or languages!)

EXAMPLES:
Input: "Show me C# pitches for sai songs"
Output: {"pitch":"C#","deity":"sai"}

Input: "Find pitches for devi songs in hamsadhwani raga"
Output: {"deity":"devi","raga":"hamsadhwani"}

Input: "Which singers sing krishna bhajans in sanskrit"
Output: {"deity":"krishna","language":"sanskrit"}

Input: "C pitch for mohanam raga"
Output: {"pitch":"C","raga":"mohanam"}

Input: "D# pitch kalyani raga"
Output: {"pitch":"D#","raga":"kalyani"}

Input: "Show me D# devi songs in sanskrit"
Output: {"pitch":"D#","deity":"devi","language":"sanskrit"}

CRITICAL: Sanskrit, Hindi, Telugu, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Oriya are LANGUAGES, NOT ragas. Never classify them as ragas.

PAY ATTENTION TO HINTS: If query contains [HINT: "word" is a TYPE], use that TYPE for classification.

IMPORTANT: Use exact matches from the VALID lists above. If a value is not in the list, do not include it in the output.

Output ONLY the JSON object, nothing else.`;
    }
  }

  private getUserPrompt(query: string, searchType: SearchType): string {
    return `Query: "${query}"

Output the JSON filter object:`;
  }

  private parseResponse(content: string, searchType: SearchType): LLMSearchResult {
    try {
      // Try multiple parsing strategies
      let parsed: any = {};
      
      // Strategy 1: Direct JSON parse (if response is pure JSON)
      try {
        parsed = JSON.parse(content.trim());
        console.log('✅ Parsed using direct JSON.parse');
      } catch {
        // Strategy 2: Extract JSON using regex (handles text before/after)
        const jsonMatch = content.match(/\{[^{}]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            console.log('✅ Parsed using regex extraction');
          } catch {
            console.warn('⚠️ Regex extracted text but failed to parse:', jsonMatch[0]);
          }
        }
      }
      
      // Validate that we got a plain object (not array or null)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        console.warn('⚠️ Invalid parsed result type:', typeof parsed);
        return { filters: {} };
      }
      
      // Clean up filters: remove null/undefined/empty string values
      const cleanFilters = Object.entries(parsed).reduce((acc, [key, value]) => {
        if (value && typeof value === 'string' && value.trim()) {
          acc[key] = value.trim().toLowerCase();
        }
        return acc;
      }, {} as Record<string, string>);
      
      // Post-processing: Fix obvious misclassifications
      const correctedFilters = this.correctMisclassifications(cleanFilters);
      
      console.log('✅ Clean filters:', cleanFilters);
      if (JSON.stringify(cleanFilters) !== JSON.stringify(correctedFilters)) {
        console.log('🔧 Corrected filters:', correctedFilters);
      }
      
      return {
        filters: correctedFilters,
        confidence: 0.8,
      };
    } catch (error) {
      console.error('❌ Failed to parse LLM response:', error, 'Content:', content);
      return { filters: {} };
    }
  }

  private correctMisclassifications(filters: Record<string, string>): Record<string, string> {
    const corrected = { ...filters };
    
    // Known ragas that might be misclassified as deity
    const knownRagas = [
      'hamsadhwani', 'mohanam', 'kalyani', 'shankarabharanam', 'kharaharapriya',
      'bhairavi', 'sankarabharanam', 'todi', 'kambhoji', 'bilahari', 'dhanyasi',
      'kapi', 'arabhi', 'natabhairavi', 'sahana', 'begada', 'mayamalavagowla'
    ];
    
    // Known deities
    const knownDeities = [
      'sai', 'devi', 'krishna', 'rama', 'shiva', 'ganesh', 'ganesha', 'hanuman',
      'durga', 'lakshmi', 'saraswati', 'vishnu', 'muruga', 'murugan', 'ayyappa'
    ];
    
    // Known languages
    const knownLanguages = [
      'sanskrit', 'hindi', 'telugu', 'tamil', 'kannada', 'malayalam',
      'bengali', 'marathi', 'gujarati', 'punjabi', 'oriya'
    ];
    
    // Check if deity value is actually a raga
    if (corrected.deity && knownRagas.includes(corrected.deity)) {
      console.warn(`⚠️ Correcting misclassification: "${corrected.deity}" is a raga, not deity`);
      corrected.raga = corrected.deity;
      delete corrected.deity;
    }
    
    // Check if raga value is actually a deity
    if (corrected.raga && knownDeities.includes(corrected.raga)) {
      console.warn(`⚠️ Correcting misclassification: "${corrected.raga}" is a deity, not raga`);
      corrected.deity = corrected.raga;
      delete corrected.raga;
    }
    
    // Check if deity is actually a language
    if (corrected.deity && knownLanguages.includes(corrected.deity)) {
      console.warn(`⚠️ Correcting misclassification: "${corrected.deity}" is a language, not deity`);
      corrected.language = corrected.deity;
      delete corrected.deity;
    }
    
    // Check if raga value is actually a language
    if (corrected.raga && knownLanguages.includes(corrected.raga)) {
      console.warn(`⚠️ Correcting misclassification: "${corrected.raga}" is a language, not raga`);
      corrected.language = corrected.raga;
      delete corrected.raga;
    }
    
    // Check if language value is actually a raga
    if (corrected.language && knownRagas.includes(corrected.language)) {
      console.warn(`⚠️ Correcting misclassification: "${corrected.language}" is a raga, not language`);
      corrected.raga = corrected.language;
      delete corrected.language;
    }
    
    return corrected;
  }

  async unload(): Promise<void> {
    if (this.engine) {
      // Clean up resources
      this.engine = null;
      this.isReady = false;
      this.initPromise = null;
    }
  }
}

// Singleton instance
let webLLMInstance: WebLLMService | null = null;

export function getWebLLMService(): WebLLMService {
  if (!webLLMInstance) {
    webLLMInstance = new WebLLMService();
  }
  return webLLMInstance;
}

export function checkWebGPUSupport(): boolean {
  return 'gpu' in navigator;
}


