import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePitches } from '../../contexts/PitchContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useAuth } from '../../contexts/AuthContext';
import { PitchForm } from './PitchForm';
import { PitchList } from './PitchList';
import type { SongSingerPitch, CreatePitchInput, Song } from '../../types';
import { Modal } from '../common/Modal';
import { SongDetails } from './SongDetails';

export const PitchManager: React.FC = () => {
  const { isEditor } = useAuth();
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
  const [searchParams, setSearchParams] = useSearchParams();
  const songFilterId = searchParams.get('songId') || '';
  const singerFilterId = searchParams.get('singerId') || '';

  const [viewingSong, setViewingSong] = useState<Song | null>(null);

  // Fetch songs, singers, and all existing pitch associations when needed.
  // We avoid refetching on every tab entry by only loading when the in-memory
  // collections are empty (e.g. first load or after a full reload).
  useEffect(() => {
    if (!songsLoading && songs.length === 0) {
      fetchSongs();
    }
    if (!singersLoading && singers.length === 0) {
      fetchSingers();
    }
    if (!pitchLoading && pitches.length === 0) {
      fetchAllPitches();
    }
  }, [
    fetchSongs,
    fetchSingers,
    fetchAllPitches,
    songsLoading,
    singersLoading,
    pitchLoading,
    songs.length,
    singers.length,
    pitches.length,
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

  const handleCancel = () => {
    setShowForm(false);
    setEditingPitch(null);
    clearPitchError();
  };

  const handleSubmit = async (input: CreatePitchInput) => {
    let result;

    if (editingPitch) {
      // Update existing pitch
      result = await updatePitch(editingPitch.id, { pitch: input.pitch });
    } else {
      // Create new pitch
      result = await createPitch(input);
    }

    if (result) {
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

  // Clear search when Escape key is pressed while on this tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClearFilters = () => {
    // Clear query params and local search input
    const next = new URLSearchParams(searchParams);
    next.delete('songId');
    next.delete('singerId');
    setSearchParams(next);
    setSearchTerm('');
  };

  const filteredPitches = pitches.filter((p) => {
    // If navigated here with a specific songId, only show pitches for that song
    if (songFilterId && p.songId !== songFilterId) {
      return false;
    }

    // If navigated here with a specific singerId, only show pitches for that singer
    if (singerFilterId && p.singerId !== singerFilterId) {
      return false;
    }

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();

    const song = songs.find((s) => s.id === p.songId);
    const singer = singers.find((s) => s.id === p.singerId);

    return (
      p.pitch.toLowerCase().includes(q) ||
      song?.name.toLowerCase().includes(q) ||
      singer?.name.toLowerCase().includes(q)
    );
  });

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
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
            <div className="relative flex-1 sm:w-80">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search by song, singer, or pitch..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M9.5 17a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                />
              </svg>
            </div>
            <div className="flex flex-row gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  fetchSongs();
                  fetchSingers();
                  fetchAllPitches();
                }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h5M20 20v-5h-5M5.455 19.545A8 8 0 0115 5.34M18.545 4.455A8 8 0 019 18.66"
                  />
                </svg>
                Refresh
              </button>
              {!showForm && isEditor && (
                <button
                  onClick={handleCreateClick}
                  disabled={loading || songs.length === 0 || singers.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Pitch
                </button>
              )}
            </div>
          </div>
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

      {/* Form */}
      {showForm && (
        <div className="mb-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {editingPitch ? 'Edit Pitch Association' : 'Create New Pitch Association'}
          </h2>
          <PitchForm
            pitch={editingPitch}
            songs={songs}
            singers={singers}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* List */}
      <PitchList
        pitches={filteredPitches}
        songs={songs}
        singers={singers}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        onViewSong={(songId) => {
          const song = songs.find((s) => s.id === songId) || null;
          setViewingSong(song);
        }}
        loading={loading}
      />

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
