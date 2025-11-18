import React, { useState } from 'react';
import type { Singer } from '../../types';
import { Modal } from '../common/Modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface SingerListProps {
  singers: Singer[];
  onEdit: (singer: Singer) => void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export const SingerList: React.FC<SingerListProps> = ({ singers, onEdit, onDelete, loading = false }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
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
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {singers.map((singer) => (
              <tr key={singer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{singer.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleViewPitches(singer)}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Pitches
                  </button>
                  {isAuthenticated && (
                    <>
                      <button
                        onClick={() => onEdit(singer)}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(singer)}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
