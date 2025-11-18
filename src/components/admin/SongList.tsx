import React, { useState } from 'react';
import type { Song } from '../../types';
import { Modal } from '../common/Modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from '../../contexts/SessionContext';

interface SongListProps {
  songs: Song[];
  onEdit: (song: Song) => void;
  onDelete: (id: string) => Promise<void>;
  onView: (song: Song) => void;
  loading?: boolean;
}

export const SongList: React.FC<SongListProps> = ({ songs, onEdit, onDelete, onView, loading = false }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addSong, songIds } = useSession();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (song: Song) => {
    setSongToDelete(song);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!songToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(songToDelete.id);
      setDeleteModalOpen(false);
      setSongToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setSongToDelete(null);
  };

  const handlePresent = (song: Song) => {
    // Single-song presentation uses the /presentation/:songId route
    navigate(`/presentation/${song.id}`);
  };

  const handleViewPitches = (song: Song) => {
    navigate(`/admin/pitches?songId=${song.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 sm:py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16">
        <svg
          className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <h3 className="mt-4 text-base sm:text-lg font-medium text-gray-900 dark:text-white">No songs</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new song.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {songs.map((song) => (
          <div
            key={song.id}
            className="card p-4 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3
                  className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 cursor-pointer hover:underline"
                  onClick={() => onView(song)}
                >
                  {song.name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {song.lyrics ? (
                    <>
                      {song.lyrics.substring(0, 200)}
                      {song.lyrics.length > 200 ? '...' : ''}
                    </>
                  ) : (
                    <span className="italic text-gray-400">No lyrics available</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {song.language && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      {song.language}
                    </span>
                  )}
                  {song.deity && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                      {song.deity}
                    </span>
                  )}
                  {song.tempo && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                      {song.tempo}
                    </span>
                  )}
                  {song.meaning && (
                    <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                      Translation
                    </span>
                  )}
                </div>
                {song.audioLink && (
                  <div className="mt-3">
                    <audio
                      controls
                      className="w-full max-w-xs"
                    >
                      <source src={song.audioLink} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button
                  onClick={() => addSong(song.id)}
                  disabled={songIds.includes(song.id)}
                  className="px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {songIds.includes(song.id) ? 'In Live' : 'Add to Live'}
                </button>
                <button
                  onClick={() => handlePresent(song)}
                  className="px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors whitespace-nowrap"
                >
                  Present
                </button>
                <button
                  onClick={() => handleViewPitches(song)}
                  className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors whitespace-nowrap"
                >
                  Pitches
                </button>
                {isAuthenticated && (
                  <>
                    <button
                      onClick={() => onEdit(song)}
                      className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(song)}
                      className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        title="Delete Song"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{songToDelete?.name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
