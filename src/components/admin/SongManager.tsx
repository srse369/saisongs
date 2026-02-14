import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useSongs } from '../../contexts/SongContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { SongForm } from './SongForm';
import { SongList } from './SongList';
import { SongDetails } from './SongDetails';
import { Modal } from '../common/Modal';
import { AdvancedSongSearch, type SongSearchFilters } from '../common/AdvancedSongSearch';
import { RefreshIcon, type MobileAction } from '../common';
import { createSongFuzzySearch, parseNaturalQuery } from '../../utils/smartSearch';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import songService from '../../services/SongService';
import type { Song, CreateSongInput } from '../../types';
import { BaseManager } from './BaseManager';
import { useBaseManager } from '../../hooks/useBaseManager';

interface SongManagerProps {
  isActive?: boolean;
}

export const SongManager: React.FC<SongManagerProps> = ({ isActive = true }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
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

  // Use base manager hook for common functionality
  const baseManager = useBaseManager({
    resourceName: 'songs',
    isActive,
    onDataRefresh: () => fetchSongs(true),
    onEscapeKey: () => {
      // Clear search when Escape key is pressed (only if no modal is open)
      if (!isFormModalOpen && !viewingSong) {
        setSearchTerm('');
        setAdvancedFilters({});
      }
      // Focus search bar
      if (baseManager.searchInputRef.current) {
        baseManager.searchInputRef.current.focus();
      }
    },
  });

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pitchCount'>('name');
  const [advancedFilters, setAdvancedFilters] = useState<SongSearchFilters>({});
  const [visibleCount, setVisibleCount] = useState(50);
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Show error as toast message
  useEffect(() => {
    if (error) {
      toast.error(error.message);
      clearError(); // Clear error after showing toast
    }
  }, [error, toast, clearError]);

  const scrollToTop = () => {
    if (baseManager.listContainerRef.current) {
      baseManager.listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Create fuzzy search instance for fallback
  const fuzzySearch = useMemo(() => createSongFuzzySearch(songs), [songs]);

  useEffect(() => {
    // Only fetch songs when tab is active (only if not already loaded)
    if (isActive && songs.length === 0) {
      fetchSongs(); // Use cached data, only refresh if stale
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, songs.length]); // fetchSongs is stable from context

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

  // Create a stable key from filter values to detect changes reliably
  const filterKey = useMemo(() => {
    return Object.entries(advancedFilters)
      .filter(([_, v]) => v && typeof v === 'string')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
  }, [advancedFilters]);

  // Reset visible songs when search or underlying list changes
  useEffect(() => {
    setVisibleCount(50);
  }, [searchTerm, filterKey, songs.length]);

  // Recalculate mobile position when filters change (header height changes)
  useEffect(() => {
    if (baseManager.isMobile) {
      baseManager.calculateMobilePosition();
    }
  }, [filterKey, baseManager.isMobile, baseManager.calculateMobilePosition]);

  const displayedSongs = useMemo(
    () => filteredSongs.slice(0, visibleCount),
    [filteredSongs, visibleCount]
  );

  // Simple lazy-load: load more when user scrolls near bottom
  useEffect(() => {
    if (!isActive) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const root = baseManager.isMobile && baseManager.listContainerRef.current 
      ? baseManager.listContainerRef.current 
      : null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 50, filteredSongs.length));
        }
      },
      {
        root: root,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredSongs.length, baseManager.isMobile, isActive]);

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

  // Header actions content
  const headerActions = (
    <>
      <div className="relative flex-1 min-w-0">
        <input
          ref={baseManager.searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search songs by name, deity, language..."
          autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
          className="w-full pl-9 pr-9 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <i className="fas fa-search text-base text-gray-400 absolute left-3 top-2.5" aria-hidden />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Clear search"
          >
            <i className="fas fa-times text-sm" />
          </button>
        )}
      </div>
      {/* Desktop action buttons - hidden on mobile */}
      <div className="hidden md:flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'pitchCount')}
          title="Sort songs by name or pitch count"
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <option value="name">Sort: Name</option>
          <option value="pitchCount">Sort: Pitch Count</option>
        </select>
        <button
          type="button"
          onClick={() => fetchSongs(true)}
          disabled={loading}
          title="Reload songs from the database to see the latest updates"
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
        {isEditor && (
          <button
            onClick={handleCreateClick}
            title="Add a new song to the library with name, lyrics, translation, and metadata"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-plus text-lg"></i>
            Create New Song
          </button>
        )}
      </div>
    </>
  );

  return (
    <BaseManager
      isActive={isActive}
      isMobile={baseManager.isMobile}
      showScrollToTop={baseManager.showScrollToTop}
      listContainerStyle={baseManager.listContainerStyle}
      listContainerRef={baseManager.listContainerRef}
      headerRef={baseManager.headerRef}
      title="Song Management"
      subtitle="Create and manage your song library"
      helpHref="/help#songs"
      headerActions={headerActions}
      mobileActions={mobileActions}
      onScrollToTop={baseManager.scrollToTop}
      loading={loading}
    >
      {/* Advanced Search - Shown directly on both mobile and desktop */}
      <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8">
        <AdvancedSongSearch
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
          onClear={() => setAdvancedFilters({})}
          songs={songs}
        />

        {/* Song count status - Fixed in header on mobile */}
        {filteredSongs.length > 0 && (
          <div className={`text-sm text-gray-600 dark:text-gray-400 ${baseManager.isMobile ? 'ml-20' : 'mb-2'}`}>
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

      {/* Modals */}
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
    </BaseManager>
  );
};

export default SongManager;
