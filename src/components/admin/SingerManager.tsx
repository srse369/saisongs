import React, { useState, useEffect } from 'react';
import { useSingers } from '../../contexts/SingerContext';
import { useAuth } from '../../contexts/AuthContext';
import { SingerForm } from './SingerForm';
import { SingerList } from './SingerList';
import { Modal } from '../common/Modal';
import type { Singer, CreateSingerInput } from '../../types';

export const SingerManager: React.FC = () => {
  const { singers, loading, error, fetchSingers, createSinger, updateSinger, deleteSinger } = useSingers();
  const { isEditor } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Only fetch singers if we don't already have them in memory.
    // This avoids refetching every time we enter the tab while still
    // loading data on first use or after a full reload.
    if (!loading && singers.length === 0) {
      fetchSingers();
    }
  }, [fetchSingers, loading, singers.length]);

  const handleCreateClick = () => {
    setEditingSinger(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (singer: Singer) => {
    setEditingSinger(singer);
    setIsFormOpen(true);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingSinger(null);
  };

  const handleFormSubmit = async (input: CreateSingerInput) => {
    if (editingSinger) {
      const result = await updateSinger(editingSinger.id, input);
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

  const filteredSingers = singers.filter((singer) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return singer.name.toLowerCase().includes(q);
  });

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Singer Management</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage singers and their profiles
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:min-w-[220px]">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search singers by name..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="flex flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => fetchSingers()}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h5M20 20v-5h-5M5.455 19.545A8 8 0 0115 5.34M18.545 4.455A8 8 0 019 18.66"
                  />
                </svg>
                Refresh
              </button>
              {isEditor && (
                <button
                  onClick={handleCreateClick}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
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
        />
      </Modal>
    </div>
  );
};
