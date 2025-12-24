import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserMultiSelect } from '../common/UserMultiSelect';
import { clearCentersCache } from '../common/CenterBadges';
import { RefreshIcon, Tooltip, Modal } from '../common';

interface Center {
  id: number;
  name: string;
  badgeTextColor: string;
  editorIds?: string[];
  createdAt: string;
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
    badgeTextColor: '#1e40af', // default blue
    editorIds: [] as string[],
  });

  // Track original data for unsaved changes detection
  const [originalData, setOriginalData] = useState({
    name: '',
    badgeTextColor: '#1e40af',
    editorIds: [] as string[],
  });
  
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchCenters();
    }
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
          badgeTextColor: center.badgeTextColor,
          editorIds: center.editorIds || []
        }
      : { 
          name: '', 
          badgeTextColor: '#1e40af',
          editorIds: []
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
    const editorIdsChanged = JSON.stringify(formData.editorIds.slice().sort()) !== 
                             JSON.stringify(originalData.editorIds.slice().sort());
    return (
      formData.name.trim() !== originalData.name.trim() ||
      formData.badgeTextColor !== originalData.badgeTextColor ||
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
      badgeTextColor: '#1e40af',
      editorIds: [],
    });
    setOriginalData({
      name: '',
      badgeTextColor: '#1e40af',
      editorIds: [],
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
          badgeTextColor: formData.badgeTextColor,
          editorIds: formData.editorIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save center');
      }

      await fetchCenters();
      
      // Clear caches since centers data has changed
      clearCentersCache(); // Clear the CenterBadges module-level cache
      window.localStorage.removeItem('songStudio:singersCache'); // Singers may have changed permissions
      window.localStorage.removeItem('songStudio:centersCache'); // Clear any localStorage centers cache
      
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
      
      // Clear caches since centers data has changed
      clearCentersCache();
      window.localStorage.removeItem('songStudio:singersCache');
      window.localStorage.removeItem('songStudio:centersCache');
      
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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Centers</h1>
            <Tooltip content="View help documentation for this tab">
              <a
                href="/help#centers"
                className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                title="Help"
              >
                <i className="fas fa-question-circle text-xl"></i>
              </a>
            </Tooltip>
          </div>
          {!loading && centers.length > 0 && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {centers.length} center{centers.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Tooltip content="Refresh centers list">
            <button
              type="button"
              onClick={() => fetchCenters()}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </button>
          </Tooltip>
          <button
            onClick={() => handleOpenForm()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            + Add Center
          </button>
        </div>
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
        <div className="space-y-3">
          {centers.map((center) => (
            <div
              key={center.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              {/* Icon */}
              <div 
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full"
                style={{ 
                  backgroundColor: `${center.badgeTextColor}20`,
                  color: center.badgeTextColor 
                }}
              >
                <i className="fas fa-building text-xl"></i>
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {center.name}
                  </h3>
                  <span
                    className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700"
                    style={{ color: center.badgeTextColor }}
                  >
                    {center.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    <i className="fas fa-calendar-alt mr-1"></i>
                    Created {new Date(center.createdAt).toLocaleDateString()}
                  </span>
                  {center.editorIds && center.editorIds.length > 0 && (
                    <span>
                      <i className="fas fa-user-edit mr-1"></i>
                      {center.editorIds.length} editor{center.editorIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={() => handleOpenForm(center)}
                  className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <i className="fas fa-edit text-blue-600 dark:text-blue-400"></i>
                  <span className="hidden sm:inline text-sm font-medium">Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(center)}
                  className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <i className="fas fa-trash text-red-600 dark:text-red-400"></i>
                  <span className="hidden sm:inline text-sm font-medium">Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => handleCloseForm()}
        title={editingCenter ? 'Edit Center' : 'Create New Center'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Center Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Center Name <span className="text-red-500 dark:text-red-400">*</span>
              <Tooltip content="Name of the center that will be displayed throughout the app">
                <span className="ml-1 text-gray-400 dark:text-gray-500 cursor-help">
                  <i className="fas fa-info-circle text-xs"></i>
                </span>
              </Tooltip>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="Enter center name"
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {/* Badge Text Color */}
          <div>
            <label htmlFor="badgeTextColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Badge Text Color
              <Tooltip content="Color used for this center's badge in the UI">
                <span className="ml-1 text-gray-400 dark:text-gray-500 cursor-help">
                  <i className="fas fa-info-circle text-xs"></i>
                </span>
              </Tooltip>
            </label>
            <div className="flex gap-3 items-center">
              <input
                id="badgeTextColor"
                type="color"
                value={formData.badgeTextColor}
                onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                disabled={isSubmitting}
              />
              <input
                type="text"
                value={formData.badgeTextColor}
                onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 font-mono"
                placeholder="#1e40af"
                disabled={isSubmitting}
              />
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Preview:</span>
              <span
                className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-700"
                style={{ color: formData.badgeTextColor }}
              >
                {formData.name || 'Center Name'}
              </span>
            </div>
          </div>

          {/* Editors */}
          <div>
            <UserMultiSelect
              selectedUserIds={formData.editorIds}
              onChange={(userIds) => setFormData({ ...formData, editorIds: userIds })}
              label="Center Editors"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Users who can create and edit singers for this center
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Tooltip content="Discard changes and close the form">
              <button
                type="button"
                onClick={() => handleCloseForm()}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 w-full sm:w-auto"
              >
                Cancel
              </button>
            </Tooltip>
            <Tooltip content={editingCenter ? "Save changes to this center" : "Create a new center"}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
              >
                {isSubmitting ? 'Saving...' : editingCenter ? 'Update Center' : 'Create Center'}
              </button>
            </Tooltip>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CentersManager;
