import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBadge } from './RoleBadge';
import { fetchCentersOnce } from './CenterBadges';

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

  // Fetch centers on mount using cached fetch
  useEffect(() => {
    if (userRole !== 'public') {
      fetchCentersOnce().then(data => {
        setCenters(data);
      }).catch(error => {
        console.error('Error fetching centers:', error);
      });
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
      <i className="fas fa-user-circle text-2xl"></i>
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
                  <i className="fas fa-building w-4 h-4 mr-3"></i>
                  Centers
                </button>
                <button
                  onClick={() => handleNavigate('/admin/analytics')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <i className="fas fa-chart-bar w-4 h-4 mr-3"></i>
                  Analytics
                </button>
                <button
                  onClick={() => handleNavigate('/admin/feedback')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <i className="fas fa-comment w-4 h-4 mr-3"></i>
                  Feedback
                </button>
              </div>
              
              {/* Import Section */}
              <div className="py-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleNavigate('/admin/import')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <i className="fas fa-download w-4 h-4 mr-3"></i>
                  Import Songs
                </button>
                <button
                  onClick={() => handleNavigate('/admin/import-csv')}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <i className="fas fa-file-import w-4 h-4 mr-3"></i>
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
              <i className="fas fa-sign-out-alt w-4 h-4 mr-3"></i>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
