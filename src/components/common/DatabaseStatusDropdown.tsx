import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../../services/ApiClient';
import { clearAllCaches, checkCacheClearCooldown, CACHE_KEYS, getCacheItem, getBrowserCacheEntityCounts } from '../../utils/cacheUtils';
import { takeOfflineIfNeeded, getLastOfflineDownloadTime } from '../../utils/offlineDownload';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { usePitches } from '../../contexts/PitchContext';
import { useTemplates } from '../../contexts/TemplateContext';
import { useToast } from '../../contexts/ToastContext';
import { useOfflineSyncContext } from '../../contexts/OfflineSyncContext';
import { getPendingCount } from '../../utils/offlineQueue';

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
  isAuthenticated?: boolean;
  /** Show Take Offline button (editors and admins only) */
  canTakeOffline?: boolean;
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
  isAuthenticated = false,
  canTakeOffline = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [reloadingBackendCache, setReloadingBackendCache] = useState(false);
  const [reloadMessage, setReloadMessage] = useState<string | null>(null);
  const [clearingLocalStorage, setClearingLocalStorage] = useState(false);
  const [localStorageMessage, setLocalStorageMessage] = useState<string | null>(null);
  const [lastLocalStorageClear, setLastLocalStorageClear] = useState<number | null>(null);
  const [brevoStatus, setBrevoStatus] = useState<BrevoStatus | null>(null);
  const [brevoLoading, setBrevoLoading] = useState(false);
  const [takingOffline, setTakingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<string | null>(null);
  const [lastOfflineTime, setLastOfflineTime] = useState<number | null>(null);
  const [cacheCounts, setCacheCounts] = useState<Awaited<ReturnType<typeof getBrowserCacheEntityCounts>> | null>(null);
  const [lyricsLoadedTrigger, setLyricsLoadedTrigger] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { fetchSongs } = useSongs();
  const { fetchSingers } = useSingers();
  const { fetchAllPitches } = usePitches();
  const { fetchTemplates } = useTemplates();
  const toast = useToast();
  const { setShowSyncModal } = useOfflineSyncContext();
  const pendingCount = getPendingCount();

  // Load lastOfflineTime and lastLocalStorageClear on mount
  useEffect(() => {
    getLastOfflineDownloadTime().then(setLastOfflineTime);
    getCacheItem(CACHE_KEYS.LAST_LOCAL_STORAGE_CLEAR).then((saved) => {
      setLastLocalStorageClear(saved ? parseInt(saved, 10) : null);
    });
  }, []);

  // Load cache counts when dropdown opens
  useEffect(() => {
    if (isOpen) {
      getBrowserCacheEntityCounts().then(setCacheCounts);
    }
  }, [isOpen, lyricsLoadedTrigger]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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

  const handleReloadBackendCache = async () => {
    setReloadingBackendCache(true);
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
      setReloadingBackendCache(false);
    }
  };

  const handleClearLocalStorage = async () => {
    // Check cooldown
    const cooldown = checkCacheClearCooldown();
    if (cooldown.isOnCooldown) {
      setLocalStorageMessage(`Please wait ${cooldown.remainingSeconds} seconds before clearing again`);
      setTimeout(() => setLocalStorageMessage(null), 3000);
      return;
    }

    if (!confirm('Clear web page, JavaScript, and CSS cache? This will fetch fresh HTML/JS/CSS but preserve image caches.')) {
      return;
    }

    setClearingLocalStorage(true);
    setLocalStorageMessage(null);

    try {
      await clearAllCaches({
        clearServiceWorkerCache: true,
        reload: true,
        reloadParam: '_nocache',
        reloadDelay: 1500,
        updateLastClearTimestamp: true,
      });

      // Update local state for cooldown tracking
      const timestamp = Date.now();
      setLastLocalStorageClear(timestamp);

      setLocalStorageMessage('Web page, JavaScript, and CSS cache cleared! Reloading...');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to clear cache';
      setLocalStorageMessage(`Error: ${errorMsg}`);
      setClearingLocalStorage(false);
    }
  };

  const handleTakeOffline = async () => {
    setTakingOffline(true);
    setOfflineProgress('Checking...');
    try {
      const { skipped, result } = await takeOfflineIfNeeded((progress) => {
        setOfflineProgress(progress.message);
      });
      if (result.success) {
        if (skipped) {
          toast.success('Already have all data offline. No download needed.');
        } else {
          toast.success(
            `Downloaded ${result.songsCount} songs, ${result.singersCount} singers, ${result.pitchesCount} pitches, ${result.templatesCount} templates, ${result.sessionsCount} sessions, ${result.centersCount} centers for offline use.`
          );
          getLastOfflineDownloadTime().then(setLastOfflineTime);
          // Refresh status dropdown cache counts (songs with lyrics, etc.)
          window.dispatchEvent(new CustomEvent('songsLyricsLoaded'));
        }
        fetchSongs(false);
        if (isAuthenticated) {
          fetchSingers(false);
          fetchAllPitches(false);
          fetchTemplates(false);
        }
      } else {
        toast.error(result.error || 'Failed to download for offline');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to download for offline';
      toast.error(msg);
    } finally {
      setTakingOffline(false);
      setOfflineProgress(null);
    }
  };

  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show red icon when offline OR database disconnected
  const showRedStatus = !isOnline || !isConnected;

  // Refresh cache counts when songsLyricsLoaded fires (lyrics loaded in background)
  useEffect(() => {
    const handler = () => setLyricsLoadedTrigger((n) => n + 1);
    window.addEventListener('songsLyricsLoaded', handler);
    return () => window.removeEventListener('songsLyricsLoaded', handler);
  }, []);
  const counts = cacheCounts ?? { songs: 0, singers: 0, pitches: 0, templates: 0, sessions: 0, centers: 0 };
  const songsWithLyrics = cacheCounts?.songsWithLyrics ?? 0;
  const templatesWithSlides = cacheCounts?.templatesWithSlides ?? 0;
  const hasAnyCache = (counts.songs > 0 || counts.singers > 0 || counts.pitches > 0 || counts.templates > 0 || counts.sessions > 0 || counts.centers > 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Status Icon Button - orange when offline or database disconnected, pulsing when offline */}
      <button
        onClick={handleToggle}
        className={`flex flex-col items-center gap-0.5 p-2 rounded-full transition-all duration-200 ${showRedStatus
            ? 'text-[rgb(227,74,16)] dark:text-[rgb(227,74,16)] hover:bg-[rgba(227,74,16,0.08)] dark:hover:bg-[rgba(227,74,16,0.15)]'
            : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
          }`}
        title={!isOnline ? 'Offline - Showing cached data' : isConnected ? 'Database connected - Click for details' : 'Database disconnected - Click for details'}
      >
        {showRedStatus ? (
          <i className={`fas fa-times-circle text-lg ${!isOnline ? 'animate-status-pulse' : ''}`}></i>
        ) : (
          <i className="fas fa-check-circle text-lg"></i>
        )}
        <span className="text-[10px] leading-none opacity-80">{isOnline ? 'Online' : 'Offline'}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Content */}
          <div className="px-4 py-3">
            {/* 1. Browser cache section - shown for both connected and disconnected */}
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <i className="fas fa-database text-gray-500"></i>
                Browser cache (offline data):
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-600 dark:text-gray-400">Centers:</span>
                    <span className={`font-medium ${counts.centers > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{counts.centers}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-600 dark:text-gray-400">Songs:</span>
                    <span className={`font-medium ${counts.songs > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {counts.songs}
                      {counts.songs > 0 && (
                        <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                          ({songsWithLyrics} w/ lyrics)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-600 dark:text-gray-400">Singers:</span>
                    <span className={`font-medium ${counts.singers > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{counts.singers}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-600 dark:text-gray-400">Pitches:</span>
                    <span className={`font-medium ${counts.pitches > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{counts.pitches}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-600 dark:text-gray-400">Templates:</span>
                    <span className={`font-medium ${counts.templates > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {counts.templates}
                      {counts.templates > 0 && (
                        <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                          ({templatesWithSlides} w/ slides)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-600 dark:text-gray-400">Sessions:</span>
                    <span className={`font-medium ${counts.sessions > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{counts.sessions}</span>
                  </div>
                </div>
              {!hasAnyCache && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  No offline data. Use &quot;Take Offline&quot; when connected to download.
                </p>
              )}
            </div>

            {/* 2. Database connection status */}
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
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

            {/* 3. Others */}
            {isConnected ? (
              <>
                {isAuthenticated && loading ? (
                  <div className="flex items-center justify-center py-4">
                    <i className="fas fa-spinner fa-spin text-xl text-blue-600 dark:text-blue-400"></i>
                  </div>
                ) : isAuthenticated && stats ? (
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
                ) : isAuthenticated ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="mb-2">Unable to load statistics</p>
                    {statsError && (
                      <p className="text-xs text-red-600 dark:text-red-400 break-words">
                        {statsError}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Brevo API Status */}
                {isAuthenticated && (
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
                )}

                {/* Sync Offline Changes (when pending) */}
                {pendingCount > 0 && (
                <div className={`${isAuthenticated && 'mt-4 pt-4 border-t'} border-gray-200 dark:border-gray-700`}>
                  <button
                    onClick={() => { setShowSyncModal(true); setIsOpen(false); }}
                    title="Review and sync offline changes"
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 rounded-md transition-colors mb-3"
                  >
                    <i className="fas fa-cloud-upload-alt text-base mr-2"></i>
                    Sync {pendingCount} offline change{pendingCount !== 1 ? 's' : ''}
                  </button>
                </div>
                )}

                {/* Take Offline Button (Editors and Admins only) */}
                {canTakeOffline && (
                <div className={`${isAuthenticated && 'mt-4 pt-4 border-t'} border-gray-200 dark:border-gray-700`}>
                  <button
                    onClick={handleTakeOffline}
                    disabled={takingOffline || !isOnline}
                    title={!isOnline ? 'Connect to the internet to download for offline' : 'Download all song details for offline use'}
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                  >
                    {takingOffline ? (
                      <>
                        <i className="fas fa-spinner fa-spin text-base mr-2"></i>
                        <span className="truncate">{offlineProgress || 'Downloading...'}</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-download text-base mr-2"></i>
                        Take Offline
                      </>
                    )}
                  </button>
                  {lastOfflineTime && !takingOffline && (
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-3">
                      Last downloaded: {new Date(lastOfflineTime).toLocaleString()}
                    </p>
                  )}
                </div>
                )}

                {/* Clear Local Storage Button (All Users) */}
                <div className="border-gray-200 dark:border-gray-700">
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
                    <p className={`mt-2 text-xs text-center ${localStorageMessage.startsWith('Error') || localStorageMessage.startsWith('Please wait')
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
                      onClick={handleReloadBackendCache}
                      disabled={reloadingBackendCache}
                      className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reloadingBackendCache ? (
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
                      <p className={`mt-2 text-xs text-center ${reloadMessage.startsWith('Error')
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
