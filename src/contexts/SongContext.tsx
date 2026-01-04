import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Song, CreateSongInput, UpdateSongInput, ServiceError } from '../types';
import { songService } from '../services';
import { useToast } from './ToastContext';
import { compareStringsIgnoringSpecialChars } from '../utils';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from '../utils/cacheUtils';
import { globalEventBus } from '../utils/globalEventBus';

const SONGS_CACHE_KEY = 'saiSongs:songsCache';
const SONGS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface SongContextState {
  songs: Song[];
  loading: boolean;
  error: ServiceError | null;
  fetchSongs: (forceRefresh?: boolean) => Promise<void>;
  getSongById: (id: string) => Promise<Song | null>;
  createSong: (input: CreateSongInput) => Promise<Song | null>;
  updateSong: (id: string, input: UpdateSongInput) => Promise<Song | null>;
  deleteSong: (id: string) => Promise<boolean>;
  searchSongs: (query: string) => Promise<void>;
  searchSongsWithFilter: (query: string, singerId?: string) => Promise<void>;
  getSongsBySinger: (singerId: string) => Promise<void>;
  clearError: () => void;
}

const SongContext = createContext<SongContextState | undefined>(undefined);

interface SongProviderProps {
  children: ReactNode;
}

export const SongProvider: React.FC<SongProviderProps> = ({ children }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const toast = useToast();

  // Listen for song and pitch events to update state optimistically
  useEffect(() => {
    let unsubscribes: (() => void)[] = [];

    const unsubscribeSongCreated = globalEventBus.on('songCreated', (detail) => {
      const { song } = detail;
      if (song) {
        setSongs(prev => {
          // Check if song already exists (duplicate prevention)
          let updated: Song[];
          if (prev.some(s => s.id === song.id)) {
            updated = prev.map(s => s.id === song.id ? song : s);
          } else {
            updated = [...prev, song].sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
          }
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SONGS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              songs: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribeSongUpdated = globalEventBus.on('songUpdated', (detail) => {
      const { song } = detail;
      if (song) {
        setSongs(prev => {
          // Check if song already exists (duplicate prevention)
          let updated: Song[];
          if (prev.some(s => s.id === song.id)) {
            updated = prev.map(s => s.id === song.id ? song : s);
          } else {
            updated = [...prev, song].sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
          }
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SONGS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              songs: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribeSongDeleted = globalEventBus.on('songDeleted', (detail) => {
      const { song } = detail;
      if (song) {
        setSongs(prev => {
          const updated = prev.filter(s => s.id !== song.id);
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SONGS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              songs: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerMerged = globalEventBus.on('singerMerged', (detail) => {
      const { songIdsPitchCountDown } = detail;
      if (songIdsPitchCountDown) {
        setSongs(prev => {
          const updated = prev.map(song => {
            const change = songIdsPitchCountDown.get(song.id) ?? 0;
            return { ...song, pitchCount: (song.pitchCount ?? 0) + change };
          });
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SONGS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              songs: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribePitchCreated = globalEventBus.on('pitchCreated', (detail) => {
      const { pitch } = detail;
      if (pitch) {
        setSongs(prev => {
          const updated = prev.map(song =>
            song.id === pitch.songId
              ? { ...song, pitchCount: (song.pitchCount ?? 0) + 1 }
              : song
          );
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SONGS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              songs: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribePitchDeleted = globalEventBus.on('pitchDeleted', (detail) => {
      const { pitch } = detail;
      if (pitch) {
        setSongs(prev => {
          const updated = prev.map(song =>
            song.id === pitch.songId
              ? { ...song, pitchCount: Math.max(0, (song.pitchCount ?? 0) - 1) }
              : song
          );
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SONGS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              songs: updated,
            }));
          }
          return updated;
        });
      }
    });

    unsubscribes.push(unsubscribeSongCreated, unsubscribeSongUpdated, unsubscribeSongDeleted, unsubscribeSingerMerged, unsubscribePitchCreated, unsubscribePitchDeleted);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchSongs = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent retry loops: if we've already fetched and failed, don't retry automatically
    if (!forceRefresh && hasFetched && error) {
      return;
    }

    // Reset backoff for explicit user-triggered refreshes
    if (forceRefresh && typeof window !== 'undefined') {
      const { apiClient } = await import('../services/ApiClient');
      apiClient.resetBackoff('/songs');
      setError(null);
      setHasFetched(false);
    }

    setLoading(true);
    setError(null);
    try {
      // Try to hydrate from browser cache first to speed up page load,
      // unless the caller explicitly requested a forced refresh.
      if (!forceRefresh && typeof window !== 'undefined') {
        const cachedRaw = getLocalStorageItem(SONGS_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as {
              timestamp: number;
              songs: Song[];
            };
            const now = Date.now();
            if (cached.timestamp && now - cached.timestamp < SONGS_CACHE_TTL_MS && Array.isArray(cached.songs)) {
              const hydratedSongs: Song[] = cached.songs.map((s: any) => ({
                ...s,
                createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
                updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
              })).sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
              setSongs(hydratedSongs);
              setLoading(false);
              return;
            }
          } catch {
            // Ignore cache parse errors and fall back to network
          }
        }
      }

      // Fetch from backend - pass nocache if force refresh to invalidate server cache too
      const freshSongs = await songService.getAllSongs(forceRefresh);
      const sortedSongs = freshSongs.sort((a, b) => compareStringsIgnoringSpecialChars(a.name, b.name));
      setSongs(sortedSongs);

      // Persist to cache for subsequent loads
      if (typeof window !== 'undefined') {
        const cacheData = JSON.stringify({
          timestamp: Date.now(),
          songs: sortedSongs,
        });
        setLocalStorageItem(SONGS_CACHE_KEY, cacheData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch songs';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getSongById = useCallback(async (id: string): Promise<Song | null> => {
    setLoading(true);
    setError(null);
    try {
      const song = await songService.getSongById(id);
      return song;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch song';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createSong = useCallback(async (input: CreateSongInput): Promise<Song | null> => {
    setLoading(true);
    setError(null);
    try {
      const song = await songService.createSong(input);

      if (song) {
        if (typeof window !== 'undefined') {
          // Dispatch global event to notify other components
          globalEventBus.dispatch('songCreated', { type: 'songCreated', song: song });
        }
        toast.success(`Song ${song.name} created successfully`);
        return song;
      }
      console.error('Failed to create song', input);
      toast.error(`Failed to create song ${input.name}`);
      return null;
    } catch (err) {
      console.error(`Error creating song ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error creating song ${input.name}: ${err}`;
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateSong = useCallback(async (id: string, input: UpdateSongInput): Promise<Song | null> => {
    setLoading(true);
    setError(null);
    try {
      const song = await songService.updateSong(id, input);
      if (song) {
        if (typeof window !== 'undefined') {
          // Dispatch global event to notify other components
          globalEventBus.dispatch('songUpdated', { type: 'songUpdated', song: song });
        }
        toast.success(`Song ${song.name} updated successfully`);
        return song;
      } else {
        console.error('Failed to update song', input);
        toast.error(`Failed to update song ${input.name}`);
        return null;
      }
    } catch (err) {
      console.error(`Error updating song ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error updating song ${input.name}: ${err}`;
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteSong = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Get the song before deleting to know which song to update
      // Try from state first (fast), but fallback to fetching from backend if not found
      let songToDelete = songs.find(s => s.id === id);

      // If song not in state, fetch from backend to get full song data
      if (!songToDelete) {
        const fetchedSong = await songService.getSongById(id);
        if (fetchedSong) {
          songToDelete = fetchedSong;
        }
      }

      if (songToDelete) {
        const success = await songService.deleteSong(id);
        if (success) {
          if (typeof window !== 'undefined') {
            // Dispatch global event to notify other components
            globalEventBus.dispatch('songDeleted', {
              type: 'songDeleted',
              song: songToDelete
            });
          }
          toast.success(`Song ${songToDelete.name} deleted successfully`);
          return true;
        } else {
          console.error(`Failed to delete song ${id}`);
          toast.error('Failed to delete song');
          return false;
        }
      } else {
        console.error(`Failed to delete song ${id}`);
        toast.error('Failed to delete song');
        return false;
      }
    } catch (err) {
      console.error(`Error deleting song ${id}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error deleting song: ${err}`;
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, songs]);

  const searchSongs = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const songs = await songService.searchSongs(query);
      setSongs(songs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search songs';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const searchSongsWithFilter = useCallback(async (query: string, singerId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const songs = await songService.searchSongsWithFilter(query, singerId);
      setSongs(songs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search songs';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getSongsBySinger = useCallback(async (singerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const songs = await songService.getSongsBySinger(singerId);
      setSongs(songs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch songs by singer';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const value: SongContextState = {
    songs,
    loading,
    error,
    fetchSongs,
    getSongById,
    createSong,
    updateSong,
    deleteSong,
    searchSongs,
    searchSongsWithFilter,
    getSongsBySinger,
    clearError,
  };

  return <SongContext.Provider value={value}>{children}</SongContext.Provider>;
};

export const useSongs = (): SongContextState => {
  const context = useContext(SongContext);
  if (context === undefined) {
    throw new Error('useSongs must be used within a SongProvider');
  }
  return context;
};
