import React, { useState, useEffect, useRef } from 'react';
import { useSingers } from '../../contexts/SingerContext';
import { useAuth } from '../../contexts/AuthContext';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import { RefreshIcon } from '../common';
import { SingerForm } from './SingerForm';
import { SingerList } from './SingerList';
import { Modal } from '../common/Modal';
import type { Singer, CreateSingerInput } from '../../types';

export const SingerManager: React.FC = () => {
  const { singers, loading, error, fetchSingers, createSinger, updateSinger, deleteSinger } = useSingers();
  const { isEditor, userId } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const lastFetchedUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Fetch singers when user changes to get correct filtered data
    if (userId !== lastFetchedUserIdRef.current) {
      lastFetchedUserIdRef.current = userId;
      fetchSingers(); // Use cached data, only refresh if stale
    }
  }, [fetchSingers, userId]);

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

  const filteredSingers = React.useMemo(() => {
    if (!searchTerm.trim()) return singers;
    
    const q = searchTerm.toLowerCase();
    const filtered = singers.filter((singer) => 
      singer.name.toLowerCase().includes(q)
    );
    
    // Sort results: prioritize singers that start with the search term
    return filtered.sort((a, b) => {
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
  }, [singers, searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Clear search when Escape key is pressed while on this tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Singer Management</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage singers and their profiles
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <div className="relative flex-1 lg:min-w-[300px]">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search singers by name..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M9.5 17a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                />
              </svg>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
              <button
                type="button"
                onClick={() => fetchSingers(true)}
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <RefreshIcon className="w-4 h-4" />
                Refresh
              </button>
              {isEditor && (
                <button
                  onClick={handleCreateClick}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Singer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="ml-3 text-sm font-medium text-red-800">{error.message}</p>
          </div>
        </div>
      )}

      <SingerList
        singers={filteredSingers}
        onEdit={handleEditClick}
        onDelete={handleDelete}
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
