import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SearchBar } from '../common/SearchBar';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { usePitches } from '../../contexts/PitchContext';

interface SongListProps {
  onSongSelect: (songId: string) => void;
}

export const SongList: React.FC<SongListProps> = ({ onSongSelect }) => {
  const { songs, loading: songsLoading, fetchSongs } = useSongs();
  const { singers, fetchSingers } = useSingers();
  const { pitches, getPitchesForSinger } = usePitches();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSingerId, setSelectedSingerId] = useState<string>('');

  // Fetch songs and singers on mount
  useEffect(() => {
    fetchSongs();
    fetchSingers();
  }, [fetchSongs, fetchSingers]);

  // When singer filter changes, fetch pitches for that singer so we can filter locally by songId
  useEffect(() => {
    if (selectedSingerId) {
      getPitchesForSinger(selectedSingerId);
    }
  }, [selectedSingerId, getPitchesForSinger]);

  // Derive filtered songs using in-memory filtering (fast, no extra network calls)
  const filteredSongs = useMemo(() => {
    let base = songs;

    // If a singer is selected, restrict songs to those that have a pitch entry for that singer
    if (selectedSingerId) {
      const songIdsForSinger = new Set(pitches.map(p => p.songId));
      base = base.filter(song => songIdsForSinger.has(song.id));
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return base;
    }

    return base.filter(song => {
      const fields = [
        song.name,
        song.title,
        song.title2,
        song.language,
        song.deity,
        song.tempo,
        song.beat,
        song.raga,
        song.level,
        song.externalSourceUrl,
      ];

      return fields.some(field =>
        field ? field.toString().toLowerCase().includes(query) : false
      );
    });
  }, [songs, searchQuery, selectedSingerId, pitches]);

  const handleSongClick = (songId: string) => {
    onSongSelect(songId);
  };

  const handleSingerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSingerId(e.target.value);
  };

  if (songsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Select a Song to Present
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Choose a song from the list below to start your presentation
        </p>
      </div>

      {/* Search and filter controls */}
      <div className="mb-6 space-y-3 sm:space-y-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search songs by name..."
          debounceMs={300}
        />

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label htmlFor="singer-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:whitespace-nowrap">
            Filter by Singer:
          </label>
          <select
            id="singer-filter"
            value={selectedSingerId}
            onChange={handleSingerChange}
            className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Singers</option>
            {singers.map(singer => (
              <option key={singer.id} value={singer.id}>
                {singer.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Song list */}
      <div className="space-y-3 sm:space-y-4">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-12 sm:py-16 text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 sm:h-16 sm:w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-base sm:text-lg font-medium">No songs found</p>
            <p className="text-sm mt-2">Try adjusting your search or filter</p>
          </div>
        ) : (
          filteredSongs.map(song => (
            <button
              key={song.id}
              onClick={() => handleSongClick(song.id)}
              className="w-full text-left p-4 sm:p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2 truncate">
                    {song.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                    {song.externalSourceUrl}
                  </p>
                </div>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
