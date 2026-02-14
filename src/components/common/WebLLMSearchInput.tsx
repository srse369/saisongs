import React, { useState, useEffect, forwardRef } from 'react';
import { getWebLLMService, type LLMSearchResult, type SearchType, type AvailableValues } from '../../services/WebLLMService';
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
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (availableValues) {
      const service = getWebLLMService();
      service.setAvailableValues(availableValues);
    }
  }, [availableValues]);

  const handleSearch = async () => {
    if (!value.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const service = getWebLLMService();
      const result: LLMSearchResult = await service.parseNaturalLanguageQuery(value, searchType);
      
      console.log('Natural language search result:', {
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
      setError('Could not parse query. Try being more specific.');
      console.error('Natural language parse error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) {
      handleSearch();
    }
  };

  return (
    <div className="flex-1 space-y-3">
      <div className="relative flex items-center">
        <i className="fas fa-search text-base absolute left-3 text-gray-400"></i>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
          className="w-full pl-10 pr-24 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100"
        />
        <div className="absolute right-2 sm:right-3 flex items-center gap-1 sm:gap-2">
          {value && (
            <button
              onClick={() => onChange('')}
              className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Clear"
            >
              <i className="fas fa-times text-base"></i>
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-start gap-2 animate-fade-in">
          <i className="fas fa-check-circle text-lg text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"></i>
          <span className="text-sm text-green-800 dark:text-green-300">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <i className="fas fa-times-circle text-lg text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"></i>
          <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
        </div>
      )}

      {value.trim() && (
        <button
          onClick={handleSearch}
          disabled={isProcessing}
          className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <i className="fas fa-spinner fa-spin text-base"></i>
              Applying…
            </>
          ) : (
            <>
              <i className="fas fa-bolt text-base"></i>
              Apply filters (or Enter)
            </>
          )}
        </button>
      )}

      {!value.trim() && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-900 dark:text-purple-100 font-medium mb-1">Natural language examples:</p>
          <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
            {searchType === 'song' ? (
              <>
                <li>• &quot;Show me sai bhajans in sanskrit with slow tempo&quot;</li>
                <li>• &quot;Find hamsadhwani raga songs&quot;</li>
                <li>• &quot;Devi songs that are simple level&quot;</li>
              </>
            ) : (
              <>
                <li>• &quot;Show me C# pitches for sai songs&quot;</li>
                <li>• &quot;Find pitches for devi songs in hamsadhwani raga&quot;</li>
                <li>• &quot;D# pitch for sanskrit songs&quot;</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});

WebLLMSearchInput.displayName = 'WebLLMSearchInput';

