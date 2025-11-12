import React, { useState, useEffect } from 'react';
import { useSingers } from '../../contexts/SingerContext';
import { SingerForm } from './SingerForm';
import { SingerList } from './SingerList';
import { Modal } from '../common/Modal';
import type { Singer, CreateSingerInput } from '../../types';

export const SingerManager: React.FC = () => {
  const { singers, loading, error, fetchSingers, createSinger, updateSinger, deleteSinger } = useSingers();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);

  useEffect(() => {
    fetchSingers();
  }, [fetchSingers]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Singer Management</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage singers and their profiles
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add Singer
          </button>
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
        singers={singers}
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
