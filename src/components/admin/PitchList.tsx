import React, { useState } from 'react';
import type { SongSingerPitch, Song, Singer } from '../../types';
import { Modal } from '../common/Modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from '../../contexts/SessionContext';
import { formatPitch, formatPitchWithName } from '../../utils/pitchUtils';

interface PitchWithDetails extends SongSingerPitch {
  songName?: string;
  singerName?: string;
}

interface PitchListProps {
  pitches: SongSingerPitch[];
  songs: Song[];
  singers: Singer[];
  onEdit: (pitch: SongSingerPitch) => void;
  onDelete: (id: string) => Promise<void>;
  onViewSong: (songId: string) => void;
  loading?: boolean;
}

export const PitchList: React.FC<PitchListProps> = ({ 
  pitches, 
  songs, 
  singers, 
  onEdit, 
  onDelete, 
  onViewSong,
  loading = false 
}) => {
  const navigate = useNavigate();
  const { addSong, songIds, entries } = useSession();
  const { isEditor, isAdmin } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pitchToDelete, setPitchToDelete] = useState<PitchWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Check if a song+singer combination is already in the live session
  const isInLiveSession = (songId: string, singerId: string): boolean => {
    return entries.some(entry => entry.songId === songId && entry.singerId === singerId);
  };

  // Create a map for quick lookups
  const songMap = new Map(songs.map(song => [song.id, song.name]));
  const singerMap = new Map(singers.map(singer => [singer.id, singer.name]));

  // Enrich pitches with song and singer names
  const enrichedPitches: PitchWithDetails[] = pitches.map(pitch => ({
    ...pitch,
    songName: songMap.get(pitch.songId) || 'Unknown Song',
    singerName: singerMap.get(pitch.singerId) || 'Unknown Singer',
  }));

  const handleDeleteClick = (pitch: PitchWithDetails) => {
    setPitchToDelete(pitch);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pitchToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(pitchToDelete.id);
      setDeleteModalOpen(false);
      setPitchToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setPitchToDelete(null);
  };

  const handlePresent = (pitch: PitchWithDetails) => {
    const params = new URLSearchParams();
    if (pitch.singerName) {
      params.set('singerName', pitch.singerName);
    }
    if (pitch.pitch) {
      params.set('pitch', pitch.pitch);
    }
    const query = params.toString();
    navigate(`/presentation/${pitch.songId}${query ? `?${query}` : ''}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (enrichedPitches.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
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
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No pitch associations</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new pitch association.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="responsive-table w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[25%]">
                Song
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[20%]">
                Singer
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[20%]">
                Pitch
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[35%]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {enrichedPitches.map((pitch) => (
              <tr key={pitch.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                <td data-label="Song" className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onViewSong(pitch.songId)}
                    className="text-left text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline truncate max-w-full block"
                    title={pitch.songName}
                  >
                    {pitch.songName}
                  </button>
                </td>
                <td data-label="Singer" className="px-3 py-3">
                  <div className="text-sm text-gray-900 dark:text-white truncate" title={pitch.singerName}>{pitch.singerName}</div>
                </td>
                <td data-label="Pitch" className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatPitch(pitch.pitch)}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">({pitch.pitch.replace('#', '♯')})</span>
                  </div>
                </td>
                <td data-label="Actions" className="px-3 py-3 text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => addSong(pitch.songId, pitch.singerId, pitch.pitch)}
                      disabled={isInLiveSession(pitch.songId, pitch.singerId)}
                      title={isInLiveSession(pitch.songId, pitch.singerId) ? 'In Live' : 'Add to Live'}
                      className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isInLiveSession(pitch.songId, pitch.singerId) ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => handlePresent(pitch)}
                      title="Present"
                      className="p-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    {isEditor && (
                      <button
                        onClick={() => onEdit(pitch)}
                        title="Edit"
                        className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteClick(pitch)}
                        title="Delete"
                        className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        title="Delete Pitch Association"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete the pitch association for{' '}
            <span className="font-semibold">{pitchToDelete?.singerName}</span> singing{' '}
            <span className="font-semibold">{pitchToDelete?.songName}</span> in pitch{' '}
            <span className="font-semibold">{pitchToDelete?.pitch}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
