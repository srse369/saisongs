import React, { useState, useEffect } from 'react';
import { getWebLLMService, checkWebGPUSupport, type LLMSearchResult, type SearchType } from '../../services/WebLLMService';
import type { InitProgressReport } from '@mlc-ai/web-llm';
import type { SongSearchFilters } from './AdvancedSongSearch';
import type { PitchSearchFilters } from './AdvancedPitchSearch';

interface WebLLMSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFiltersExtracted?: (filters: SongSearchFilters | PitchSearchFilters) => void;
  searchType: SearchType;
  placeholder?: string;
}

export const WebLLMSearchInput: React.FC<WebLLMSearchInputProps> = ({
  value,
  onChange,
  onFiltersExtracted,
  searchType,
  placeholder = 'Ask me: "Show me sai songs in sanskrit with fast tempo"...',
}) => {
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<string>('');
  const [loadPercentage, setLoadPercentage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasWebGPU, setHasWebGPU] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setHasWebGPU(checkWebGPUSupport());
  }, []);

  const handleEnableLLM = async () => {
    if (!hasWebGPU) {
      setError('WebGPU not supported in your browser. Please use Chrome/Edge 113+ or Safari 17+');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const service = getWebLLMService();
    
    try {
      await service.initialize((report: InitProgressReport) => {
        setLoadProgress(report.text);
        setLoadPercentage(report.progress * 100);
      });
      
      setLlmEnabled(true);
      setIsLoading(false);
      setLoadProgress('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load AI model. Try refreshing the page.';
      setError(errorMsg);
      setIsLoading(false);
      console.error('WebLLM initialization error:', err);
    }
  };

  const handleDisableLLM = async () => {
    const service = getWebLLMService();
    await service.unload();
    setLlmEnabled(false);
  };

  const handleSearch = async () => {
    if (!llmEnabled || !value.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const service = getWebLLMService();
      const result: LLMSearchResult = await service.parseNaturalLanguageQuery(value, searchType);
      
      if (onFiltersExtracted && Object.keys(result.filters).length > 0) {
        onFiltersExtracted(result.filters);
      }
    } catch (err) {
      setError('AI search failed. Using regular search instead.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && llmEnabled && !isProcessing) {
      handleSearch();
    }
  };

  return (
    <div className="flex-1 space-y-3">
      {/* Search Input with integrated AI Toggle */}
      <div className="relative flex items-center">
        {/* Search Icon */}
        <svg
          className={`w-4 h-4 absolute left-3 ${llmEnabled ? 'text-purple-500' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* Search Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={llmEnabled ? placeholder : 'Search (Enable AI for natural language)...'}
          className={`
            w-full pl-10 pr-32 py-2.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
            ${llmEnabled 
              ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/10' 
              : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
            }
            dark:text-gray-100
          `}
        />

        {/* Right side controls */}
        <div className="absolute right-3 flex items-center gap-2">
          {/* Clear button */}
          {value && (
            <button
              onClick={() => onChange('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Clear"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Divider */}
          <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />

          {/* AI Toggle */}
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium ${llmEnabled ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
              AI
            </span>
            <button
              onClick={llmEnabled ? handleDisableLLM : handleEnableLLM}
              disabled={isLoading || !hasWebGPU}
              className={`
                relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                ${llmEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}
                ${!hasWebGPU ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
              `}
              title={!hasWebGPU ? 'WebGPU not supported' : llmEnabled ? 'Disable AI' : 'Enable AI'}
            >
              <span
                className={`
                  inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                  ${llmEnabled ? 'translate-x-5' : 'translate-x-1'}
                `}
              />
            </button>
            {llmEnabled && (
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Helper text for WebGPU warning */}
      {!hasWebGPU && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ WebGPU required for AI search (Chrome/Edge 113+, Safari 17+)
        </p>
      )}

      {/* Loading Progress */}
      {isLoading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Loading AI Model... {Math.round(loadPercentage)}%
            </span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 ml-8">{loadProgress}</p>
          <div className="mt-2 ml-8 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div 
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadPercentage}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 ml-8">
            This will download ~100-150MB model. First time only, cached for future use.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* AI Hint */}
      {llmEnabled && !isProcessing && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-900 dark:text-purple-100 font-medium mb-1">💡 AI Search Examples:</p>
          <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
            <li>• "Show me all sai bhajans in sanskrit with slow tempo"</li>
            <li>• "I want devi songs that are simple level"</li>
            <li>• "Find hamsadhwani raga songs"</li>
            <li>• "C# pitch for any singer"</li>
          </ul>
        </div>
      )}
    </div>
  );
};

