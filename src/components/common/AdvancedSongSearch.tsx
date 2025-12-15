import React, { useState } from 'react';
import { FilterInput } from './FilterInput';

export interface SongSearchFilters {
  name?: string;
  title?: string;
  deity?: string;
  language?: string;
  raga?: string;
  tempo?: string;
  beat?: string;
  level?: string;
  songTags?: string;
}

interface AdvancedSongSearchProps {
  filters: SongSearchFilters;
  onFiltersChange: (filters: SongSearchFilters) => void;
  onClear: () => void;
}

export const AdvancedSongSearch: React.FC<AdvancedSongSearchProps> = ({
  filters,
  onFiltersChange,
  onClear,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (field: keyof SongSearchFilters, value: string) => {
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
            <FilterInput
              label="Song Name"
              value={filters.name || ''}
              placeholder="Search by name..."
              onChange={(value) => handleFilterChange('name', value)}
            />
            <FilterInput
              label="Deity"
              value={filters.deity || ''}
              placeholder="Search by deity..."
              onChange={(value) => handleFilterChange('deity', value)}
            />
            <FilterInput
              label="Language"
              value={filters.language || ''}
              placeholder="Search by language..."
              onChange={(value) => handleFilterChange('language', value)}
            />
            <FilterInput
              label="Raga"
              value={filters.raga || ''}
              placeholder="Search by raga..."
              onChange={(value) => handleFilterChange('raga', value)}
            />
            <FilterInput
              label="Tempo"
              value={filters.tempo || ''}
              placeholder="Search by tempo..."
              onChange={(value) => handleFilterChange('tempo', value)}
            />
            <FilterInput
              label="Beat"
              value={filters.beat || ''}
              placeholder="Search by beat..."
              onChange={(value) => handleFilterChange('beat', value)}
            />
            <FilterInput
              label="Level"
              value={filters.level || ''}
              placeholder="Search by level..."
              onChange={(value) => handleFilterChange('level', value)}
            />
            <FilterInput
              label="Tags"
              value={filters.songTags || ''}
              placeholder="Search by tags..."
              onChange={(value) => handleFilterChange('songTags', value)}
            />
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
                      onClick={() => handleFilterChange(key as keyof SongSearchFilters, '')}
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


