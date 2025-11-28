import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useAuth } from '../contexts/AuthContext';
import { MusicIcon, SongIcon } from './common';
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
  const { isAuthenticated, userRole, logout, downgradeRole } = useAuth();

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
              <Link to="/" className={getLinkClasses('/')}>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </Link>
              <Link to="/admin/songs" className={getLinkClasses('/admin/songs')}>
                <SongIcon className="w-4 h-4 mr-1.5" />
                Songs
              </Link>
              
              {/* Singers and Pitches tabs only visible when authenticated */}
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
                  <Link to="/admin/templates" className={getLinkClasses('/admin/templates')}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-21h10a2 2 0 012 2v14a2 2 0 01-2 2m-10-21v21m0-21H9m10 0h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m0-21v21m0-21H9" />
                    </svg>
                    Templates
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
              
              {/* Analytics tab - Admin only */}
              {userRole === 'admin' && (
                <>
                  <Link to="/admin/analytics" className={getLinkClasses('/admin/analytics')}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Analytics
                  </Link>
                  <Link to="/admin/feedback" className={getLinkClasses('/admin/feedback')}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Feedback
                  </Link>
                </>
              )}
              
              {/* Database connection indicator + Admin mode indicator */}
              <div className="ml-2 flex items-center space-x-2">
                {isConnected ? (
                  <div className="flex items-center text-green-600 dark:text-green-400" title="Database connected">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <button
                    onClick={resetConnection}
                    className="flex items-center text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                    title={connectionError || 'Database disconnected - Click to reconnect'}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}

                {/* Role indicator */}
                <button
                  type="button"
                  onClick={() => {
                    if (isAuthenticated) {
                      // Cycle down one role: admin → editor → viewer → public
                      downgradeRole();
                      // Navigate to home page after role change
                      navigate('/');
                    } else {
                      // In public mode: open password dialog to login
                      const event = new KeyboardEvent('keydown', {
                        key: 'i',
                        code: 'KeyI',
                        ctrlKey: true,
                        shiftKey: true,
                        bubbles: true,
                      });
                      window.dispatchEvent(event);
                    }
                  }}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border ${
                    userRole === 'admin'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                      : userRole === 'editor'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : userRole === 'viewer'
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                  title={
                    userRole === 'admin'
                      ? 'Click to downgrade to Editor mode'
                      : userRole === 'editor'
                      ? 'Click to downgrade to Viewer mode'
                      : userRole === 'viewer'
                      ? 'Click to downgrade to Public mode'
                      : 'Click to login'
                  }
                >
                  <svg
                    className={`w-3 h-3 mr-1 ${
                      userRole === 'admin' ? 'text-emerald-600 dark:text-emerald-400' : userRole === 'editor' ? 'text-blue-600 dark:text-blue-400' : userRole === 'viewer' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {userRole === 'admin' ? (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </>
                    ) : userRole === 'editor' ? (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </>
                    ) : (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </>
                    )}
                  </svg>
                  {userRole === 'admin' ? 'Admin' : userRole === 'editor' ? 'Editor' : userRole === 'viewer' ? 'Viewer' : 'Public'}
                </button>
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
                to="/"
                className={`block ${getLinkClasses('/')}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </Link>
              <Link
                to="/admin/songs"
                className={`block ${getLinkClasses('/admin/songs')}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <SongIcon className="w-5 h-5 mr-2 inline" />
                Songs
              </Link>
              
              {/* Singers and Pitches tabs only visible when authenticated */}
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
              
              {/* Analytics tab - Admin only */}
              {userRole === 'admin' && (
                <>
                  <Link
                    to="/admin/analytics"
                    className={`block ${getLinkClasses('/admin/analytics')}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Analytics
                  </Link>
                  <Link
                    to="/admin/feedback"
                    className={`block ${getLinkClasses('/admin/feedback')}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Feedback
                  </Link>
                </>
              )}
              
              {/* Database status and Role indicator in mobile menu */}
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

                {/* Role indicator */}
                <button
                  type="button"
                  onClick={() => {
                    if (isAuthenticated) {
                      downgradeRole();
                      // Navigate to home page after role change
                      navigate('/');
                    } else {
                      const event = new KeyboardEvent('keydown', {
                        key: 'i',
                        code: 'KeyI',
                        ctrlKey: true,
                        shiftKey: true,
                        bubbles: true,
                      });
                      window.dispatchEvent(event);
                    }
                  }}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border ${
                    userRole === 'admin'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                      : userRole === 'editor'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : userRole === 'viewer'
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <svg
                    className={`w-4 h-4 mr-2 ${
                      userRole === 'admin' ? 'text-emerald-600 dark:text-emerald-400' : userRole === 'editor' ? 'text-blue-600 dark:text-blue-400' : userRole === 'viewer' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {userRole === 'admin' ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    ) : userRole === 'editor' ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    ) : (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </>
                    )}
                  </svg>
                  {userRole === 'admin' 
                    ? 'Admin Mode - Tap to downgrade' 
                    : userRole === 'editor' 
                    ? 'Editor Mode - Tap to downgrade' 
                    : userRole === 'viewer'
                    ? 'Viewer Mode - Tap to downgrade'
                    : 'Public Mode - Tap to login'}
                </button>
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
