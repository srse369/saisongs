import React, { useState, useEffect, useRef } from 'react';
import { useSingers } from '../../contexts/SingerContext';
import { useAuth } from '../../contexts/AuthContext';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import { RefreshIcon, Tooltip } from '../common';
import { SingerForm } from './SingerForm';
import { SingerList } from './SingerList';
import { Modal } from '../common/Modal';
import type { Singer, CreateSingerInput } from '../../types';

export const SingerManager: React.FC = () => {
  const { singers, loading, error, fetchSingers, createSinger, updateSinger, deleteSinger, mergeSingers } = useSingers();
  const { isEditor, userId, logout } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pitchCount'>('name');
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch singers when user changes to get correct filtered data
    if (userId !== lastFetchedUserIdRef.current) {
      lastFetchedUserIdRef.current = userId;
      fetchSingers(); // Use cached data, only refresh if stale
    }
  }, [fetchSingers, userId]);

  // Focus search bar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateClick = () => {
    setEditingSinger(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (singer: Singer) => {
    setEditingSinger(singer);
    setIsFormOpen(true);
  };

  const handleFormCancel = () => {
    // Check for unsaved changes before closing
    if (checkUnsavedChangesRef.current && checkUnsavedChangesRef.current()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    setIsFormOpen(false);
    setEditingSinger(null);
  };

  const handleFormSubmit = async (input: CreateSingerInput, adminFields?: { is_admin: boolean; editor_for: number[] }) => {
    if (editingSinger) {
      // Check if user is updating their own email
      const isUpdatingOwnEmail = editingSinger.id === userId && input.email && input.email !== editingSinger.email;
      
      const result = await updateSinger(editingSinger.id, input);
      if (result && adminFields) {
        // If admin fields provided, update them via separate API calls
        const API_BASE_URL = import.meta.env.VITE_API_URL || (
          import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
        );
        
        try {
          // Update is_admin status
          await fetch(`${API_BASE_URL}/singers/${editingSinger.id}/admin`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ is_admin: adminFields.is_admin ? 1 : 0 }),
          });
          
          // Update editor_for
          await fetch(`${API_BASE_URL}/singers/${editingSinger.id}/editor-for`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ editor_for: adminFields.editor_for }),
          });
          
          // Clear centers cache since editor assignments affect center data
          window.localStorage.removeItem('songStudio:centersCache');
          
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
      // Refresh singers to get updated data
      await fetchSingers(true);
    }
    return success;
  };

  const filteredSingers = React.useMemo(() => {
    let result = searchTerm.trim() ? singers.filter((singer) => 
      singer.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [...singers];
    
    // Apply sorting
    if (sortBy === 'pitchCount') {
      result.sort((a, b) => (b.pitch_count ?? 0) - (a.pitch_count ?? 0));
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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Singer Management</h1>
              <Tooltip content="View help documentation for this tab">
                <a
                  href="/help#singers"
                  className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                  title="Help"
                >
                  <i className="fas fa-question-circle text-xl"></i>
                </a>
              </Tooltip>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage singers and their profiles
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <div className="relative flex-1 lg:min-w-[300px]">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search singers by name..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <i className="fas fa-search text-base text-gray-400 absolute left-3 top-2.5"></i>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
              <Tooltip content="Sort singers by name or pitch count">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'pitchCount')}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="name">Sort: Name</option>
                  <option value="pitchCount">Sort: Pitch Count</option>
                </select>
              </Tooltip>
              <Tooltip content="Reload singers from the database to see the latest changes">
                <button
                  type="button"
                  onClick={() => fetchSingers(true)}
                  disabled={loading}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <RefreshIcon className="w-4 h-4" />
                  Refresh
                </button>
              </Tooltip>
              {isEditor && (
                <Tooltip content="Create a new singer profile with name, gender, and pitch information">
                  <button
                    onClick={handleCreateClick}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <i className="fas fa-plus text-lg"></i>
                    Add Singer
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Singer count status */}
      {filteredSingers.length > 0 && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {filteredSingers.length} singer{filteredSingers.length !== 1 ? 's' : ''}
        </div>
      )}

      <SingerList
        singers={filteredSingers}
        onEdit={handleEditClick}
        onDelete={handleDelete}
        onMerge={handleMerge}
        onStartSelection={() => searchInputRef.current?.focus()}
        loading={loading}
      />

      <Modal
        isOpen={isFormOpen}
        onClose={handleFormCancel}
        title={editingSinger ? 'Edit Singer' : 'Create New Singer'}
      >
        <SingerForm
          singer={editingSinger}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          onUnsavedChangesRef={checkUnsavedChangesRef}
        />
      </Modal>
    </div>
  );
};

export default SingerManager;
