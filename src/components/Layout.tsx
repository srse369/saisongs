import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useAuth } from '../contexts/AuthContext';
import { MusicIcon, SongIcon, RoleBadge, UserDropdown, DatabaseStatusDropdown, CenterBadges, Tooltip, Modal } from './common';
import { FeedbackDrawer } from './common/FeedbackDrawer';
import { clearAllCaches, checkCacheClearCooldown, CACHE_KEYS } from '../utils/cacheUtils';
import apiClient from '../services/ApiClient';

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const { isConnected, connectionError, resetConnection } = useDatabase();
  const { isAuthenticated, userRole, userName, userEmail, logout, centerIds, editorFor, isAdmin } = useAuth();

  const handleShowAdmins = async () => {
    setIsMobileMenuOpen(false);
    setShowAdminsModal(true);
    setLoadingAdmins(true);
    try {
      const response = await apiClient.get('/auth/admins');
      if (response && response.admins) {
        setAdmins(response.admins);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleRefreshLocalCache = async () => {
    const cooldownSeconds = checkCacheClearCooldown(60000); // 60 second cooldown
    if (cooldownSeconds > 0) {
      alert(`Please wait ${cooldownSeconds} seconds before clearing cache again.`);
      return;
    }

    if (!confirm('Clear web page, JavaScript, and CSS cache? This will fetch fresh HTML/JS/CSS but preserve image caches.')) {
      return;
    }

    setClearingCache(true);
    setIsMobileMenuOpen(false);
    
    try {
      await clearAllCaches({
        clearServiceWorkerCache: true,
        reload: true,
        reloadParam: '_nocache',
        reloadDelay: 1500,
        updateLastClearTimestamp: true,
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      setClearingCache(false);
      alert('Failed to clear cache. Please try again.');
    }
  };

  // Check if current path matches the link
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Swipe navigation for mobile - navigate between main tabs
  useEffect(() => {
    // Only enable on mobile
    if (window.innerWidth >= 768) return;

    // Define tab order based on authentication
    const tabs = [
      { path: '/admin/songs', label: 'Songs' },
      ...(isAuthenticated ? [
        { path: '/admin/singers', label: 'Singers' },
        { path: '/admin/pitches', label: 'Pitches' },
      ] : []),
      { path: '/session', label: 'Live' },
    ];

    let touchStartX: number | null = null;
    let touchStartY: number | null = null;
    const minSwipeDistance = 50; // Minimum distance for a swipe
    const maxVerticalDistance = 100; // Maximum vertical movement to still count as horizontal swipe

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX === null || touchStartY === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Check if it's primarily a horizontal swipe
      if (Math.abs(deltaY) > maxVerticalDistance) {
        touchStartX = null;
        touchStartY = null;
        return;
      }

      // Find current tab index
      const currentPath = location.pathname;
      const currentIndex = tabs.findIndex(tab => 
        currentPath === tab.path || currentPath.startsWith(tab.path + '/')
      );

      if (currentIndex === -1) {
        touchStartX = null;
        touchStartY = null;
        return;
      }

      // Navigate based on swipe direction
      if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          // Swipe right - go to previous tab
          if (currentIndex > 0) {
            navigate(tabs[currentIndex - 1].path);
          }
        } else {
          // Swipe left - go to next tab
          if (currentIndex < tabs.length - 1) {
            navigate(tabs[currentIndex + 1].path);
          }
        }
      }

      touchStartX = null;
      touchStartY = null;
    };

    // Add touch event listeners to the document
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [location.pathname, navigate, isAuthenticated]);

  // Get link classes based on active state
  const getLinkClasses = (path: string) => {
    const baseClasses = "inline-flex items-center px-2 lg:px-3 py-2 text-sm font-medium rounded-md transition-colors";
    const activeClasses = "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
    const inactiveClasses = "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header with Navigation */}
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 md:h-16">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center group">
              <img 
                src="/logo.png" 
                alt="Sai Songs" 
                className="h-8 sm:h-10 md:h-12 w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
              <Link to="/admin/songs" className={getLinkClasses('/admin/songs')}>
                <SongIcon className="w-4 h-4 mr-1.5" />
                Songs
              </Link>
              
              {/* Singers and Pitches tabs visible to all authenticated users */}
              {isAuthenticated && (
                <>
                  <Link to="/admin/singers" className={getLinkClasses('/admin/singers')}>
                    <i className="fas fa-users w-4 h-4 mr-1.5"></i>
                    Singers
                  </Link>
                  <Link to="/admin/pitches" className={getLinkClasses('/admin/pitches')}>
                    <MusicIcon className="w-4 h-4 mr-1.5" />
                    Pitches
                  </Link>
                </>
              )}
              
              <Link to="/session" className={getLinkClasses('/session')}>
                <i className="fas fa-play-circle w-4 h-4 mr-1.5"></i>
                Live
              </Link>
              
              {(userRole === 'admin' || userRole === 'editor') && (
                <Link to="/admin/templates" className={getLinkClasses('/admin/templates')}>
                  <i className="fas fa-layer-group w-4 h-4 mr-1.5"></i>
                  Templates
                </Link>
              )}
              
              {/* Help, Database connection indicator + Auth controls */}
              <div className="ml-2 flex items-center space-x-2">
                <Tooltip content="Help & Documentation">
                  <Link 
                    to="/help" 
                    className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                  >
                    <i className="fas fa-question-circle text-lg"></i>
                  </Link>
                </Tooltip>
                
                {/* Only show database status to authenticated users */}
                {isAuthenticated && (
                  <DatabaseStatusDropdown 
                    isConnected={isConnected}
                    connectionError={connectionError}
                    resetConnection={resetConnection}
                    isAdmin={isAdmin}
                  />
                )}

                {/* Login/Logout buttons */}
                {isAuthenticated ? (
                  <UserDropdown />
                ) : (
                  <button
                    onClick={() => {
                      // Trigger login dialog
                      const event = new KeyboardEvent('keydown', {
                        key: 'i',
                        code: 'KeyI',
                        ctrlKey: true,
                        shiftKey: true,
                        bubbles: true,
                      });
                      window.dispatchEvent(event);
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 rounded-md transition-colors"
                    title="Sign in"
                  >
                    <i className="fas fa-sign-in-alt w-4 h-4 mr-1.5"></i>
                    Sign In
                  </button>
                )}
              </div>
            </nav>

            {/* Mobile menu - hamburger menu only */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <i className="fas fa-times text-2xl"></i>
                ) : (
                  <i className="fas fa-bars text-2xl"></i>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation - Hamburger menu for other items */}
          {isMobileMenuOpen && (
            <nav className="md:hidden py-4 space-y-1 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
              {(userRole === 'admin' || userRole === 'editor') && (
                <Link
                  to="/admin/templates"
                  className={`block ${getLinkClasses('/admin/templates')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <i className="fas fa-layer-group w-5 h-5 mr-2 inline"></i>
                  Templates
                </Link>
              )}
              
              <Link
                to="/help"
                className={`block ${getLinkClasses('/help')}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-question-circle w-5 h-5 mr-2 inline"></i>
                Help
              </Link>
              
              <button
                onClick={handleRefreshLocalCache}
                disabled={clearingCache}
                className={`block w-full text-left ${getLinkClasses('')} ${clearingCache ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fas fa-sync-alt w-5 h-5 mr-2 inline"></i>
                {clearingCache ? 'Refreshing Cache...' : 'Refresh Local Cache'}
              </button>
              
              {/* Database status and Auth controls in mobile menu */}
              <div className="px-3 py-2 space-y-3 border-t border-gray-200 dark:border-gray-700 mt-2 pt-3">
                {/* Database status */}
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <>
                      <i className="fas fa-check-circle w-5 h-5 text-green-600 dark:text-green-400"></i>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Database Connected</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-times-circle w-5 h-5 text-red-600 dark:text-red-400"></i>
                      <button
                        onClick={resetConnection}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        Reconnect Database
                      </button>
                    </>
                  )}
                </div>

                {/* Login/Logout and Role */}
                {isAuthenticated ? (
                  <>
                    {/* Role indicator */}
                    {/* User Info Card */}
                    <div className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="flex-shrink-0">
                          <RoleBadge role={userRole} size="md" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {userName || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {userEmail || 'No email'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Center Access Info */}
                      {(centerIds.length > 0 || editorFor.length > 0) && (
                        <div className="space-y-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-600">
                          {centerIds.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Associated Centers:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <CenterBadges centerIds={centerIds} showAllIfEmpty={false} />
                              </div>
                            </div>
                          )}
                          {editorFor.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Editor For:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <CenterBadges centerIds={editorFor} showAllIfEmpty={false} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Admin Menu Items */}
                      {userRole === 'admin' && (
                        <div className="space-y-1 mb-3">
                          <button
                            onClick={handleShowAdmins}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <i className="fas fa-user-shield w-4 h-4 mr-2"></i>
                            Admins
                          </button>
                          <button
                            onClick={() => {
                              navigate('/admin/centers');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <i className="fas fa-building w-4 h-4 mr-2"></i>
                            Centers
                          </button>
                          <button
                            onClick={() => {
                              navigate('/admin/analytics');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <i className="fas fa-chart-bar w-4 h-4 mr-2"></i>
                            Analytics
                          </button>
                          <button
                            onClick={() => {
                              navigate('/admin/feedback');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <i className="fas fa-comment w-4 h-4 mr-2"></i>
                            Feedback
                          </button>
                        </div>
                      )}
                      
                      {/* Import - Available to editors and admins */}
                      {(userRole === 'admin' || userRole === 'editor') && (
                        <div className="space-y-1 mb-3">
                          <button
                            onClick={() => {
                              navigate('/admin/import-csv');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <i className="fas fa-file-import w-4 h-4 mr-2"></i>
                            Import Singers & Pitches
                          </button>
                        </div>
                      )}
                      
                      {/* Logout button */}
                      <button
                        onClick={async () => {
                          await logout();
                          navigate('/');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors border border-gray-300 dark:border-gray-600"
                      >
                        <i className="fas fa-sign-out-alt w-4 h-4 mr-1.5"></i>
                        Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      const event = new KeyboardEvent('keydown', {
                        key: 'i',
                        code: 'KeyI',
                        ctrlKey: true,
                        shiftKey: true,
                        bubbles: true,
                      });
                      window.dispatchEvent(event);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 rounded-md transition-colors"
                  >
                    <i className="fas fa-sign-in-alt w-4 h-4 mr-1.5"></i>
                    Sign In
                  </button>
                )}
              </div>
              
              {/* Version display */}
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 mt-2 pt-3">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Version {import.meta.env.VITE_APP_VERSION || 'dev'}
                </p>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto py-2 sm:py-4 md:py-6 lg:py-8 px-2 sm:px-6 lg:px-8 pb-24 md:pb-2">
        {children}
      </main>

      {/* Mobile Bottom Navigation - Songs, Singers, Pitches, Live buttons */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-30">
        <div className="flex items-center justify-around h-10 py-0.5">
          {/* Songs */}
          <Link
            to="/admin/songs"
            className={`flex flex-col items-center justify-center gap-0 px-2 py-0.5 transition-colors flex-1 ${
              isActive('/admin/songs')
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <SongIcon />
            <span className="text-[9px] font-medium leading-none">Songs</span>
          </Link>
          
          {/* Singers and Pitches tabs visible to all authenticated users */}
          {isAuthenticated && (
            <>
              <Link
                to="/admin/singers"
                className={`flex flex-col items-center justify-center gap-0 px-2 py-0.5 transition-colors flex-1 ${
                  isActive('/admin/singers')
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-users text-lg"></i>
                <span className="text-[9px] font-medium leading-none">Singers</span>
              </Link>
              <Link
                to="/admin/pitches"
                className={`flex flex-col items-center justify-center gap-0 px-2 py-0.5 transition-colors flex-1 ${
                  isActive('/admin/pitches')
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <MusicIcon className="w-5 h-5" />
                <span className="text-[9px] font-medium leading-none">Pitches</span>
              </Link>
            </>
          )}
          
          {/* Live */}
          <Link
            to="/session"
            className={`flex flex-col items-center justify-center gap-0 px-2 py-0.5 transition-colors flex-1 ${
              isActive('/session')
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <i className="fas fa-play-circle text-lg"></i>
            <span className="text-[9px] font-medium leading-none">Live</span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto hidden md:block">
        <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Sai Songs © {new Date().getFullYear()}
          </p>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-1">
            Thanks 🙏 to sairhythms for Songs and Metadata.
          </p>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-1">
            v{import.meta.env.VITE_APP_VERSION || 'dev'}
          </p>
        </div>
      </footer>

      {/* Feedback Button - Almost Hidden */}
      <Tooltip content="Send feedback, report bugs, or request new features">
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="fixed bottom-20 md:bottom-4 right-4 w-10 h-10 rounded-full bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500 text-white shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 z-30"
          aria-label="Send feedback"
        >
          <i className="fas fa-comment text-lg mx-auto"></i>
        </button>
      </Tooltip>

      {/* Feedback Drawer */}
      <FeedbackDrawer isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      {/* Admins Modal */}
      <Modal
        isOpen={showAdminsModal}
        onClose={() => setShowAdminsModal(false)}
        title="System Administrators"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Users with full administrative access to the system.
          </p>
          
          {loadingAdmins ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No administrators found.
            </div>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                    <i className="fas fa-user-shield"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {admin.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {admin.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Total: {admins.length} administrator{admins.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
