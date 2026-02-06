import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
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
import { RefreshIcon, type MobileAction } from '../common';
import songService from '../../services/SongService';
import type { Song, CreateSongInput } from '../../types';
import { BaseManager } from './BaseManager';
import { useBaseManager } from '../../hooks/useBaseManager';
import { createSongFuzzySearch } from '../../utils/smartSearch';
import { compareStringsIgnoringSpecialChars } from '../../utils';

interface SongManagerProps {
  isActive?: boolean;
}

export const SongManagerRefactored: React.FC<SongManagerProps> = ({ isActive = true }) => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const songIdFromUrl = searchParams.get('songId') || '';
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
  const songIdRef = useRef<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Create fuzzy search instance for fallback
  const fuzzySearch = useMemo(() => createSongFuzzySearch(songs), [songs]);

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

  // Create a stable key from filter values to detect changes
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

  // Show error as toast message
  useEffect(() => {
    if (error) {
      toast.error(error.message);
      clearError(); // Clear error after showing toast
    }
  }, [error, toast, clearError]);

  // Extract available values for WebLLM
  const availableValues = useMemo(() => {
    return WebLLMService.extractAvailableValues(songs, []);
  }, [songs]);

  useEffect(() => {
    // Only fetch songs when tab is active (only if not already loaded)
    if (isActive && songs.length === 0) {
      fetchSongs(); // Use cached data, only refresh if stale
    }
  }, [fetchSongs, isActive, songs.length]);

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


  // Handle scrolling to song when songId is in URL (only when active)
  useEffect(() => {
    if (!isActive || !songIdFromUrl || filteredSongs.length === 0) {
      songIdRef.current = null;
      return;
    }
    
    // Find the index of the target song in filteredSongs
    const targetIndex = filteredSongs.findIndex(song => song.id === songIdFromUrl);
    
    if (targetIndex === -1) {
      // Song not found in filtered results, clear the parameter
      const next = new URLSearchParams(searchParams);
      next.delete('songId');
      setSearchParams(next, { replace: true });
      songIdRef.current = null;
      return;
    }
    
    // If the song is beyond the visible count, increase visibleCount to include it
    if (targetIndex >= visibleCount) {
      setVisibleCount(Math.min(targetIndex + 10, filteredSongs.length));
      songIdRef.current = songIdFromUrl;
      return;
    }
    
    // Song should be visible, mark it for scrolling
    songIdRef.current = songIdFromUrl;
  }, [songIdFromUrl, filteredSongs, visibleCount, searchParams, setSearchParams, isActive]);

  // Scroll to song when it becomes visible in displayedSongs (only when active)
  useEffect(() => {
    if (!isActive) return;
    const targetSongId = songIdRef.current;
    if (!targetSongId) return;
    
    const isSongVisible = displayedSongs.some(song => song.id === targetSongId);
    
    if (!isSongVisible) return; // Wait until song is in displayedSongs
    
    // Use requestAnimationFrame and setTimeout to ensure DOM is fully updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Try multiple times to find the element
        let attempts = 0;
        const maxAttempts = 40; // Try for up to 2 seconds
        
        const tryScroll = () => {
          const element = document.getElementById(`song-${targetSongId}`);
          if (element) {
            // Calculate scroll position to ensure bottom border is visible
            // Position element slightly above center so there's room below for the border
            const isMobile = baseManager.isMobile;
            const container = isMobile ? baseManager.listContainerRef.current : null;
            
            if (isMobile && container) {
              // Mobile: scroll within container
              const elementRect = element.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
              const containerHeight = container.clientHeight;
              const elementHeight = elementRect.height;
              const ringWidth = 8;
              const targetScrollTop = relativeTop - (containerHeight / 2) + (elementHeight / 2) - ringWidth;
              container.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
              });
            } else {
              // Desktop: scroll window
              const elementRect = element.getBoundingClientRect();
              const absoluteElementTop = elementRect.top + window.pageYOffset;
              const viewportHeight = window.innerHeight;
              const elementHeight = elementRect.height;
              const ringWidth = 8; // ring-4 = 16px (4 * 4px)
              // Position so element is slightly above center, leaving space below for border
              const targetScrollTop = absoluteElementTop - (viewportHeight / 2) + (elementHeight / 2) - ringWidth;
              window.scrollTo({
                top: Math.max(0, targetScrollTop), // Don't scroll above top
                behavior: 'smooth'
              });
            }
            // Highlight the song for a few seconds
            element.classList.add('ring-4', 'ring-blue-400', 'dark:ring-blue-500');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-blue-400', 'dark:ring-blue-500');
            }, 4000); // Highlight for 4 seconds
            // Clear the URL parameter and reset ref
            const next = new URLSearchParams(searchParams);
            next.delete('songId');
            setSearchParams(next, { replace: true });
            songIdRef.current = null;
            return true;
          }
          return false;
        };

        // Try immediately
        if (!tryScroll()) {
          // If not found, retry with interval
          const interval = setInterval(() => {
            attempts++;
            if (tryScroll() || attempts >= maxAttempts) {
              clearInterval(interval);
              if (attempts >= maxAttempts) {
                // Element not found after max attempts
                console.warn(`Could not find song element with id: song-${targetSongId} after ${maxAttempts} attempts`);
                const next = new URLSearchParams(searchParams);
                next.delete('songId');
                setSearchParams(next, { replace: true });
                songIdRef.current = null;
              }
            }
          }, 50);
        }
      }, 150);
    });
  }, [displayedSongs, searchParams, setSearchParams, isActive, baseManager.isMobile, baseManager.listContainerRef]);

  // Lazy-load more songs as the user scrolls near the bottom (only when active)
  useEffect(() => {
    if (!isActive) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    // On mobile, use the container as root; on desktop, use viewport (null)
    // Use a small delay to ensure container is ready on mobile
    const setupObserver = () => {
      const root = baseManager.isMobile && baseManager.listContainerRef.current ? baseManager.listContainerRef.current : null;

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
          root: root,
          rootMargin: '100px', // Start loading when sentinel is 100px away from viewport/container
          threshold: 0.1, // Trigger when 10% visible (more lenient than 1.0)
        }
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
    };

    // On mobile, wait a bit for container to be ready
    if (baseManager.isMobile) {
      const timeoutId = setTimeout(setupObserver, 100);
      return () => clearTimeout(timeoutId);
    } else {
      return setupObserver();
    }
  }, [filteredSongs.length, baseManager.isMobile, displayedSongs.length, isActive, baseManager.listContainerRef]);

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
      <div className="flex-1">
        <WebLLMSearchInput
          ref={baseManager.searchInputRef}
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
      headerBelow={(
        <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 pt-3">
          {filteredSongs.length > 0 && (
            <div className={`text-sm text-gray-600 dark:text-gray-400 ${baseManager.isMobile ? 'mt-2' : 'mb-2'}`}>
              {displayedSongs.length < filteredSongs.length
                ? `Showing ${displayedSongs.length} of ${filteredSongs.length} songs`
                : `${filteredSongs.length} song${filteredSongs.length !== 1 ? 's' : ''}`}
            </div>
          )}
          <AdvancedSongSearch
            filters={advancedFilters}
            onFiltersChange={(newFilters) => {
              setAdvancedFilters(newFilters);
            }}
            onClear={() => {
              setAdvancedFilters({});
            }}
            onApply={() => {
              // No action needed - filters are already applied via onFiltersChange
            }}
            songs={songs}
          />
        </div>
      )}
      mobileActions={mobileActions}
      onScrollToTop={baseManager.scrollToTop}
      loading={loading}
    >
      

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

export default SongManagerRefactored;
