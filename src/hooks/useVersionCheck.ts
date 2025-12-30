import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/ApiClient';
import { clearAllCaches, CACHE_KEYS } from '../utils/cacheUtils';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

interface HealthResponse {
  status: string;
  version: string;
  timestamp?: string;
}

/**
 * Hook to check for app version updates and automatically clear cache if version changed
 */
export const useVersionCheck = () => {
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  const clearCachesAndReload = async () => {
    try {
      // Update stored version before clearing
      const serverVersion = await fetchServerVersion();
      if (serverVersion) {
        localStorage.setItem(CACHE_KEYS.APP_VERSION, serverVersion);
      }

      // Clear all caches and reload
      await clearAllCaches({
        clearServiceWorkerCache: true,
        reload: true,
        reloadParam: '_v',
        reloadDelay: 0, // No delay for version updates
        updateLastClearTimestamp: false, // Don't update cooldown timestamp for version updates
      });
    } catch (error) {
      console.error('Error clearing caches for version update:', error);
      // Still reload even if cache clearing fails
      window.location.reload();
    }
  };

  const fetchServerVersion = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store', // Always fetch fresh version
      });

      if (!response.ok) {
        return null;
      }

      const data: HealthResponse = await response.json();
      return data.version || null;
    } catch (error) {
      console.warn('Failed to fetch server version:', error);
      return null;
    }
  };

  const checkVersion = async () => {
    // Prevent concurrent checks
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    try {
      const storedVersion = localStorage.getItem(CACHE_KEYS.APP_VERSION);
      const serverVersion = await fetchServerVersion();

      if (!serverVersion) {
        // If we can't fetch server version, skip check
        isCheckingRef.current = false;
        return;
      }

      // If this is the first time, just store the version
      if (!storedVersion) {
        localStorage.setItem(CACHE_KEYS.APP_VERSION, serverVersion);
        isCheckingRef.current = false;
        return;
      }

      // Only check if stored version differs from server version
      // We compare stored (what user last saw) vs server (what's currently deployed)
      // Browser version from build time is irrelevant - it's just metadata
      const versionChanged = storedVersion !== serverVersion;

      if (versionChanged) {
        console.log(`Version update detected: ${storedVersion} → ${serverVersion}`);
        console.log('Clearing caches and reloading...');
        
        // Clear caches and reload
        await clearCachesAndReload();
      } else {
        isCheckingRef.current = false;
      }
    } catch (error) {
      console.error('Error checking version:', error);
      isCheckingRef.current = false;
    }
  };

  useEffect(() => {
    // Check version on mount
    checkVersion();

    // Set up periodic checks
    checkIntervalRef.current = setInterval(() => {
      checkVersion();
    }, VERSION_CHECK_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []); // Only run on mount
};

