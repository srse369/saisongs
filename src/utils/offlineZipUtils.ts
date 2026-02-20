/**
 * Fetch and parse songs from zip endpoints for offline use.
 * - songs-list.zip: metadata only (fast, sync load)
 * - songs-clobs.zip: lyrics, meaning, songTags (async background load)
 *
 * Requires editor/admin (endpoints return 401 otherwise).
 */

import JSZip from 'jszip';
import apiClient from '../services/ApiClient';
import { CACHE_KEYS, setCacheItem } from './cacheUtils';
import { API_BASE_URL } from '../services/ApiClient';

/** Decompress gzip bytes in browser using DecompressionStream */
async function gunzipBytes(buffer: ArrayBuffer): Promise<string> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decompressed = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

/** Fetch a zip file as ArrayBuffer (uses credentials for auth) */
async function fetchZipAsArrayBuffer(endpoint: string): Promise<ArrayBuffer> {
  const base = API_BASE_URL.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${base}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
  }
  return response.arrayBuffer();
}

/** Parse songs-list.zip and return light songs (metadata only) */
export async function fetchSongsListZip(): Promise<any[]> {
  const buffer = await fetchZipAsArrayBuffer('/offline/songs-list.zip');
  const zip = await JSZip.loadAsync(buffer);
  const songs: any[] = [];

  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir || !filename.endsWith('.json')) continue;
    const id = filename.replace(/\.json$/, '');
    const content = await entry.async('arraybuffer');
    const jsonStr = await gunzipBytes(content);
    const light = JSON.parse(jsonStr);
    songs.push({ ...light, id });
  }

  return songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/** Parse songs-clobs.zip and return Map<id, {lyrics, meaning, songTags}> */
export async function fetchSongsClobsZip(): Promise<Map<string, { lyrics?: string | null; meaning?: string | null; songTags?: string | null }>> {
  const buffer = await fetchZipAsArrayBuffer('/offline/songs-clobs.zip');
  const zip = await JSZip.loadAsync(buffer);
  const clobs = new Map<string, { lyrics?: string | null; meaning?: string | null; songTags?: string | null }>();

  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir || !filename.endsWith('.json')) continue;
    const id = filename.replace(/\.json$/, '');
    const content = await entry.async('arraybuffer');
    const jsonStr = await gunzipBytes(content);
    const data = JSON.parse(jsonStr);
    clobs.set(id, data);
  }

  return clobs;
}

/**
 * Load songs: sync from songs-list.zip, then async merge lyrics from songs-clobs.zip.
 * Stores merged result in localStorage for offline use.
 * Returns { songs, lyricsLoaded } - lyricsLoaded is true once clobs are merged.
 */
export async function loadSongsFromZips(
  onClobsLoaded?: (songsWithLyrics: any[]) => void
): Promise<{ songs: any[]; lyricsLoaded: boolean }> {
  const lightSongs = await fetchSongsListZip();
  const now = Date.now();

  // Immediately cache light songs so UI can show list
  const songsWithoutLyrics = lightSongs.map((s) => ({
    ...s,
    lyrics: null,
    meaning: null,
    songTags: null,
  }));
  await setCacheItem(
    CACHE_KEYS.SAI_SONGS_SONGS,
    JSON.stringify({ timestamp: now, songs: songsWithoutLyrics })
  );

  // Background: fetch clobs and merge
  let lyricsLoaded = false;
  fetchSongsClobsZip()
    .then(async (clobsMap) => {
      const merged = lightSongs.map((light) => {
        const clobs = clobsMap.get(light.id);
        return clobs
          ? { ...light, ...clobs }
          : { ...light, lyrics: null, meaning: null, songTags: null };
      });

      await setCacheItem(
        CACHE_KEYS.SAI_SONGS_SONGS,
        JSON.stringify({ timestamp: Date.now(), songs: merged })
      );

      for (const song of merged) {
        await setCacheItem(
          `${CACHE_KEYS.SAI_SONGS_SONG_PREFIX}${song.id}`,
          JSON.stringify({ timestamp: Date.now(), song })
        );
      }

      lyricsLoaded = true;
      onClobsLoaded?.(merged);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('songsLyricsLoaded'));
      }
    })
    .catch((err) => {
      console.warn('Background lyrics fetch failed:', err);
    });

  return {
    songs: songsWithoutLyrics,
    lyricsLoaded: false,
  };
}
