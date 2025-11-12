import React, { useState } from 'react';
import type { Singer } from '../../types';
import { Modal } from '../common/Modal';

interface SingerListProps {
  singers: Singer[];
  onEdit: (singer: Singer) => void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export const SingerList: React.FC<SingerListProps> = ({ singers, onEdit, onDelete, loading = false }) => {
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
      setDeleteModalOpen(false);
      setSingerToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setSingerToDelete(null);
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
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No singers</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new singer.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {singers.map((singer) => (
          <div
            key={singer.id}
            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
          >
            <div className="flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {singer.name}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Added {singer.createdAt.toLocaleDateString()}
              </p>
              <div className="flex justify-end space-x-2 mt-auto">
                <button
                  onClick={() => onEdit(singer)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(singer)}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
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
          <p className="text-gray-700">
            Are you sure you want to delete <span className="font-semibold">{singerToDelete?.name}</span>?
            This action cannot be undone and will also remove all pitch associations for this singer.
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
