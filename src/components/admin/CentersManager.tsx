import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserMultiSelect } from '../common/UserMultiSelect';

interface Center {
  id: number;
  name: string;
  badge_text_color: string;
  editor_ids?: string[];
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

export const CentersManager: React.FC = () => {
  const { isAdmin } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    badge_text_color: '#1e40af', // default blue
    editor_ids: [] as string[],
  });

  // Track original data for unsaved changes detection
  const [originalData, setOriginalData] = useState({
    name: '',
    badge_text_color: '#1e40af',
    editor_ids: [] as string[],
  });

  useEffect(() => {
    fetchCenters();
  }, []);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFormOpen) {
        handleCloseForm();
      }
    };

    if (isFormOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFormOpen, formData, originalData]);

  const fetchCenters = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/centers`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch centers');
      }

      const data = await response.json();
      setCenters(data);
      setError('');
    } catch (err) {
      console.error('Error fetching centers:', err);
      setError('Failed to load centers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (center?: Center) => {
    const initialData = center
      ? { 
          name: center.name, 
          badge_text_color: center.badge_text_color,
          editor_ids: center.editor_ids || []
        }
      : { 
          name: '', 
          badge_text_color: '#1e40af',
          editor_ids: []
        };

    if (center) {
      setEditingCenter(center);
    } else {
      setEditingCenter(null);
    }
    
    setFormData(initialData);
    setOriginalData(initialData);
    setIsFormOpen(true);
  };

  const hasUnsavedChanges = () => {
    const editorIdsChanged = JSON.stringify(formData.editor_ids.slice().sort()) !== 
                             JSON.stringify(originalData.editor_ids.slice().sort());
    return (
      formData.name.trim() !== originalData.name.trim() ||
      formData.badge_text_color !== originalData.badge_text_color ||
      editorIdsChanged
    );
  };

  const handleCloseForm = (force: boolean = false) => {
    if (!force && hasUnsavedChanges()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }

    setIsFormOpen(false);
    setEditingCenter(null);
    setFormData({
      name: '',
      badge_text_color: '#1e40af',
      editor_ids: [],
    });
    setOriginalData({
      name: '',
      badge_text_color: '#1e40af',
      editor_ids: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Center name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingCenter
        ? `${API_BASE_URL}/centers/${editingCenter.id}`
        : `${API_BASE_URL}/centers`;

      const response = await fetch(url, {
        method: editingCenter ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          badge_text_color: formData.badge_text_color,
          editor_ids: formData.editor_ids,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save center');
      }

      await fetchCenters();
      
      // Clear singers cache since center editors may have changed user permissions
      window.localStorage.removeItem('songStudio:singersCache');
      
      setError('');
      handleCloseForm(true); // Force close without unsaved changes check
    } catch (err: any) {
      console.error('Error saving center:', err);
      setError(err.message || 'Failed to save center');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (center: Center) => {
    if (!confirm(`Are you sure you want to delete "${center.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/centers/${center.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Log dependency details in frontend console
        if (errorData.dependencies) {
          console.log(`Cannot delete center "${center.name}" (ID: ${center.id})`);
          console.log(`Dependency type: ${errorData.dependencies.type}`);
          console.log(`Items (${errorData.dependencies.items.length}):`);
          
          if (errorData.dependencies.type === 'users_with_roles') {
            errorData.dependencies.items.forEach((user: any) => {
              console.log(`  - ${user.name} (${user.email})`);
            });
          } else {
            errorData.dependencies.items.forEach((item: string) => {
              console.log(`  - ${item}`);
            });
          }
        }
        
        throw new Error(errorData.error || 'Failed to delete center');
      }

      await fetchCenters();
      setError('');
    } catch (err: any) {
      console.error('Error deleting center:', err);
      setError(err.message || 'Failed to delete center');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-gray-700 dark:text-gray-300">Only administrators can manage centers.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Centers</h1>
        <button
          onClick={() => handleOpenForm()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Center
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : centers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">No centers found. Create your first center to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {centers.map((center) => (
            <div
              key={center.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {center.name}
                    </h3>
                    <span
                      className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-700"
                      style={{ color: center.badge_text_color }}
                    >
                      Badge Preview
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created: {new Date(center.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleOpenForm(center)}
                    className="px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(center)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseForm}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                {editingCenter ? 'Edit Center' : 'Add Center'}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Center Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="badge_text_color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Badge Text Color
                </label>
                <div className="flex gap-3">
                  <input
                    id="badge_text_color"
                    type="color"
                    value={formData.badge_text_color}
                    onChange={(e) => setFormData({ ...formData, badge_text_color: e.target.value })}
                    className="w-16 h-10 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  />
                  <input
                    type="text"
                    value={formData.badge_text_color}
                    onChange={(e) => setFormData({ ...formData, badge_text_color: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="#1e40af"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="mt-2">
                  <span
                    className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-700"
                    style={{ color: formData.badge_text_color }}
                  >
                    Preview Badge
                  </span>
                </div>
              </div>

              <div>
                <UserMultiSelect
                  selectedUserIds={formData.editor_ids}
                  onChange={(userIds) => setFormData({ ...formData, editor_ids: userIds })}
                  label="Editors"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Users who can create and edit singers for this center
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    editingCenter ? 'Update' : 'Create'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CentersManager;
