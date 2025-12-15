import React, { useState } from 'react';
import type { Singer } from '../../types';
import { Modal } from '../common/Modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MusicIcon } from '../common';
import { CenterBadges } from '../common/CenterBadges';

interface SingerListProps {
  singers: Singer[];
  onEdit: (singer: Singer) => void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export const SingerList: React.FC<SingerListProps> = ({ singers, onEdit, onDelete, loading = false }) => {
  const navigate = useNavigate();
  const { isEditor, isAdmin } = useAuth();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [singerToDelete, setSingerToDelete] = useState<Singer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (singer: Singer) => {
    setSingerToDelete(singer);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!singerToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(singerToDelete.id);
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
      setSingerToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setSingerToDelete(null);
  };

  const handleViewPitches = (singer: Singer) => {
    navigate(`/admin/pitches?singerId=${singer.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (singers.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-user text-5xl text-gray-400 mb-3 block"></i>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No singers</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new singer.</p>
      </div>
    );
  }

  return (
    <>
      {/* Card layout for all screen sizes - SAME AS SONGS */}
      <div className="space-y-3">
        {singers.map((singer) => (
          <div
            key={singer.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md p-4 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex flex-col gap-3">
              {/* Singer Name and Gender */}
              <div className="flex items-center gap-3">
                <h3 className={`text-lg font-semibold ${
                  singer.gender?.toLowerCase() === 'male' 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : singer.gender?.toLowerCase() === 'boy' 
                      ? 'text-blue-400 dark:text-blue-300' 
                      : singer.gender?.toLowerCase() === 'female' 
                        ? 'text-pink-600 dark:text-pink-400' 
                        : singer.gender?.toLowerCase() === 'girl' 
                          ? 'text-pink-400 dark:text-pink-300' 
                          : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {singer.name}
                </h3>
                {singer.gender && (
                  <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {singer.gender}
                  </span>
                )}
              </div>
              
              {/* Center Badges with Warning for Missing Centers */}
              <div className="flex items-center gap-2">
                <CenterBadges centerIds={singer.center_ids} showWarningIfEmpty={true} />
                {(!singer.center_ids || singer.center_ids.length === 0) && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 italic">
                    (Needs center assignment)
                  </span>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex flex-wrap items-center justify-start gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleViewPitches(singer)}
                    title="View Pitches"
                    className="inline-flex items-center gap-2 p-2 rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <MusicIcon className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Pitches</span>
                  </button>
                  {isEditor && (
                    <button
                      onClick={() => onEdit(singer)}
                      title="Edit"
                      className="inline-flex items-center gap-2 p-2 rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <i className="fas fa-edit text-lg"></i>
                      <span className="text-sm font-medium whitespace-nowrap">Edit</span>
                    </button>
                  )}
                  {isEditor && (
                    <button
                      onClick={() => handleDeleteClick(singer)}
                      title="Delete"
                      className="inline-flex items-center gap-2 p-2 rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500"
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
        title="Delete Singer"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <span className="font-semibold">{singerToDelete?.name}</span>?
            This action cannot be undone and will also remove all pitch associations for this singer.
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
