import React, { useState, useEffect, forwardRef } from 'react';
import { getWebLLMService, checkWebGPUSupport, type LLMSearchResult, type SearchType, type AvailableValues } from '../../services/WebLLMService';
import type { InitProgressReport } from '@mlc-ai/web-llm';
import type { SongSearchFilters } from './AdvancedSongSearch';
import type { PitchSearchFilters } from './AdvancedPitchSearch';

interface WebLLMSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFiltersExtracted?: (filters: SongSearchFilters | PitchSearchFilters) => void;
  searchType: SearchType;
  placeholder?: string;
  availableValues?: AvailableValues;
}

export const WebLLMSearchInput = forwardRef<HTMLInputElement, WebLLMSearchInputProps>(({
  value,
  onChange,
  onFiltersExtracted,
  searchType,
  placeholder = 'Ask me: "Show me sai songs in sanskrit with fast tempo"...',
  availableValues,
}, ref) => {
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<string>('');
  const [loadPercentage, setLoadPercentage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasWebGPU, setHasWebGPU] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasWebGPU(checkWebGPUSupport());
  }, []);

  // Update available values when they change or when LLM is enabled
  useEffect(() => {
    if (availableValues) {
      const service = getWebLLMService();
      service.setAvailableValues(availableValues);
    }
  }, [availableValues]);

  const handleEnableLLM = async () => {
    if (!hasWebGPU) {
      setError('WebGPU not supported in your browser. Please use Chrome/Edge 113+ or Safari 17+');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const service = getWebLLMService();
    
    // Set available values before or after initialization
    if (availableValues) {
      service.setAvailableValues(availableValues);
    }
    
    try {
      await service.initialize((report: InitProgressReport) => {
        setLoadProgress(report.text);
        setLoadPercentage(report.progress * 100);
      });
      
      // Ensure available values are set after initialization
      if (availableValues) {
        service.setAvailableValues(availableValues);
      }
      
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
      
      console.log('🤖 AI Search Result:', {
        query: value,
        searchType,
        extractedFilters: result.filters,
        filterCount: Object.keys(result.filters).length
      });
      
      if (onFiltersExtracted) {
        if (Object.keys(result.filters).length > 0) {
          // Check if only "name" filter is extracted (text search query)
          const filterKeys = Object.keys(result.filters);
          const isTextSearch = filterKeys.length === 1 && 
            (filterKeys[0] === 'name' || filterKeys[0] === 'songName');
          
          if (isTextSearch) {
            // For text search queries, use the search text instead of the name filter
            // This allows fuzzy search to work properly
            const nameValue = (result.filters as any).name || (result.filters as any).songName || '';
            if (nameValue) {
              // Set search text to the extracted name for fuzzy search
              onChange(nameValue);
              // Don't apply the name filter - just use search text
              setSuccessMessage(`✨ Searching for: "${nameValue}"`);
            } else {
              // If no name value, keep the original search text
              setSuccessMessage(`✨ Using text search`);
            }
          } else {
            // For filter-based queries, apply filters and clear the search text
            console.log('✅ Applying filters:', result.filters);
            onFiltersExtracted(result.filters);
            onChange('');
            
            // Show success message
            const filterCount = Object.keys(result.filters).length;
            const filterNames = Object.keys(result.filters).join(', ');
            setSuccessMessage(`✨ Applied ${filterCount} filter${filterCount > 1 ? 's' : ''}: ${filterNames}`);
          }
          
          // Clear success message after 5 seconds
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          console.log('⚠️ No filters extracted from query');
          setError('No filters found. Try being more specific (e.g., "Show C# pitches for Sai songs")');
        }
      }
    } catch (err) {
      setError('AI search failed. Using regular search instead.');
      console.error('❌ AI Search Error:', err);
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
        <i className={`fas fa-search text-base absolute left-3 ${llmEnabled ? 'text-purple-500' : 'text-gray-400'}`}></i>

        {/* Search Input - larger touch target on mobile */}
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={llmEnabled ? placeholder : 'Search (Enable AI for natural language)...'}
          autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
          className={`
            w-full pl-10 pr-32 py-3 sm:py-2.5 text-base sm:text-sm border rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
            ${llmEnabled 
              ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/10' 
              : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
            }
            dark:text-gray-100
          `}
        />

        {/* Right side controls */}
        <div className="absolute right-2 sm:right-3 flex items-center gap-1 sm:gap-2">
          {/* Clear button - larger touch target on mobile */}
          {value && (
            <button
              onClick={() => onChange('')}
              className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Clear"
            >
              <i className="fas fa-times text-base"></i>
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
              <i className="fas fa-check-circle text-xs text-green-500"></i>
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
            <i className="fas fa-spinner fa-spin text-lg text-blue-600 dark:text-blue-400"></i>
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

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-start gap-2 animate-fade-in">
          <i className="fas fa-check-circle text-lg text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"></i>
          <span className="text-sm text-green-800 dark:text-green-300">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <i className="fas fa-times-circle text-lg text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"></i>
          <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Ask AI Button - only show when AI is enabled and there's a query */}
      {llmEnabled && value.trim() && !isLoading && (
        <button
          onClick={handleSearch}
          disabled={isProcessing}
          className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <i className="fas fa-spinner fa-spin text-base"></i>
              Processing...
            </>
          ) : (
            <>
              <i className="fas fa-bolt text-base"></i>
              Ask AI (or press Enter)
            </>
          )}
        </button>
      )}

      {/* AI Hint */}
      {llmEnabled && !isProcessing && !value.trim() && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-900 dark:text-purple-100 font-medium mb-1">💡 AI Search Examples:</p>
          <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
            {searchType === 'song' ? (
              <>
                <li>• "Show me sai bhajans in sanskrit with slow tempo"</li>
                <li>• "Find hamsadhwani raga songs"</li>
                <li>• "Devi songs that are simple level"</li>
                <li>• "Fast tempo krishna songs in mohanam raga"</li>
              </>
            ) : (
              <>
                <li>• "Show me C# pitches for sai songs"</li>
                <li>• "Find pitches for devi songs in hamsadhwani raga"</li>
                <li>• "D# pitch for sanskrit songs"</li>
                <li>• "Which singers have krishna bhajans"</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});

WebLLMSearchInput.displayName = 'WebLLMSearchInput';

