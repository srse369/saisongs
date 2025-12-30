import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../../services/ApiClient';

// Cache health stats for 60 seconds
let healthStatsCache: { stats: any; timestamp: number } | null = null;
const HEALTH_STATS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

// Cache Brevo status for 60 seconds (changes less frequently)
let brevoStatusCache: { status: any; timestamp: number } | null = null;
const BREVO_STATUS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

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
  const [clearingLocalStorage, setClearingLocalStorage] = useState(false);
  const [localStorageMessage, setLocalStorageMessage] = useState<string | null>(null);
  const [lastLocalStorageClear, setLastLocalStorageClear] = useState<number | null>(() => {
    const saved = localStorage.getItem('lastLocalStorageClear');
    return saved ? parseInt(saved, 10) : null;
  });
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
        // Check cache first
        if (healthStatsCache && Date.now() - healthStatsCache.timestamp < HEALTH_STATS_CACHE_TTL_MS) {
          setStats(healthStatsCache.stats);
          return;
        }

        setLoading(true);
        setStatsError(null);
        try {
          const response = await apiClient.get<any>('/health?stats=true');
          if (response && response.stats) {
            // Cache the stats
            healthStatsCache = {
              stats: response.stats,
              timestamp: Date.now()
            };
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
        // Check cache first
        if (brevoStatusCache && Date.now() - brevoStatusCache.timestamp < BREVO_STATUS_CACHE_TTL_MS) {
          setBrevoStatus(brevoStatusCache.status);
          return;
        }

        setBrevoLoading(true);
        try {
          const response = await apiClient.get<BrevoStatus>('/health/brevo');
          // Cache the status
          brevoStatusCache = {
            status: response,
            timestamp: Date.now()
          };
          setBrevoStatus(response);
        } catch (error) {
          console.error('Failed to fetch Brevo status:', error);
          const errorStatus = {
            status: 'error' as const,
            message: error instanceof Error ? error.message : 'Failed to check status',
            configured: false
          };
          // Don't cache errors
          setBrevoStatus(errorStatus);
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
      // Invalidate health stats cache
      healthStatsCache = null;
      // Refresh stats after reload
      setStats(null);
      setStatsError(null);
      // Fetch fresh stats
      const healthResponse = await apiClient.get<any>('/health?stats=true');
      if (healthResponse && healthResponse.stats) {
        // Cache the fresh stats
        healthStatsCache = {
          stats: healthResponse.stats,
          timestamp: Date.now()
        };
        setStats(healthResponse.stats);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to reload cache';
      setReloadMessage(`Error: ${errorMsg}`);
    } finally {
      setReloadingCache(false);
    }
  };

  const handleClearLocalStorage = async () => {
    // Check cooldown (2 minutes = 120000ms)
    const now = Date.now();
    const cooldownMs = 2 * 60 * 1000; // 2 minutes
    
    if (lastLocalStorageClear && now - lastLocalStorageClear < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (now - lastLocalStorageClear)) / 1000);
      setLocalStorageMessage(`Please wait ${remainingSeconds} seconds before clearing again`);
      setTimeout(() => setLocalStorageMessage(null), 3000);
      return;
    }

    if (!confirm('Clear web page, JavaScript, and CSS cache? This will fetch fresh HTML/JS/CSS but preserve image caches.')) {
      return;
    }

    setClearingLocalStorage(true);
    setLocalStorageMessage(null);
    
    try {
      // Clear app-specific localStorage caches
      const cacheKeys = [
        'saiSongs:songsCache',
        'saiSongs:singersCache',
        'saiSongs:pitchesCache',
        'saiSongs:templatesCache',
        'saiSongs:centersCache',
        'selectedSessionTemplateId', // Session template selection
        'saisongs-template-clipboard-v2', // Template editor clipboard
      ];
      
      cacheKeys.forEach(key => {
        window.localStorage.removeItem(key);
      });
      
      // Clear service worker caches for HTML, JavaScript, and CSS files (preserve images)
      if ('caches' in window && 'serviceWorker' in navigator) {
        try {
          const cacheNames = await caches.keys();
          const htmlPaths = ['/', '/index.html', '/help'];
          
          for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            
            // Delete HTML, JavaScript, and CSS files, preserve images
            for (const request of requests) {
              const url = new URL(request.url);
              const pathname = url.pathname;
              
              // Check if this is an HTML, JavaScript, or CSS file
              const isHtml = htmlPaths.includes(pathname) || pathname.endsWith('.html');
              const isJs = pathname.endsWith('.js') || pathname.endsWith('.mjs');
              const isCss = pathname.endsWith('.css');
              
              // Delete HTML, JS, and CSS files, preserve images and other assets
              if (isHtml || isJs || isCss) {
                await cache.delete(request);
              }
            }
          }
        } catch (swError) {
          // Service worker cache clearing is optional, don't fail if it errors
          console.warn('Could not clear service worker cache:', swError);
        }
      }
      
      // Update last clear timestamp
      const timestamp = Date.now();
      setLastLocalStorageClear(timestamp);
      localStorage.setItem('lastLocalStorageClear', timestamp.toString());
      
      setLocalStorageMessage('Web page, JavaScript, and CSS cache cleared! Reloading...');
      
      // Reload page with cache-busting query parameter to force fresh HTML, JS, and CSS
      // Images will still use their cached versions (1 year cache)
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('_nocache', timestamp.toString());
        window.location.href = url.toString();
      }, 1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to clear cache';
      setLocalStorageMessage(`Error: ${errorMsg}`);
      setClearingLocalStorage(false);
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
          <i className="fas fa-check-circle text-lg"></i>
        ) : (
          <i className="fas fa-times-circle text-lg"></i>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <i className="fas fa-database text-lg text-green-600 dark:text-green-400"></i>
              ) : (
                <i className="fas fa-database text-lg text-red-600 dark:text-red-400"></i>
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
                    <i className="fas fa-spinner fa-spin text-xl text-blue-600 dark:text-blue-400"></i>
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
                      <i className="fas fa-spinner fa-spin text-base text-blue-600 dark:text-blue-400"></i>
                    </div>
                  ) : brevoStatus ? (
                    <div className="flex items-center space-x-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                      {brevoStatus.status === 'ok' ? (
                        <>
                          <i className="fas fa-check-circle text-base text-green-600 dark:text-green-400"></i>
                          <span className="text-sm text-green-700 dark:text-green-300 font-medium">Connected</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-times-circle text-base text-red-600 dark:text-red-400"></i>
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
                
                {/* Clear Local Storage Button (All Users) */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleClearLocalStorage}
                    disabled={clearingLocalStorage}
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {clearingLocalStorage ? (
                      <>
                        <i className="fas fa-spinner fa-spin text-base mr-2"></i>
                        Clearing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-trash-alt text-base mr-2"></i>
                        Clear Local Cache
                      </>
                    )}
                  </button>
                  {localStorageMessage && (
                    <p className={`mt-2 text-xs text-center ${
                      localStorageMessage.startsWith('Error') || localStorageMessage.startsWith('Please wait')
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {localStorageMessage}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
                    Clears web page (HTML), JavaScript, CSS cache, and localStorage data. Preserves images. 2-minute cooldown.
                  </p>
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
                          <i className="fas fa-spinner fa-spin text-base mr-2"></i>
                          Reloading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-sync text-base mr-2"></i>
                          Reload Backend Cache
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
                  <i className="fas fa-sync text-base mr-2"></i>
                  Retry Connection
                </button>
              </>
            )}
            
            {/* Release Version */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Version:</span>
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {import.meta.env.VITE_APP_VERSION || 'dev'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
