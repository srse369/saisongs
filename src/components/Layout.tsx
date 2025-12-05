import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useAuth } from '../contexts/AuthContext';
import { MusicIcon, SongIcon, RoleBadge, UserDropdown, DatabaseStatusDropdown, CenterBadges } from './common';
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
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Singers
                  </Link>
                  <Link to="/admin/pitches" className={getLinkClasses('/admin/pitches')}>
                    <MusicIcon className="w-4 h-4 mr-1.5" />
                    Pitches
                  </Link>
                </>
              )}
              
              <Link to="/session" className={getLinkClasses('/session')}>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Live
              </Link>
              
              {(userRole === 'admin' || userRole === 'editor') && (
                <Link to="/admin/templates" className={getLinkClasses('/admin/templates')}>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-21h10a2 2 0 012 2v14a2 2 0 01-2 2m-10-21v21m0-21H9m10 0h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m0-21v21m0-21H9" />
                  </svg>
                  Templates
                </Link>
              )}
              
              {/* Database connection indicator + Auth controls */}
              <div className="ml-2 flex items-center space-x-2">
                <DatabaseStatusDropdown 
                  isConnected={isConnected}
                  connectionError={connectionError}
                  resetConnection={resetConnection}
                  isAdmin={isAdmin}
                />

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
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
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
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
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
                    <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
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
                <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Live Session
              </Link>
              
              {(userRole === 'admin' || userRole === 'editor') && (
                <Link
                  to="/admin/templates"
                  className={`block ${getLinkClasses('/admin/templates')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-21h10a2 2 0 012 2v14a2 2 0 01-2 2m-10-21v21m0-21H9m10 0h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m0-21v21m0-21H9" />
                  </svg>
                  Templates
                </Link>
              )}
              
              {/* Database status and Auth controls in mobile menu */}
              <div className="px-3 py-2 space-y-3 border-t border-gray-200 dark:border-gray-700 mt-2 pt-3">
                {/* Database status */}
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <>
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Database Connected</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
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
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Centers
                          </button>
                          <button
                            onClick={() => {
                              navigate('/admin/analytics');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Analytics
                          </button>
                          <button
                            onClick={() => {
                              navigate('/admin/feedback');
                              setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
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
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
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
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
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
      <button
        onClick={() => setIsFeedbackOpen(true)}
        className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500 text-white shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        title="Send feedback"
        aria-label="Send feedback"
      >
        <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </button>

      {/* Feedback Drawer */}
      <FeedbackDrawer isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
};
