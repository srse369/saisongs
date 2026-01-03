/**
 * Utility functions for clearing application caches
 * Handles both localStorage and service worker caches
 * Includes compression support to reduce storage size
 */

// Import lz-string for compression (small library, ~3KB gzipped)
import LZString from 'lz-string';

// Common cache keys used across the application
export const CACHE_KEYS = {
  // Current keys (saiSongs prefix)
  SAI_SONGS_SONGS: 'saiSongs:songsCache',
  SAI_SONGS_SINGERS: 'saiSongs:singersCache',
  SAI_SONGS_PITCHES: 'saiSongs:pitchesCache',
  SAI_SONGS_TEMPLATES: 'saiSongs:templatesCache',
  SAI_SONGS_CENTERS: 'saiSongs:centersCache',
  
  // Other app data
  SELECTED_SESSION_TEMPLATE_ID: 'saiSongs:selectedSessionTemplateId',
  TEMPLATE_CLIPBOARD: 'saiSongs:templateClipboard',
  
  // Version tracking
  APP_VERSION: 'saiSongs:appVersion',
  LAST_LOCAL_STORAGE_CLEAR: 'lastLocalStorageClear',
} as const;

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
 * Compress a string using lz-string compression
 * Falls back to original string if compression fails or is unavailable
 * Uses synchronous compression for better performance
 */
export function compressString(data: string): string {
  if (!data || data.length < 1000) {
    return data; // Don't compress small strings
  }
  
  try {
    if (typeof window !== 'undefined' && LZString) {
      // Use compressToUTF16 for better browser compatibility
      const compressed = LZString.compressToUTF16(data);
      // Only use compression if it actually reduces size (at least 10% reduction)
      if (compressed && compressed.length < data.length * 0.9) {
        return 'C' + compressed; // Prefix 'C' to indicate compressed
      }
    }
  } catch (error) {
    // Silently fail - compression is optional
  }
  return data; // Return original if compression fails or doesn't help
}

/**
 * Get the selected template ID from localStorage (shared across all preview modes)
 */
export function getSelectedTemplateId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID);
  } catch (e) {
    console.warn('Failed to get selected template ID from localStorage:', e);
    return null;
  }
}

/**
 * Set the selected template ID in localStorage (shared across all preview modes)
 */
export function setSelectedTemplateId(templateId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID, templateId);
    return true;
  } catch (e) {
    console.warn('Failed to save selected template ID to localStorage:', e);
    return false;
  }
}

/**
 * Clear the selected template ID from localStorage
 */
export function clearSelectedTemplateId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID);
  } catch (e) {
    console.warn('Failed to clear selected template ID from localStorage:', e);
  }
}

/**
 * Decompress a string if it was compressed
 * Returns original string if not compressed or decompression fails
 */
export function decompressString(data: string): string {
  if (!data || !data.startsWith('C')) {
    return data; // Not compressed
  }
  
  try {
    if (typeof window !== 'undefined' && LZString) {
      const compressed = data.substring(1); // Remove 'C' prefix
      const decompressed = LZString.decompressFromUTF16(compressed);
      if (decompressed) {
        return decompressed;
      }
    }
  } catch (error) {
    console.warn('Decompression failed, returning original data:', error);
  }
  return data;
}


/**
 * Get a localStorage item and automatically decompress if needed
 * @param key - The key to retrieve
 * @returns The decompressed value or null if not found
 */
export function getLocalStorageItem(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    return decompressString(value);
  } catch (error) {
    console.warn(`Failed to get localStorage key "${key}":`, error);
    return null;
  }
}

/**
 * Set a localStorage item with automatic compression and error handling
 * @param key - The key to set
 * @param value - The value to set (will be compressed before storing)
 * @returns true if successful, false if failed
 */
export function setLocalStorageItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Automatically compress the value to save localStorage space
    const compressedValue = compressString(value);
    localStorage.setItem(key, compressedValue);
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Remove a localStorage item with error handling
 * @param key - The key to remove
 * @returns true if successful, false if failed
 */
export function removeLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Check if a localStorage item exists
 * @param key - The key to check
 * @returns true if the key exists, false otherwise
 */
export function hasLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.warn(`Failed to check localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Clear localStorage caches
 * @param keys - Array of cache keys to clear. If not provided, clears all data cache keys.
 */
export function clearLocalStorageCache(keys?: string[]): void {
  const appVersion = localStorage.getItem(CACHE_KEYS.APP_VERSION);
  const lastLocalStorageClear = localStorage.getItem(CACHE_KEYS.LAST_LOCAL_STORAGE_CLEAR);

  localStorage.clear();

  if (appVersion) {
    localStorage.setItem(CACHE_KEYS.APP_VERSION, appVersion);
  }
  if (lastLocalStorageClear) {
    localStorage.setItem(CACHE_KEYS.LAST_LOCAL_STORAGE_CLEAR, lastLocalStorageClear);
  }
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

