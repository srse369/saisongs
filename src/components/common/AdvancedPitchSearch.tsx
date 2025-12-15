import React, { useState } from 'react';

export interface PitchSearchFilters {
  songName?: string;
  singerName?: string;
  pitch?: string;
  deity?: string;
  language?: string;
  raga?: string;
}

interface AdvancedPitchSearchProps {
  filters: PitchSearchFilters;
  onFiltersChange: (filters: PitchSearchFilters) => void;
  onClear: () => void;
}

export const AdvancedPitchSearch: React.FC<AdvancedPitchSearchProps> = ({
  filters,
  onFiltersChange,
  onClear,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (field: keyof PitchSearchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v);
  const activeFilterCount = Object.values(filters).filter(v => v).length;

  return (
    <div className="space-y-3">
      {/* Toggle Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
        >
          <i className="fas fa-sliders-h text-base"></i>
          {isExpanded ? 'Hide' : 'Show'} Advanced Search
          {activeFilterCount > 0 && !isExpanded && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Advanced Search Fields */}
      {isExpanded && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Song Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Song Name
              </label>
              <input
                type="text"
                value={filters.songName || ''}
                onChange={(e) => handleFilterChange('songName', e.target.value)}
                placeholder="Search by song..."
                autoFocus
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Singer Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Singer Name
              </label>
              <input
                type="text"
                value={filters.singerName || ''}
                onChange={(e) => handleFilterChange('singerName', e.target.value)}
                placeholder="Search by singer..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Pitch */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pitch
              </label>
              <input
                type="text"
                value={filters.pitch || ''}
                onChange={(e) => handleFilterChange('pitch', e.target.value)}
                placeholder="Search by pitch (e.g. C#)"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Deity */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Deity (from song)
              </label>
              <input
                type="text"
                value={filters.deity || ''}
                onChange={(e) => handleFilterChange('deity', e.target.value)}
                placeholder="Search by deity..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Language (from song)
              </label>
              <input
                type="text"
                value={filters.language || ''}
                onChange={(e) => handleFilterChange('language', e.target.value)}
                placeholder="Search by language..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Raga */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Raga (from song)
              </label>
              <input
                type="text"
                value={filters.raga || ''}
                onChange={(e) => handleFilterChange('raga', e.target.value)}
                placeholder="Search by raga..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Active filters:</span>
              {Object.entries(filters).map(([key, value]) => 
                value ? (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs"
                  >
                    <span className="font-medium">{key}:</span>
                    <span>{value}</span>
                    <button
                      onClick={() => handleFilterChange(key as keyof PitchSearchFilters, '')}
                      className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      ×
                    </button>
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


