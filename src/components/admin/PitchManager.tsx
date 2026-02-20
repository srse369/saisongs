import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { usePitches } from '../../contexts/PitchContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import { PitchForm } from './PitchForm';
import { PitchList } from './PitchList';
import { AdvancedPitchSearch, type PitchSearchFilters } from '../common/AdvancedPitchSearch';
import { RefreshIcon, type MobileAction } from '../common';
import { BaseManager } from './BaseManager';
import { useBaseManager } from '../../hooks/useBaseManager';
import type { SongSingerPitch, CreatePitchInput, Song } from '../../types';
import { Modal } from '../common/Modal';
import { SongDetails } from './SongDetails';
import { globalEventBus } from '../../utils/globalEventBus';

interface PitchManagerProps {
  isActive?: boolean;
}

export const PitchManager: React.FC<PitchManagerProps> = ({ isActive = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isEditor, userId, isAuthenticated } = useAuth();
  const toast = useToast();

  const {
    pitches,
    loading: pitchLoading,
    error: pitchError,
    hasFetched: pitchesHasFetched,
    fetchAllPitches,
    createPitch,
    updatePitch,
    deletePitch,
    clearError: clearPitchError
  } = usePitches();

  const {
    songs,
    loading: songsLoading,
    error: songsError,
    fetchSongs,
    clearError: clearSongsError
  } = useSongs();

  const {
    singers,
    loading: singersLoading,
    error: singersError,
    fetchSingers,
    clearError: clearSingersError
  } = useSingers();

  const [showForm, setShowForm] = useState(false);
  const [editingPitch, setEditingPitch] = useState<SongSingerPitch | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'songName' | 'singerName'>('songName');
  const [advancedFilters, setAdvancedFilters] = useState<PitchSearchFilters>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const songFilterId = searchParams.get('songId') || '';
  const singerFilterId = searchParams.get('singerId') || '';

  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [showMyPitches, setShowMyPitches] = useState(true);
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  // Use base manager for shared UI behaviour (mobile, scroll, header refs, etc.)
  const baseManager = useBaseManager({
    resourceName: 'pitches',
    isActive,
    onDataRefresh: () => fetchAllPitches(true),
    onEscapeKey: () => {
      // If a modal is open, let it handle Escape
      if (showForm || viewingSong) return;
      if (baseManager.searchInputRef.current) {
        baseManager.searchInputRef.current.focus();
      }
    },
  });

  // We rely on baseManager for list container ref/style/scroll handling
  // Use baseManager.scrollToTop where needed

  // Check if the logged-in user has a singer profile (can manage own pitches)
  // userId is now a hex string matching singer.id format
  const userSinger = useMemo(() => {
    if (!userId || !isAuthenticated) return null;
    return singers.find(s => s.id === userId);
  }, [userId, singers, isAuthenticated]);

  // User can create pitches if they're an editor OR if they have a singer profile
  const canCreatePitch = isEditor || !!userSinger;

  // Sync advanced filters with URL parameters (when navigating from Songs/Singers tab)
  useEffect(() => {
    const newFilters: PitchSearchFilters = {};

    if (songFilterId && songs.length > 0) {
      const song = songs.find(s => s.id === songFilterId);
      if (song) {
        newFilters.songName = song.name;
      }
    }

    if (singerFilterId && singers.length > 0) {
      const singer = singers.find(s => s.id === singerFilterId);
      if (singer) {
        newFilters.singerName = singer.name;
      }
    }

    // Only update if we have filters to set and they're different from current
    if (Object.keys(newFilters).length > 0) {
      setAdvancedFilters(prev => {
        // Only update if the values are actually different
        const hasChanges = Object.entries(newFilters).some(([key, value]) =>
          prev[key as keyof PitchSearchFilters] !== value
        );
        return hasChanges ? { ...prev, ...newFilters } : prev;
      });
    }
  }, [songFilterId, singerFilterId, songs, singers]);

  // Apply filters passed from Ask the app (clear existing filters and search, then set rule filters)
  useEffect(() => {
    const llmFilters = location.state?.llmFilters as Record<string, string> | undefined;
    const llmShowMyPitches = location.state?.llmShowMyPitches as boolean | undefined;
    if (llmFilters && typeof llmFilters === 'object' && Object.keys(llmFilters).length > 0) {
      setSearchTerm('');
      setAdvancedFilters({ ...llmFilters });
      if (llmShowMyPitches === true) setShowMyPitches(true);
      if (llmShowMyPitches === false) setShowMyPitches(false);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  // When navigating from a singer's or song's pitches button, switch to "All Pitches" mode
  // so the filter can work correctly (otherwise "My Pitches" filter would conflict)
  useEffect(() => {
    if (singerFilterId || songFilterId) {
      setShowMyPitches(false);
    }
  }, [singerFilterId, songFilterId]);

  // Only fetch data when tab is active and not already loaded (avoids refetch when switching tabs)
  useEffect(() => {
    if (!isActive) return;
    
    // Use hasFetched to avoid refetching when switching back to tab - data persists in context
    const promises: Promise<void>[] = [];
    
    if (songs.length === 0) {
      promises.push(fetchSongs());
    }
    
    if (singers.length === 0) {
      promises.push(fetchSingers());
    }
    
    // Only fetch pitches if we haven't already - prevents reload when switching Live <-> Pitches
    if (!pitchesHasFetched) {
      promises.push(fetchAllPitches());
    }
    
    if (promises.length > 0) {
      Promise.all(promises).catch(error => {
        console.error('Error fetching data in parallel:', error);
      });
    }
  }, [fetchSongs, fetchSingers, fetchAllPitches, isActive, songs.length, singers.length, pitchesHasFetched]);

  // Listen for data refresh requests from global event bus
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    unsubscribe = globalEventBus.on('dataRefreshNeeded', (detail) => {
      if (detail.resource === 'pitches' || detail.resource === 'all') {
        // Refresh pitches data from backend to get latest state
        fetchAllPitches(true); // Force refresh
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchSongs, fetchSingers, fetchAllPitches]);

  // Focus search bar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && baseManager.searchInputRef.current) {
        baseManager.searchInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [baseManager.searchInputRef]);

  const handleCreateClick = () => {
    setEditingPitch(null);
    setShowForm(true);
    clearPitchError();
    // Refresh singers list to include any newly created singers
    fetchSingers(true);
  };

  const handleEditClick = (pitch: SongSingerPitch) => {
    setEditingPitch(pitch);
    setShowForm(true);
    clearPitchError();
  };

  const handleCancel = useCallback(() => {
    // Check for unsaved changes before closing
    if (checkUnsavedChangesRef.current && checkUnsavedChangesRef.current()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    setShowForm(false);
    setEditingPitch(null);
    clearPitchError();
  }, [clearPitchError]);

  const handleSubmit = async (input: CreatePitchInput) => {
    let result;

    if (editingPitch) {
      // Update existing pitch
      result = await updatePitch(editingPitch.id, { pitch: input.pitch });
    } else {
      // Create new pitch
      result = await createPitch(input);
    }

    // Close form on success or permission error
    // Permission errors are already shown via toast, so we close the form
    // to avoid the "unsaved changes" dialog issue
    if (result) {
      setShowForm(false);
      setEditingPitch(null);
    } else if (editingPitch && pitchError?.message?.includes('Access denied')) {
      // Close form on permission error to avoid unsaved changes dialog
      setShowForm(false);
      setEditingPitch(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deletePitch(id);
  };

  const error = pitchError || songsError || singersError;
  const loading = pitchLoading || songsLoading || singersLoading;

  // Show errors as toast messages
  useEffect(() => {
    if (pitchError) {
      toast.error(pitchError.message);
      clearPitchError();
    }
    if (songsError) {
      toast.error(songsError.message);
      clearSongsError();
    }
    if (singersError) {
      toast.error(singersError.message);
      clearSingersError();
    }
  }, [pitchError, songsError, singersError, toast, clearPitchError, clearSongsError, clearSingersError]);

  // Debounce search term for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Clear search when Escape key is pressed while on this tab (only if no modal is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't clear search if a modal is open - let the modal handle Escape
      if (showForm || viewingSong) return;

      if (e.key === 'Escape') {
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setAdvancedFilters({});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm, viewingSong]);

  const handleClearFilters = () => {
    // Clear query params and local search input
    const next = new URLSearchParams(searchParams);
    next.delete('songId');
    next.delete('singerId');
    setSearchParams(next);
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setAdvancedFilters({});
  };

  // Create lookup maps for O(1) access instead of O(n) .find() calls
  const songMap = useMemo(() => new Map(songs.map(s => [s.id, s])), [songs]);
  const singerMap = useMemo(() => new Map(singers.map(s => [s.id, s])), [singers]);

  // Memoize filtered pitches with debounced search for performance
  const filteredPitches = useMemo(() => {
    // Helper function for case-sensitive comparison
    const matches = (value: string | undefined, filter: string, caseSensitive: boolean) => {
      if (!value) return false;
      if (caseSensitive) {
        return value.includes(filter);
      }
      return value.toLowerCase().includes(filter.toLowerCase());
    };

    // Create a copy of the array to avoid mutating the original
    let filtered = [...pitches].filter((p) => {
      // If "My Pitches" is enabled, only show pitches for the logged-in user's singer
      if (showMyPitches && userSinger && p.singerId !== userSinger.id) {
        return false;
      }

      // If navigated here with a specific songId, only show pitches for that song
      if (songFilterId && p.songId !== songFilterId) {
        return false;
      }

      // If navigated here with a specific singerId, only show pitches for that singer
      if (singerFilterId && p.singerId !== singerFilterId) {
        return false;
      }

      const song = songMap.get(p.songId);
      const singer = singerMap.get(p.singerId);

      // Apply advanced filters (field-specific) with case sensitivity
      if (advancedFilters.songName && !matches(song?.name, advancedFilters.songName, advancedFilters.songNameCaseSensitive || false)) {
        return false;
      }
      if (advancedFilters.singerName && !matches(singer?.name, advancedFilters.singerName, advancedFilters.singerNameCaseSensitive || false)) {
        return false;
      }
      if (advancedFilters.pitch && !matches(p.pitch, advancedFilters.pitch, advancedFilters.pitchCaseSensitive || false)) {
        return false;
      }
      if (advancedFilters.deity && !matches(song?.deity, advancedFilters.deity, advancedFilters.deityCaseSensitive || false)) {
        return false;
      }
      if (advancedFilters.language && !matches(song?.language, advancedFilters.language, advancedFilters.languageCaseSensitive || false)) {
        return false;
      }
      if (advancedFilters.raga && !matches(song?.raga, advancedFilters.raga, advancedFilters.ragaCaseSensitive || false)) {
        return false;
      }
      if (advancedFilters.tempo && !matches(song?.tempo, advancedFilters.tempo, advancedFilters.tempoCaseSensitive || false)) {
        return false;
      }

      // Apply basic search (searches across all fields)
      if (!debouncedSearchTerm.trim()) return true;
      const q = debouncedSearchTerm.toLowerCase();

      return (
        p.pitch.toLowerCase().includes(q) ||
        song?.name.toLowerCase().includes(q) ||
        singer?.name.toLowerCase().includes(q)
      );
    });

    // Apply sorting based on sortBy selection
    filtered.sort((a, b) => {
      const songA = songMap.get(a.songId);
      const songB = songMap.get(b.songId);
      const singerA = singerMap.get(a.singerId);
      const singerB = singerMap.get(b.singerId);

      const aSongName = songA?.name || '';
      const bSongName = songB?.name || '';
      const aSingerName = singerA?.name || '';
      const bSingerName = singerB?.name || '';

      // Handle search term prioritization (prefix matches come first)
      if (debouncedSearchTerm.trim()) {
        const q = debouncedSearchTerm.toLowerCase();
        const aSongStartsWith = aSongName.toLowerCase().startsWith(q);
        const bSongStartsWith = bSongName.toLowerCase().startsWith(q);
        const aSingerStartsWith = aSingerName.toLowerCase().startsWith(q);
        const bSingerStartsWith = bSingerName.toLowerCase().startsWith(q);

        // Prefix matches come first
        const aStartsWith = aSongStartsWith || aSingerStartsWith;
        const bStartsWith = bSongStartsWith || bSingerStartsWith;

        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
      }

      // Apply sorting based on sortBy selection
      if (sortBy === 'singerName') {
        // Sort by singer name first, then song name
        const singerCompare = compareStringsIgnoringSpecialChars(aSingerName, bSingerName);
        if (singerCompare !== 0) return singerCompare;
        return compareStringsIgnoringSpecialChars(aSongName, bSongName);
      } else {
        // Sort by song name first, then singer name (default)
        const songCompare = compareStringsIgnoringSpecialChars(aSongName, bSongName);
        if (songCompare !== 0) return songCompare;
        return compareStringsIgnoringSpecialChars(aSingerName, bSingerName);
      }
    });

    return filtered;
  }, [pitches, debouncedSearchTerm, advancedFilters, songFilterId, singerFilterId, songMap, singerMap, sortBy, showMyPitches, userSinger]);

  // Create a stable key from filter values to detect changes reliably
  const filterKey = useMemo(() => {
    return Object.entries(advancedFilters)
      .filter(([_, v]) => v && typeof v === 'string')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
  }, [advancedFilters]);

  // Reset visible pitches when search or underlying list changes
  useEffect(() => {
    setVisibleCount(50);
  }, [debouncedSearchTerm, filterKey, pitches.length, songFilterId, singerFilterId, showMyPitches]);

  // Recalculate mobile position when filters change (header height changes)
  useEffect(() => {
    if (baseManager.isMobile) {
      baseManager.calculateMobilePosition();
    }
  }, [filterKey, baseManager.isMobile, baseManager.calculateMobilePosition]);

  // Only render a subset of pitches for performance
  const displayedPitches = useMemo(
    () => filteredPitches.slice(0, visibleCount),
    [filteredPitches, visibleCount]
  );

  // Lazy-load more pitches as the user scrolls near the bottom
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    // On mobile, use the container as root; on desktop, use viewport (null)
    const root = baseManager.isMobile && baseManager.listContainerRef.current ? baseManager.listContainerRef.current : null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + 100, filteredPitches.length)
          );
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
  }, [filteredPitches.length, baseManager.isMobile, baseManager.listContainerRef]);

  const activeFilterCount = Object.values(advancedFilters).filter(v => v && typeof v === 'string').length + (songFilterId ? 1 : 0) + (singerFilterId ? 1 : 0);

  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Sort',
      icon: 'fas fa-sort',
      onClick: () => {
        setSortBy(prev => prev === 'songName' ? 'singerName' : 'songName');
      },
      variant: 'secondary',
    },
    {
      label: 'Refresh',
      icon: 'fas fa-sync-alt',
      onClick: () => {
        fetchSongs(true);
        fetchSingers(true);
        fetchAllPitches(true);
      },
      variant: 'secondary',
      disabled: pitchLoading || songsLoading || singersLoading,
    },
    ...(canCreatePitch && !showForm ? [{
      label: 'Create',
      icon: 'fas fa-plus',
      onClick: handleCreateClick,
      variant: 'primary' as const,
      disabled: songs.length === 0 || singers.length === 0,
    }] : []),
  ];

  const headerActions = (
    <>
      <div className="relative flex-1 min-w-0">
        <input
          ref={baseManager.searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search pitches by song or singer..."
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
          onChange={(e) => setSortBy(e.target.value as 'songName' | 'singerName')}
          title="Sort pitches by song name or singer name"
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <option value="songName">Sort: Song</option>
          <option value="singerName">Sort: Singer</option>
        </select>
        <button
          type="button"
          onClick={() => {
            fetchSongs(true);
            fetchSingers(true);
            fetchAllPitches(true);
          }}
          disabled={loading}
          title="Reload pitches, songs, and singers to see the latest changes"
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
        {!showForm && canCreatePitch && (
          <button
            onClick={handleCreateClick}
            disabled={loading || songs.length === 0 || singers.length === 0}
            title={songs.length === 0 || singers.length === 0 ? "Load songs and singers first" : userSinger && !isEditor ? "Assign pitches to yourself" : "Assign a pitch/key to a singer for a specific song"}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-plus text-lg"></i>
            Create New Pitch
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
      title="Pitch Management"
      subtitle="Associate singers with songs and their pitch information"
      helpHref="/help#pitches"
      headerActions={headerActions}
      headerBelow={(
        <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 pt-3">
          {filteredPitches.length > 0 && (
            <div className={`text-sm text-gray-600 dark:text-gray-400 ${baseManager.isMobile ? 'mt-2' : 'mb-2'}`}>
              {displayedPitches.length < filteredPitches.length
                ? `Showing ${displayedPitches.length} of ${filteredPitches.length} pitches`
                : `${filteredPitches.length} pitch${filteredPitches.length !== 1 ? 'es' : ''}`}
            </div>
          )}
          <AdvancedPitchSearch
            filters={advancedFilters}
            songs={songs}
            singers={singers}
            onFiltersChange={(newFilters) => {
              const next = new URLSearchParams(searchParams);
              let urlChanged = false;

              const currentSongName = songFilterId
                ? songs.find(s => s.id === songFilterId)?.name
                : undefined;
              const currentSingerName = singerFilterId
                ? singers.find(s => s.id === singerFilterId)?.name
                : undefined;

              if (newFilters.songName !== currentSongName && songFilterId) {
                next.delete('songId');
                urlChanged = true;
              }
              if (newFilters.singerName !== currentSingerName && singerFilterId) {
                next.delete('singerId');
                urlChanged = true;
              }
              if (urlChanged) setSearchParams(next);

              // When a singer name is entered in advanced search, switch to "All Pitches"
              // so the filter applies across all pitches (not just "My Pitches")
              if (newFilters.singerName?.trim()) {
                setShowMyPitches(false);
              }

              setAdvancedFilters(newFilters);
            }}
            onClear={handleClearFilters}
            rightContent={userSinger ? (
              <button
                onClick={() => setShowMyPitches(!showMyPitches)}
                title={showMyPitches ? "Show all pitches" : "Show only my assigned pitches"}
                className="px-3 py-1.5 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors flex items-center gap-2 whitespace-nowrap text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <i className={`fas ${showMyPitches ? 'fa-users' : 'fa-user'} text-sm text-blue-600 dark:text-blue-400`}></i>
                {showMyPitches ? 'All Pitches' : 'My Pitches'}
              </button>
            ) : undefined}
          />
        </div>
      )}
      mobileActions={mobileActions}
      onScrollToTop={baseManager.scrollToTop}
      loading={loading}
    >
      <PitchList
        pitches={displayedPitches}
        songs={songs}
        singers={singers}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        onViewSong={(songId) => {
          const song = songs.find((s) => s.id === songId) || null;
          setViewingSong(song);
        }}
        loading={loading}
        userSingerId={userSinger?.id}
      />

      {/* Lazy-load sentinel */}
      {displayedPitches.length < filteredPitches.length && (
        <div
          ref={loadMoreRef}
          className="mt-4 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400"
        >
          Scroll to load more...
        </div>
      )}

      {/* Pitch Form Modal */}
      {showForm && (
        <Modal
          isOpen={showForm}
          onClose={handleCancel}
          title={editingPitch ? 'Edit Pitch Association' : 'Create New Pitch Association'}
        >
          <PitchForm
            pitch={editingPitch}
            songs={songs}
            singers={singers}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onUnsavedChangesRef={checkUnsavedChangesRef}
            userSingerId={userSinger?.id}
            defaultSongId={songFilterId || undefined}
            defaultSingerId={singerFilterId || undefined}
          />
        </Modal>
      )}


      {/* Song Details Modal */}
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

export default PitchManager;
