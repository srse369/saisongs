import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSingers } from '../../contexts/SingerContext';
import { usePitches } from '../../contexts/PitchContext';
import { useAuth } from '../../contexts/AuthContext';
import { compareStringsIgnoringSpecialChars } from '../../utils';
import { removeLocalStorageItem } from '../../utils/cacheUtils';
import { RefreshIcon, MobileBottomActionBar, type MobileAction } from '../common';
import { SingerForm } from './SingerForm';
import { SingerList } from './SingerList';
import { Modal } from '../common/Modal';
import type { Singer, CreateSingerInput } from '../../types';
import { globalEventBus } from '../../utils/globalEventBus';

interface SingerManagerProps {
  isActive?: boolean;
}

export const SingerManager: React.FC<SingerManagerProps> = ({ isActive = true }) => {
  const location = useLocation();
  const { singers, loading, error, fetchSingers, createSinger, updateSinger, deleteSinger, mergeSingers } = useSingers();
  const { fetchAllPitches } = usePitches();
  const { isEditor, userId, logout } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pitchCount'>('name');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const checkUnsavedChangesRef = useRef<(() => boolean) | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const startSelectionRef = useRef<(() => void) | null>(null);
  
  // State for dynamic list container positioning on mobile
  const [listContainerStyle, setListContainerStyle] = useState<React.CSSProperties>(() => {
    return {};
  });

  // Track mobile state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll on mobile when tab is active
  useEffect(() => {
    if (isMobile && isActive) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isActive]);

  // Calculate list container positioning on mobile (after DOM is ready)
  useEffect(() => {
    if (!isMobile || !isActive) {
      setListContainerStyle({});
      return;
    }

    const calculatePosition = () => {
      const header = headerRef.current;
      if (!header) return;

      const bottomBarHeight = 108;
      const headerRect = header.getBoundingClientRect();
      const bottomBarTop = window.innerHeight - bottomBarHeight;
      const calculatedHeight = bottomBarTop - headerRect.bottom;
      
      // Ensure height is positive and reasonable
      const finalHeight = calculatedHeight > 0 ? calculatedHeight : 400;
      
      setListContainerStyle({
        top: `${headerRect.bottom + 6}px`,
        left: '1%',
        width: '98%',
        height: `${finalHeight}px`,
        minHeight: `${finalHeight}px`,
        maxHeight: `${finalHeight}px`,
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-y',
      });
    };

    // Calculate using requestAnimationFrame to ensure DOM is laid out
    const rafId = requestAnimationFrame(() => {
      calculatePosition();
    });
    
    // Also recalculate after delays to ensure bottom bar is rendered
    const timeoutId1 = setTimeout(calculatePosition, 100);
    const timeoutId2 = setTimeout(calculatePosition, 300);
    const timeoutId3 = setTimeout(calculatePosition, 500);

    // Recalculate on resize
    window.addEventListener('resize', calculatePosition);
    
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isMobile, isActive, singers.length, loading, searchTerm]);

  // Track scroll position for scroll-to-top button (only when active)
  useEffect(() => {
    if (!isActive || !isMobile || !listContainerRef.current) return;

    const container = listContainerRef.current;
    const handleScroll = () => {
      setShowScrollToTop(container.scrollTop > 200);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isMobile, isActive]);

  const scrollToTop = () => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Only fetch singers when tab is active (only if not already loaded)
    if (isActive && singers.length === 0) {
      fetchSingers(); // Use cached data, only refresh if stale
    }
  }, [fetchSingers, isActive, singers.length]);

  // Prevent body scroll on mobile when tab is active
  useEffect(() => {
    if (isMobile && isActive) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isActive]);

  // Listen for data refresh requests from global event bus (only when active)
  useEffect(() => {
    if (!isActive) return;

    let unsubscribe: (() => void) | undefined;

    unsubscribe = globalEventBus.on('dataRefreshNeeded', (detail) => {
      if (detail.resource === 'singers' || detail.resource === 'all') {
        // Refresh singers data from backend to get latest state
        fetchSingers(true); // Force refresh
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchSingers, isActive]);

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
        const API_BASE_URL = import.meta.env.VITE_API_URL || (
          import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
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
          removeLocalStorageItem('saiSongs:centersCache');

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

  const body = (
    <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 py-2 sm:py-4 md:py-8">
      {/* Fixed Header on Mobile - Pinned below Layout header */}
      <div 
        ref={headerRef}
        id="singer-manager-header"
        className={`${isMobile ? 'fixed left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700' : 'mb-2 sm:mb-4'}`}
        style={isMobile ? {
          top: '48px', // Position below Layout header (h-12 = 48px on mobile)
          paddingTop: 'env(safe-area-inset-top, 0px)',
        } : {}}
      >
        <div className={`max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 ${isMobile ? 'py-2' : ''}`}>
          <div className="flex flex-col gap-2 sm:gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Singer Management</h1>
                <a
                  href="/help#singers"
                  className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                  title="View help documentation for this tab"
                >
                  <i className="fas fa-question-circle text-lg sm:text-xl"></i>
                </a>
              </div>
              <p className="hidden sm:block mt-2 text-sm text-gray-600 dark:text-gray-400">
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
                  title="Reload singers from the database to see the latest changes"
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <RefreshIcon className="w-4 h-4" />
                  Refresh
                </button>
                {isEditor && (
                  <button
                    onClick={handleCreateClick}
                    title="Create a new singer profile with name, gender, and pitch information"
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <i className="fas fa-plus text-lg"></i>
                    Add Singer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Singer count and merge controls - Fixed in header on mobile */}
        <div className={`max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 ${isMobile ? 'pb-2 border-b border-gray-200 dark:border-gray-700' : ''}`}>
          <div className={`flex flex-wrap items-center justify-between gap-3 ${isMobile ? 'mb-0' : 'mb-4'}`}>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredSingers.length} singer{filteredSingers.length !== 1 ? 's' : ''}
            </div>
            {isEditor && (
              <button
                onClick={() => {
                  startSelectionRef.current?.();
                }}
                title="Merge multiple singer profiles into one, combining all their pitch information"
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <i className="fas fa-code-merge text-blue-600 dark:text-blue-400"></i>
                Merge Singers
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List Container - Scrollable on mobile, normal on desktop */}
      <div
        ref={listContainerRef}
        className={isMobile ? 'fixed overflow-y-auto' : 'overflow-y-auto'}
        style={isMobile ? {
          ...listContainerStyle,
          // Ensure overflow is always set
          overflowY: 'auto',
          overflowX: 'hidden',
        } : {
          minHeight: '400px',
          maxHeight: 'calc(100vh - 200px)', // Leave space for header and padding
        }}
      >
        <SingerList
          singers={filteredSingers}
          onEdit={handleEditClick}
          onDelete={handleDelete}
          onMerge={handleMerge}
          onStartSelection={() => searchInputRef.current?.focus()}
          onPreview={handlePreviewClick}
          loading={loading}
          startSelectionRef={startSelectionRef}
        />
      </div>

      {/* Scroll to Top Button - Mobile only */}
      {isMobile && showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <i className="fas fa-arrow-up text-lg"></i>
        </button>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={handleFormCancel}
        title={isPreviewMode ? 'View Singer' : editingSinger ? 'Edit Singer' : 'Create New Singer'}
      >
        <SingerForm
          singer={editingSinger}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          onUnsavedChangesRef={checkUnsavedChangesRef}
          readOnly={isPreviewMode}
        />
      </Modal>

      {/* Mobile Bottom Action Bar */}
      <MobileBottomActionBar
        actions={mobileActions}
      />
    </div>
  );
  
  return body;  
};

export default SingerManager;
