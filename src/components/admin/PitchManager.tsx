import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePitches } from '../../contexts/PitchContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useAuth } from '../../contexts/AuthContext';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import { PitchForm } from './PitchForm';
import { PitchList } from './PitchList';
import { WebLLMSearchInput } from '../common/WebLLMSearchInput';
import { AdvancedPitchSearch, type PitchSearchFilters } from '../common/AdvancedPitchSearch';
import { RefreshIcon, Tooltip } from '../common';
import type { SongSingerPitch, CreatePitchInput, Song } from '../../types';
import { Modal } from '../common/Modal';
import { SongDetails } from './SongDetails';

export const PitchManager: React.FC = () => {
  const { isEditor, userId, isAuthenticated } = useAuth();
  const { 
    pitches, 
    loading: pitchLoading, 
    error: pitchError,
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
  const [visibleCount, setVisibleCount] = useState(100);
  const [showMyPitchesModal, setShowMyPitchesModal] = useState(false);
  const [showGridViewModal, setShowGridViewModal] = useState(false);
  const [myPitchesSearchTerm, setMyPitchesSearchTerm] = useState('');
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch songs, singers, and all existing pitch associations when needed.
  // Use cached data when switching tabs for better performance
  // Parallelize fetches for better performance
  useEffect(() => {
    if (userId !== lastFetchedUserIdRef.current) {
      lastFetchedUserIdRef.current = userId;
      
      // Fetch all data in parallel for faster loading
      Promise.all([
        !songsLoading && fetchSongs(), // Use cached data
        !singersLoading && fetchSingers(), // Use cached data
        !pitchLoading && fetchAllPitches() // Use cached data
      ]).catch(error => {
        console.error('Error fetching data in parallel:', error);
      });
    }
  }, [
    fetchSongs,
    fetchSingers,
    fetchAllPitches,
    userId,
    songsLoading,
    singersLoading,
    pitchLoading,
  ]);

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
    setEditingPitch(null);
    setShowForm(true);
    clearPitchError();
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

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

  // Get pitches for the current user
  const myPitches = useMemo(() => {
    if (!userSinger) return [];
    return pitches
      .filter(p => p.singerId === userSinger.id)
      .sort((a, b) => (songMap.get(a.songId)?.name || '').localeCompare(songMap.get(b.songId)?.name || ''));
  }, [pitches, userSinger, songMap]);

  // Filter myPitches based on search term
  const filteredMyPitches = useMemo(() => {
    if (!myPitchesSearchTerm.trim()) return myPitches;
    
    const searchLower = myPitchesSearchTerm.toLowerCase();
    return myPitches.filter((pitch) => {
      const song = songMap.get(pitch.songId);
      const songName = song?.name || '';
      return (
        songName.toLowerCase().includes(searchLower) ||
        pitch.pitch.toLowerCase().includes(searchLower)
      );
    });
  }, [myPitches, myPitchesSearchTerm, songMap]);

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
  }, [pitches, debouncedSearchTerm, advancedFilters, songFilterId, singerFilterId, songMap, singerMap, sortBy]);

  // Reset visible pitches when search or underlying list changes
  useEffect(() => {
    setVisibleCount(100);
  }, [debouncedSearchTerm, advancedFilters, pitches.length, songFilterId, singerFilterId]);

  // Only render a subset of pitches for performance
  const displayedPitches = useMemo(
    () => filteredPitches.slice(0, visibleCount),
    [filteredPitches, visibleCount]
  );

  // Lazy-load more pitches as the user scrolls near the bottom
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

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
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredPitches.length]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-2">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pitch Management</h1>
              <Tooltip content="View help documentation for this tab">
                <a
                  href="/help#pitches"
                  className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                  title="Help"
                >
                  <i className="fas fa-question-circle text-xl"></i>
                </a>
              </Tooltip>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Associate singers with songs and their pitch information
            </p>
            {(songFilterId || singerFilterId) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {songFilterId && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    <span className="font-medium mr-1">Song:</span>
                    <span>
                      {songs.find((s) => s.id === songFilterId)?.name || 'Unknown song'}
                    </span>
                  </span>
                )}
                {singerFilterId && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                    <span className="font-medium mr-1">Singer:</span>
                    <span>
                      {singers.find((s) => s.id === singerFilterId)?.name || 'Unknown singer'}
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleClearFilters();
                  }}
                  className="inline-flex items-center px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <WebLLMSearchInput
              ref={searchInputRef}
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              onFiltersExtracted={(filters) => {
                // Type guard: since searchType is "pitch", filters should be PitchSearchFilters
                const pitchFilters = filters as PitchSearchFilters;
                
                // If AI extracts songName/singerName filters, clear URL params to avoid conflicts
                const next = new URLSearchParams(searchParams);
                let urlChanged = false;
                
                if (pitchFilters.songName && songFilterId) {
                  next.delete('songId');
                  urlChanged = true;
                }
                
                if (pitchFilters.singerName && singerFilterId) {
                  next.delete('singerId');
                  urlChanged = true;
                }
                
                if (urlChanged) {
                  setSearchParams(next);
                }
                
                // Merge AI-extracted filters with existing advanced filters
                setAdvancedFilters(prev => ({ ...prev, ...pitchFilters }));
              }}
              searchType="pitch"
              placeholder='Ask AI: "Show me C# pitches for devi songs" or "Which singers have sanskrit songs?"...'
            />
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
              <Tooltip content="Sort pitches by song name or singer name">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'songName' | 'singerName')}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="songName">Sort: Song</option>
                  <option value="singerName">Sort: Singer</option>
                </select>
              </Tooltip>
              <Tooltip content="Reload pitches, songs, and singers to see the latest changes">
                <button
                  type="button"
                  onClick={() => {
                    fetchSongs(true);
                    fetchSingers(true);
                    fetchAllPitches(true);
                  }}
                  disabled={loading}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <RefreshIcon className="w-4 h-4" />
                  Refresh
                </button>
              </Tooltip>
              {!showForm && canCreatePitch && (
                <Tooltip content={songs.length === 0 || singers.length === 0 ? "Load songs and singers first" : userSinger && !isEditor ? "Assign pitches to yourself" : "Assign a pitch/key to a singer for a specific song"}>
                  <button
                    onClick={handleCreateClick}
                    disabled={loading || songs.length === 0 || singers.length === 0}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <i className="fas fa-plus text-lg"></i>
                    Create New Pitch
                  </button>
                </Tooltip>
              )}
              {userSinger && (
                <Tooltip content="View a list of all my assigned pitches">
                  <button
                    type="button"
                    onClick={() => setShowMyPitchesModal(true)}
                    className="w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap bg-purple-600 text-white hover:bg-purple-700"
                  >
                    <i className="fas fa-user text-sm"></i>
                    My Pitches
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Advanced Search */}
          <AdvancedPitchSearch
            filters={advancedFilters}
            songs={songs}
            singers={singers}
            onFiltersChange={(newFilters) => {
              // If user manually changes songName/singerName in advanced search,
              // clear the corresponding URL param to avoid confusion
              const next = new URLSearchParams(searchParams);
              let urlChanged = false;
              
              // Get current song/singer names from URL filters
              const currentSongName = songFilterId 
                ? songs.find(s => s.id === songFilterId)?.name 
                : undefined;
              const currentSingerName = singerFilterId 
                ? singers.find(s => s.id === singerFilterId)?.name 
                : undefined;
              
              // If songName filter changed and doesn't match URL filter, clear URL param
              if (newFilters.songName !== currentSongName && songFilterId) {
                next.delete('songId');
                urlChanged = true;
              }
              
              // If singerName filter changed and doesn't match URL filter, clear URL param
              if (newFilters.singerName !== currentSingerName && singerFilterId) {
                next.delete('singerId');
                urlChanged = true;
              }
              
              if (urlChanged) {
                setSearchParams(next);
              }
              
              setAdvancedFilters(newFilters);
            }}
            onClear={handleClearFilters}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error.message}</span>
          <button
            onClick={() => {
              clearPitchError();
              clearSongsError();
              clearSingersError();
            }}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pitch count status */}
      {filteredPitches.length > 0 && (
        <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          {displayedPitches.length < filteredPitches.length
            ? `Showing ${displayedPitches.length} of ${filteredPitches.length} pitches`
            : `${filteredPitches.length} pitch${filteredPitches.length !== 1 ? 'es' : ''}`}
        </div>
      )}

      {/* List */}
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
            onUnsavedChangesRef={checkUnsavedChangesRef}            userSingerId={userSinger?.id}          />
        </Modal>
      )}

      {/* Grid View Modal - Commented out until PitchGridView component is created */}
      {/* {showGridViewModal && (
        <Modal
          isOpen={showGridViewModal}
          onClose={() => setShowGridViewModal(false)}
          title="Pitches Grid View"
          size="large"
        >
          <PitchGridView
            pitches={filteredPitches}
            songs={songs}
            singers={singers}
          />
        </Modal>
      )} */}

      {/* My Pitches Modal */}
      {showMyPitchesModal && (
        <Modal
          isOpen={showMyPitchesModal}
          onClose={() => {
            setShowMyPitchesModal(false);
            setMyPitchesSearchTerm(''); // Clear search when closing modal
          }}
          title="My Pitches"
        >
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={myPitchesSearchTerm}
                onChange={(e) => setMyPitchesSearchTerm(e.target.value)}
                placeholder="Search by song name or pitch..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                autoFocus
              />
              <i className="fas fa-search text-base text-gray-400 absolute left-3 top-2.5"></i>
            </div>
          </div>
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="w-full divide-y divide-gray-300 dark:divide-gray-700 table-fixed">
              <colgroup>
                <col className="w-auto" />
                <col className="w-20" />
                <col className="w-16" />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Song
                  </th>
                  <th scope="col" className="px-2 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Pitch
                  </th>
                  <th scope="col" className="relative py-3.5 pl-2 pr-4 text-right text-sm font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {filteredMyPitches.length > 0 ? (
                  filteredMyPitches.map((pitch) => {
                    const song = songMap.get(pitch.songId);
                    return (
                      <tr key={pitch.id}>
                        <td className="py-4 pl-4 pr-2 text-sm font-medium text-gray-900 dark:text-white">
                          <div className="truncate" title={song?.name || 'Unknown Song'}>
                            {song?.name || 'Unknown Song'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {pitch.pitch}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-2 pr-4 text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setShowMyPitchesModal(false);
                              setMyPitchesSearchTerm('');
                              handleEditClick(pitch);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {myPitchesSearchTerm.trim() 
                        ? 'No pitches found matching your search.'
                        : 'You don\'t have any pitches assigned yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-900/30 dark:text-blue-100 dark:hover:bg-blue-900/50"
              onClick={() => {
                setShowMyPitchesModal(false);
                setMyPitchesSearchTerm(''); // Clear search when closing modal
              }}
            >
              Close
            </button>
          </div>
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
    </div>
  );
};

export default PitchManager;
