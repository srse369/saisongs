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

    const systemPrompt = this.getSystemPrompt(searchType);
    const userPrompt = this.getUserPrompt(query, searchType);

    try {
      const response = await this.engine.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 256,
      });

      const content = response.choices[0]?.message?.content || '{}';
      return this.parseResponse(content, searchType);
    } catch (error) {
      console.error('WebLLM query failed:', error);
      throw error;
    }
  }

  private getSystemPrompt(searchType: SearchType): string {
    if (searchType === 'song') {
      return `You are a search query parser for a song database. Extract search filters from natural language queries.

Available filters:
- name: song name
- title: song title
- deity: sai, devi, krishna, rama, shiva, ganesh, hanuman, durga, lakshmi, saraswati
- language: sanskrit, hindi, telugu, tamil, kannada, malayalam, bengali, marathi
- raga: musical raga name
- tempo: slow, medium, fast
- beat: beat pattern
- level: simple, intermediate, advanced
- songTags: tags/categories

Output ONLY valid JSON with extracted filters. Example:
{"deity":"sai","language":"sanskrit"}

If no specific filters, output: {}`;
    } else {
      return `You are a search query parser for a pitch/singer database. Extract search filters from natural language queries.

Available filters:
- songName: name of the song
- singerName: name of the singer
- pitch: musical pitch (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
- deity: deity from song metadata
- language: language from song metadata
- raga: raga from song metadata

Output ONLY valid JSON with extracted filters. Example:
{"pitch":"C#","deity":"devi"}

If no specific filters, output: {}`;
    }
  }

  private getUserPrompt(query: string, searchType: SearchType): string {
    return `Parse this search query: "${query}"

Extract relevant filters and output ONLY the JSON object, nothing else.`;
  }

  private parseResponse(content: string, searchType: SearchType): LLMSearchResult {
    try {
      // Extract JSON from response (in case LLM adds extra text)
      const jsonMatch = content.match(/\{[^}]*\}/);
      if (!jsonMatch) {
        return { filters: {} };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        filters: parsed,
        confidence: 0.8, // Could be enhanced with actual confidence scoring
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      return { filters: {} };
    }
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

