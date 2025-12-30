import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Singer, CreateSingerInput, UpdateSingerInput, ServiceError } from '../types';
import { singerService } from '../services';
import { useToast } from './ToastContext';
import { compareStringsIgnoringSpecialChars } from '../utils';

const SINGERS_CACHE_KEY = 'songStudio:singersCache';
const SINGERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface SingerContextState {
  singers: Singer[];
  loading: boolean;
  error: ServiceError | null;
  fetchSingers: (forceRefresh?: boolean) => Promise<void>;
  getSingerById: (id: string) => Promise<Singer | null>;
  createSinger: (input: CreateSingerInput) => Promise<Singer | null>;
  updateSinger: (id: string, input: UpdateSingerInput) => Promise<Singer | null>;
  deleteSinger: (id: string) => Promise<void>;
  mergeSingers: (targetSingerId: string, singerIdsToMerge: string[]) => Promise<boolean>;
  clearError: () => void;
  clearState: () => void;
}

const SingerContext = createContext<SingerContextState | undefined>(undefined);

interface SingerProviderProps {
  children: ReactNode;
}

export const SingerProvider: React.FC<SingerProviderProps> = ({ children }) => {
  const [singers, setSingers] = useState<Singer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const toast = useToast();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearState = useCallback(() => {
    setSingers([]);
    setError(null);
    setHasFetched(false);
  }, []);

  const fetchSingers = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent retry loops: if we've already fetched and failed, don't retry automatically
    if (!forceRefresh && hasFetched && error) {
      return;
    }
    
    // Reset backoff for explicit user-triggered refreshes
    if (forceRefresh && typeof window !== 'undefined') {
      const { apiClient } = await import('../services/ApiClient');
      apiClient.resetBackoff('/singers');
      setError(null);
      setHasFetched(false);
    }
    
    setLoading(true);
    setError(null);
    try {
      // Try to hydrate from browser cache first to speed up page load,
      // unless the caller explicitly requested a forced refresh.
      if (!forceRefresh && typeof window !== 'undefined') {
        const cachedRaw = window.localStorage.getItem(SINGERS_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as {
              timestamp: number;
              singers: Singer[];
            };
            const now = Date.now();
            if (cached.timestamp && now - cached.timestamp < SINGERS_CACHE_TTL_MS && Array.isArray(cached.singers)) {
              setSingers(cached.singers);
              setLoading(false);
              setHasFetched(true);
              return;
            }
          } catch {
            // Ignore cache parse errors and fall back to network
          }
        }
      }

      // Fetch from backend - pass nocache if force refresh to invalidate server cache too
      const fetchedSingers = await singerService.getAllSingers(forceRefresh);
      setSingers(fetchedSingers);
      setHasFetched(true);

      // Persist to cache for subsequent loads
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            SINGERS_CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              singers: fetchedSingers,
            })
          );
        } catch (e) {
          // Silently ignore storage errors (e.g., quota exceeded on iOS)
          console.warn('Failed to cache singers to localStorage:', e);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch singers';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [toast, hasFetched, error]);

  const getSingerById = useCallback(async (id: string): Promise<Singer | null> => {
    setLoading(true);
    setError(null);
    try {
      const singer = await singerService.getSingerById(id);
      return singer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch singer';
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

  const createSinger = useCallback(async (input: CreateSingerInput): Promise<Singer | null> => {
    setLoading(true);
    setError(null);
    try {
      const singer = await singerService.createSinger(input);
      
      // Add the singer to local state immediately for optimistic update
      setSingers(prev => {
        // Check if singer already exists (duplicate prevention)
        if (prev.some(s => s.id === singer.id)) {
          return prev;
        }
        // Insert in sorted order by name
        const newList = [...prev, singer].sort((a, b) => 
          compareStringsIgnoringSpecialChars(a.name, b.name)
        );
        return newList;
      });
      
      // Clear localStorage cache so fresh data is fetched next time
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SINGERS_CACHE_KEY);
      }
      
      toast.success('Singer created successfully');
      return singer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create singer';
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

  const updateSinger = useCallback(async (id: string, input: UpdateSingerInput): Promise<Singer | null> => {
    setLoading(true);
    setError(null);
    try {
      const singer = await singerService.updateSinger(id, input);
      if (singer) {
        setSingers(prev => prev.map(s => s.id === id ? singer : s));
        // Clear localStorage cache so fresh data is fetched next time
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(SINGERS_CACHE_KEY);
        }
        toast.success('Singer updated successfully');
      }
      return singer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update singer';
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

  const deleteSinger = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await singerService.deleteSinger(id);
      setSingers(prev => prev.filter(singer => singer.id !== id));
      // Clear localStorage cache so fresh data is fetched next time
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SINGERS_CACHE_KEY);
      }
      toast.success('Singer deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete singer';
      // Show toast notification but don't persist error in state
      // since we have a persistent error display in the UI
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const mergeSingers = useCallback(async (targetSingerId: string, singerIdsToMerge: string[]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await singerService.mergeSingers(targetSingerId, singerIdsToMerge);
      
      // Clear localStorage caches for singers and pitches
      // Note: Pitches are also affected by merge (transferred/deleted), so we clear their cache too
      // The calling component (SingerManager) will refresh pitches after merge completes
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SINGERS_CACHE_KEY);
        window.localStorage.removeItem('songStudio:pitchesCache');
      }
      
      // Refresh singers list to get updated data (merged singers are deleted, target singer updated)
      await fetchSingers(true);
      
      toast.success(`Successfully merged ${result.mergedCount} singer(s)`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to merge singers';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchSingers]);

  const value: SingerContextState = {
    singers,
    loading,
    error,
    fetchSingers,
    getSingerById,
    createSinger,
    updateSinger,
    deleteSinger,
    mergeSingers,
    clearError,
    clearState,
  };

  return <SingerContext.Provider value={value}>{children}</SingerContext.Provider>;
};

export const useSingers = (): SingerContextState => {
  const context = useContext(SingerContext);
  if (context === undefined) {
    throw new Error('useSingers must be used within a SingerProvider');
  }
  return context;
};
