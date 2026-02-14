import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebLLMService, getWebLLMService, checkWebGPUSupport } from './WebLLMService';

describe('WebLLMService', () => {
  let service: WebLLMService;

  beforeEach(() => {
    service = new WebLLMService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setAvailableValues / extractAvailableValues', () => {
    it('should set and retain available values', () => {
      service.setAvailableValues({ deities: ['sai', 'devi'], tempos: ['fast', 'slow'] });
      expect((service as any).availableValues.deities).toEqual(['sai', 'devi']);
      expect((service as any).availableValues.tempos).toEqual(['fast', 'slow']);
    });
  });

  describe('parseNaturalLanguageQuery (rule-based)', () => {
    it('should parse song query with deity', async () => {
      const result = await service.parseNaturalLanguageQuery('find sai songs', 'song');
      expect(result.filters).toEqual(expect.objectContaining({ deity: 'sai' }));
    });

    it('should parse song query with language', async () => {
      const result = await service.parseNaturalLanguageQuery('sanskrit songs', 'song');
      expect(result.filters).toEqual(expect.objectContaining({ language: 'sanskrit' }));
    });

    it('should parse song query with tempo', async () => {
      const result = await service.parseNaturalLanguageQuery('fast devi songs', 'song');
      expect(result.filters).toEqual(expect.objectContaining({ tempo: 'fast', deity: 'devi' }));
    });

    it('should parse pitch query with deity', async () => {
      const result = await service.parseNaturalLanguageQuery('pitches for sai songs', 'pitch');
      expect(result.filters).toEqual(expect.objectContaining({ deity: 'sai' }));
    });

    it('should return empty filters for empty or irrelevant query', async () => {
      const result = await service.parseNaturalLanguageQuery('', 'song');
      expect(result.filters).toEqual({});
    });
  });

  describe('chatWithAppContext (rule-based)', () => {
    it('should navigate to songs with filters for "show slow shiva bhajans"', async () => {
      const { reply, action } = await service.chatWithAppContext('show slow shiva bhajans');
      expect(reply).toContain('songs');
      expect(action?.type).toBe('navigate');
      expect(action?.path).toBe('/admin/songs');
      expect(action?.filters).toEqual({ deity: 'shiva', tempo: 'slow' });
    });

    it('should navigate to my pitches for "my slow shiva bhajans"', async () => {
      const { reply, action } = await service.chatWithAppContext('my slow shiva bhajans');
      expect(action?.type).toBe('navigate');
      expect(action?.path).toBe('/admin/pitches');
      expect(action?.filters).toEqual({ deity: 'shiva', tempo: 'slow' });
      expect(action?.showMyPitches).toBe(true);
    });

    it('should navigate to singers for "go to singers"', async () => {
      const { reply, action } = await service.chatWithAppContext('go to singers');
      expect(action?.type).toBe('navigate');
      expect(action?.path).toBe('/admin/singers');
    });

    it('should return show_preview for "preview Om Ram"', async () => {
      const { reply, action } = await service.chatWithAppContext('preview Om Ram');
      expect(action?.type).toBe('show_preview');
      expect(action?.songName?.toLowerCase()).toBe('om ram');
    });

    it('should return play_audio for "play Shiva Shankara"', async () => {
      const { action } = await service.chatWithAppContext('play Shiva Shankara');
      expect(action?.type).toBe('play_audio');
      expect(action?.songName?.toLowerCase()).toContain('shiva');
    });

    it('should return clear_session for "clear the session"', async () => {
      const { action } = await service.chatWithAppContext('clear the session');
      expect(action?.type).toBe('clear_session');
    });

    it('should call onDebugLog when provided', async () => {
      const logs: [string, unknown][] = [];
      await service.chatWithAppContext('show shiva songs', {
        onDebugLog: (msg, data) => logs.push([msg, data]),
      });
      expect(logs.some(([msg]) => msg === 'User message')).toBe(true);
    });

    it('should return helpful message when no rule matches', async () => {
      const { reply, action } = await service.chatWithAppContext('xyz random gibberish');
      expect(reply).toContain("didn't catch");
      expect(action).toBeUndefined();
    });
  });

  describe('unload', () => {
    it('should not throw', async () => {
      await expect(service.unload()).resolves.toBeUndefined();
    });
  });

  describe('getWebLLMService', () => {
    it('should return singleton instance', () => {
      const instance1 = getWebLLMService();
      const instance2 = getWebLLMService();
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(WebLLMService);
    });
  });

  describe('checkWebGPUSupport', () => {
    it('should return true when gpu in navigator', () => {
      const orig = (navigator as any).gpu;
      (navigator as any).gpu = {};
      expect(checkWebGPUSupport()).toBe(true);
      (navigator as any).gpu = orig;
    });

    it('should return false when gpu not in navigator', () => {
      const orig = (navigator as any).gpu;
      delete (navigator as any).gpu;
      expect(checkWebGPUSupport()).toBe(false);
      if (orig !== undefined) (navigator as any).gpu = orig;
    });
  });
});
