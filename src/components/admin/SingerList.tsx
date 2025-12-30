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
  onPreview?: (singer: Singer) => void;
  loading?: boolean;
}

export const SingerList: React.FC<SingerListProps> = ({ singers, onEdit, onDelete, onMerge, onStartSelection, onPreview, loading = false }) => {
  const navigate = useNavigate();
  const { isEditor, isAdmin, userId } = useAuth();
  const { singers: allSingers } = useSingers();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [singerToDelete, setSingerToDelete] = useState<Singer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSingerIds, setSelectedSingerIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedSingerId, setSelectedSingerId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    <>
      {/* Singer count and merge controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {singers.length} singer{singers.length !== 1 ? 's' : ''}
        </div>
        {isEditor && onMerge && (
          <div className="flex flex-wrap items-center gap-3">
            {!isSelectionMode ? (
              <Tooltip content="Merge multiple singer profiles into one, combining all their pitch information">
                <button
                  onClick={handleStartSelection}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <i className="fas fa-code-merge text-blue-600 dark:text-blue-400"></i>
                  Merge Singers
                </button>
              </Tooltip>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{selectedSingerIds.length}</span>
                  <span>selected</span>
                </div>
                {selectedSingerIds.length > 0 && (
                  <button
                    onClick={() => setSelectedSingerIds([])}
                    className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
                  >
                    Clear
                  </button>
                )}
                <Tooltip content={selectedSingerIds.length < 2 ? "Select at least 2 singers to merge" : "Combine selected singers into one profile"}>
                  <button
                    onClick={handleOpenMergeModal}
                    disabled={selectedSingerIds.length < 2}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <i className="fas fa-code-merge"></i>
                    Merge
                  </button>
                </Tooltip>
                <button
                  onClick={handleCancelSelection}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {/* Card layout for all screen sizes - SAME AS SONGS */}
      <div className="space-y-1.5 md:space-y-3">
        {singers.map((singer) => {
          const isSelected = selectedSingerId === singer.id;
          const isMergeSelected = selectedSingerIds.includes(singer.id);
          return (
          <div
            key={singer.id}
            onClick={() => {
              // On mobile, toggle selection on row click (only if not in merge selection mode)
              if (isMobile && !isSelectionMode) {
                setSelectedSingerId(isSelected ? null : singer.id);
              }
            }}
            className={`bg-white dark:bg-gray-800 border rounded-lg shadow-md p-2 md:p-4 hover:shadow-lg transition-all duration-200 ${
              isMergeSelected || (isMobile && isSelected && !isSelectionMode)
                ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'border-gray-200 dark:border-gray-700'
            } ${isMobile && !isSelectionMode ? 'cursor-pointer' : ''}`}
          >
            <div className="flex gap-1.5 md:gap-3">
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
              
              <div className="flex-1 flex flex-col gap-1.5 md:gap-3">
              {/* Singer Name (color-coded by gender) */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
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
                  {/* Pitch count circle - to the right of singer name, only show on mobile when there are pitches */}
                  {(singer.pitchCount ?? 0) > 0 && (
                    <div className="flex-shrink-0 md:hidden">
                      <div className="w-6 h-6 flex items-center justify-center rounded-full bg-black dark:bg-black text-white text-xs font-semibold">
                        {singer.pitchCount}
                      </div>
                    </div>
                  )}
                  {/* Missing email icon - red email icon with X circle overlay */}
                  {!singer.email && (
                    <Tooltip content="No email address - cannot grant login permissions">
                      <span className="flex-shrink-0 relative inline-flex items-center justify-center gap-1.5 text-red-600 dark:text-red-400">
                        <span className="relative inline-flex items-center justify-center">
                          <i className="fas fa-envelope text-base"></i>
                          <i className="fas fa-circle-xmark absolute -top-1 -right-1 text-black dark:text-black text-base"></i>
                        </span>
                        <span className="hidden md:inline text-sm font-medium">No email</span>
                      </span>
                    </Tooltip>
                  )}
                </div>
                {/* Center Badges and Preview Icon - right-aligned on both mobile and desktop */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CenterBadges centerIds={singer.centerIds} showWarningIfEmpty={false} />
                  {/* Warning for Missing Centers - Desktop only */}
                  {(!singer.centerIds || singer.centerIds.length === 0) && (
                    <span className="hidden md:inline text-xs text-yellow-600 dark:text-yellow-400 italic">
                      (Needs center assignment)
                    </span>
                  )}
                  {onPreview && (
                    <Tooltip content="Preview singer details">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreview(singer);
                        }}
                        className="flex-shrink-0 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                      >
                        <i className="fas fa-eye text-base"></i>
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
              
              {/* Actions - Touch-friendly on mobile - Hidden on mobile until row is selected */}
              <div className={`flex flex-wrap items-center justify-start gap-2 pt-1 md:pt-3 md:border-t md:border-gray-200 md:dark:border-gray-700 ${isMobile && !isSelected && !isSelectionMode ? 'hidden' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                  <Tooltip content={`View ${singer.pitchCount ?? 0} pitch assignment${(singer.pitchCount ?? 0) !== 1 ? 's' : ''}`}>
                    <button
                      onClick={() => handleViewPitches(singer)}
                      className="relative min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 rounded-lg sm:rounded-md text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      <div className="relative">
                        <MusicIcon className="w-5 h-5" />
                        {/* Mobile: Badge overlay on icon */}
                        {(singer.pitchCount ?? 0) > 0 && (
                          <span className="absolute -top-1 -right-1 sm:hidden flex items-center justify-center min-w-[16px] h-[16px] px-0.5 text-[9px] font-bold text-white bg-black rounded-full z-10">
                            {singer.pitchCount ?? 0}
                          </span>
                        )}
                      </div>
                      {/* Desktop: Text and inline badge */}
                      <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Pitches</span>
                      <span className={`hidden sm:inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-bold rounded-full ${
                        (singer.pitchCount ?? 0) > 0 
                          ? 'text-white bg-gray-900 dark:bg-black' 
                          : 'text-gray-500 bg-gray-300 dark:bg-gray-600 dark:text-gray-400'
                      }`}>
                        {singer.pitchCount ?? 0}
                      </span>
                    </button>
                  </Tooltip>
                  {/* Edit button - show for editors OR if viewing their own profile */}
                  {(isEditor || singer.id === userId) && (
                    <Tooltip content="Edit singer profile (name, gender, centers)">
                      <button
                        onClick={() => onEdit(singer)}
                        className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 rounded-lg sm:rounded-md text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        <i className="fas fa-edit text-lg text-blue-600 dark:text-blue-400"></i>
                        <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Edit</span>
                      </button>
                    </Tooltip>
                  )}
                  {/* Delete button - only for editors/admins */}
                  {isEditor && (
                    <Tooltip content="Delete singer and all their pitch assignments">
                      <button
                        onClick={() => handleDeleteClick(singer)}
                        className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 rounded-lg sm:rounded-md text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        <i className="fas fa-trash text-lg text-red-600 dark:text-red-400"></i>
                        <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Delete</span>
                      </button>
                    </Tooltip>
                  )}
              </div>
              </div>
            </div>
          </div>
          );
        })}
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
