import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSingers } from '../../contexts/SingerContext';
import { usePitches } from '../../contexts/PitchContext';
import { useAuth } from '../../contexts/AuthContext';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import { removeCacheItem } from '../../utils/cacheUtils';
import { RefreshIcon, type MobileAction } from '../common';
import { SingerForm } from './SingerForm';
import { SingerList } from './SingerList';
import { Modal } from '../common/Modal';
import type { Singer, CreateSingerInput } from '../../types';
import { BaseManager } from './BaseManager';
import { useBaseManager } from '../../hooks/useBaseManager';

interface SingerManagerProps {
  isActive?: boolean;
}

export const SingerManager: React.FC<SingerManagerProps> = ({ isActive = true }) => {
  const location = useLocation();
  const { singers, loading, error, fetchSingers, createSinger, updateSinger, deleteSinger, mergeSingers } = useSingers();
  const { fetchAllPitches } = usePitches();
  const { isEditor, userId, logout } = useAuth();
  
  // Use base manager hook for common functionality
  const baseManager = useBaseManager({
    resourceName: 'singers',
    isActive,
    onDataRefresh: () => fetchSingers(true),
    onEscapeKey: () => {
      if (baseManager.searchInputRef.current) {
        baseManager.searchInputRef.current.focus();
      }
    },
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewSinger, setPreviewSinger] = useState<Singer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pitchCount'>('name');
  const [selectedSingersForMerge, setSelectedSingersForMerge] = useState<string[]>([]);
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const startSelectionRef = useRef<(() => void) | null>(null);

  // Show error as toast message
  useEffect(() => {
    if (error) {
      console.error('SingerManager error:', error);
      // You could add toast notification here if needed
    }
  }, [error]);

  const scrollToTop = () => {
    if (baseManager.listContainerRef.current) {
      baseManager.listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Only fetch singers when tab is active (only if not already loaded)
    if (isActive && singers.length === 0) {
      fetchSingers(); // Use cached data, only refresh if stale
    }
  }, [fetchSingers, isActive, singers.length]);

  const handleCreateClick = () => {
    setEditingSinger(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (singer: Singer) => {
    setEditingSinger(singer);
    setIsPreviewMode(false);
    setIsFormOpen(true);
  };

  const handlePreviewClick = (singer: Singer) => {
    setEditingSinger(singer);
    setIsPreviewMode(true);
    setIsFormOpen(true);
  };

  const handleFormCancel = () => {
    // Check for unsaved changes before closing (only if not in preview mode)
    if (!isPreviewMode && checkUnsavedChangesRef.current && checkUnsavedChangesRef.current()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    setIsFormOpen(false);
    setEditingSinger(null);
    setIsPreviewMode(false);
  };

  const handleFormSubmit = async (input: CreateSingerInput, adminFields?: { isAdmin: boolean; editorFor: number[] }) => {
    if (editingSinger) {
      // Check if user is updating their own email
      const isUpdatingOwnEmail = editingSinger.id === userId && input.email && input.email !== editingSinger.email;

      const result = await updateSinger(editingSinger.id, input);
      if (result && adminFields) {
        // If admin fields provided, update them via separate API calls
        const API_BASE_URL = (window as any).__API_URL__ || (
          (window as any).__DEV__ ? '/api' : 'http://localhost:3111/api'
        );

        try {
          // Update isAdmin status
          await fetch(`${API_BASE_URL}/singers/${editingSinger.id}/admin`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isAdmin: adminFields.isAdmin ? 1 : 0 }),
          });

          // Update editorFor
          await fetch(`${API_BASE_URL}/singers/${editingSinger.id}/editor-for`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ editorFor: adminFields.editorFor }),
          });

          // Clear centers cache since editor assignments affect center data
          removeCacheItem('saiSongs:centersCache').catch(() => {});

          // Refresh singers to get updated data
          await fetchSingers(true);
        } catch (error) {
          console.error('Error updating admin fields:', error);
        }
      }
      if (result) {
        setIsFormOpen(false);
        setEditingSinger(null);

        // If user updated their own email, log them out
        if (isUpdatingOwnEmail) {
          await logout();
          window.location.href = '/';
        }
      }
    } else {
      const result = await createSinger(input);
      if (result) {
        setIsFormOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSinger(id);
  };

  const handleMerge = async (targetSingerId: string, singerIdsToMerge: string[]): Promise<boolean> => {
    const success = await mergeSingers(targetSingerId, singerIdsToMerge);
    if (success) {
      // Refresh singers and pitches to get updated data after merge
      // (mergeSingers already refreshes singers, but we refresh pitches here)
      await Promise.all([
        fetchSingers(true),
        fetchAllPitches(true)
      ]);
    }
    return success;
  };

  const filteredSingers = React.useMemo(() => {
    let result = searchTerm.trim() ? singers.filter((singer) =>
      singer.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [...singers];

    // Apply sorting
    if (sortBy === 'pitchCount') {
      result.sort((a, b) => (b.pitchCount ?? 0) - (a.pitchCount ?? 0));
    } else {
      // Sort by name
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        result.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStartsWith = aName.startsWith(q);
          const bStartsWith = bName.startsWith(q);

          // Prefix matches come first
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;

          // If both start with query or neither does, sort alphabetically
          return compareStringsIgnoringSpecialChars(a.name, b.name);
        });
      } else {
        result.sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
      }
    }

    return result;
  }, [singers, searchTerm, sortBy]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Clear search when Escape key is pressed while on this tab (only if no modal is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't clear search if a modal is open - let the modal handle Escape
      if (isFormOpen) return;

      if (e.key === 'Escape') {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen]);

  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Sort',
      icon: 'fas fa-sort',
      onClick: () => {
        setSortBy(prev => prev === 'name' ? 'pitchCount' : 'name');
      },
      variant: 'secondary',
    },
    {
      label: 'Refresh',
      icon: 'fas fa-sync-alt',
      onClick: () => fetchSingers(true),
      variant: 'secondary',
      disabled: loading,
    },
    ...(isEditor ? [{
      label: 'Add',
      icon: 'fas fa-plus',
      onClick: handleCreateClick,
      variant: 'primary' as const,
    }] : []),
  ];

  // Header actions content
  const headerActions = (
    <div className="flex flex-col lg:flex-row gap-3 w-full">
      <div className="relative flex-1 lg:min-w-[300px]">
        <input
          ref={baseManager.searchInputRef}
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search singers by name..."
          autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
          className="w-full pl-9 pr-9 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <i className="fas fa-search text-base text-gray-400 absolute left-3 top-2.5"></i>
        {searchTerm && (
          <button
            onClick={() => handleSearchChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Clear search"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        )}
      </div>
      {/* Desktop action buttons - hidden on mobile */}
      <div className="hidden md:flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'pitchCount')}
          title="Sort singers by name or pitch count"
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <option value="name">Sort: Name</option>
          <option value="pitchCount">Sort: Pitch Count</option>
        </select>
        <button
          type="button"
          onClick={() => fetchSingers(true)}
          disabled={loading}
          title="Reload singers from the database to see the latest updates"
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
        {isEditor && (
          <button
            onClick={handleCreateClick}
            title="Add a new singer to the database with name and profile information"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-plus text-lg"></i>
            Add New Singer
          </button>
        )}
      </div>
    </div>
  );

  return (
    <BaseManager
      isActive={isActive}
      isMobile={baseManager.isMobile}
      showScrollToTop={baseManager.showScrollToTop}
      listContainerStyle={baseManager.listContainerStyle}
      listContainerRef={baseManager.listContainerRef}
      headerRef={baseManager.headerRef}
      title="Singer Management"
      subtitle="Manage singers and their profiles"
      helpHref="/help#singers"
      headerActions={headerActions}
      headerBelow={filteredSingers.length > 0 ? (
        <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 pt-3">
          <div className={`text-sm text-gray-600 dark:text-gray-400 ${baseManager.isMobile ? 'mt-2' : 'mb-2'}`}>
            {filteredSingers.length} singer{filteredSingers.length !== 1 ? 's' : ''}
          </div>
        </div>
      ) : undefined}
      mobileActions={mobileActions}
      onScrollToTop={baseManager.scrollToTop}
      loading={loading}
    >
      <div className="flex flex-col gap-2 sm:gap-4">
        {/* Desktop merge controls - hidden on mobile */}
        {selectedSingersForMerge.length >= 2 && (
          <div className="hidden md:flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              {selectedSingersForMerge.length} singers selected for merge
            </span>
            <button
              onClick={() => selectedSingersForMerge.length >= 2 && handleMerge(selectedSingersForMerge[0], selectedSingersForMerge.slice(1))}
              disabled={loading || selectedSingersForMerge.length < 2}
              className="px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-800/30 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <i className="fas fa-code-merge text-blue-600 dark:text-blue-400"></i>
              Merge Singers
            </button>
          </div>
        )}
      </div>

      <SingerList
        singers={filteredSingers}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        onMerge={handleMerge}
        onStartSelection={() => baseManager.searchInputRef.current?.focus()}
        onPreview={handlePreviewClick}
        loading={loading}
        startSelectionRef={startSelectionRef}
      />

      {/* Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleFormCancel}
        title={editingSinger ? 'Edit Singer' : 'Add New Singer'}
      >
        <SingerForm
          singer={editingSinger}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          onUnsavedChangesRef={checkUnsavedChangesRef}
        />
      </Modal>

      {/* Preview Modal */}
      {previewSinger && (
        <Modal
          isOpen={!!previewSinger}
          onClose={() => setPreviewSinger(null)}
          title="Singer Details"
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <i className="fas fa-user text-2xl text-gray-500 dark:text-gray-400"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {previewSinger.name}
              </h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">Total Songs:</span>
                <span className="text-gray-900 dark:text-white">{previewSinger.pitchCount || 0}</span>
              </div>
              
              {previewSinger.createdAt && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Created:</span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(previewSinger.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </BaseManager>
  );  
};

export default SingerManager;
