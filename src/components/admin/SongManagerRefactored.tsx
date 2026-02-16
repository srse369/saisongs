import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useSongs } from '../../contexts/SongContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { SongForm } from './SongForm';
import { SongList } from './SongList';
import { SongDetails } from './SongDetails';
import { Modal } from '../common/Modal';
import { AdvancedSongSearch, type SongSearchFilters } from '../common/AdvancedSongSearch';
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
  const navigate = useNavigate();
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
      // Clear only search term when Escape is pressed (never clear filters so closing preview keeps filters)
      if (!isFormModalOpen && !viewingSong) {
        setSearchTerm('');
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pitchCount'>('name');
  const [advancedFilters, setAdvancedFilters] = useState<SongSearchFilters>({});
  const [visibleCount, setVisibleCount] = useState(50);
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const songIdRef = useRef<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const previewOpenedByNavigationRef = useRef(false);
  const pendingScrollRestoreRef = useRef<{ songId: string; requiredCount: number } | null>(null);

  // Apply filters passed from Ask the app (clear existing filters and search, then set rule filters)
  useEffect(() => {
    const llmFilters = location.state?.llmFilters as Record<string, string> | undefined;
    if (llmFilters && typeof llmFilters === 'object' && Object.keys(llmFilters).length > 0) {
      setSearchTerm('');
      setAdvancedFilters({ ...llmFilters });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  // Open song preview when LLM asks (e.g. "show preview of Om Ram")
  useEffect(() => {
    const openSongPreview = location.state?.openSongPreview as string | undefined;
    if (openSongPreview && songs.length > 0) {
      const song = songs.find((s) => s.id === openSongPreview);
      if (song) {
        previewOpenedByNavigationRef.current = true;
        setViewingSong(song);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate, songs]);

  // When returning from presentation, restore list position (tab remounts so state was lost)
  useEffect(() => {
    if (!isActive) return;
    try {
      const id = sessionStorage.getItem('songsScrollToId');
      if (!id) return;
      sessionStorage.removeItem('songsScrollToId');
      const visibleCountStr = sessionStorage.getItem('songsScrollToVisibleCount');
      sessionStorage.removeItem('songsScrollToScrollTop');
      sessionStorage.removeItem('songsScrollToVisibleCount');
      const savedVisibleCount = visibleCountStr != null ? Number(visibleCountStr) : 0;
      if (Number.isFinite(savedVisibleCount) && savedVisibleCount > 0) {
        setVisibleCount(Math.min(savedVisibleCount, filteredSongs.length || savedVisibleCount));
        pendingScrollRestoreRef.current = { songId: id, requiredCount: savedVisibleCount };
      } else {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('songId', id);
          return next;
        }, { replace: true });
      }
    } catch {
      // ignore
    }
  }, [isActive, setSearchParams]);

  // Debounce search term so filtering runs after user pauses typing (avoids lag on every keystroke)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

    // Apply smart search (use debounced term)
    const query = debouncedSearchTerm.trim();

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

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const lowerQuery = query.toLowerCase();

    // Priority 1: Match leftmost part of song name (prefix match) - fast, best for typing
    const prefixMatches = results.filter(s =>
      (s.name?.toLowerCase() ?? '').startsWith(lowerQuery)
    );
    if (prefixMatches.length > 0) {
      results = prefixMatches;
    } else {
      // Priority 2: Other search styles (substring in name/fields, then fuzzy)
      if (words.length > 1) {
        // Multi-word: require every word to appear in at least one field
        results = results.filter(song => {
          const name = song.name?.toLowerCase() ?? '';
          const deity = song.deity?.toLowerCase() ?? '';
          const language = song.language?.toLowerCase() ?? '';
          const raga = song.raga?.toLowerCase() ?? '';
          const songTags = song.songTags?.toLowerCase() ?? '';
          const combined = `${name} ${deity} ${language} ${raga} ${songTags}`;
          return words.every(word => combined.includes(word));
        });
      } else {
        // Single word: substring in name or other fields
        const otherMatches = results.filter(s =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.deity?.toLowerCase().includes(lowerQuery) ||
          s.language?.toLowerCase().includes(lowerQuery) ||
          s.raga?.toLowerCase().includes(lowerQuery) ||
          s.songTags?.toLowerCase().includes(lowerQuery)
        );
        if (otherMatches.length > 0) {
          results = otherMatches;
        } else {
          // Priority 3: Fuzzy search (typo tolerance) - only when no prefix or substring matches
          const fuzzyResults = fuzzySearch.search(query);
          const fuzzyIds = new Set(fuzzyResults.map(r => r.item.id));
          results = results.filter(s => fuzzyIds.has(s.id));
        }
      }
    }

    // Apply sorting (keep comparator cheap for large result sets)
    if (sortBy === 'pitchCount') {
      results.sort((a, b) => {
        const pitchCompare = (b.pitchCount ?? 0) - (a.pitchCount ?? 0);
        if (pitchCompare !== 0) return pitchCompare;
        return compareStringsIgnoringSpecialChars(a.name, b.name);
      });
    } else {
      // Sort by name. For single-word query only, put "name starts with query" first; else alphabetical (faster).
      const singleWord = words.length === 1 ? words[0] : '';
      if (singleWord && !advancedFilters.name) {
        results.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStartsWith = aName.startsWith(singleWord);
          const bStartsWith = bName.startsWith(singleWord);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          return compareStringsIgnoringSpecialChars(a.name, b.name);
        });
      } else {
        results.sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
      }
    }

    return results;
  }, [songs, debouncedSearchTerm, advancedFilters, fuzzySearch, sortBy]);

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
  }, [debouncedSearchTerm, filterKey, songs.length]);

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

  // After returning from presentation: scroll to the previewed song row by ID (reliable regardless of layout timing)
  useEffect(() => {
    const pending = pendingScrollRestoreRef.current;
    if (pending === null || displayedSongs.length < pending.requiredCount) return;
    pendingScrollRestoreRef.current = null;
    const { songId } = pending;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const row = document.getElementById(`song-${songId}`);
        if (row) row.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
    });
  }, [displayedSongs.length]);

  // Show error as toast message
  useEffect(() => {
    if (error) {
      toast.error(error.message);
      clearError(); // Clear error after showing toast
    }
  }, [error, toast, clearError]);

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

  // Clear only search term on Escape (never clear advanced filters so closing preview doesn't alter filters)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFormModalOpen || viewingSong) return;
      if (e.key === 'Escape') {
        setSearchTerm('');
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
          onClose={() => {
            if (previewOpenedByNavigationRef.current) {
              previewOpenedByNavigationRef.current = false;
              navigate(-1);
              setViewingSong(null);
              return;
            }
            const songIdToShow = viewingSong.id;
            setViewingSong(null);
            // After modal closes, only scroll if the song row is not already in view (avoids unnecessary shift)
            setTimeout(() => {
              const row = document.getElementById(`song-${songIdToShow}`);
              if (!row) return;
              row.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            }, 100);
          }}
          title="Song Details"
        >
          <SongDetails song={viewingSong} />
        </Modal>
      )}
    </BaseManager>
  );
};

export default SongManagerRefactored;
