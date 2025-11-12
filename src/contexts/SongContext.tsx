import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Song, CreateSongInput, UpdateSongInput, ServiceError } from '../types';
import { songService } from '../services';
import { useToast } from './ToastContext';

interface SongContextState {
  songs: Song[];
  loading: boolean;
  error: ServiceError | null;
  fetchSongs: () => Promise<void>;
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
  const toast = useToast();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchSongs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const songs = await songService.getAllSongs();
      setSongs(songs);
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
      setSongs(prev => [...prev, song]);
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
