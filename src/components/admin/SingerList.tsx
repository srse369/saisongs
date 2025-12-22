import React, { useState, useEffect } from 'react';
import type { Singer } from '../../types';
import { Modal } from '../common/Modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSingers } from '../../contexts/SingerContext';
import { MusicIcon, Tooltip } from '../common';
import { CenterBadges } from '../common/CenterBadges';
import { SingerMergeModal } from './SingerMergeModal';

interface SingerListProps {
  singers: Singer[];
  onEdit: (singer: Singer) => void;
  onDelete: (id: string) => Promise<void>;
  onMerge?: (targetSingerId: string, singerIdsToMerge: string[]) => Promise<boolean>;
  onStartSelection?: () => void;
  loading?: boolean;
}

export const SingerList: React.FC<SingerListProps> = ({ singers, onEdit, onDelete, onMerge, onStartSelection, loading = false }) => {
  const navigate = useNavigate();
  const { isEditor, isAdmin, userId } = useAuth();
  const { singers: allSingers } = useSingers();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [singerToDelete, setSingerToDelete] = useState<Singer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSingerIds, setSelectedSingerIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  const handleToggleSelection = (singerId: string) => {
    setSelectedSingerIds(prev => 
      prev.includes(singerId) 
        ? prev.filter(id => id !== singerId)
        : [...prev, singerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedSingerIds.length === singers.length) {
      setSelectedSingerIds([]);
    } else {
      setSelectedSingerIds(singers.map(s => s.id));
    }
  };

  const handleStartSelection = () => {
    setIsSelectionMode(true);
    onStartSelection?.();
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedSingerIds([]);
  };

  const handleOpenMergeModal = () => {
    if (selectedSingerIds.length < 2) {
      return;
    }
    setMergeModalOpen(true);
  };

  const handleConfirmMerge = async (targetSingerId: string, singerIdsToMerge: string[]) => {
    if (onMerge) {
      const success = await onMerge(targetSingerId, singerIdsToMerge);
      if (success) {
        setMergeModalOpen(false);
        setIsSelectionMode(false);
        setSelectedSingerIds([]);
      }
    }
  };

  const handleCloseMergeModal = () => {
    setMergeModalOpen(false);
  };

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

  // Handle Escape key to cancel selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        handleCancelSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode]);

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
    <>      {/* Merge mode controls */}
      {isEditor && onMerge && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {!isSelectionMode ? (
            <Tooltip content="Merge multiple singer profiles into one, combining all their pitch information">
              <button
                onClick={handleStartSelection}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <i className="fas fa-check-square mr-2"></i>
                Select Singers to Merge
              </button>
            </Tooltip>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold">{selectedSingerIds.length}</span>
                <span>singer{selectedSingerIds.length !== 1 ? 's' : ''} selected</span>
              </div>
              {selectedSingerIds.length > 0 && (
                <button
                  onClick={() => setSelectedSingerIds([])}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
                >
                  Deselect All
                </button>
              )}
              <Tooltip content={selectedSingerIds.length < 2 ? "Select at least 2 singers to merge" : "Combine selected singers into one profile"}>
                <button
                  onClick={handleOpenMergeModal}
                  disabled={selectedSingerIds.length < 2}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-code-merge mr-2"></i>
                  Merge Selected
                </button>
              </Tooltip>
              <button
                onClick={handleCancelSelection}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {/* Card layout for all screen sizes - SAME AS SONGS */}
      <div className="space-y-3">
        {singers.map((singer) => (
          <div
            key={singer.id}
            className={`bg-white dark:bg-gray-800 border rounded-lg shadow-md p-4 hover:shadow-lg transition-all duration-200 ${
              selectedSingerIds.includes(singer.id)
                ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex gap-3">
              {/* Checkbox for selection */}
              {isEditor && onMerge && isSelectionMode && (
                <div className="flex items-start pt-1">
                  <input
                    type="checkbox"
                    checked={selectedSingerIds.includes(singer.id)}
                    onChange={() => handleToggleSelection(singer.id)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                  />
                </div>
              )}
              
              <div className="flex-1 flex flex-col gap-3">
              {/* Singer Name and Gender */}
              <div className="flex items-center gap-3 flex-wrap">
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
                  <Tooltip content={`View ${singer.pitch_count ?? 0} pitch assignment${(singer.pitch_count ?? 0) !== 1 ? 's' : ''}`}>
                    <button
                      onClick={() => handleViewPitches(singer)}
                      className="inline-flex items-center gap-2 p-2 rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      <MusicIcon className="w-5 h-5" />
                      <span className="text-sm font-medium whitespace-nowrap">Pitches</span>
                      <span className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-bold text-white rounded-full ${
                        (singer.pitch_count ?? 0) > 0 
                          ? 'bg-blue-600 dark:bg-blue-500' 
                          : 'bg-gray-400 dark:bg-gray-500'
                      }`}>
                        {singer.pitch_count ?? 0}
                      </span>
                    </button>
                  </Tooltip>
                  {/* Edit button - show for editors OR if viewing their own profile */}
                  {(isEditor || singer.id === userId) && (
                    <Tooltip content="Edit singer profile (name, gender, centers)">
                      <button
                        onClick={() => onEdit(singer)}
                        className="inline-flex items-center gap-2 p-2 rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <i className="fas fa-edit text-lg"></i>
                        <span className="text-sm font-medium whitespace-nowrap">Edit</span>
                      </button>
                    </Tooltip>
                  )}
                  {/* Delete button - only for editors/admins */}
                  {isEditor && (
                    <Tooltip content="Delete singer and all their pitch assignments">
                      <button
                        onClick={() => handleDeleteClick(singer)}
                        className="inline-flex items-center gap-2 p-2 rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <i className="fas fa-trash text-lg"></i>
                        <span className="text-sm font-medium whitespace-nowrap">Delete</span>
                      </button>
                    </Tooltip>
                  )}
              </div>
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

      <SingerMergeModal
        isOpen={mergeModalOpen}
        singers={allSingers}
        selectedSingerIds={selectedSingerIds}
        onClose={handleCloseMergeModal}
        onConfirm={handleConfirmMerge}
      />
    </>
  );
};
