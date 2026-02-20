/**
 * IndexedDB cache layer for offline data.
 * Stores data uncompressed for faster read/write. IndexedDB has much higher limits than localStorage.
 */

const DB_NAME = 'saiSongs-cache';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Get a value from IndexedDB cache.
 */
export async function getCacheItem(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        const value = request.result;
        resolve(value != null ? String(value) : null);
      };
    });
  } catch (e) {
    console.warn(`IndexedDB get failed for "${key}":`, e);
    return null;
  }
}

/**
 * Set a value in IndexedDB cache (uncompressed).
 */
export async function setCacheItem(key: string, value: string): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve(true);
      };
    });
  } catch (e) {
    console.warn(`IndexedDB set failed for "${key}":`, e);
    return false;
  }
}

/**
 * Remove a value from IndexedDB cache.
 */
export async function removeCacheItem(key: string): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve(true);
      };
    });
  } catch (e) {
    console.warn(`IndexedDB remove failed for "${key}":`, e);
    return false;
  }
}

/**
 * Check if a key exists in IndexedDB cache.
 */
export async function hasCacheItem(key: string): Promise<boolean> {
  const value = await getCacheItem(key);
  return value !== null;
}

const SONG_PREFIX = 'saiSongs:song:';
// Upper bound for song keys: "saiSongs:song:g" excludes "saiSongs:songsCache" (UUIDs use 0-9,a-f only)
const SONG_KEY_UPPER = 'saiSongs:song:g';

/**
 * Count individual song cache entries that have lyrics.
 * Used when the songs list cache has no lyrics (e.g. from regular API).
 */
export async function countSongsWithLyricsFromIndividualCache(): Promise<number> {
  if (typeof window === 'undefined' || !window.indexedDB) return 0;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      // Bound range: keys > "saiSongs:song:" and < "saiSongs:song:g" (UUIDs use 0-9,a-f; excludes songsCache)
      const range = IDBKeyRange.bound(SONG_PREFIX, SONG_KEY_UPPER, true, true);
      const request = store.getAll(range);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = () => {
        db.close();
        const values = request.result as unknown[];
        let count = 0;
        for (const raw of values) {
          try {
            const str = raw != null ? String(raw) : '';
            const parsed = JSON.parse(str) as { song?: { lyrics?: string | null } };
            const lyrics = parsed?.song?.lyrics;
            if (lyrics != null && lyrics !== '' && String(lyrics).trim().length > 0) {
              count++;
            }
          } catch {
            // Skip parse errors
          }
        }
        resolve(count);
      };
    });
  } catch (e) {
    console.warn('IndexedDB countSongsWithLyrics failed:', e);
    return 0;
  }
}

/**
 * Get all keys from the cache (for migration or debugging).
 */
export async function getAllCacheKeys(): Promise<string[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve((request.result as IDBValidKey[]).map(String));
      };
    });
  } catch (e) {
    console.warn('IndexedDB getAllKeys failed:', e);
    return [];
  }
}

/**
 * Clear all saiSongs cache entries from IndexedDB.
 * Preserves APP_VERSION and LAST_LOCAL_STORAGE_CLEAR if requested.
 */
export async function clearCacheStore(preserveKeys?: string[]): Promise<void> {
  try {
    const db = await openDb();
    const preserve = new Set(preserveKeys ?? []);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (!preserve.has(String(cursor.key))) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          db.close();
          resolve();
        }
      };
    });
  } catch (e) {
    console.warn('IndexedDB clear failed:', e);
  }
}
