import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useAuth } from '../contexts/AuthContext';
import { MusicIcon, SongIcon, RoleBadge, UserDropdown, DatabaseStatusDropdown, CenterBadges, Tooltip } from './common';
import { FeedbackDrawer } from './common/FeedbackDrawer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { isConnected, connectionError, resetConnection } = useDatabase();
  const { isAuthenticated, userRole, userName, userEmail, logout, centerIds, editorFor, isAdmin } = useAuth();

  // Check if current path matches the link
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center group">
              <img 
                src="/logo.png" 
                alt="Sai Devotional Song Studio" 
                className="h-10 sm:h-12 w-auto object-contain group-hover:scale-105 transition-transform"
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
              
              {/* Database connection indicator + Auth controls */}
              <div className="ml-2 flex items-center space-x-2">
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

            {/* Mobile menu button */}
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

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <nav className="md:hidden py-4 space-y-1 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
              <Link
                to="/admin/songs"
                className={`block ${getLinkClasses('/admin/songs')}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <SongIcon className="w-5 h-5 mr-2 inline" />
                Songs
              </Link>
              
              {/* Singers and Pitches tabs visible to all authenticated users */}
              {isAuthenticated && (
                <>
                  <Link
                    to="/admin/singers"
                    className={`block ${getLinkClasses('/admin/singers')}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <i className="fas fa-users w-5 h-5 mr-2 inline"></i>
                    Singers
                  </Link>
                  <Link
                    to="/admin/pitches"
                    className={`block ${getLinkClasses('/admin/pitches')}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <MusicIcon className="w-5 h-5 mr-2 inline" />
                    Pitches
                  </Link>
                </>
              )}
              
              <Link
                to="/session"
                className={`block ${getLinkClasses('/session')}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-play-circle w-5 h-5 mr-2 inline"></i>
                Live Session
              </Link>
              
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
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Sai Devotional Song Studio © {new Date().getFullYear()}
          </p>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-1">
            Thanks 🙏 to sairhythms for Songs and Metadata.
          </p>
        </div>
      </footer>

      {/* Feedback Button - Almost Hidden */}
      <Tooltip content="Send feedback, report bugs, or request new features">
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500 text-white shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          aria-label="Send feedback"
        >
          <i className="fas fa-comment text-lg mx-auto"></i>
        </button>
      </Tooltip>

      {/* Feedback Drawer */}
      <FeedbackDrawer isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
};
