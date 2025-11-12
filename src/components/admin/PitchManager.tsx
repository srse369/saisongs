import React, { useState, useEffect } from 'react';
import { usePitches } from '../../contexts/PitchContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { PitchForm } from './PitchForm';
import { PitchList } from './PitchList';
import type { SongSingerPitch, CreatePitchInput } from '../../types';

export const PitchManager: React.FC = () => {
  const { 
    pitches, 
    loading: pitchLoading, 
    error: pitchError,
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

  // Fetch songs and singers on mount
  useEffect(() => {
    fetchSongs();
    fetchSingers();
  }, [fetchSongs, fetchSingers]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pitch Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Associate singers with songs and their pitch information
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error.message}</span>
          <button
            onClick={() => {
              clearPitchError();
              clearSongsError();
              clearSingersError();
            }}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Button */}
      {!showForm && (
        <div className="mb-6">
          <button
            onClick={handleCreateClick}
            disabled={loading || songs.length === 0 || singers.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create New Pitch Association
          </button>
          {songs.length === 0 && !songsLoading && (
            <p className="mt-2 text-sm text-gray-600">
              Please create songs first before adding pitch associations.
            </p>
          )}
          {singers.length === 0 && !singersLoading && (
            <p className="mt-2 text-sm text-gray-600">
              Please create singers first before adding pitch associations.
            </p>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
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
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Pitch Associations</h2>
        </div>
        <div className="p-6">
          <PitchList
            pitches={pitches}
            songs={songs}
            singers={singers}
            onEdit={handleEditClick}
            onDelete={handleDelete}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};
