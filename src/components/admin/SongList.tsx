import React, { useState } from 'react';
import type { Song } from '../../types';
import { Modal } from '../common/Modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from '../../contexts/SessionContext';
import { MusicIcon } from '../common';

interface SongListProps {
  songs: Song[];
  onEdit: (song: Song) => void;
  onDelete: (id: string) => Promise<void>;
  onView: (song: Song) => void;
  loading?: boolean;
}

export const SongList: React.FC<SongListProps> = ({ songs, onEdit, onDelete, onView, loading = false }) => {
  const navigate = useNavigate();
  const { isEditor, isAdmin, isAuthenticated } = useAuth();
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
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md p-4 hover:shadow-lg transition-all duration-200"
          >
            {/* Unified layout for all screen sizes */}
            <div className="flex flex-col gap-3">
              {/* Content Section - First */}
              <div className="flex-1 min-w-0">
                {/* Song Name */}
                <h3
                  className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 cursor-pointer hover:underline"
                  onClick={() => onView(song)}
                >
                  {song.name}
                </h3>

                {/* Title 2 */}
                {song.title2 && song.title2.trim().toLowerCase() !== song.name.trim().toLowerCase() && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 italic">
                    {song.title2}
                  </p>
                )}

                {/* Raga and Beat (without tempo) */}
                {(song.raga || song.beat) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {song.raga && <span>Raga: {song.raga}</span>}
                    {song.raga && song.beat && <span className="mx-2">•</span>}
                    {song.beat && <span>Beat: {song.beat}</span>}
                  </p>
                )}

                {/* Deity, Language, and Tempo badges */}
                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  {song.deity && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded font-medium">
                      {song.deity}
                    </span>
                  )}
                  {song.language && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded font-medium">
                      {song.language}
                    </span>
                  )}
                  {song.tempo && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded font-medium">
                      {song.tempo}
                    </span>
                  )}
                </div>

                {/* Audio Player */}
                {song.audioLink && (
                  <div className="mt-3">
                    <audio
                      controls
                      preload="none"
                      className="w-full max-w-xs dark:invert dark:brightness-90 dark:contrast-90 dark:hue-rotate-180"
                    >
                      <source src={song.audioLink} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>

              {/* Action Icons - Last with labels always visible */}
              <div className="flex flex-wrap items-center justify-start gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => addSong(song.id)}
                  disabled={songIds.includes(song.id)}
                  title={songIds.includes(song.id) ? 'In Live' : 'Add to Live'}
                  className="flex items-center gap-2 p-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {songIds.includes(song.id) ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    )}
                  </svg>
                  <span className="text-sm font-medium whitespace-nowrap">Add to Session</span>
                </button>
                <button
                  onClick={() => handlePresent(song)}
                  title="Present"
                  className="flex items-center gap-2 p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium whitespace-nowrap">Preview</span>
                </button>
                {/* Only show View Pitches button when authenticated (pitches contain private singer info) */}
                {isAuthenticated && (
                  <button
                    onClick={() => handleViewPitches(song)}
                    title="View Pitches"
                    className="flex items-center gap-2 p-2 text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  >
                    <MusicIcon className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Pitches</span>
                  </button>
                )}
                {isEditor && (
                  <button
                    onClick={() => onEdit(song)}
                    title="Edit"
                    className="flex items-center gap-2 p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-sm font-medium whitespace-nowrap">Edit</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteClick(song)}
                    title="Delete"
                    className="flex items-center gap-2 p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-sm font-medium whitespace-nowrap">Delete</span>
                  </button>
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
