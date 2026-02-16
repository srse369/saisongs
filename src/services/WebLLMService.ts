import type { SongSearchFilters } from '../components/common/AdvancedSongSearch';
import type { PitchSearchFilters } from '../components/common/AdvancedPitchSearch';
import { ALL_PITCH_OPTIONS } from '../utils/pitchUtils';
import type { Song } from '../types';
import { parseNaturalQuery } from '../utils/smartSearch';

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
  songNames?: string[];
}

export class WebLLMService {
  private availableValues: AvailableValues = {};

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

    const songNames = songs
      .map(s => s.name)
      .filter(name => name && name.trim())
      .slice(0, 200); // Limit for prompt size

    return {
      ragas: getUniqueValues('raga'),
      deities: getUniqueValues('deity'),
      languages: getUniqueValues('language'),
      tempos: getUniqueValues('tempo'),
      beats: getUniqueValues('beat'),
      levels: getUniqueValues('level'),
      pitches: ALL_PITCH_OPTIONS,
      singerNames: Array.from(new Set(singerNames)),
      songNames,
    };
  }

  /**
   * Parse natural language into structured filters (rule-based).
   */
  async parseNaturalLanguageQuery(
    query: string,
    searchType: SearchType
  ): Promise<LLMSearchResult> {
    const parsed = parseNaturalQuery(query);
    const filters: Record<string, string> = {};
    if (searchType === 'song') {
      if (parsed.general) filters.name = parsed.general;
      if (parsed.deity) filters.deity = parsed.deity;
      if (parsed.language) filters.language = parsed.language;
      if (parsed.raga) filters.raga = parsed.raga;
      if (parsed.tempo) filters.tempo = parsed.tempo;
      if (parsed.beat) filters.beat = parsed.beat;
      if (parsed.level) filters.level = parsed.level;
    } else {
      if (parsed.general) filters.songName = parsed.general;
      if (parsed.singer) filters.singerName = parsed.singer;
      if (parsed.pitch) filters.pitch = parsed.pitch;
      if (parsed.deity) filters.deity = parsed.deity;
      if (parsed.language) filters.language = parsed.language;
      if (parsed.raga) filters.raga = parsed.raga;
    }
    return { filters: filters as SongSearchFilters | PitchSearchFilters };
  }

  /**
   * Normalize synonyms so rule regexes can match flexibly.
   * Canonical forms: song (not bhajan), scale (not key/pitch for "my scale for" style).
   */
  private normalizeSynonyms(text: string): string {
    let out = text.toLowerCase().trim();
    // song = bhajan (whole word)
    out = out.replace(/\bbhajans\b/g, 'songs');
    out = out.replace(/\bbhajan\b/g, 'song');
    // scale = key = pitch (for "my X for the song" / "X's X for song" patterns)
    out = out.replace(/\bmy\s+key\s+for\b/g, 'my scale for');
    out = out.replace(/\bmy\s+pitch\s+for\b/g, 'my scale for');
    out = out.replace(/\bkey\s+for\s+(?:the\s+)?(?:song\s+)?/gi, 'scale for the song ');
    out = out.replace(/\bpitch\s+for\s+(?:the\s+)?(?:song\s+)?/gi, 'scale for the song ');
    // X's key for / X's pitch for -> X's scale for
    out = out.replace(/'s?\s+key\s+for\b/g, "'s scale for");
    out = out.replace(/'s?\s+pitch\s+for\b/g, "'s scale for");
    return out;
  }

  /** Deity names as tagged in the DB; user may say "hanuman" but data uses "anjaneya". */
  private static readonly DEITY_FILTER_ALIASES: Record<string, string> = {
    hanuman: 'anjaneya',
  };

  /**
   * Rule-based extraction of song filters from phrases like "fast shiva bhajans" or "show me slow sai songs".
   * Maps user-facing deity names to DB values (e.g. hanuman -> anjaneya).
   */
  private tryRuleBasedSongFilters(userPrompt: string): Record<string, string> | null {
    const lower = userPrompt.toLowerCase().trim();
    const filters: Record<string, string> = {};
    const deityWords = ['shiva', 'devi', 'krishna', 'rama', 'sai', 'ganesh', 'ganesha', 'hanuman', 'vishnu', 'muruga', 'murugan', 'lakshmi', 'saraswati', 'durga', 'ayyappa'];
    const tempoWords = ['fast', 'slow', 'medium'];
    for (const d of deityWords) {
      if (new RegExp(`\\b${d}\\b`, 'i').test(lower)) {
        filters.deity = WebLLMService.DEITY_FILTER_ALIASES[d] ?? d;
        break;
      }
    }
    for (const t of tempoWords) {
      if (new RegExp(`\\b${t}\\b`, 'i').test(lower)) {
        filters.tempo = t;
        break;
      }
    }
    if (Object.keys(filters).length === 0) return null;
    return filters;
  }

  /** Map deity values to DB tags (e.g. hanuman -> anjaneya). */
  private normalizeDeityInFilters(filters: Record<string, string>): Record<string, string> {
    if (!filters.deity) return filters;
    const mapped = WebLLMService.DEITY_FILTER_ALIASES[filters.deity.toLowerCase()];
    if (!mapped) return filters;
    return { ...filters, deity: mapped };
  }

  /**
   * App-aware chat: user message is answered using rule-based parsing only.
   * Returns a reply and optional action (navigate, show_preview, play_audio, etc.).
   * @param options.onDebugLog - If provided, called with (message, data) for each step.
   */
  async chatWithAppContext(
    userMessage: string,
    options?: { onDebugLog?: (message: string, data?: unknown) => void }
  ): Promise<{ reply: string; action?: { type: string; path?: string; filters?: Record<string, string>; [k: string]: unknown } }> {
    const log = (message: string, data?: unknown) => {
      console.log('[Ask app]', message, data ?? '');
      options?.onDebugLog?.(message, data);
    };

    const userPrompt = userMessage.trim() || '(User said nothing)';
    const lower = userPrompt.toLowerCase();
    const norm = this.normalizeSynonyms(userPrompt);
    log('User message', userPrompt);

    // "Add to live" rules FIRST - must run before song search (which would wrongly treat "add...to live X" as a filter)
    const addForSingerToLiveMatch = lower.match(/\badd\s+(?:the\s+following\s+)?(?:song|bhajan)\s+for\s+singer\s+["']?([^"']+)["']?\s+to\s+live\s+["']?([^"']+)["']?/);
    if (addForSingerToLiveMatch) {
      const singerName = addForSingerToLiveMatch[1].trim();
      const songName = addForSingerToLiveMatch[2].trim();
      if (singerName && songName) {
        log('Rule: add song for singer to live', { singerName, songName });
        return { reply: `Adding "${songName}" for ${singerName} to the session.`, action: { type: 'add_song_to_session', songName, singerName } };
      }
    }
    const addToLiveMatch = lower.match(/\badd\s+(?:the\s+following\s+)?(?:song|bhajan)\s+to\s+live\s+["']?([^"']+)["']?/);
    if (addToLiveMatch) {
      const songName = addToLiveMatch[1].trim();
      if (songName) {
        log('Rule: add song to live', { songName });
        return { reply: `Adding "${songName}" to the session.`, action: { type: 'add_song_to_session', songName } };
      }
    }

    const wantsSongs = /\b(songs?|tracks?)\b/.test(norm) || /\b(show|find|give|get|list|me)\s+.+\s+songs?\b/.test(norm);
    const hasFilterHint = /\b(shiva|devi|krishna|rama|sai|hanuman|ganesh|fast|slow|medium|sanskrit|hindi|telugu|tamil|raga|deity|tempo|language)\b/i.test(norm);
    const wantsMyPitches = /\bmy\b/i.test(norm) && (/\b(songs?|pitches?)\b/.test(norm) || norm.includes('pitches') || norm.includes('scale') || norm.includes('key') || norm.includes('pitch') || hasFilterHint);

    // "What is my scale/key/pitch for [the] [song] X" -> Pitches, my pitches, songName: X (norm has "scale")
    const myScaleForSongMatch = norm.match(/(?:what'?s?|what is)\s+my\s+scale\s+for\s+(?:the\s+)?(?:song\s+)?(.+?)(?:\s*[.?]?\s*)$/);
    if (myScaleForSongMatch) {
      const songName = myScaleForSongMatch[1].trim();
      if (songName) {
        log('Rule: my scale for song', { songName });
        return {
          reply: `Showing your scale for "${songName}".`,
          action: { type: 'navigate', path: '/admin/pitches', filters: { songName }, showMyPitches: true },
        };
      }
    }

    // "What is X's scale/key/pitch for [the] [song] Y" -> Pitches, all pitches, singerName: X, songName: Y
    // (?!is\s) prevents capturing "is ashwin" when the phrase is "What is ashwin's" - only the name goes in group 1.
    const possessiveScaleMatch = norm.match(/(?:what'?s?|what is)\s+(?!is\s)(.+?)'s\s+scale\s+for\s+(?:the\s+)?(?:song\s+)?(.+?)(?:\s*[.?]?\s*)$/);
    if (possessiveScaleMatch) {
      const singerName = possessiveScaleMatch[1].trim();
      const songName = possessiveScaleMatch[2].trim();
      if (singerName && songName) {
        log('Rule: singer scale for song', { singerName, songName });
        return {
          reply: `Showing ${singerName}'s scale for "${songName}".`,
          action: { type: 'navigate', path: '/admin/pitches', filters: { singerName, songName }, showMyPitches: false },
        };
      }
    }

    // "My X bhajans" / "my pitches for X" -> Pitches with filters
    if (wantsMyPitches && hasFilterHint) {
      const ruleFilters = this.tryRuleBasedSongFilters(userPrompt);
      if (ruleFilters && Object.keys(ruleFilters).length > 0) {
        log('Rule: my pitches', ruleFilters);
        const parts = Object.entries(ruleFilters).map(([k, v]) => `${k}: ${v}`);
        return {
          reply: `Showing your pitches for ${parts.join(', ')}.`,
          action: { type: 'navigate', path: '/admin/pitches', filters: ruleFilters, showMyPitches: true },
        };
      }
    }

    // "Show me bhajans/songs with the word X" -> Songs tab with song name filter X
    const withTheWordMatch = norm.match(/\b(?:show|find|list)\s+(?:me\s+)?songs?\s+with\s+the\s+word\s+(.+?)(?:\s*[.?]?\s*)$/);
    if (withTheWordMatch) {
      const nameQuery = withTheWordMatch[1].trim();
      if (nameQuery) {
        log('Rule: songs with the word', { name: nameQuery });
        return {
          reply: `Showing songs with the word "${nameQuery}".`,
          action: { type: 'navigate', path: '/admin/songs', filters: { name: nameQuery } },
        };
      }
    }

    // "Show/find X songs/bhajans" -> Songs with filters
    if (wantsSongs || (norm.includes('show') && norm.includes('song'))) {
      const ruleFilters = this.tryRuleBasedSongFilters(userPrompt);
      if (ruleFilters && Object.keys(ruleFilters).length > 0) {
        log('Rule: songs with filters', ruleFilters);
        const parts = Object.entries(ruleFilters).map(([k, v]) => `${k}: ${v}`);
        return {
          reply: `Showing songs with ${parts.join(', ')}.`,
          action: { type: 'navigate', path: '/admin/songs', filters: ruleFilters },
        };
      }
      const parsed = await this.parseNaturalLanguageQuery(userPrompt, 'song');
      let filters = parsed.filters as Record<string, string>;
      if (filters && Object.keys(filters).length > 0) {
        filters = this.normalizeDeityInFilters(filters);
        log('Rule: song query parser', filters);
        const parts = Object.entries(filters).map(([k, v]) => `${k}: ${v}`);
        return {
          reply: `Showing songs with ${parts.join(', ')}.`,
          action: { type: 'navigate', path: '/admin/songs', filters },
        };
      }
    }

    // Navigate to other tabs
    if (/\b(singers?|artists?)\b/.test(lower) && /\b(go|open|show|take|navigate)\b/.test(lower)) {
      log('Rule: navigate to singers');
      return { reply: 'Opening Singers.', action: { type: 'navigate', path: '/admin/singers' } };
    }
    if (/\b(help)\b/.test(lower) && /\b(go|open|show|take)\b/.test(lower)) {
      return { reply: 'Opening Help.', action: { type: 'navigate', path: '/help' } };
    }
    if (/\b(session)\b/.test(lower) && /\b(go|open|show|take)\b/.test(lower)) {
      return { reply: 'Opening Session.', action: { type: 'navigate', path: '/session' } };
    }
    if (/\b(templates?)\b/.test(lower) && /\b(go|open|show|take)\b/.test(lower)) {
      return { reply: 'Opening Templates.', action: { type: 'navigate', path: '/admin/templates' } };
    }
    if (/\b(centers?)\b/.test(lower) && /\b(go|open|show|take)\b/.test(lower)) {
      return { reply: 'Opening Centers.', action: { type: 'navigate', path: '/admin/centers' } };
    }
    if (/\b(feedback)\b/.test(lower) && /\b(go|open|show|take)\b/.test(lower)) {
      return { reply: 'Opening Feedback.', action: { type: 'navigate', path: '/admin/feedback' } };
    }
    if (/\bsongs?\b/.test(norm) && /\b(go|open|show|take)\b/.test(norm) && !hasFilterHint) {
      return { reply: 'Opening Songs.', action: { type: 'navigate', path: '/admin/songs' } };
    }
    if (/\b(pitches?|scale|key)\b/.test(norm) && /\b(go|open|show|take)\b/.test(norm)) {
      return { reply: 'Opening Pitches.', action: { type: 'navigate', path: '/admin/pitches' } };
    }

    // "Show me preview of bhajan/song X" -> preview of song X (norm has "song" for bhajan)
    const previewOfBhajanMatch = norm.match(/\b(?:show\s+me\s+)?preview\s+of\s+song\s+(.+?)(?:\s*[.?]?\s*)$/);
    if (previewOfBhajanMatch) {
      const songName = previewOfBhajanMatch[1].trim();
      if (songName) {
        log('Rule: show_preview of bhajan/song', { songName });
        return { reply: `Opening preview for "${songName}".`, action: { type: 'show_preview', songName } };
      }
    }

    // Song-specific actions: preview, play, ref gents/ladies (extract song name from message)
    const previewMatch = lower.match(/\b(?:preview|show)\s+(?:me\s+)?(?:the\s+)?(.+?)(?:\s+please)?$/);
    const playMatch = lower.match(/\b(?:play)\s+(?:me\s+)?(?:the\s+)?(.+?)(?:\s+please)?$/);
    const refGentsMatch = lower.match(/\b(?:ref\s*gents?|gents?\s*scale|men'?s?\s*scale)\s+(?:for\s+)?(.+?)(?:\s+please)?$/);
    const refLadiesMatch = lower.match(/\b(?:ref\s*ladies|ladies'?\s*scale|women'?s?\s*scale)\s+(?:for\s+)?(.+?)(?:\s+please)?$/);
    const songNameFrom = (m: RegExpMatchArray | null) => (m ? m[1].trim().replace(/\s+please\s*$/i, '') : null);
    const songName = songNameFrom(previewMatch) || songNameFrom(playMatch) || songNameFrom(refGentsMatch) || songNameFrom(refLadiesMatch);
    if (previewMatch && songName) {
      log('Rule: show_preview', { songName });
      return { reply: `Opening preview for "${songName}".`, action: { type: 'show_preview', songName } };
    }
    if (playMatch && songName) {
      log('Rule: play_audio', { songName });
      return { reply: `Playing "${songName}".`, action: { type: 'play_audio', songName } };
    }
    if (refGentsMatch && songName) {
      log('Rule: show_ref_gents', { songName });
      return { reply: `Showing gents scale for "${songName}".`, action: { type: 'show_ref_gents', songName } };
    }
    if (refLadiesMatch && songName) {
      log('Rule: show_ref_ladies', { songName });
      return { reply: `Showing ladies scale for "${songName}".`, action: { type: 'show_ref_ladies', songName } };
    }

    // Session actions
    if (/\bclear\s+(?:the\s+)?session\b/.test(lower)) {
      return { reply: 'Clearing the session.', action: { type: 'clear_session' } };
    }
    const addSessionMatch = lower.match(/\b(?:add)\s+(.+?)\s+to\s+(?:the\s+)?(?:session|live)\b/);
    if (addSessionMatch) {
      const name = addSessionMatch[1].trim();
      return { reply: `Adding "${name}" to the session.`, action: { type: 'add_song_to_session', songName: name } };
    }
    const removeSessionMatch = lower.match(/\b(?:remove)\s+(.+?)\s+from\s+(?:the\s+)?session\b/);
    if (removeSessionMatch) {
      const name = removeSessionMatch[1].trim();
      return { reply: `Removing "${name}" from the session.`, action: { type: 'remove_song_from_session', songName: name } };
    }

    log('No rule matched');
    return {
      reply: "I didn't catch that. Try: 'Show Shiva songs', 'Fast devi bhajans', 'Go to Songs', or 'Preview Om Ram'.",
    };
  }

  async unload(): Promise<void> {
    // No-op: rule-based only, no model to unload
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

/** No-op: app uses rule-based parsing only, no model to preload. */
export function preloadWebLLM(): void {}


