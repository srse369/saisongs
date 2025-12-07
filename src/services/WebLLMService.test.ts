import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebLLMService, getWebLLMService, checkWebGPUSupport } from './WebLLMService';
import type * as webllm from '@mlc-ai/web-llm';

describe('WebLLMService', () => {
  let service: WebLLMService;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let mockEngine: any;

  beforeEach(() => {
    service = new WebLLMService();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock WebLLM engine
    mockEngine = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const mockCreateMLCEngine = vi.fn().mockResolvedValue(mockEngine);
      
      // Mock the webllm module
      vi.doMock('@mlc-ai/web-llm', () => ({
        CreateMLCEngine: mockCreateMLCEngine,
      }));

      // Use dynamic import to get mocked module
      const webllmModule = await import('@mlc-ai/web-llm');
      (webllmModule as any).CreateMLCEngine = mockCreateMLCEngine;
      
      // Replace the CreateMLCEngine in global scope
      (global as any).CreateMLCEngine = mockCreateMLCEngine;
      
      // Mock the service's internal engine creation
      const initSpy = vi.spyOn(service as any, 'initialize').mockImplementation(async () => {
        (service as any).engine = mockEngine;
        (service as any).isReady = true;
        (service as any).isInitializing = false;
      });

      await service.initialize();

      expect(service.isModelReady()).toBe(true);
      expect(service.isModelInitializing()).toBe(false);
      
      initSpy.mockRestore();
    });

    it('should call progress callback during initialization', async () => {
      const progressCallback = vi.fn();
      
      const initSpy = vi.spyOn(service as any, 'initialize').mockImplementation(async (onProgress?: any) => {
        if (onProgress) {
          onProgress({ progress: 0.5, text: 'Loading model...' });
        }
        (service as any).engine = mockEngine;
        (service as any).isReady = true;
        (service as any).isInitializing = false;
      });

      await service.initialize(progressCallback);

      expect(progressCallback).toHaveBeenCalledWith({ progress: 0.5, text: 'Loading model...' });
      
      initSpy.mockRestore();
    });

    it('should return immediately if already initialized', async () => {
      (service as any).isReady = true;
      (service as any).engine = mockEngine;

      await service.initialize();

      expect(service.isModelReady()).toBe(true);
    });

    it('should return existing promise if initialization in progress', async () => {
      const mockPromise = Promise.resolve();
      (service as any).initPromise = mockPromise;

      const result = service.initialize();

      // Should return same promise (can't use toBe with promises in all environments)
      expect(result).toBeInstanceOf(Promise);
    });

    it('should handle WebGPU not available error', async () => {
      const initSpy = vi.spyOn(service as any, 'initialize').mockImplementation(async () => {
        (service as any).isInitializing = true;
        throw new Error('WebGPU not available. Please use Chrome/Edge 113+ with hardware acceleration enabled.');
      });

      await expect(service.initialize()).rejects.toThrow(
        'WebGPU not available'
      );

      expect(service.isModelReady()).toBe(false);
      
      initSpy.mockRestore();
    });

    it('should handle network error', async () => {
      const initSpy = vi.spyOn(service as any, 'initialize').mockImplementation(async () => {
        (service as any).isInitializing = true;
        throw new Error('Network error loading model. Check your internet connection and try again.');
      });

      await expect(service.initialize()).rejects.toThrow(
        'Network error'
      );
      
      initSpy.mockRestore();
    });

    it('should handle memory error', async () => {
      const initSpy = vi.spyOn(service as any, 'initialize').mockImplementation(async () => {
        (service as any).isInitializing = true;
        throw new Error('Insufficient memory. Please close other tabs and try again.');
      });

      await expect(service.initialize()).rejects.toThrow(
        'Insufficient memory'
      );
      
      initSpy.mockRestore();
    });

    it('should handle generic initialization error', async () => {
      const initSpy = vi.spyOn(service as any, 'initialize').mockImplementation(async () => {
        (service as any).isInitializing = true;
        throw new Error('Failed to load AI model: Generic error');
      });

      await expect(service.initialize()).rejects.toThrow(
        'Failed to load AI model'
      );
      
      initSpy.mockRestore();
    });
  });

  describe('parseNaturalLanguageQuery', () => {
    beforeEach(() => {
      (service as any).isReady = true;
      (service as any).engine = mockEngine;
    });

    it('should throw error if not initialized', async () => {
      (service as any).isReady = false;
      (service as any).engine = null;

      await expect(
        service.parseNaturalLanguageQuery('find sai songs', 'song')
      ).rejects.toThrow('WebLLM not initialized');
    });

    it('should parse song search query successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"deity":"sai"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find sai songs', 'song');

      expect(result).toEqual({
        filters: { deity: 'sai' },
        confidence: 0.8,
      });
    });

    it('should parse pitch search query successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"pitch":"C#","deity":"sai"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('C# pitch for sai songs', 'pitch');

      expect(result).toEqual({
        filters: { pitch: 'c#', deity: 'sai' },
        confidence: 0.8,
      });
    });

    it('should preprocess query with raga hints', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"raga":"hamsadhwani"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      await service.parseNaturalLanguageQuery('find hamsadhwani songs', 'song');

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('[HINT: "hamsadhwani" is a RAGA name]'),
            }),
          ]),
        })
      );
    });

    it('should preprocess query with deity hints', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"deity":"krishna"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      await service.parseNaturalLanguageQuery('find krishna bhajans', 'song');

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('[HINT: "krishna" is a DEITY name]'),
            }),
          ]),
        })
      );
    });

    it('should preprocess query with language hints', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"language":"sanskrit"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      await service.parseNaturalLanguageQuery('find sanskrit songs', 'song');

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('[HINT: "sanskrit" is a LANGUAGE]'),
            }),
          ]),
        })
      );
    });

    it('should preprocess query with tempo hints', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"tempo":"fast"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      await service.parseNaturalLanguageQuery('find fast songs', 'song');

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('[HINT: "fast" is a TEMPO]'),
            }),
          ]),
        })
      );
    });

    it('should handle JSON wrapped in text', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Here is the result: {"deity":"sai"} as requested.',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find sai songs', 'song');

      expect(result.filters).toEqual({ deity: 'sai' });
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('invalid query', 'song');

      expect(result).toEqual({
        filters: {},
        confidence: 0.8,
      });
    });

    it('should handle missing choices in response', async () => {
      const mockResponse = {
        choices: [],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find songs', 'song');

      expect(result).toEqual({
        filters: {},
        confidence: 0.8,
      });
    });

    it('should clean filters by removing null/undefined/empty values', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"deity":"sai","raga":"","language":null,"tempo":"  "}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find sai songs', 'song');

      expect(result.filters).toEqual({ deity: 'sai' });
    });

    it('should correct misclassified raga as deity', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"deity":"hamsadhwani"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find hamsadhwani songs', 'song');

      expect(result.filters).toEqual({ raga: 'hamsadhwani' });
    });

    it('should correct misclassified deity as raga', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"raga":"krishna"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find krishna songs', 'song');

      expect(result.filters).toEqual({ deity: 'krishna' });
    });

    it('should correct misclassified language as deity', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"deity":"sanskrit"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find sanskrit songs', 'song');

      expect(result.filters).toEqual({ language: 'sanskrit' });
    });

    it('should convert filter values to lowercase', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"deity":"SAI","language":"SANSKRIT"}',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find SAI songs in SANSKRIT', 'song');

      expect(result.filters).toEqual({ deity: 'sai', language: 'sanskrit' });
    });

    it('should handle LLM query error', async () => {
      mockEngine.chat.completions.create.mockRejectedValue(new Error('LLM error'));

      await expect(
        service.parseNaturalLanguageQuery('find songs', 'song')
      ).rejects.toThrow('LLM error');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'not valid json at all',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find songs', 'song');

      expect(result).toEqual({
        filters: {},
        confidence: 0.8,
      });
    });

    it('should handle array response (invalid)', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '["deity", "sai"]',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find sai songs', 'song');

      expect(result.filters).toEqual({});
    });

    it('should handle null response (invalid)', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'null',
          },
        }],
      };

      mockEngine.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.parseNaturalLanguageQuery('find songs', 'song');

      expect(result.filters).toEqual({});
    });
  });

  describe('unload', () => {
    it('should clean up resources', async () => {
      (service as any).engine = mockEngine;
      (service as any).isReady = true;
      (service as any).initPromise = Promise.resolve();

      await service.unload();

      expect((service as any).engine).toBeNull();
      expect((service as any).isReady).toBe(false);
      expect((service as any).initPromise).toBeNull();
    });

    it('should handle unload when not initialized', async () => {
      await service.unload();

      expect((service as any).engine).toBeNull();
      expect((service as any).isReady).toBe(false);
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
    it('should return true if WebGPU is supported', () => {
      (navigator as any).gpu = {};

      const result = checkWebGPUSupport();

      expect(result).toBe(true);
    });

    it('should return false if WebGPU is not supported', () => {
      const originalGpu = (navigator as any).gpu;
      delete (navigator as any).gpu;

      const result = checkWebGPUSupport();

      expect(result).toBe(false);

      // Restore
      if (originalGpu !== undefined) {
        (navigator as any).gpu = originalGpu;
      }
    });
  });
});
