import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Song, CreateSongInput, UpdateSongInput, ServiceError } from '../types';
import { songService } from '../services';
import { useToast } from './ToastContext';

const SONGS_CACHE_KEY = 'songStudio:songsCache';
const SONGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
        const cachedRaw = window.localStorage.getItem(SONGS_CACHE_KEY);
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
              }));
              setSongs(hydratedSongs);
              setLoading(false);
              return;
            }
          } catch {
            // Ignore cache parse errors and fall back to network
          }
        }
      }

      // Fallback: fetch from backend
      const freshSongs = await songService.getAllSongs();
      setSongs(freshSongs);

      // Persist to cache for subsequent loads
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          SONGS_CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            songs: freshSongs,
          })
        );
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
      
      // Add the song to local state immediately
      setSongs(prev => {
        // Check if song already exists (duplicate prevention)
        if (prev.some(s => s.id === song.id)) {
          return prev;
        }
        // Insert in sorted order by name
        return [...prev, song].sort((a, b) => a.name.localeCompare(b.name));
      });
      
      // Clear localStorage cache so it doesn't return stale data
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SONGS_CACHE_KEY);
      }
      
      toast.success('Song created successfully');
      return song;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create song';
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
        setSongs(prev => prev.map(s => s.id === id ? song : s));
        
        // Clear localStorage cache so it doesn't return stale data
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(SONGS_CACHE_KEY);
        }
        
        toast.success('Song updated successfully');
      }
      return song;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update song';
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
      const success = await songService.deleteSong(id);
      if (success) {
        setSongs(prev => prev.filter(song => song.id !== id));
        
        // Clear localStorage cache so it doesn't return stale data
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(SONGS_CACHE_KEY);
        }
        
        toast.success('Song deleted successfully');
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete song';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
