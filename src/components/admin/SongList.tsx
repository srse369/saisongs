import React, { useState, useEffect } from 'react';
import type { Song } from '../../types';
import { Modal } from '../common/Modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from '../../contexts/SessionContext';
import { MusicIcon } from '../common';
import { SongMetadataCard } from '../common/SongMetadataCard';

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
  const { isEditor, isAdmin, isAuthenticated, userEmail, userId } = useAuth();
  const { addSong, songIds } = useSession();
  const [syncingSongId, setSyncingSongId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    // Open in new tab so the Songs tab stays mounted and preserves scroll position
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const path = `${base}/presentation/${song.id}`.replace(/\/\/+/g, '/');
    window.open(`${window.location.origin}${path}?closeOnExit=1`, '_blank', 'noopener,noreferrer');
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
      <div className="space-y-0 md:space-y-3">
        {songs.map((song, index) => {
          const isSelected = selectedSongId === song.id;
          return (
          <div
            id={`song-${song.id}`}
            key={song.id}
            onClick={() => {
              // On mobile, toggle selection on row click
              if (isMobile) {
                setSelectedSongId(isSelected ? null : song.id);
              }
            }}
            className={`bg-white dark:bg-gray-800 p-2 md:p-4 transition-all duration-200 ${
              isMobile 
                ? `cursor-pointer ${index > 0 ? 'border-t border-gray-300 dark:border-gray-600' : ''} ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`
                : `border rounded-lg shadow-md hover:shadow-lg ${
                    isSelected 
                      ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`
            }`}
          >
            {/* Unified layout for all screen sizes */}
            <div className="flex flex-col gap-1.5 md:gap-3">
              {/* Content Section - First */}
              <div className="flex flex-1 min-w-0 items-start gap-2">
                <span className="flex-shrink-0 text-sm font-medium text-gray-400 dark:text-gray-500 tabular-nums" title={`Song #${index + 1} in list`}>
                  #{index + 1}
                </span>
                <div className="flex-1 min-w-0">
                {/* Song Metadata Section - Reusable component */}
                <SongMetadataCard
                  song={song}
                  onNameClick={isMobile ? undefined : () => handlePresent(song)}
                  nameClickTitle={isMobile ? undefined : "Click to preview"}
                  showBackground={!isMobile}
                  pitchCount={song.pitchCount}
                  isSelected={isSelected}
                  onPreviewClick={() => handlePresent(song)}
                  isAuthenticated={isAuthenticated}
                />

                {/* Audio Player - Hidden on mobile until row is selected */}
                {song.audioLink && (
                  <div className={`mt-2 ${isMobile && !isSelected ? 'hidden' : ''}`}>
                    <audio
                      controls
                      preload="none"
                      className="w-full max-w-xs dark:invert dark:brightness-90 dark:contrast-90 dark:hue-rotate-180"
                      style={{ height: '32px' }}
                    >
                      <source src={song.audioLink} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                </div>
              </div>

              {/* Action Icons - Icon-only on mobile, text on desktop - Hidden on mobile until row is selected */}
              <div className={`flex flex-wrap items-center justify-start gap-1.5 sm:gap-2 pt-1 md:pt-3 md:border-t md:border-gray-200 md:dark:border-gray-700 ${isMobile && !isSelected ? 'hidden' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => addSong(song.id)}
                  disabled={songIds.includes(song.id)}
                  title={songIds.includes(song.id) ? 'In Live' : 'Add to Live'}
                  className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className={`fas ${songIds.includes(song.id) ? 'fa-check' : 'fa-plus'} text-lg text-emerald-600 dark:text-emerald-400`}></i>
                  <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Add to Session</span>
                </button>
                {/* Only show View Pitches button when authenticated (pitches contain private singer info) */}
                {isAuthenticated && (
                  <button
                    onClick={() => handleViewPitches(song)}
                    title={`View ${song.pitchCount ?? 0} pitch assignment${(song.pitchCount ?? 0) !== 1 ? 's' : ''}`}
                    className="relative min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    <div className="relative">
                    <MusicIcon className="w-5 h-5" />
                      {/* Mobile: Badge overlay on icon */}
                      {(song.pitchCount ?? 0) > 0 && (
                        <span className="absolute -top-1 -right-1 sm:hidden flex items-center justify-center min-w-[16px] h-[16px] px-0.5 text-[9px] font-bold text-white bg-black rounded-full z-10">
                          {song.pitchCount ?? 0}
                        </span>
                      )}
                    </div>
                    {/* Desktop: Text and inline badge */}
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Pitches</span>
                    <span className={`hidden sm:inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-bold rounded-full ${
                      (song.pitchCount ?? 0) > 0 
                        ? 'text-white bg-gray-900 dark:bg-black' 
                        : 'text-gray-500 bg-gray-300 dark:bg-gray-600 dark:text-gray-400'
                    }`}>
                      {song.pitchCount ?? 0}
                    </span>
                  </button>
                )}
                {song.externalSourceUrl && (
                  <a
                    href={song.externalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View song on external source (YouTube, etc.)"
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  >
                    <i className="fas fa-external-link-alt text-lg text-blue-600 dark:text-blue-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">External URL</span>
                  </a>
                )}
                {isEditor && (
                  <button
                    onClick={() => onEdit(song)}
                    title="Edit"
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  >
                    <i className="fas fa-edit text-lg text-blue-600 dark:text-blue-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Edit</span>
                  </button>
                )}
                {isAdmin && song.externalSourceUrl && (
                  <button
                    onClick={() => handleSyncClick(song.id)}
                    disabled={syncingSongId === song.id}
                    title="Sync from external source"
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncingSongId === song.id ? (
                      <>
                        <i className="fas fa-sync text-lg text-yellow-600 dark:text-yellow-400 animate-spin"></i>
                        <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Syncing...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sync text-lg text-yellow-600 dark:text-yellow-400"></i>
                        <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Sync</span>
                      </>
                    )}
                  </button>
                )}
                {/* Delete button - show for admins OR editors who created the song */}
                {(isAdmin || (isEditor && song.createdBy === userId)) && (
                  <button
                    onClick={() => handleDeleteClick(song)}
                    title="Delete"
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  >
                    <i className="fas fa-trash text-lg text-red-600 dark:text-red-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
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
