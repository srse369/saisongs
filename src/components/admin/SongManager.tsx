import React, { useState, useEffect } from 'react';
import { useSongs } from '../../contexts/SongContext';
import { SongForm } from './SongForm';
import { SongList } from './SongList';
import { Modal } from '../common/Modal';
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

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const handleCreateClick = () => {
    setEditingSong(null);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (song: Song) => {
    setEditingSong(song);
    setIsFormModalOpen(true);
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

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 animate-fade-in">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-1">
              Song Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Create and manage your song library
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Song
          </button>
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
        songs={songs}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        loading={loading}
      />

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
    </div>
  );
};
