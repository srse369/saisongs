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
  onSync: (id: string) => Promise<void>;
  onView: (song: Song) => void;
  loading?: boolean;
}

export const SongList: React.FC<SongListProps> = ({ songs, onEdit, onDelete, onSync, onView, loading = false }) => {
  const navigate = useNavigate();
  const { isEditor, isAdmin, isAuthenticated, userEmail } = useAuth();
  const { addSong, songIds } = useSession();
  const [syncingSongId, setSyncingSongId] = useState<string | null>(null);
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

  const handleSyncClick = async (id: string) => {
    setSyncingSongId(id);
    try {
      await onSync(id);
    } finally {
      setSyncingSongId(null);
    }
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
        <i className="fas fa-music text-5xl sm:text-6xl text-gray-400 dark:text-gray-600 mb-4 block"></i>
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
                {/* Song Name - Clickable to preview with external link */}
                <div className="flex items-center gap-1 mb-2">
                  <button
                    onClick={() => handlePresent(song)}
                    className="text-left text-base sm:text-lg font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                    title="Click to preview"
                  >
                    {song.name}
                  </button>
                  {song.externalSourceUrl && (
                    <a
                      href={song.externalSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                      title="View on external source"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-external-link-alt text-base"></i>
                    </a>
                  )}
                </div>

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
                  onClick={() => handlePresent(song)}
                  title="Preview"
                  className="p-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                >
                  <i className="fas fa-eye text-lg"></i>
                </button>
                <button
                  onClick={() => addSong(song.id)}
                  disabled={songIds.includes(song.id)}
                  title={songIds.includes(song.id) ? 'In Live' : 'Add to Live'}
                  className="flex items-center gap-2 p-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className={`fas ${songIds.includes(song.id) ? 'fa-check' : 'fa-plus'} text-lg`}></i>
                  <span className="text-sm font-medium whitespace-nowrap">Add to Session</span>
                </button>
                {/* Only show View Pitches button when authenticated (pitches contain private singer info) */}
                {isAuthenticated && (
                  <button
                    onClick={() => handleViewPitches(song)}
                    title="View Pitches"
                    className="flex items-center gap-2 p-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
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
                    <i className="fas fa-edit text-lg"></i>
                    <span className="text-sm font-medium whitespace-nowrap">Edit</span>
                  </button>
                )}
                {isAdmin && song.externalSourceUrl && (
                  <button
                    onClick={() => handleSyncClick(song.id)}
                    disabled={syncingSongId === song.id}
                    title="Sync from external source"
                    className="flex items-center gap-2 p-2 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncingSongId === song.id ? (
                      <>
                        <i className="fas fa-sync text-lg animate-spin"></i>
                        <span className="text-sm font-medium whitespace-nowrap">Syncing...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sync text-lg"></i>
                        <span className="text-sm font-medium whitespace-nowrap">Sync</span>
                      </>
                    )}
                  </button>
                )}
                {isEditor && (
                  <button
                    onClick={() => handleDeleteClick(song)}
                    title="Delete"
                    className="flex items-center gap-2 p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  >
                    <i className="fas fa-trash text-lg"></i>
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
