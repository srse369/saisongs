import React, { useState, useMemo, useEffect } from 'react';
import type { Song } from '../../types';

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
  nameCaseSensitive?: boolean;
  deityCaseSensitive?: boolean;
  languageCaseSensitive?: boolean;
  ragaCaseSensitive?: boolean;
  tempoCaseSensitive?: boolean;
  beatCaseSensitive?: boolean;
  levelCaseSensitive?: boolean;
  songTagsCaseSensitive?: boolean;
}

interface AdvancedSongSearchProps {
  filters: SongSearchFilters;
  onFiltersChange: (filters: SongSearchFilters) => void;
  onClear: () => void;
  onApply?: () => void;
  songs?: Song[];
}

export const AdvancedSongSearch: React.FC<AdvancedSongSearchProps> = ({
  filters,
  onFiltersChange,
  onClear,
  onApply,
  songs = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /**
   * FIX: 2026 Layout Recalculation
   * Force the browser to reset the visual viewport to 100% after keyboard hide.
   */
  const handleMobileDismissal = (callback?: () => void) => {
    // 1. Dismiss Keyboard immediately
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // 2. Allow a delay for the keyboard dismissal animation to start
    // Closing the dialog too fast causes the 'blank screen' bug.
    setTimeout(() => {
      if (callback) callback();
      setIsExpanded(false);

      // 3. Force a DOM Reflow (The "Nuclear Option" for repaints)
      document.body.style.display = 'none';
      document.body.offsetHeight; // Forces engine to recalculate layout
      document.body.style.display = '';

      // 4. Reset scroll to fix viewport displacement
      window.scrollTo(window.scrollX, window.scrollY);
    }, 150); 
  };

  const uniqueValues = useMemo(() => {
    const getUniqueValues = (field: keyof Song) => {
      const values = new Set<string>();
      songs.forEach(song => {
        const value = song[field];
        if (value && typeof value === 'string' && value.trim()) {
          values.add(value.trim());
        }
      });
      return Array.from(values).sort((a, b) => a.localeCompare(b));
    };
    return {
      deities: getUniqueValues('deity'),
      languages: getUniqueValues('language'),
      ragas: getUniqueValues('raga'),
      tempos: getUniqueValues('tempo'),
      beats: getUniqueValues('beat'),
      levels: getUniqueValues('level'),
    };
  }, [songs]);

  const handleFilterChange = (field: keyof SongSearchFilters, value: string) => {
    onFiltersChange({ ...filters, [field]: value || undefined });
  };

  const handleCaseSensitivityChange = (field: keyof SongSearchFilters, checked: boolean) => {
    onFiltersChange({ ...filters, [field]: checked });
  };

  const hasActiveFilters = Object.values(filters).some(v => v === true || (typeof v === 'string' && v.length > 0));
  const activeFilterCount = Object.values(filters).filter(v => v === true || (typeof v === 'string' && v.length > 0)).length;

  return (
    <div className="space-y-3">
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
            onPointerDown={(e) => {
              e.preventDefault(); // Prevents click-stealing
              handleMobileDismissal(onClear);
            }}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {isExpanded && (
        <div 
          className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 animate-fade-in"
          style={isMobile ? {
            maxHeight: 'calc(100vh - 280px)', // Reserve space for header, search bar, and bottom action bar
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          } : {}}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Song Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Song Name</label>
              <input
                type="text"
                value={filters.name || ''}
                onChange={(e) => handleFilterChange('name', e.target.value)}
                placeholder="Search by name..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="name-case-sensitive"
                  checked={filters.nameCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('nameCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="name-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Deity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deity</label>
              <input
                list="deity-list"
                value={filters.deity || ''}
                onChange={(e) => handleFilterChange('deity', e.target.value)}
                placeholder="Type or select..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <datalist id="deity-list">
                {uniqueValues.deities.map(deity => (
                  <option key={deity} value={deity} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="deity-case-sensitive"
                  checked={filters.deityCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('deityCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="deity-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
              <input
                list="language-list"
                value={filters.language || ''}
                onChange={(e) => handleFilterChange('language', e.target.value)}
                placeholder="Type or select..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <datalist id="language-list">
                {uniqueValues.languages.map(language => (
                  <option key={language} value={language} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="language-case-sensitive"
                  checked={filters.languageCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('languageCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="language-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Raga */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Raga</label>
              <input
                list="raga-list"
                value={filters.raga || ''}
                onChange={(e) => handleFilterChange('raga', e.target.value)}
                placeholder="Type or select..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <datalist id="raga-list">
                {uniqueValues.ragas.map(raga => (
                  <option key={raga} value={raga} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="raga-case-sensitive"
                  checked={filters.ragaCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('ragaCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="raga-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Tempo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tempo</label>
              <input
                list="tempo-list"
                value={filters.tempo || ''}
                onChange={(e) => handleFilterChange('tempo', e.target.value)}
                placeholder="Type or select..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <datalist id="tempo-list">
                {uniqueValues.tempos.map(tempo => (
                  <option key={tempo} value={tempo} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="tempo-case-sensitive"
                  checked={filters.tempoCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('tempoCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="tempo-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Beat */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beat</label>
              <input
                list="beat-list"
                value={filters.beat || ''}
                onChange={(e) => handleFilterChange('beat', e.target.value)}
                placeholder="Type or select..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <datalist id="beat-list">
                {uniqueValues.beats.map(beat => (
                  <option key={beat} value={beat} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="beat-case-sensitive"
                  checked={filters.beatCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('beatCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="beat-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level</label>
              <input
                list="level-list"
                value={filters.level || ''}
                onChange={(e) => handleFilterChange('level', e.target.value)}
                placeholder="Type or select..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <datalist id="level-list">
                {uniqueValues.levels.map(level => (
                  <option key={level} value={level} />
                ))}
              </datalist>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="level-case-sensitive"
                  checked={filters.levelCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('levelCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="level-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
              <input
                type="text"
                value={filters.songTags || ''}
                onChange={(e) => handleFilterChange('songTags', e.target.value)}
                placeholder="Search by tags..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="checkbox"
                  id="tags-case-sensitive"
                  checked={filters.songTagsCaseSensitive || false}
                  onChange={(e) => handleCaseSensitivityChange('songTagsCaseSensitive', e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
                <label htmlFor="tags-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  Case sensitive
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleMobileDismissal();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md"
            >
              Close
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleMobileDismissal(onApply);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
