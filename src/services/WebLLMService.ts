import * as webllm from "@mlc-ai/web-llm";
import type { SongSearchFilters } from '../components/common/AdvancedSongSearch';
import type { PitchSearchFilters } from '../components/common/AdvancedPitchSearch';

export type SearchType = 'song' | 'pitch';

export interface LLMSearchResult {
  filters: SongSearchFilters | PitchSearchFilters;
  explanation?: string;
  confidence?: number;
}

export class WebLLMService {
  private engine: webllm.MLCEngine | null = null;
  private isInitializing = false;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  
  // Using the smallest available model for better performance and reliability
  // Qwen2-0.5B is the smallest model (~100-150MB) perfect for simple parsing tasks
  private readonly MODEL = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
  
  constructor() {}

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
    let enhanced = query;
    
    // Common ragas - if detected, add hint
    const commonRagas = [
      'hamsadhwani', 'mohanam', 'kalyani', 'shankarabharanam', 'kharaharapriya',
      'bhairavi', 'sankarabharanam', 'todi', 'kambhoji', 'bilahari', 'dhanyasi'
    ];
    
    for (const raga of commonRagas) {
      if (query.toLowerCase().includes(raga)) {
        enhanced = `${query} [HINT: "${raga}" is a RAGA name]`;
        break;
      }
    }
    
    // Common deities
    const deities = ['sai', 'devi', 'krishna', 'rama', 'shiva', 'ganesh', 'hanuman', 
                     'durga', 'lakshmi', 'saraswati', 'ganesha', 'vishnu'];
    for (const deity of deities) {
      if (query.toLowerCase().includes(deity) && !enhanced.includes('[HINT:')) {
        enhanced = `${query} [HINT: "${deity}" is a DEITY name]`;
        break;
      }
    }
    
    // Language detection
    const languages = ['sanskrit', 'hindi', 'telugu', 'tamil', 'kannada', 'malayalam', 
                      'bengali', 'marathi'];
    for (const lang of languages) {
      if (query.toLowerCase().includes(lang) && !enhanced.includes('[HINT:')) {
        enhanced = `${query} [HINT: "${lang}" is a LANGUAGE]`;
        break;
      }
    }
    
    // Tempo detection
    const tempos = ['slow', 'medium', 'fast', 'medium-fast', 'medium-slow'];
    for (const tempo of tempos) {
      if (query.toLowerCase().includes(tempo) && !enhanced.includes('[HINT:')) {
        enhanced = `${query} [HINT: "${tempo}" is a TEMPO]`;
        break;
      }
    }
    
    return enhanced;
  }

  private getSystemPrompt(searchType: SearchType): string {
    if (searchType === 'song') {
      return `You are a search query parser. Extract filters from natural language and output ONLY valid JSON.

CRITICAL RULES FOR CLASSIFICATION:
1. RAGA = Musical raga names like hamsadhwani, mohanam, kalyani, bhairavi, shankarabharanam, todi, kambhoji, bilahari
2. DEITY = Gods/goddesses like sai, devi, krishna, rama, shiva, ganesh, hanuman, durga, lakshmi, saraswati, ganesha
3. LANGUAGE = Languages like sanskrit, hindi, telugu, tamil, kannada, malayalam, bengali, marathi
4. TEMPO = Speed like slow, medium, fast, medium-fast, medium-slow
5. LEVEL = Difficulty like simple, intermediate, advanced
6. NAME = Actual song title/name

AVAILABLE FILTERS:
- name: song name/title
- deity: ONLY deity names (not ragas!)
- language: ONLY language names
- raga: ONLY raga names (not deities!)
- tempo: ONLY tempo values
- beat: beat pattern
- level: ONLY difficulty levels
- songTags: tags/categories

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

PAY ATTENTION TO HINTS: If query contains [HINT: "word" is a TYPE], use that TYPE for classification.

Output ONLY the JSON object, nothing else.`;
    } else {
      return `You are a search query parser. Extract filters from natural language and output ONLY valid JSON.

CRITICAL RULES FOR CLASSIFICATION:
1. PITCH = Musical notes like C, C#, D, D#, E, F, F#, G, G#, A, A#, B (with or without sharp/flat)
2. RAGA = Musical raga names like hamsadhwani, mohanam, kalyani
3. DEITY = Gods/goddesses like sai, devi, krishna, rama
4. LANGUAGE = Languages like sanskrit, hindi, telugu

AVAILABLE FILTERS:
- songName: name of the song
- singerName: name of the singer  
- pitch: ONLY musical pitches (C, C#, D, etc.)
- deity: ONLY deity names (not ragas!)
- language: ONLY language names
- raga: ONLY raga names (not deities!)

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

PAY ATTENTION TO HINTS: If query contains [HINT: "word" is a TYPE], use that TYPE for classification.

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

