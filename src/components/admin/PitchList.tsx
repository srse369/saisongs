import React, { useState } from 'react';
import type { SongSingerPitch, Song, Singer } from '../../types';
import { Modal } from '../common/Modal';

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
  loading?: boolean;
}

export const PitchList: React.FC<PitchListProps> = ({ 
  pitches, 
  songs, 
  singers, 
  onEdit, 
  onDelete, 
  loading = false 
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pitchToDelete, setPitchToDelete] = useState<PitchWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        <h3 className="mt-2 text-sm font-medium text-gray-900">No pitch associations</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new pitch association.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Song
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Singer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pitch
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enrichedPitches.map((pitch) => (
              <tr key={pitch.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{pitch.songName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{pitch.singerName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 font-semibold">{pitch.pitch}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onEdit(pitch)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(pitch)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
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
          <p className="text-gray-700">
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
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
