import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../../services/ApiClient';

interface DatabaseStatusDropdownProps {
  isConnected: boolean;
  connectionError: string | null;
  resetConnection: () => Promise<void>;
  isAdmin?: boolean;
}

interface DatabaseStats {
  centers: number;
  songs: number;
  users: number;
  pitches: number;
  templates: number;
  sessions: number;
}

interface BrevoStatus {
  status: 'ok' | 'error';
  message?: string;
  configured: boolean;
}

export const DatabaseStatusDropdown: React.FC<DatabaseStatusDropdownProps> = ({
  isConnected,
  connectionError,
  resetConnection,
  isAdmin = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [reloadingCache, setReloadingCache] = useState(false);
  const [reloadMessage, setReloadMessage] = useState<string | null>(null);
  const [brevoStatus, setBrevoStatus] = useState<BrevoStatus | null>(null);
  const [brevoLoading, setBrevoLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch stats and Brevo status when dropdown opens
  useEffect(() => {
    const fetchStats = async () => {
      if (isOpen && isConnected && !stats) {
        setLoading(true);
        setStatsError(null);
        try {
          const response = await apiClient.get<any>('/health?stats=true');
          if (response && response.stats) {
            setStats(response.stats);
          } else if (response && response.statsError) {
            setStatsError(response.statsError);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to fetch statistics';
          console.error('Failed to fetch database stats:', errorMsg);
          setStatsError(errorMsg);
        } finally {
          setLoading(false);
        }
      }
    };

    const fetchBrevoStatus = async () => {
      if (isOpen && !brevoStatus) {
        setBrevoLoading(true);
        try {
          const response = await apiClient.get<BrevoStatus>('/health/brevo');
          setBrevoStatus(response);
        } catch (error) {
          console.error('Failed to fetch Brevo status:', error);
          setBrevoStatus({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to check status',
            configured: false
          });
        } finally {
          setBrevoLoading(false);
        }
      }
    };

    fetchStats();
    fetchBrevoStatus();
  }, [isOpen, isConnected, stats, brevoStatus]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    // Reset stats when opening to fetch fresh data
    if (!isOpen) {
      setStats(null);
      setStatsError(null);
      setReloadMessage(null);
      setBrevoStatus(null);
    }
  };

  const handleReloadCache = async () => {
    setReloadingCache(true);
    setReloadMessage(null);
    try {
      const response = await apiClient.post('/cache/reload');
      setReloadMessage('Cache reloaded successfully!');
      // Refresh stats after reload
      setStats(null);
      setStatsError(null);
      // Fetch fresh stats
      const healthResponse = await apiClient.get<any>('/health?stats=true');
      if (healthResponse && healthResponse.stats) {
        setStats(healthResponse.stats);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to reload cache';
      setReloadMessage(`Error: ${errorMsg}`);
    } finally {
      setReloadingCache(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Status Icon Button */}
      <button
        onClick={handleToggle}
        className={`p-2 rounded-full transition-all duration-200 ${
          isConnected
            ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
            : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
        }`}
        title={isConnected ? 'Database connected - Click for details' : 'Database disconnected - Click for details'}
      >
        {isConnected ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                  <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                  <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                  <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                  <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
                </svg>
              )}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {isConnected ? 'Database Connected' : 'Database Disconnected'}
              </h3>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-3">
            {isConnected ? (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : stats ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Database Statistics:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Centers:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.centers}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Songs:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.songs}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Users:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.users}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Pitches:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.pitches}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Templates:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.templates}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Sessions:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.sessions}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="mb-2">Unable to load statistics</p>
                    {statsError && (
                      <p className="text-xs text-red-600 dark:text-red-400 break-words">
                        {statsError}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Brevo API Status */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Email Service (Brevo):</p>
                  {brevoLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <svg className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : brevoStatus ? (
                    <div className="flex items-center space-x-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                      {brevoStatus.status === 'ok' ? (
                        <>
                          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-green-700 dark:text-green-300 font-medium">Connected</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                              {brevoStatus.configured ? 'Error' : 'Not Configured'}
                            </span>
                            {brevoStatus.message && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-words">
                                {brevoStatus.message}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                
                {/* Reload Cache Button (Admin Only) */}
                {isAdmin && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleReloadCache}
                      disabled={reloadingCache}
                      className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reloadingCache ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Reloading...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reload Cache
                        </>
                      )}
                    </button>
                    {reloadMessage && (
                      <p className={`mt-2 text-xs text-center ${
                        reloadMessage.startsWith('Error') 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {reloadMessage}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Error Details:</p>
                  <p className="text-sm text-red-600 dark:text-red-400 break-words">
                    {connectionError || 'Unable to connect to database'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetConnection();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry Connection
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
