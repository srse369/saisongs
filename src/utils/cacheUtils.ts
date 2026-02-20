/**
 * Utility functions for clearing application caches
 * Uses IndexedDB for offline data (uncompressed, faster, higher limits)
 * Small preferences stay in localStorage
 */

import {
  getCacheItem as idbGet,
  setCacheItem as idbSet,
  removeCacheItem as idbRemove,
  clearCacheStore as idbClearStore,
  getAllCacheKeys,
  countSongsWithLyricsFromIndividualCache,
} from './indexedDbCache';

// Common cache keys used across the application
export const CACHE_KEYS = {
  // Current keys (saiSongs prefix)
  SAI_SONGS_SONGS: 'saiSongs:songsCache',
  SAI_SONGS_SINGERS: 'saiSongs:singersCache',
  SAI_SONGS_PITCHES: 'saiSongs:pitchesCache',
  SAI_SONGS_TEMPLATES: 'saiSongs:templatesCache',
  SAI_SONGS_DEFAULT_TEMPLATE: 'saiSongs:defaultTemplateCache',
  SAI_SONGS_SONG_PREFIX: 'saiSongs:song:', // Individual song cache: saiSongs:song:{id}
  SAI_SONGS_CENTERS: 'saiSongs:centersCache',
  SAI_SONGS_SESSIONS: 'saiSongs:sessionsCache',

  // Other app data
  SELECTED_SESSION_TEMPLATE_ID: 'saiSongs:selectedSessionTemplateId',
  TEMPLATE_CLIPBOARD: 'saiSongs:templateClipboard',
  TEMPLATE_MEDIA_PREFIX: 'saiSongs:templateMedia:',
  
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
 * Get estimated size of IndexedDB cache in bytes (approximate).
 */
export async function getCacheSizeEstimate(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const keys = await getAllCacheKeys();
    let total = 0;
    for (const key of keys) {
      const val = await idbGet(key);
      total += (val?.length ?? 0) + key.length;
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Get the selected template ID from cache (shared across all preview modes)
 */
export async function getSelectedTemplateId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    return await idbGet(CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID);
  } catch (e) {
    console.warn('Failed to get selected template ID:', e);
    return null;
  }
}

/**
 * Set the selected template ID in cache (shared across all preview modes)
 */
export async function setSelectedTemplateId(templateId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return await idbSet(CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID, templateId);
  } catch (e) {
    console.warn('Failed to save selected template ID:', e);
    return false;
  }
}

/**
 * Clear the selected template ID from cache
 */
export async function clearSelectedTemplateId(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbRemove(CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID);
  } catch (e) {
    console.warn('Failed to clear selected template ID:', e);
  }
}


/**
 * Get counts of entities stored in browser cache (IndexedDB).
 * Used to show what data is available for offline use.
 */
export interface BrowserCacheCounts {
  songs: number;
  singers: number;
  pitches: number;
  templates: number;
  sessions: number;
  centers: number;
  /** Songs that have lyrics cached (from same parse as songs count, no extra work) */
  songsWithLyrics?: number;
  /** Templates that have slides cached (from same parse as templates count, no extra work) */
  templatesWithSlides?: number;
}

export async function getBrowserCacheEntityCounts(): Promise<BrowserCacheCounts> {
  const counts: BrowserCacheCounts = {
    songs: 0,
    singers: 0,
    pitches: 0,
    templates: 0,
    sessions: 0,
    centers: 0,
  };

  if (typeof window === 'undefined') return counts;

  try {
    const [songsRaw, singersRaw, pitchesRaw, templatesRaw, sessionsRaw, centersRaw] = await Promise.all([
      idbGet(CACHE_KEYS.SAI_SONGS_SONGS),
      idbGet(CACHE_KEYS.SAI_SONGS_SINGERS),
      idbGet(CACHE_KEYS.SAI_SONGS_PITCHES),
      idbGet(CACHE_KEYS.SAI_SONGS_TEMPLATES),
      idbGet(CACHE_KEYS.SAI_SONGS_SESSIONS),
      idbGet(CACHE_KEYS.SAI_SONGS_CENTERS),
    ]);

    // Parse each entity separately so one failure doesn't zero out others
    if (songsRaw) {
      try {
        const parsed = JSON.parse(songsRaw) as { songs?: { lyrics?: string | null }[] };
        const songs = parsed?.songs;
        if (Array.isArray(songs)) {
          counts.songs = songs.length;
          const fromList = songs.filter((s) => {
            const l = s?.lyrics;
            return l != null && l !== '' && String(l).trim().length > 0;
          }).length;
          if (fromList > 0) {
            counts.songsWithLyrics = fromList;
          } else if (songs.length > 0) {
            counts.songsWithLyrics = await countSongsWithLyricsFromIndividualCache();
          }
        }
      } catch (e) {
        console.warn('Failed to parse songs cache for counts:', e);
      }
    }
    if (singersRaw) {
      try {
        const parsed = JSON.parse(singersRaw);
        const singers = parsed?.singers;
        counts.singers = Array.isArray(singers) ? singers.length : 0;
      } catch {
        // Ignore
      }
    }
    if (pitchesRaw) {
      try {
        const parsed = JSON.parse(pitchesRaw);
        const pitches = parsed?.pitches;
        counts.pitches = Array.isArray(pitches) ? pitches.length : 0;
      } catch {
        // Ignore
      }
    }
    if (templatesRaw) {
      try {
        const parsed = JSON.parse(templatesRaw) as { templates?: { slides?: unknown[] }[] };
        const templates = parsed?.templates;
        if (Array.isArray(templates)) {
          counts.templates = templates.length;
          counts.templatesWithSlides = templates.filter(
            (t) => Array.isArray(t?.slides) && t.slides.length > 0
          ).length;
        }
      } catch {
        // Ignore
      }
    }
    if (sessionsRaw) {
      try {
        const parsed = JSON.parse(sessionsRaw);
        const sessions = parsed?.sessions;
        counts.sessions = Array.isArray(sessions) ? sessions.length : 0;
      } catch {
        // Ignore
      }
    }
    if (centersRaw) {
      try {
        const parsed = JSON.parse(centersRaw);
        const centers = parsed?.centers;
        counts.centers = Array.isArray(centers) ? centers.length : 0;
      } catch {
        // Ignore
      }
    }
  } catch (e) {
    console.warn('getBrowserCacheEntityCounts failed:', e);
  }

  return counts;
}

/**
 * Get song IDs from the songs list cache.
 */
export async function getSongIdsFromCache(): Promise<string[]> {
  if (typeof window === 'undefined') return [];
  try {
    const songsRaw = await idbGet(CACHE_KEYS.SAI_SONGS_SONGS);
    if (!songsRaw) return [];
    const parsed = JSON.parse(songsRaw);
    const songs = parsed?.songs;
    if (!Array.isArray(songs)) return [];
    return songs.map((s: { id?: string }) => s?.id).filter((id: string | undefined): id is string => !!id);
  } catch {
    return [];
  }
}

/**
 * Check if a song has lyrics cached (individual song cache or in songs list).
 */
export async function songHasLyricsInCache(id: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const songKey = `${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${id}`;
    const cachedRaw = await idbGet(songKey);
    if (cachedRaw) {
      const { song } = JSON.parse(cachedRaw) as { timestamp: number; song: { lyrics?: string | null } };
      if (song && song.lyrics != null && song.lyrics !== undefined) return true;
    }
    const listRaw = await idbGet(CACHE_KEYS.SAI_SONGS_SONGS);
    if (listRaw) {
      const { songs } = JSON.parse(listRaw) as { timestamp: number; songs: { id?: string; lyrics?: string | null }[] };
      if (Array.isArray(songs)) {
        const found = songs.find((s) => s?.id === id);
        if (found && found.lyrics != null && found.lyrics !== undefined) return true;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

/**
 * Get song IDs that are in cache but missing lyrics.
 */
export async function getSongIdsMissingLyrics(): Promise<string[]> {
  const ids = await getSongIdsFromCache();
  const missing: string[] = [];
  for (const id of ids) {
    if (!(await songHasLyricsInCache(id))) missing.push(id);
  }
  return missing;
}


/**
 * Deleted entity IDs returned by GET /api/offline/deleted
 */
export interface DeletedEntities {
  songs?: string[];
  singers?: string[];
  pitches?: string[];
  templates?: string[];
  sessions?: string[];
  centers?: string[];
}

/**
 * Remove deleted entities from the browser cache (IndexedDB).
 * Call after fetching deleted IDs from GET /api/offline/deleted?since=<ts>.
 */
export async function removeDeletedFromCache(deleted: DeletedEntities): Promise<void> {
  if (typeof window === 'undefined') return;

  const filterAndRewrite = async (
    cacheKey: string,
    arrayKey: string,
    idField: string,
    idsToRemove: string[]
  ): Promise<void> => {
    if (idsToRemove.length === 0) return;
    const set = new Set(idsToRemove);
    const raw = await idbGet(cacheKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown[]>;
      const arr = parsed[arrayKey];
      if (!Array.isArray(arr)) return;
      const filtered = arr.filter((item: Record<string, unknown>) => {
        const id = item[idField];
        return id == null || !set.has(String(id));
      });
      if (filtered.length === arr.length) return;
      parsed[arrayKey] = filtered;
      parsed.timestamp = Date.now();
      await idbSet(cacheKey, JSON.stringify(parsed));
    } catch {
      // Ignore parse errors
    }
  };

  await Promise.all([
    ...(deleted.songs ?? []).map((id) => idbRemove(`${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${id}`)),
    ...(deleted.templates ?? []).map((id) => idbRemove(`${CACHE_KEYS.TEMPLATE_MEDIA_PREFIX}${id}`)),
    filterAndRewrite(CACHE_KEYS.SAI_SONGS_SONGS, 'songs', 'id', deleted.songs ?? []),
    filterAndRewrite(CACHE_KEYS.SAI_SONGS_SINGERS, 'singers', 'id', deleted.singers ?? []),
    filterAndRewrite(CACHE_KEYS.SAI_SONGS_PITCHES, 'pitches', 'id', deleted.pitches ?? []),
    filterAndRewrite(CACHE_KEYS.SAI_SONGS_TEMPLATES, 'templates', 'id', deleted.templates ?? []),
    filterAndRewrite(CACHE_KEYS.SAI_SONGS_SESSIONS, 'sessions', 'id', deleted.sessions ?? []),
    filterAndRewrite(CACHE_KEYS.SAI_SONGS_CENTERS, 'centers', 'id', deleted.centers ?? []),
  ]);
}

/**
 * Get a cache item from IndexedDB (uncompressed, fast).
 * @param key - The key to retrieve
 * @returns The value or null if not found
 */
export async function getCacheItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    return await idbGet(key);
  } catch (error) {
    console.warn(`Failed to get cache key "${key}":`, error);
    return null;
  }
}

/**
 * Set a cache item in IndexedDB (uncompressed, fast).
 * @param key - The key to set
 * @param value - The value to set
 * @returns true if successful, false if failed
 */
export async function setCacheItem(key: string, value: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return await idbSet(key, value);
  } catch (error) {
    console.warn(`Failed to set cache key "${key}":`, error);
    return false;
  }
}

/**
 * Remove a cache item from IndexedDB
 * @param key - The key to remove
 * @returns true if successful, false if failed
 */
export async function removeCacheItem(key: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return await idbRemove(key);
  } catch (error) {
    console.warn(`Failed to remove cache key "${key}":`, error);
    return false;
  }
}

/** Sync get for small keys (queue, etc.) - uses localStorage. Use for keys that must be sync. */
export function getSyncItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Sync set for small keys (queue, etc.) - uses localStorage. */
export function setSyncItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Use getCacheItem (async) */
export async function getLocalStorageItem(key: string): Promise<string | null> {
  return getCacheItem(key);
}

/** @deprecated Use setCacheItem (async) */
export async function setLocalStorageItem(key: string, value: string): Promise<boolean> {
  return setCacheItem(key, value);
}

/** @deprecated Use removeCacheItem (async) */
export async function removeLocalStorageItem(key: string): Promise<boolean> {
  return removeCacheItem(key);
}

/**
 * Check if a cache item exists
 */
export async function hasCacheItem(key: string): Promise<boolean> {
  const value = await getCacheItem(key);
  return value !== null;
}

/** @deprecated Use hasCacheItem (async) */
export async function hasLocalStorageItem(key: string): Promise<boolean> {
  return hasCacheItem(key);
}

/**
 * Clear IndexedDB cache. Preserves APP_VERSION. LAST_LOCAL_STORAGE_CLEAR stays in localStorage.
 */
export async function clearLocalStorageCache(_keys?: string[]): Promise<void> {
  if (typeof window === 'undefined') return;
  const appVersion = await idbGet(CACHE_KEYS.APP_VERSION);

  await idbClearStore();

  if (appVersion) {
    await idbSet(CACHE_KEYS.APP_VERSION, appVersion);
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
 * Clear all caches (IndexedDB and service worker)
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

  // Clear IndexedDB cache
  await clearLocalStorageCache();

  // Clear service worker cache if requested
  if (shouldClearSW) {
    // Unregister service workers first
    await unregisterServiceWorkers();
    // Then delete all cache storage entries
    await clearServiceWorkerCache();
  }

  // Update last clear timestamp if requested (kept in localStorage for sync checkCacheClearCooldown)
  if (updateLastClearTimestamp) {
    const timestamp = Date.now();
    try {
      localStorage.setItem(CACHE_KEYS.LAST_LOCAL_STORAGE_CLEAR, timestamp.toString());
    } catch {
      // Ignore
    }
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

