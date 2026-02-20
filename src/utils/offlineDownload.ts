/**
 * Offline download utility - downloads all song details and related data to browser cache
 * for full offline functionality.
 *
 * All downloads (whole or parts) are gzip-compressed via Express compression middleware
 * for efficient transfer over the network.
 */

import apiClient from '../services/ApiClient';
import {
  CACHE_KEYS,
  setCacheItem,
  getCacheItem,
  getSongIdsMissingLyrics,
  getSongIdsFromCache,
  removeDeletedFromCache,
  getBrowserCacheEntityCounts,
  type DeletedEntities,
} from './cacheUtils';
import { countSongsWithLyricsFromIndividualCache } from './indexedDbCache';

const OFFLINE_TIMESTAMP_KEY = 'saiSongs:offlineDownloadTimestamp';

export interface OfflineDownloadProgress {
  phase: 'songs' | 'song-details' | 'singers' | 'pitches' | 'templates' | 'done';
  current: number;
  total: number;
  message: string;
}

export interface OfflineDownloadResult {
  success: boolean;
  songsCount: number;
  singersCount: number;
  pitchesCount: number;
  templatesCount: number;
  sessionsCount: number;
  centersCount: number;
  error?: string;
}

/**
 * Download all data for offline use via a single batched endpoint (gzip-compressed).
 * Fetches songs (with lyrics), singers, pitches, and templates in one request.
 */
export async function downloadForOffline(
  onProgress?: (progress: OfflineDownloadProgress) => void
): Promise<OfflineDownloadResult> {
  const result: OfflineDownloadResult = {
    success: false,
    songsCount: 0,
    singersCount: 0,
    pitchesCount: 0,
    templatesCount: 0,
    sessionsCount: 0,
    centersCount: 0,
  };

  try {
    apiClient.resetBackoff();

    onProgress?.({
      phase: 'songs',
      current: 0,
      total: 1,
      message: 'Downloading all data (gzip-compressed)...',
    });

    // Single request - backend returns all data in one response (2 min timeout to avoid indefinite hang)
    const data = (await apiClient.getWithTimeout<{
      songs: any[];
      singers: any[];
      pitches: any[];
      templates: any[];
      sessions: any[];
      centers: any[];
    }>('/offline/download', 120_000)) as {
      songs?: any[];
      singers?: any[];
      pitches?: any[];
      templates?: any[];
      sessions?: any[];
      centers?: any[];
    };

    const songs = Array.isArray(data?.songs) ? data.songs : [];
    const singers = Array.isArray(data?.singers) ? data.singers : [];
    const pitches = Array.isArray(data?.pitches) ? data.pitches : [];
    const templates = Array.isArray(data?.templates) ? data.templates : [];
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    const centers = Array.isArray(data?.centers) ? data.centers : [];

    result.songsCount = songs.length;
    result.singersCount = singers.length;
    result.pitchesCount = pitches.length;
    result.templatesCount = templates.length;
    result.sessionsCount = sessions.length;
    result.centersCount = centers.length;

    const now = Date.now();

    // Cache each song individually for offline lookup
    for (const song of songs) {
      const songKey = `${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${song.id}`;
      await setCacheItem(songKey, JSON.stringify({ timestamp: now, song }));
    }

    await Promise.all([
      setCacheItem(CACHE_KEYS.SAI_SONGS_SONGS, JSON.stringify({ timestamp: now, songs })),
      setCacheItem(CACHE_KEYS.SAI_SONGS_SINGERS, JSON.stringify({ timestamp: now, singers })),
      setCacheItem(CACHE_KEYS.SAI_SONGS_PITCHES, JSON.stringify({ timestamp: now, pitches })),
      setCacheItem(CACHE_KEYS.SAI_SONGS_TEMPLATES, JSON.stringify({ timestamp: now, templates })),
      setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: now, sessions })),
      setCacheItem(CACHE_KEYS.SAI_SONGS_CENTERS, JSON.stringify({ timestamp: now, centers })),
      setCacheItem(OFFLINE_TIMESTAMP_KEY, String(now)),
    ]);

    onProgress?.({
      phase: 'done',
      current: 1,
      total: 1,
      message: 'Done!',
    });

    result.success = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Download failed';
  }

  return result;
}

/**
 * Fetch and cache lyrics for songs that are in cache but missing lyrics.
 * Uses batched endpoint (gzip-compressed) for efficiency.
 */
export async function ensureSongLyricsCached(
  onProgress?: (progress: OfflineDownloadProgress) => void
): Promise<{ fetched: number; failed: number }> {
  const missingIds = await getSongIdsMissingLyrics();
  if (missingIds.length === 0) return { fetched: 0, failed: 0 };

  onProgress?.({
    phase: 'song-details',
    current: 0,
    total: missingIds.length,
    message: `Fetching lyrics for ${missingIds.length} songs (batched, gzip-compressed)...`,
  });

  try {
    const response = await apiClient.post<{ songs: any[] }>('/offline/songs-batch', { ids: missingIds });
    const songs = Array.isArray(response?.songs) ? response.songs : [];
    const now = Date.now();
    let fetched = 0;

    for (const song of songs) {
      if (song?.id && typeof window !== 'undefined') {
        const songKey = `${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${song.id}`;
        await setCacheItem(songKey, JSON.stringify({ timestamp: now, song }));
        fetched++;
      }
    }

    const failed = missingIds.length - fetched;
    onProgress?.({
      phase: 'done',
      current: missingIds.length,
      total: missingIds.length,
      message: 'Done!',
    });
    return { fetched, failed };
  } catch {
    return { fetched: 0, failed: missingIds.length };
  }
}

/**
 * Take offline: skip if cache already has complete data; otherwise download.
 * Uses /offline/manifest to compare cache counts with server (same user-filtered data).
 */
export async function takeOfflineIfNeeded(
  onProgress?: (progress: OfflineDownloadProgress) => void
): Promise<{ skipped: boolean; result: OfflineDownloadResult }> {
  apiClient.resetBackoff();

  try {
    onProgress?.({ phase: 'songs', current: 0, total: 1, message: 'Checking cache...' });
    const cacheCounts = await getBrowserCacheEntityCounts();
    let cacheSongs = cacheCounts.songs ?? 0;

    // Fallback: if main parse returned 0 but we have song IDs in cache, use that count
    if (cacheSongs === 0) {
      const songIds = await getSongIdsFromCache();
      if (songIds.length > 0) {
        cacheSongs = songIds.length;
        (cacheCounts as { songs: number }).songs = cacheSongs;
        // Also get lyrics count from individual caches when list parse may have failed
        const withLyrics = await countSongsWithLyricsFromIndividualCache();
        (cacheCounts as { songsWithLyrics?: number }).songsWithLyrics = withLyrics;
      }
    }

    // Ensure we have lyrics count when we have songs (needed for skip decision)
    let cacheSongsWithLyrics = cacheCounts.songsWithLyrics ?? 0;
    if (cacheSongs > 0 && cacheSongsWithLyrics === 0) {
      cacheSongsWithLyrics = await countSongsWithLyricsFromIndividualCache();
      (cacheCounts as { songsWithLyrics?: number }).songsWithLyrics = cacheSongsWithLyrics;
    }

    // Skip manifest when cache is empty - go straight to download
    if (cacheSongs === 0) {
      const result = await downloadForOffline(onProgress);
      return { skipped: false, result };
    }

    const manifest = await apiClient.get<{
      songs?: { count?: number; withLyrics?: number };
      singers?: { count?: number };
      pitches?: { count?: number };
      templates?: { count?: number };
      sessions?: { count?: number };
      centers?: { count?: number };
    }>('/offline/manifest');

    const serverSongs = manifest?.songs?.count ?? 0;
    const serverSongsWithLyrics = manifest?.songs?.withLyrics ?? serverSongs;
    const serverSingers = manifest?.singers?.count ?? 0;
    const serverPitches = manifest?.pitches?.count ?? 0;
    const serverTemplates = manifest?.templates?.count ?? 0;
    const serverSessions = manifest?.sessions?.count ?? 0;
    const serverCenters = manifest?.centers?.count ?? 0;

    const cacheSingers = cacheCounts.singers ?? 0;
    const cachePitches = cacheCounts.pitches ?? 0;
    const cacheTemplates = cacheCounts.templates ?? 0;
    const cacheSessions = cacheCounts.sessions ?? 0;
    const cacheCenters = cacheCounts.centers ?? 0;

    // Require both song count AND lyrics: skip only when we have all songs AND lyrics for them.
    // Songs list cache often has metadata only (no lyrics); lyrics come from individual cache.
    // Server provides withLyrics count; we need cacheSongsWithLyrics >= that to skip.
    const cacheComplete =
      cacheSongs >= serverSongs &&
      cacheSongsWithLyrics >= serverSongsWithLyrics &&
      cacheSingers >= serverSingers &&
      cachePitches >= serverPitches &&
      cacheTemplates >= serverTemplates &&
      cacheSessions >= serverSessions &&
      cacheCenters >= serverCenters;

    if (cacheComplete && serverSongs > 0) {
      onProgress?.({ phase: 'done', current: 1, total: 1, message: 'Already have all data offline.' });
      return {
        skipped: true,
        result: {
          success: true,
          songsCount: cacheSongs,
          singersCount: cacheSingers,
          pitchesCount: cachePitches,
          templatesCount: cacheTemplates,
          sessionsCount: cacheSessions,
          centersCount: cacheCenters,
        },
      };
    }
  } catch {
    // Manifest failed (e.g. not authenticated) - fall through to download
  }

  const result = await downloadForOffline(onProgress);
  return { skipped: false, result };
}

/**
 * Get the timestamp of the last successful offline download, or null if never.
 */
export async function getLastOfflineDownloadTime(): Promise<number | null> {
  if (typeof window === 'undefined') return null;
  try {
    const raw = await getCacheItem(OFFLINE_TIMESTAMP_KEY);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return isNaN(ts) ? null : ts;
  } catch {
    return null;
  }
}

/**
 * Fetch deleted entity IDs from the server (tombstone table) and remove them from the browser cache.
 * Call after sync or when coming back online. Uses last offline download timestamp as "since".
 * Requires editor or admin. Silently no-ops if the deleted_entities table does not exist.
 */
export async function fetchDeletedAndCleanCache(): Promise<{ cleaned: number }> {
  const since = (await getLastOfflineDownloadTime()) ?? 0;
  try {
    const deleted = await apiClient.get<DeletedEntities>(`/offline/deleted?since=${since}`);
    const total =
      (deleted.songs?.length ?? 0) +
      (deleted.singers?.length ?? 0) +
      (deleted.pitches?.length ?? 0) +
      (deleted.templates?.length ?? 0) +
      (deleted.sessions?.length ?? 0) +
      (deleted.centers?.length ?? 0);
    if (total > 0) {
      await removeDeletedFromCache(deleted);
    }
    return { cleaned: total };
  } catch {
    return { cleaned: 0 };
  }
}
