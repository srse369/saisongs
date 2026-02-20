import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserMultiSelect } from '../common/UserMultiSelect';
import { clearCentersCache } from '../common/CenterBadges';
import { getCacheItem, removeCacheItem, setCacheItem } from '../../utils/cacheUtils';
import { RefreshIcon, Modal, type MobileAction } from '../common';
import { globalEventBus } from '../../utils/globalEventBus';
import { isOffline } from '../../utils/offlineQueue';
import type { Center } from '../../types';
import { BaseManager } from './BaseManager';
import { useBaseManager } from '../../hooks/useBaseManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

const CENTERS_CACHE_KEY = 'saiSongs:centersCache';
const CENTERS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
interface CentersManagerProps {
  isActive?: boolean;
}

export const CentersManager: React.FC<CentersManagerProps> = ({ isActive = true }) => {
  const location = useLocation();
  const { isAdmin } = useAuth();

  // Use base manager hook for common functionality
  const baseManager = useBaseManager({
    resourceName: 'centers',
    isActive,
    onEscapeKey: () => {
      if (isFormOpen) {
        handleCloseForm();
      } else if (searchTermRef.current) {
        setSearchTerm('');
        baseManager.searchInputRef.current?.focus();
      }
    },
  });

  const [centers, setCenters] = useState<Center[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTermRef = useRef(searchTerm);
  searchTermRef.current = searchTerm;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(null);

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

  const filteredCenters = useMemo(() => {
    if (!searchTerm.trim()) return centers;
    const q = searchTerm.toLowerCase().trim();
    return centers.filter((c) => (c.name ?? '').toLowerCase().includes(q));
  }, [centers, searchTerm]);

  const fetchCenters = useCallback(async () => {
    try {
      setLoading(true);
      // Browser cache first
      if (typeof window !== 'undefined') {
        const raw = await getCacheItem(CENTERS_CACHE_KEY);
        if (raw) {
          try {
            const { timestamp, centers } = JSON.parse(raw) as { timestamp: number; centers: Center[] };
            if (Array.isArray(centers) && Date.now() - timestamp < CENTERS_CACHE_TTL_MS) {
              setCenters(centers);
              setError('');
              setLoading(false);
              return;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      const response = await fetch(`${API_BASE_URL}/centers`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch centers');
      }

      const data = await response.json();
      const centersData = Array.isArray(data) ? data : [];
      setCenters(centersData);
      setError('');
      // Persist to localStorage for offline use and browser cache stats
      if (typeof window !== 'undefined' && centersData.length > 0) {
        setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          centers: centersData,
        })).catch(() => {});
      }
    } catch (err) {
      console.error('Error fetching centers:', err);
      setError('Failed to load centers');
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch centers when tab is active (only if not already loaded)
  useEffect(() => {
    if (isActive && centers.length === 0) {
      fetchCenters();
    }
  }, [fetchCenters, isActive, centers.length]);

  // Listen for data refresh requests from global event bus
  useEffect(() => {
    let unsubscribes: (() => void)[] = [];

    const unsubscribeDataRefreshNeeded = globalEventBus.on('dataRefreshNeeded', (detail) => {
      if (detail.resource === 'centers' || detail.resource === 'all') {
        // Refresh centers data from backend to get latest counts
        fetchCenters();
      }
    });

    const unsubscribeCenterCreated = globalEventBus.on('centerCreated', (detail) => {
      const { center } = detail;
      if (center) {
        setCenters(prev => {
          // Check if center already exists (duplicate prevention)
          if (prev.some(c => c.id === center.id)) {
            const updated = prev.map(c => c.id === center.id ? center : c);
            if (typeof window !== 'undefined') {
              setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                centers: updated,
              })).catch(() => {});
            }
            return updated;
          }
          const updated = [...prev, center];
          if (typeof window !== 'undefined') {
            setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              centers: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribeCenterUpdated = globalEventBus.on('centerUpdated', (detail) => {
      const { center } = detail;
      if (center) {
        setCenters(prev => {
          const updated = prev.map(c => c.id === center.id ? center : c);
          if (typeof window !== 'undefined') {
            setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              centers: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribeCenterDeleted = globalEventBus.on('centerDeleted', (detail) => {
      const { center } = detail;
      if (center) {
        setCenters(prev => {
          const updated = prev.filter(c => c.id !== center.id);
          if (typeof window !== 'undefined') {
            setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              centers: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerCreated = globalEventBus.on('singerCreated', (detail) => {
      const { singer, centerIds } = detail;
      if (singer) {
        setCenters(prev => {
          const updated = prev.map(c => {
            if (centerIds?.includes(c.id)) {
              return { ...c, singerCount: (c.singerCount ?? 0) + 1 };
            }
            return c;
          });
          if (typeof window !== 'undefined') {
            setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              centers: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerUpdated = globalEventBus.on('singerUpdated', (detail) => {
      const { singer, centerIdsRemoved, centerIdsAdded } = detail;
      if (singer) {
        setCenters(prev => {
          const updated = prev.map(c => {
            if (centerIdsRemoved?.includes(c.id)) {
              return { ...c, singerCount: (c.singerCount ?? 0) - 1 };
            }
            if (centerIdsAdded?.includes(c.id)) {
              return { ...c, singerCount: (c.singerCount ?? 0) + 1 };
            }
            return c;
          });
          if (typeof window !== 'undefined') {
            setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              centers: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerDeleted = globalEventBus.on('singerDeleted', (detail) => {
      const { singer, centerIds } = detail;
      if (singer) {
        setCenters(prev => {
          const updated = prev.map(c => {
            if (centerIds?.includes(c.id)) {
              return { ...c, singerCount: (c.singerCount ?? 0) - 1 };
            }
            return c;
          });
          if (typeof window !== 'undefined') {
            setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              centers: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerMerged = globalEventBus.on('singerMerged', (detail) => {
      const { singer, centerIdsSingerCountDown } = detail;
      if (singer) {
        setCenters(prev => {
          const updated = prev.map(c => {
            return { ...c, singerCount: (c.singerCount ?? 0) + (centerIdsSingerCountDown.get(String(c.id)) ?? 0) };
          });
          if (typeof window !== 'undefined') {
            setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              centers: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    unsubscribes.push(unsubscribeDataRefreshNeeded, unsubscribeCenterCreated, unsubscribeCenterUpdated, unsubscribeCenterDeleted, unsubscribeSingerCreated, unsubscribeSingerUpdated, unsubscribeSingerDeleted, unsubscribeSingerMerged);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [fetchCenters]);

  // Escape key is handled by useBaseManager's onEscapeKey callback

  const handleOpenForm = (center?: Center) => {
    if (isOffline()) return;

    const initialData = center
      ? {
        name: center.name ?? '',
        badgeTextColor: center.badgeTextColor ?? '#1e40af',
        editorIds: center.editorIds ?? []
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
    setIsPreviewMode(false);
    setIsFormOpen(true);
  };

  const handlePreviewClick = (center: Center) => {
    const initialData = {
      name: center?.name ?? '',
      badgeTextColor: center?.badgeTextColor ?? '#1e40af',
      editorIds: center?.editorIds ?? []
    };
    setEditingCenter(center);
    setFormData(initialData);
    setOriginalData(initialData);
    setIsPreviewMode(true);
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
    if (!isPreviewMode && !force && hasUnsavedChanges()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }

    setIsFormOpen(false);
    setEditingCenter(null);
    setIsPreviewMode(false);
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

    if (isOffline()) {
      setError('Centers cannot be added or edited when offline.');
      return;
    }

    if (!formData.name.trim()) {
      setError('Center name is required');
      return;
    }

    setIsSubmitting(true);
    const isCreate = !editingCenter;
    const optimisticCenter: Center = isCreate
      ? { id: -1, name: formData.name.trim(), badgeTextColor: formData.badgeTextColor, editorIds: formData.editorIds }
      : { ...editingCenter!, name: formData.name.trim(), badgeTextColor: formData.badgeTextColor, editorIds: formData.editorIds };
    try {
      if (typeof window !== 'undefined') {
        setCenters(prev => {
          const updated = isCreate ? [...prev, optimisticCenter] : prev.map(c => c.id === editingCenter!.id ? optimisticCenter : c);
          setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), centers: updated })).catch(() => {});
          return updated;
        });
      }
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
      const savedCenter = await response.json();
      if (typeof window !== 'undefined') {
        setCenters(prev => {
          const updated = isCreate
            ? prev.map(c => c.id === -1 ? savedCenter : c)
            : prev.map(c => c.id === editingCenter!.id ? savedCenter : c);
          setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), centers: updated })).catch(() => {});
          return updated;
        });
      }
      await fetchCenters();

      // Clear caches since centers data has changed
      clearCentersCache(); // Clear the CenterBadges module-level cache
      removeCacheItem('saiSongs:singersCache').catch(() => {}); // Singers may have changed permissions
      removeCacheItem(CENTERS_CACHE_KEY).catch(() => {}); // Clear centers cache

      // Dispatch global event to notify other components
      globalEventBus.dispatch('centerUpdated', { type: 'centerUpdated', center: editingCenter ?? null });
      // Trigger singers refetch to repopulate cache (needed for offline; singers have center associations)
      globalEventBus.requestRefresh('singers');

      setError('');
      handleCloseForm(true); // Force close without unsaved changes check
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        setCenters(prev => {
          const reverted = isCreate
            ? prev.filter(c => c.id !== -1)
            : prev.map(c => c.id === editingCenter!.id ? editingCenter! : c);
          setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), centers: reverted })).catch(() => {});
          return reverted;
        });
      }
      console.error('Error saving center:', err);
      setError(err.message || 'Failed to save center');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (center: Center) => {
    if (isOffline()) {
      setError('Centers cannot be deleted when offline.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${center.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        setCenters(prev => {
          const updated = prev.filter(c => c.id !== center.id);
          setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), centers: updated })).catch(() => {});
          return updated;
        });
      }
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

      clearCentersCache();
      removeCacheItem('saiSongs:singersCache').catch(() => {});
      removeCacheItem(CENTERS_CACHE_KEY).catch(() => {});

      globalEventBus.dispatch('centerDeleted', { type: 'centerDeleted', center: center });
      // Trigger singers refetch to repopulate cache (needed for offline; singers have center associations)
      globalEventBus.requestRefresh('singers');

      setError('');
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        setCenters(prev => {
          const reverted = [...prev, center];
          setCacheItem(CENTERS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), centers: reverted })).catch(() => {});
          return reverted;
        });
      }
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

  const offline = isOffline();

  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Refresh',
      icon: 'fas fa-sync-alt',
      onClick: () => fetchCenters(),
      variant: 'secondary',
      disabled: loading,
    },
    {
      label: 'Add',
      icon: 'fas fa-plus',
      onClick: () => handleOpenForm(),
      variant: 'primary',
      disabled: offline,
    },
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Header actions content
  const headerActions = (
    <>
      <div className="relative flex-1 lg:min-w-[300px]">
        <input
          ref={baseManager.searchInputRef}
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search centers by name..."
          autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
          className="w-full pl-9 pr-9 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <i className="fas fa-search text-base text-gray-400 absolute left-3 top-2.5"></i>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Clear search"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        )}
      </div>
      {/* Desktop action buttons - hidden on mobile */}
      <div className="hidden md:flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
        <button
          type="button"
          onClick={() => fetchCenters()}
          disabled={loading}
          title="Refresh centers list"
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
        <button
          onClick={() => handleOpenForm()}
          disabled={offline}
          title={offline ? 'Centers cannot be added or edited when offline' : undefined}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <i className="fas fa-plus text-lg"></i>
          Add Center
        </button>
      </div>
    </>
  );

  return (
    <BaseManager
      isActive={isActive}
      isMobile={baseManager.isMobile}
      showScrollToTop={baseManager.showScrollToTop}
      listContainerStyle={baseManager.listContainerStyle}
      listContainerRef={baseManager.listContainerRef}
      headerRef={baseManager.headerRef}
      title="Centers"
      subtitle={offline ? 'Centers cannot be added, edited, or deleted when offline.' : 'Manage centers and editors'}
      helpHref="/help#centers"
      headerActions={headerActions}
      headerBelow={!loading && (centers.length > 0 || filteredCenters.length > 0) ? (
        <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 pt-3">
          <div className={`text-sm text-gray-600 dark:text-gray-400 ${baseManager.isMobile ? 'mt-2' : 'mb-2'}`}>
            {searchTerm.trim() ? `${filteredCenters.length} of ${centers.length} center${centers.length !== 1 ? 's' : ''}` : `${centers.length} center${centers.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      ) : undefined}
      mobileActions={mobileActions}
      onScrollToTop={baseManager.scrollToTop}
      loading={loading}
    >
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCenters.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">{searchTerm.trim() ? 'No centers match your search.' : 'No centers found. Create your first center to get started.'}</p>
            </div>
          ) : (
            <div className="space-y-0 md:space-y-3">
          {filteredCenters.map((center, index) => {
            const isSelected = selectedCenterId === center.id;
            return (
              <div
                key={center.id}
                onClick={() => {
                  // On mobile, toggle selection on row click
                  if (baseManager.isMobile) {
                    setSelectedCenterId(isSelected ? null : center.id);
                  }
                }}
                className={`p-2 md:p-4 bg-white dark:bg-gray-800 transition-all duration-200 ${baseManager.isMobile
                  ? `cursor-pointer ${index > 0 ? 'border-t border-gray-300 dark:border-gray-600' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`
                  : `border rounded-lg shadow-md hover:shadow-lg ${isSelected
                    ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                    : 'border-gray-200 dark:border-gray-700'
                  }`
                  }`}
              >
                <div className="flex items-center gap-2 md:gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 md:gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {center.name}
                        </h3>
                        <span
                          className="px-2.5 py-0.5 text-xs font-medium rounded-full border-2"
                          style={{
                            backgroundColor: (center.badgeTextColor || '#1e40af') + '20',
                            borderColor: center.badgeTextColor || '#1e40af',
                            color: center.badgeTextColor || '#1e40af'
                          }}
                        >
                          {center.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewClick(center);
                        }}
                        title="View center details"
                        className="flex-shrink-0 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                      >
                        <i className="fas fa-eye text-base"></i>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        <i className="fas fa-users"></i>
                        <span className="font-medium">{center.singerCount ?? 0}</span>
                        <span>singer{(center.singerCount ?? 0) !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        <i className="fas fa-user-edit"></i>
                        <span className="font-medium">{center.editorIds?.length ?? 0}</span>
                        <span>editor{(center.editorIds?.length ?? 0) !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        <i className="fas fa-calendar-alt mr-1"></i>
                        Created {(() => {
                          if (!center.createdAt) return 'Unknown';
                          try {
                            const date = new Date(center.createdAt);
                            return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
                          } catch {
                            return 'Unknown';
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions - Hidden on mobile until row is selected */}
                <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 mt-1 md:pt-3 md:mt-3 md:border-t md:border-gray-200 md:dark:border-gray-700 ${baseManager.isMobile && !isSelected ? 'hidden' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => !offline && handleOpenForm(center)}
                    disabled={offline}
                    title={offline ? 'Centers cannot be edited when offline' : undefined}
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-edit text-lg text-blue-600 dark:text-blue-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Edit</span>
                  </button>
                  <button
                    onClick={() => !offline && handleDelete(center)}
                    disabled={offline}
                    title={offline ? 'Centers cannot be deleted when offline' : undefined}
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-trash text-lg text-red-600 dark:text-red-400"></i>
                    <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
            </div>
          )}

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => handleCloseForm()}
        title={isPreviewMode ? 'View Center' : editingCenter ? 'Edit Center' : 'Create New Center'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Center Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Center Name <span className="text-red-500 dark:text-red-400">*</span>
              <span
                title="Name of the center that will be displayed throughout the app"
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
              >
                <i className="fas fa-info-circle text-xs"></i>
              </span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name ?? ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 bg-white"
              placeholder="Enter center name"
              required
              autoFocus={!isPreviewMode}
              disabled={isSubmitting || isPreviewMode}
              autoComplete="off"
            />
          </div>

          {/* Badge Text Color */}
          <div>
            <label htmlFor="badgeTextColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Badge Text Color
              <span
                title="Color used for this center's badge in the UI"
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
              >
                <i className="fas fa-info-circle text-xs"></i>
              </span>
            </label>
            <div className="flex gap-3 items-center">
              <input
                id="badgeTextColor"
                type="color"
                value={formData.badgeTextColor ?? '#1e40af'}
                onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                disabled={isSubmitting || isPreviewMode}
              />
              <input
                type="text"
                value={formData.badgeTextColor ?? '#1e40af'}
                onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 font-mono bg-white"
                placeholder="#1e40af"
                disabled={isSubmitting || isPreviewMode}
                autoComplete="off"
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
              disabled={isSubmitting || isPreviewMode}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Users who can create and edit singers for this center
            </p>
          </div>

          {/* Metadata - Only show when editing/viewing existing center */}
          {editingCenter && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Metadata
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editingCenter.createdBy && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Created By
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {editingCenter.createdBy}
                    </p>
                  </div>
                )}

                {editingCenter.createdAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Created At
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(editingCenter.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {editingCenter.updatedBy && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Updated By
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {editingCenter.updatedBy}
                    </p>
                  </div>
                )}

                {editingCenter.updatedAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Updated At
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(editingCenter.updatedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => handleCloseForm()}
              disabled={isSubmitting}
              title={isPreviewMode ? "Close" : "Discard changes and close the form"}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 w-full sm:w-auto"
            >
              {isPreviewMode ? 'Close' : 'Cancel'}
            </button>
            {!isPreviewMode && (
              <button
                type="submit"
                disabled={isSubmitting}
                title={editingCenter ? "Save changes to this center" : "Create a new center"}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
              >
                {isSubmitting ? 'Saving...' : editingCenter ? 'Update Center' : 'Create Center'}
              </button>
            )}
          </div>
        </form>
      </Modal>

    </BaseManager>
  );
};

export default CentersManager;
