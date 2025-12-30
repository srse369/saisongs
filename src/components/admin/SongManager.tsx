import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSongs } from '../../contexts/SongContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { SongForm } from './SongForm';
import { SongList } from './SongList';
import { SongDetails } from './SongDetails';
import { Modal } from '../common/Modal';
import { WebLLMSearchInput } from '../common/WebLLMSearchInput';
import { AdvancedSongSearch, type SongSearchFilters } from '../common/AdvancedSongSearch';
import { WebLLMService } from '../../services/WebLLMService';
import { RefreshIcon, Tooltip, MobileBottomActionBar, type MobileAction } from '../common';
import { createSongFuzzySearch, parseNaturalQuery } from '../../utils/smartSearch';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import songService from '../../services/SongService';
import type { Song, CreateSongInput } from '../../types';

export const SongManager: React.FC = () => {
  const {
    songs,
    loading,
    error,
    fetchSongs,
    createSong,
    updateSong,
    deleteSong,
    clearError,
  } = useSongs();
  const { isEditor, userId } = useAuth();
  const toast = useToast();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pitchCount'>('name');
  const [advancedFilters, setAdvancedFilters] = useState<SongSearchFilters>({});
  const [visibleCount, setVisibleCount] = useState(50);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Create fuzzy search instance for fallback
  const fuzzySearch = useMemo(() => createSongFuzzySearch(songs), [songs]);

  // Extract available values for WebLLM
  const availableValues = useMemo(() => {
    return WebLLMService.extractAvailableValues(songs, []);
  }, [songs]);

  useEffect(() => {
    // Fetch songs when user changes to get correct filtered data
    if (userId !== lastFetchedUserIdRef.current) {
      lastFetchedUserIdRef.current = userId;
      fetchSongs(); // Use cached data, only refresh if stale
    }
  }, [fetchSongs, userId]);

  // Focus search bar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateClick = () => {
    setEditingSong(null);
    setIsFormModalOpen(true);
  };

  const handleEditClick = async (song: Song) => {
    // Fetch full song details (including CLOB fields like lyrics, meaning)
    const fullSong = await songService.getSongById(song.id);
    if (fullSong) {
      setEditingSong(fullSong);
    } else {
      setEditingSong(song);
    }
    setIsFormModalOpen(true);
  };

  const handleViewClick = (song: Song) => {
    setViewingSong(song);
  };

  const handleFormCancel = () => {
    // Check for unsaved changes before closing
    if (checkUnsavedChangesRef.current && checkUnsavedChangesRef.current()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    setIsFormModalOpen(false);
    setEditingSong(null);
  };

  const handleFormSubmit = async (input: CreateSongInput) => {
    try {
      if (editingSong) {
        const result = await updateSong(editingSong.id, input);
        if (result) {
          setIsFormModalOpen(false);
          setEditingSong(null);
        }
      } else {
        const result = await createSong(input);
        if (result) {
          setIsFormModalOpen(false);
        }
      }
    } catch (err) {
      // Error is handled by context
      console.error('Error submitting song:', err);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSong(id);
  };

  const handleSync = async (id: string) => {
    try {
      const result = await songService.syncSong(id);
      if (result) {
        toast.success(`Song synced: ${result.message}`);
        // Refresh songs to get updated data
        await fetchSongs();
      } else {
        toast.error('Failed to sync song');
      }
    } catch (err) {
      console.error('Error syncing song:', err);
      toast.error('Error syncing song');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  // Clear search when Escape key is pressed while on this tab (only if no modal is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't clear search if a modal is open - let the modal handle Escape
      if (isFormModalOpen || viewingSong) return;
      
      if (e.key === 'Escape') {
        setSearchTerm('');
        setAdvancedFilters({});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormModalOpen, viewingSong]);

  const filteredSongs = useMemo(() => {
    let results = [...songs]; // Create a copy instead of a reference

    // Helper function for case-sensitive comparison
    const matches = (value: string | undefined, filter: string, caseSensitive: boolean) => {
      if (!value) return false;
      if (caseSensitive) {
        return value.includes(filter);
      }
      return value.toLowerCase().includes(filter.toLowerCase());
    };

    // Apply advanced filters first (field-specific)
    if (advancedFilters.name) {
      results = results.filter(song => 
        matches(song.name, advancedFilters.name!, advancedFilters.nameCaseSensitive || false)
      );
    }
    if (advancedFilters.deity) {
      results = results.filter(song => 
        matches(song.deity, advancedFilters.deity!, advancedFilters.deityCaseSensitive || false)
      );
    }
    if (advancedFilters.language) {
      results = results.filter(song => 
        matches(song.language, advancedFilters.language!, advancedFilters.languageCaseSensitive || false)
      );
    }
    if (advancedFilters.raga) {
      results = results.filter(song => 
        matches(song.raga, advancedFilters.raga!, advancedFilters.ragaCaseSensitive || false)
      );
    }
    if (advancedFilters.tempo) {
      results = results.filter(song => 
        matches(song.tempo, advancedFilters.tempo!, advancedFilters.tempoCaseSensitive || false)
      );
    }
    if (advancedFilters.beat) {
      results = results.filter(song => 
        matches(song.beat, advancedFilters.beat!, advancedFilters.beatCaseSensitive || false)
      );
    }
    if (advancedFilters.level) {
      results = results.filter(song => 
        matches(song.level, advancedFilters.level!, advancedFilters.levelCaseSensitive || false)
      );
    }
    if (advancedFilters.songTags) {
      results = results.filter(song => 
        matches(song.songTags, advancedFilters.songTags!, advancedFilters.songTagsCaseSensitive || false)
      );
    }

    // Apply smart search with natural language parsing and fuzzy matching
    const query = searchTerm.trim();
    
    if (!query) {
      // No search query - just apply sorting
      if (sortBy === 'pitchCount') {
        results.sort((a, b) => {
          const pitchCompare = (b.pitchCount ?? 0) - (a.pitchCount ?? 0);
          if (pitchCompare !== 0) return pitchCompare;
          return compareStringsIgnoringSpecialChars(a.name, b.name);
        });
      } else {
        // Sort by name
        if (advancedFilters.name) {
          const lowerQuery = advancedFilters.name.toLowerCase();
          results = results.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aStartsWith = aName.startsWith(lowerQuery);
            const bStartsWith = bName.startsWith(lowerQuery);
            
            // Prefix matches come first
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            
            // If both start with query or neither does, sort alphabetically
            return compareStringsIgnoringSpecialChars(a.name, b.name);
          });
        } else {
          results.sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
        }
      }
      return results;
    }

    // Direct substring search using the full query - this is the primary search
    // Search across multiple fields to cast a wide net
    const lowerQuery = query.toLowerCase();
    const directMatches = results.filter(s => 
      s.name.toLowerCase().includes(lowerQuery) ||
      s.deity?.toLowerCase().includes(lowerQuery) ||
      s.language?.toLowerCase().includes(lowerQuery) ||
      s.raga?.toLowerCase().includes(lowerQuery) ||
      s.songTags?.toLowerCase().includes(lowerQuery)
    );
    
    // Use direct matches if found, otherwise fall back to fuzzy search
    if (directMatches.length > 0) {
      results = directMatches;
    } else {
      // Fuzzy search as last resort for typo tolerance
      const fuzzyResults = fuzzySearch.search(query);
      const fuzzyIds = new Set(fuzzyResults.map(r => r.item.id));
      results = results.filter(s => fuzzyIds.has(s.id));
    }
    
    // Apply sorting
    if (sortBy === 'pitchCount') {
      // Sort by pitch count (descending), then by name for ties
      results.sort((a, b) => {
        const pitchCompare = (b.pitchCount ?? 0) - (a.pitchCount ?? 0);
        if (pitchCompare !== 0) return pitchCompare;
        return compareStringsIgnoringSpecialChars(a.name, b.name);
      });
    } else {
      // Sort by name
      if (searchTerm.trim() || advancedFilters.name) {
        const query = searchTerm.trim() || advancedFilters.name || '';
        const lowerQuery = query.toLowerCase();
        results.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStartsWith = aName.startsWith(lowerQuery);
          const bStartsWith = bName.startsWith(lowerQuery);
          
          // Prefix matches come first
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          // If both start with query or neither does, sort alphabetically
          return compareStringsIgnoringSpecialChars(a.name, b.name);
        });
      } else {
        results.sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
      }
    }

    return results;
  }, [songs, searchTerm, advancedFilters, fuzzySearch, sortBy]);

  // Reset visible songs when search or underlying list changes
  useEffect(() => {
    setVisibleCount(50);
  }, [searchTerm, advancedFilters, songs.length]);

  const displayedSongs = useMemo(
    () => filteredSongs.slice(0, visibleCount),
    [filteredSongs, visibleCount]
  );

  // Lazy-load more songs as the user scrolls near the bottom
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + 50, filteredSongs.length)
          );
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 1.0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredSongs.length]);

  const activeFilterCount = Object.values(advancedFilters).filter(v => v && typeof v === 'string').length;

  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Sort',
      icon: 'fas fa-sort',
      onClick: () => {
        // Cycle through sort options
        setSortBy(prev => prev === 'name' ? 'pitchCount' : 'name');
      },
      variant: 'secondary',
    },
    {
      label: 'Refresh',
      icon: 'fas fa-sync-alt',
      onClick: () => fetchSongs(true),
      variant: 'secondary',
      disabled: loading,
    },
    ...(isEditor ? [{
      label: 'Create',
      icon: 'fas fa-plus',
      onClick: handleCreateClick,
      variant: 'primary' as const,
    }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 py-2 sm:py-4 md:py-8 animate-fade-in">
      <div className="mb-2 sm:mb-4">
        <div className="flex flex-col gap-2 sm:gap-4 mb-2 sm:mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-1">
                Song Management
              </h1>
              <Tooltip content="View help documentation for this tab">
                <a
                  href="/help#songs"
                  className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                  title="Help"
                >
                  <i className="fas fa-question-circle text-lg sm:text-xl"></i>
                </a>
              </Tooltip>
            </div>
            <p className="hidden sm:block text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Create and manage your song library
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <div className="flex-1">
              <WebLLMSearchInput
                ref={searchInputRef}
                value={searchTerm}
                onChange={handleSearchChange}
                onFiltersExtracted={(filters) => {
                  // Merge AI-extracted filters with existing advanced filters
                  setAdvancedFilters(prev => ({ ...prev, ...filters }));
                }}
                searchType="song"
                placeholder='Ask AI: "Show me sai songs in sanskrit with fast tempo"...'
                availableValues={availableValues}
              />
            </div>
            {/* Desktop action buttons - hidden on mobile */}
            <div className="hidden md:flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
              <Tooltip content="Sort songs by name or pitch count">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'pitchCount')}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="name">Sort: Name</option>
                  <option value="pitchCount">Sort: Pitch Count</option>
                </select>
              </Tooltip>
              <Tooltip content="Reload songs from the database to see the latest updates">
                <button
                  type="button"
                  onClick={() => fetchSongs(true)}
                  disabled={loading}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <RefreshIcon className="w-4 h-4" />
                  Refresh
                </button>
              </Tooltip>
              {isEditor && (
                <Tooltip content="Add a new song to the library with name, lyrics, translation, and metadata">
                  <button
                    onClick={handleCreateClick}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <i className="fas fa-plus text-lg"></i>
                    Create New Song
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Advanced Search - Shown directly on both mobile and desktop */}
          <AdvancedSongSearch
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            onClear={() => setAdvancedFilters({})}
            songs={songs}
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center flex-1 min-w-0">
                <i className="fas fa-times-circle text-lg text-red-600 dark:text-red-400 mr-2 flex-shrink-0"></i>
                <p className="text-sm font-medium text-red-800 dark:text-red-300 truncate">{error.message}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 focus:outline-none flex-shrink-0"
                aria-label="Dismiss error">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
          </div>
        )}

        {/* Song count status */}
        {filteredSongs.length > 0 && (
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            {displayedSongs.length < filteredSongs.length
              ? `Showing ${displayedSongs.length} of ${filteredSongs.length} songs`
              : `${filteredSongs.length} song${filteredSongs.length !== 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      <SongList
        songs={displayedSongs}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        onSync={handleSync}
        loading={loading}
        onView={handleViewClick}
      />

      {/* Lazy-load sentinel / status */}
      <div
        ref={loadMoreRef}
        className="mt-4 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400"
      >
        {displayedSongs.length < filteredSongs.length
          ? 'Scroll to load more songs...'
          : filteredSongs.length > 0
          ? 'All songs loaded'
          : null}
      </div>

      <Modal
        isOpen={isFormModalOpen}
        onClose={handleFormCancel}
        title={editingSong ? 'Edit Song' : 'Create New Song'}
      >
        <SongForm
          song={editingSong}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          onUnsavedChangesRef={checkUnsavedChangesRef}
        />
      </Modal>

      {/* View-only metadata modal */}
      {viewingSong && (
        <Modal
          isOpen={!!viewingSong}
          onClose={() => setViewingSong(null)}
          title="Song Details"
        >
          <SongDetails song={viewingSong} />
        </Modal>
      )}

      {/* Mobile Bottom Action Bar */}
      <MobileBottomActionBar
        actions={mobileActions}
        filterCount={activeFilterCount}
      />

    </div>
  );
};

export default SongManager;
