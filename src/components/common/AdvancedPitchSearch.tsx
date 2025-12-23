import React, { useState, useMemo } from 'react';
import type { Song, Singer } from '../../types';

export interface PitchSearchFilters {
  songName?: string;
  singerName?: string;
  pitch?: string;
  deity?: string;
  language?: string;
  raga?: string;
  // Case sensitivity flags
  songNameCaseSensitive?: boolean;
  singerNameCaseSensitive?: boolean;
  pitchCaseSensitive?: boolean;
  deityCaseSensitive?: boolean;
  languageCaseSensitive?: boolean;
  ragaCaseSensitive?: boolean;
}

interface AdvancedPitchSearchProps {
  filters: PitchSearchFilters;
  onFiltersChange: (filters: PitchSearchFilters) => void;
  onClear: () => void;
  songs?: Song[];
  singers?: Singer[];
}

export const AdvancedPitchSearch: React.FC<AdvancedPitchSearchProps> = ({
  filters,
  onFiltersChange,
  onClear,
  songs = [],
  singers = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract unique values for dropdowns
  const uniqueValues = useMemo(() => {
    const getUniqueSongValues = (field: keyof Song) => {
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

    return {
      singerNames,
      deities: getUniqueSongValues('deity'),
      languages: getUniqueSongValues('language'),
      ragas: getUniqueSongValues('raga'),
    };
  }, [songs, singers]);

  const handleFilterChange = (field: keyof PitchSearchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  const handleCaseSensitivityChange = (field: keyof PitchSearchFilters, checked: boolean) => {
    onFiltersChange({
      ...filters,
      [field]: checked,
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Song Name
              </label>
              <input
                type="text"
                value={filters.songName || ''}
                onChange={(e) => handleFilterChange('songName', e.target.value)}
                placeholder="Search by song..."
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="songname-case-sensitive"
                  checked={filters.songNameCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('songNameCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="songname-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Singer Name Combo Box */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Singer Name
              </label>
              <input
                list="singer-list"
                value={filters.singerName || ''}
                onChange={(e) => handleFilterChange('singerName', e.target.value)}
                placeholder="Type or select singer..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <datalist id="singer-list">
                {uniqueValues.singerNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="singername-case-sensitive"
                  checked={filters.singerNameCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('singerNameCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="singername-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Pitch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pitch
              </label>
              <input
                type="text"
                value={filters.pitch || ''}
                onChange={(e) => handleFilterChange('pitch', e.target.value)}
                placeholder="Search by pitch (e.g. C#)"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="pitch-case-sensitive"
                  checked={filters.pitchCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('pitchCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="pitch-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Deity Combo Box */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Deity (from song)
              </label>
              <input
                list="pitch-deity-list"
                value={filters.deity || ''}
                onChange={(e) => handleFilterChange('deity', e.target.value)}
                placeholder="Type or select deity..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <datalist id="pitch-deity-list">
                {uniqueValues.deities.map(deity => (
                  <option key={deity} value={deity} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="pitch-deity-case-sensitive"
                  checked={filters.deityCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('deityCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="pitch-deity-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Language Combo Box */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Language (from song)
              </label>
              <input
                list="pitch-language-list"
                value={filters.language || ''}
                onChange={(e) => handleFilterChange('language', e.target.value)}
                placeholder="Type or select language..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <datalist id="pitch-language-list">
                {uniqueValues.languages.map(language => (
                  <option key={language} value={language} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="pitch-language-case-sensitive"
                  checked={filters.languageCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('languageCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="pitch-language-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Raga Combo Box */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Raga (from song)
              </label>
              <input
                list="pitch-raga-list"
                value={filters.raga || ''}
                onChange={(e) => handleFilterChange('raga', e.target.value)}
                placeholder="Type or select raga..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <datalist id="pitch-raga-list">
                {uniqueValues.ragas.map(raga => (
                  <option key={raga} value={raga} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="pitch-raga-case-sensitive"
                  checked={filters.ragaCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('ragaCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="pitch-raga-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
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


