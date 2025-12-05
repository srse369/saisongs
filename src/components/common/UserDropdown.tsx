import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBadge } from './RoleBadge';

interface Center {
  id: number;
  name: string;
  badge_text_color: string;
}

export const UserDropdown: React.FC = () => {
  const { userName, userEmail, userRole, centerIds, editorFor, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch centers on mount
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const response = await fetch('/api/centers', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setCenters(data);
        }
      } catch (error) {
        console.error('Error fetching centers:', error);
      }
    };
    
    if (userRole !== 'public') {
      fetchCenters();
    }
  }, [userRole]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    navigate('/');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  // Get profile icon (same for all users)
  const getProfileIcon = () => {
    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    );
  };

  // Get role color classes
  const getRoleColorClasses = () => {
    switch (userRole) {
      case 'admin':
        return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30';
      case 'editor':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30';
      case 'viewer':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/30';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full transition-all duration-200 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/30"
        title={`${userName || 'User'}`}
      >
        {getProfileIcon()}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-full text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20">
                {getProfileIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {userName || 'Unknown User'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={userEmail || ''}>
                  {userEmail || 'No email'}
                </p>
              </div>
            </div>
            
            {/* Role and Center Access Info */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
              {/* Admin Status */}
              <div>
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Admin:</span>{' '}
                  {userRole === 'admin' ? (
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Yes</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-500">No</span>
                  )}
                </p>
              </div>
              
              {/* Editor For */}
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Editor For:
                </p>
                {userRole === 'admin' ? (
                  <span className="text-xs text-gray-600 dark:text-gray-400 italic">All</span>
                ) : editorFor.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {editorFor.map(centerId => {
                      const center = centers.find(c => c.id === centerId);
                      return center ? (
                        <span
                          key={centerId}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700"
                          style={{ 
                            color: center.badge_text_color || '#3b82f6'
                          }}
                        >
                          {center.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-500 italic">None</span>
                )}
              </div>
              
              {/* Associated Centers */}
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Associated Centers:
                </p>
                {userRole === 'admin' ? (
                  <span className="text-xs text-gray-600 dark:text-gray-400 italic">All</span>
                ) : centerIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {centerIds.map(centerId => {
                      const center = centers.find(c => c.id === centerId);
                      return center ? (
                        <span
                          key={centerId}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700"
                          style={{ 
                            color: center.badge_text_color || '#10b981'
                          }}
                        >
                          {center.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-500 italic">None</span>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items Section */}
          {userRole === 'admin' && (
            <>
              <div className="py-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleNavigate('/admin/centers')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Centers
                </button>
                <button
                  onClick={() => handleNavigate('/admin/analytics')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Analytics
                </button>
                <button
                  onClick={() => handleNavigate('/admin/feedback')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Feedback
                </button>
              </div>
              
              {/* Import Section */}
              <div className="py-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleNavigate('/admin/import')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M20 4v5h-.581M4 12h16M10 16l2 2 2-2M12 14v4" />
                  </svg>
                  Import Songs
                </button>
                <button
                  onClick={() => handleNavigate('/admin/import-csv')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import Singers & Pitches
                </button>
              </div>
            </>
          )}

          {/* Actions Section */}
          <div className="py-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
