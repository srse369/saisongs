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
  const [advancedFilters, setAdvancedFilters] = useState<PitchSearchFilters>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const songFilterId = searchParams.get('songId') || '';
  const singerFilterId = searchParams.get('singerId') || '';

  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [visibleCount, setVisibleCount] = useState(100);
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastFetchedUserIdRef = useRef<number | null>(null);

  // Check if the logged-in user has a singer profile (can manage own pitches)
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

    const filtered = pitches.filter((p) => {
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

    // Sort results by song name, then singer name (alphabetically)
    // When searching, prioritize pitches where song name or singer name starts with the search term
    return filtered.sort((a, b) => {
      const songA = songMap.get(a.songId);
      const songB = songMap.get(b.songId);
      const singerA = singerMap.get(a.singerId);
      const singerB = singerMap.get(b.singerId);
      
      const aSongName = songA?.name.toLowerCase() || '';
      const bSongName = songB?.name.toLowerCase() || '';
      const aSingerName = singerA?.name.toLowerCase() || '';
      const bSingerName = singerB?.name.toLowerCase() || '';
      
      if (debouncedSearchTerm.trim()) {
        const q = debouncedSearchTerm.toLowerCase();
        
        // Check if song name or singer name starts with query
        const aStartsWith = aSongName.startsWith(q) || aSingerName.startsWith(q);
        const bStartsWith = bSongName.startsWith(q) || bSingerName.startsWith(q);
        
        // Prefix matches come first
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
      }
      
      // Sort by song name first, then by singer name
      const songCompare = compareStringsIgnoringSpecialChars(songA?.name || '', songB?.name || '');
      if (songCompare !== 0) return songCompare;
      return compareStringsIgnoringSpecialChars(singerA?.name || '', singerB?.name || '');
    });
  }, [pitches, debouncedSearchTerm, advancedFilters, songFilterId, singerFilterId, songMap, singerMap]);

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
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pitch Management</h1>
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
                  onClick={handleClearFilters}
                  className="inline-flex items-center px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <WebLLMSearchInput
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              onFiltersExtracted={(filters) => {
                // If AI extracts songName/singerName filters, clear URL params to avoid conflicts
                const next = new URLSearchParams(searchParams);
                let urlChanged = false;
                
                if (filters.songName && songFilterId) {
                  next.delete('songId');
                  urlChanged = true;
                }
                
                if (filters.singerName && singerFilterId) {
                  next.delete('singerId');
                  urlChanged = true;
                }
                
                if (urlChanged) {
                  setSearchParams(next);
                }
                
                // Merge AI-extracted filters with existing advanced filters
                setAdvancedFilters(prev => ({ ...prev, ...filters }));
              }}
              searchType="pitch"
              placeholder='Ask AI: "Show me C# pitches for devi songs" or "Which singers have sanskrit songs?"...'
            />
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
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
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
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
