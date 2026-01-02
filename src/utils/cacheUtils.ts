/**
 * Utility functions for clearing application caches
 * Handles both localStorage and service worker caches
 */

// Common cache keys used across the application
export const CACHE_KEYS = {
  // Legacy keys (songStudio prefix)
  SONG_STUDIO_SONGS: 'songStudio:songsCache',
  SONG_STUDIO_SINGERS: 'songStudio:singersCache',
  SONG_STUDIO_PITCHES: 'songStudio:pitchesCache',
  SONG_STUDIO_TEMPLATES: 'songStudio:templatesCache',
  SONG_STUDIO_CENTERS: 'songStudio:centersCache',
  SONG_STUDIO_APP_VERSION: 'songStudio:appVersion',

  // Current keys (saiSongs prefix)
  SAI_SONGS_SONGS: 'saiSongs:songsCache',
  SAI_SONGS_SINGERS: 'saiSongs:singersCache',
  SAI_SONGS_PITCHES: 'saiSongs:pitchesCache',
  SAI_SONGS_TEMPLATES: 'saiSongs:templatesCache',
  SAI_SONGS_CENTERS: 'saiSongs:centersCache',
  
  // Other app data
  SELECTED_SESSION_TEMPLATE_ID: 'selectedSessionTemplateId',
  TEMPLATE_CLIPBOARD_V1: 'songstudio-template-clipboard',
  TEMPLATE_CLIPBOARD_V2: 'saisongs-template-clipboard-v2',
  
  // Version tracking
  APP_VERSION: 'saiSongs:appVersion',
  LAST_LOCAL_STORAGE_CLEAR: 'lastLocalStorageClear',
} as const;

/**
 * All cache keys that should be cleared
 */
export const ALL_CACHE_KEYS = [
  CACHE_KEYS.SONG_STUDIO_SONGS,
  CACHE_KEYS.SONG_STUDIO_SINGERS,
  CACHE_KEYS.SONG_STUDIO_PITCHES,
  CACHE_KEYS.SONG_STUDIO_TEMPLATES,
  CACHE_KEYS.SONG_STUDIO_CENTERS,
  CACHE_KEYS.SONG_STUDIO_APP_VERSION,
  CACHE_KEYS.SAI_SONGS_SONGS,
  CACHE_KEYS.SAI_SONGS_SINGERS,
  CACHE_KEYS.SAI_SONGS_PITCHES,
  CACHE_KEYS.SAI_SONGS_TEMPLATES,  
  CACHE_KEYS.SAI_SONGS_CENTERS,
  CACHE_KEYS.APP_VERSION,
  CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID,
  CACHE_KEYS.TEMPLATE_CLIPBOARD_V1,
  CACHE_KEYS.TEMPLATE_CLIPBOARD_V2,
] as const;

/**
 * Legacy cache keys (songStudio prefix) - no longer used
 */
export const LEGACY_CACHE_KEYS = [
  CACHE_KEYS.SONG_STUDIO_SONGS,
  CACHE_KEYS.SONG_STUDIO_SINGERS,
  CACHE_KEYS.SONG_STUDIO_PITCHES,
  CACHE_KEYS.SONG_STUDIO_TEMPLATES,
  CACHE_KEYS.SONG_STUDIO_CENTERS,
  CACHE_KEYS.SONG_STUDIO_APP_VERSION,
  CACHE_KEYS.TEMPLATE_CLIPBOARD_V1,
] as const;

/**
 * Cache keys for data caches (excludes version tracking and clipboard)
 */
export const DATA_CACHE_KEYS = [
  CACHE_KEYS.SONG_STUDIO_SONGS,
  CACHE_KEYS.SONG_STUDIO_SINGERS,
  CACHE_KEYS.SONG_STUDIO_PITCHES,
  CACHE_KEYS.SONG_STUDIO_TEMPLATES,
  CACHE_KEYS.SONG_STUDIO_CENTERS,
  CACHE_KEYS.SAI_SONGS_SONGS,
  CACHE_KEYS.SAI_SONGS_SINGERS,
  CACHE_KEYS.SAI_SONGS_PITCHES,
  CACHE_KEYS.SAI_SONGS_TEMPLATES,
  CACHE_KEYS.SAI_SONGS_CENTERS,
  CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID,
] as const;

export interface ClearCacheOptions {
  /** Whether to clear service worker cache (HTML, JS, CSS files) */
  clearServiceWorkerCache?: boolean;
  /** Whether to reload the page after clearing */
  reload?: boolean;
  /** Custom cache-busting parameter name (default: '_nocache' or '_v') */
  reloadParam?: string;
  /** Delay before reload in milliseconds (default: 1500) */
  reloadDelay?: number;
  /** Whether to update last clear timestamp */
  updateLastClearTimestamp?: boolean;
}

/**
 * Get estimated size of localStorage in bytes
 */
export function getLocalStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}

/**
 * Safely set a localStorage item with quota exceeded error handling
 * If quota is exceeded, attempts to clear old caches and retry
 * @param key - The key to set
 * @param value - The value to set
 * @param options - Options for handling quota errors
 * @returns true if successful, false if failed even after cleanup
 */
export function safeSetLocalStorageItem(
  key: string,
  value: string,
  options: {
    clearOnQuotaError?: boolean;
    skipKeys?: string[];
  } = {}
): boolean {
  const { clearOnQuotaError = true, skipKeys = [] } = options;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // Check if it's a quota exceeded error
    const isQuotaError =
      error instanceof DOMException &&
      (error.code === 22 || // QuotaExceededError
       error.code === 1014 || // NS_ERROR_DOM_QUOTA_REACHED (Firefox)
       error.name === 'QuotaExceededError' ||
       error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    if (!isQuotaError) {
      // Not a quota error, just log and return false
      console.warn(`Failed to set localStorage key "${key}":`, error);
      return false;
    }

    console.warn(`localStorage quota exceeded when setting "${key}". Attempting cleanup...`);

    if (!clearOnQuotaError) {
      return false;
    }

    // Try to clear old caches and retry
    try {
      // Clear data caches (but skip the key we're trying to set and any explicitly skipped keys)
      const keysToClear = DATA_CACHE_KEYS.filter(
        k => k !== key && !skipKeys.includes(k)
      );

      // Clear oldest caches first (we'll clear all data caches as a simple strategy)
      keysToClear.forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch (e) {
          // Ignore errors when clearing
        }
      });

      // Retry setting the item
      localStorage.setItem(key, value);
      console.log(`Successfully set "${key}" after clearing old caches`);
      return true;
    } catch (retryError) {
      console.error(`Failed to set "${key}" even after clearing caches:`, retryError);
      return false;
    }
  }
}

/**
 * Clear legacy cache keys (songStudio:* prefix)
 * Should be called on app initialization to free up localStorage space
 */
export function clearLegacyCacheKeys(): void {
  if (typeof window === 'undefined') {
    return;
  }

  LEGACY_CACHE_KEYS.forEach(key => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear legacy cache key "${key}":`, error);
    }
  });
}

/**
 * Clear localStorage caches
 * @param keys - Array of cache keys to clear. If not provided, clears all data cache keys.
 */
export function clearLocalStorageCache(keys?: string[]): void {
  const keysToClear = keys || DATA_CACHE_KEYS;
  
  keysToClear.forEach(key => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear localStorage key "${key}":`, error);
    }
  });
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(registration => registration.unregister())
    );
    console.log(`Unregistered ${registrations.length} service worker(s)`);
  } catch (error) {
    console.warn('Could not unregister service workers:', error);
  }
}

/**
 * Clear all service worker cache storage entries completely
 * This deletes entire cache storage entries, not just specific files
 */
export async function clearServiceWorkerCache(): Promise<void> {
  if (!('caches' in window)) {
    return;
  }

  try {
    // Get all cache names
    const cacheNames = await caches.keys();
    
    // Delete ALL cache storage entries completely
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    
    console.log(`Cleared ${cacheNames.length} cache storage entries:`, cacheNames);
  } catch (error) {
    // Service worker cache clearing is optional, don't fail if it errors
    console.warn('Could not clear service worker cache:', error);
  }
}

/**
 * Clear all caches (localStorage and service worker)
 * @param options - Configuration options
 */
export async function clearAllCaches(options: ClearCacheOptions = {}): Promise<void> {
  const {
    clearServiceWorkerCache: shouldClearSW = true,
    reload = false,
    reloadParam = '_nocache',
    reloadDelay = 1500,
    updateLastClearTimestamp = false,
  } = options;

  // Clear localStorage caches
  clearLocalStorageCache();

  // Clear service worker cache if requested
  if (shouldClearSW) {
    // Unregister service workers first
    await unregisterServiceWorkers();
    // Then delete all cache storage entries
    await clearServiceWorkerCache();
  }

  // Update last clear timestamp if requested
  if (updateLastClearTimestamp) {
    const timestamp = Date.now();
    localStorage.setItem(CACHE_KEYS.LAST_LOCAL_STORAGE_CLEAR, timestamp.toString());
  }

  // Reload page if requested
  if (reload) {
    const timestamp = Date.now();
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set(reloadParam, timestamp.toString());
      window.location.href = url.toString();
    }, reloadDelay);
  }
}

/**
 * Check if cache clear cooldown is active
 * @param cooldownMs - Cooldown period in milliseconds (default: 2 minutes)
 * @returns Object with isOnCooldown flag and remaining seconds
 */
export function checkCacheClearCooldown(cooldownMs: number = 2 * 60 * 1000): {
  isOnCooldown: boolean;
  remainingSeconds: number;
} {
  const lastClear = localStorage.getItem(CACHE_KEYS.LAST_LOCAL_STORAGE_CLEAR);
  
  if (!lastClear) {
    return { isOnCooldown: false, remainingSeconds: 0 };
  }

  const lastClearTime = parseInt(lastClear, 10);
  const now = Date.now();
  const elapsed = now - lastClearTime;
  const remaining = cooldownMs - elapsed;

  if (remaining > 0) {
    return {
      isOnCooldown: true,
      remainingSeconds: Math.ceil(remaining / 1000),
    };
  }

  return { isOnCooldown: false, remainingSeconds: 0 };
}

