import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSongs } from '../../contexts/SongContext';
import { useAuth } from '../../contexts/AuthContext';
import { SongForm } from './SongForm';
import { SongList } from './SongList';
import { SongDetails } from './SongDetails';
import { Modal } from '../common/Modal';
import { WebLLMSearchInput } from '../common/WebLLMSearchInput';
import { AdvancedSongSearch, type SongSearchFilters } from '../common/AdvancedSongSearch';
import { RefreshIcon } from '../common';
import { createSongFuzzySearch, parseNaturalQuery } from '../../utils/smartSearch';
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
  const { isEditor } = useAuth();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<SongSearchFilters>({});
  const [visibleCount, setVisibleCount] = useState(50);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Create fuzzy search instance for fallback
  const fuzzySearch = useMemo(() => createSongFuzzySearch(songs), [songs]);

  useEffect(() => {
    // Only fetch songs if we don't already have them loaded.
    // AppContent will warm up the cache on initial app load; this is a
    // safety net for direct navigation or hard reloads.
    if (!loading && songs.length === 0) {
      fetchSongs();
    }
  }, [fetchSongs, loading, songs.length]);

  const handleCreateClick = () => {
    setEditingSong(null);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (song: Song) => {
    setEditingSong(song);
    setIsFormModalOpen(true);
  };

  const handleViewClick = (song: Song) => {
    setViewingSong(song);
  };

  const handleFormCancel = () => {
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

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  // Clear search when Escape key is pressed while on this tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchTerm('');
        setAdvancedFilters({});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSongs = useMemo(() => {
    let results = songs;

    // Apply advanced filters first (field-specific)
    if (advancedFilters.name) {
      results = results.filter(song => 
        song.name.toLowerCase().includes(advancedFilters.name!.toLowerCase())
      );
    }
    if (advancedFilters.title) {
      results = results.filter(song => 
        song.title?.toLowerCase().includes(advancedFilters.title!.toLowerCase())
      );
    }
    if (advancedFilters.deity) {
      results = results.filter(song => 
        song.deity?.toLowerCase().includes(advancedFilters.deity!.toLowerCase())
      );
    }
    if (advancedFilters.language) {
      results = results.filter(song => 
        song.language?.toLowerCase().includes(advancedFilters.language!.toLowerCase())
      );
    }
    if (advancedFilters.raga) {
      results = results.filter(song => 
        song.raga?.toLowerCase().includes(advancedFilters.raga!.toLowerCase())
      );
    }
    if (advancedFilters.tempo) {
      results = results.filter(song => 
        song.tempo?.toLowerCase().includes(advancedFilters.tempo!.toLowerCase())
      );
    }
    if (advancedFilters.beat) {
      results = results.filter(song => 
        song.beat?.toLowerCase().includes(advancedFilters.beat!.toLowerCase())
      );
    }
    if (advancedFilters.level) {
      results = results.filter(song => 
        song.level?.toLowerCase().includes(advancedFilters.level!.toLowerCase())
      );
    }
    if (advancedFilters.songTags) {
      results = results.filter(song => 
        song.songTags?.toLowerCase().includes(advancedFilters.songTags!.toLowerCase())
      );
    }

    // Apply smart search with natural language parsing and fuzzy matching
    const query = searchTerm.trim();
    if (!query) return results;

    // Parse natural language query
    const parsed = parseNaturalQuery(query);

    // Apply parsed filters
    if (parsed.deity) {
      results = results.filter(s => s.deity?.toLowerCase().includes(parsed.deity!));
    }
    if (parsed.language) {
      results = results.filter(s => s.language?.toLowerCase().includes(parsed.language!));
    }
    if (parsed.raga) {
      results = results.filter(s => s.raga?.toLowerCase().includes(parsed.raga!));
    }
    if (parsed.tempo) {
      results = results.filter(s => s.tempo?.toLowerCase().includes(parsed.tempo!));
    }
    if (parsed.level) {
      results = results.filter(s => s.level?.toLowerCase().includes(parsed.level!));
    }

    // Use fuzzy search for remaining general terms
    if (parsed.general || (!parsed.deity && !parsed.language && !parsed.raga && !parsed.tempo && !parsed.level)) {
      const searchQuery = parsed.general || query;
      const fuzzyResults = fuzzySearch.search(searchQuery);
      const fuzzyIds = new Set(fuzzyResults.map(r => r.item.id));
      results = results.filter(s => fuzzyIds.has(s.id));
    }

    return results;
  }, [songs, searchTerm, advancedFilters, fuzzySearch]);

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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 animate-fade-in">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-1">
              Song Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Create and manage your song library
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <WebLLMSearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              onFiltersExtracted={(filters) => {
                // Merge AI-extracted filters with existing advanced filters
                setAdvancedFilters(prev => ({ ...prev, ...filters }));
              }}
              searchType="song"
              placeholder='Ask AI: "Show me sai songs in sanskrit with fast tempo"...'
            />
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
              <button
                type="button"
                onClick={() => fetchSongs(true)}
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <RefreshIcon className="w-4 h-4" />
                Refresh
              </button>
              {isEditor && (
                <button
                  onClick={handleCreateClick}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Song
                </button>
              )}
            </div>
          </div>

          {/* Advanced Search */}
          <AdvancedSongSearch
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            onClear={() => setAdvancedFilters({})}
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center flex-1 min-w-0">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm font-medium text-red-800 dark:text-red-300 truncate">{error.message}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 focus:outline-none flex-shrink-0"
                aria-label="Dismiss error"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <SongList
        songs={displayedSongs}
        onEdit={handleEditClick}
        onDelete={handleDelete}
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
    </div>
  );
};
