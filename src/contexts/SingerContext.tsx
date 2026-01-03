import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Singer, CreateSingerInput, UpdateSingerInput, ServiceError } from '../types';
import { singerService } from '../services';
import { useToast } from './ToastContext';
import { compareStringsIgnoringSpecialChars } from '../utils';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from '../utils/cacheUtils';

const SINGERS_CACHE_KEY = 'saiSongs:singersCache';
const SINGERS_CACHE_TTL_MS = 10 * 60 * 1000; // 5 minutes

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

  // Listen for pitch creation/deletion events to update pitch counts optimistically
  // Listen for pitch events to update pitch counts optimistically
  useEffect(() => {
    let unsubscribes: (() => void)[] = [];
    
    import('../utils/globalEventBus').then(({ globalEventBus }) => {
      const unsubscribePitchCreated = globalEventBus.on('pitchCreated', (detail) => {
        const { singerId } = detail;
        setSingers(prev => {
          const updated = prev.map(singer => 
            singer.id === singerId 
              ? { ...singer, pitchCount: (singer.pitchCount ?? 0) + 1 }
              : singer
          );
          
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            const cacheData = JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            });
            setLocalStorageItem(SINGERS_CACHE_KEY, cacheData);
          }
          
          return updated;
        });
      });
      
      const unsubscribePitchDeleted = globalEventBus.on('pitchDeleted', (detail) => {
        const { singerId } = detail;
        setSingers(prev => {
          const updated = prev.map(singer => 
            singer.id === singerId 
              ? { ...singer, pitchCount: Math.max(0, (singer.pitchCount ?? 0) - 1) }
              : singer
          );
          
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            const cacheData = JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            });
            setLocalStorageItem(SINGERS_CACHE_KEY, cacheData);
          }
          
          return updated;
        });
      });
      
      unsubscribes.push(unsubscribePitchCreated, unsubscribePitchDeleted);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

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
        const cachedRaw = getLocalStorageItem(SINGERS_CACHE_KEY);
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
        const cacheData = JSON.stringify({
          timestamp: Date.now(),
          singers: fetchedSingers,
        });
        
        if (!setLocalStorageItem(SINGERS_CACHE_KEY, cacheData)) {
          // Silently ignore storage errors (e.g., quota exceeded on mobile)
          // Singers will be fetched from server on next load
          console.warn('Failed to cache singers to localStorage due to quota. Singers will be fetched from server on next load.');
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
      // Also update localStorage cache with the new singer included
      setSingers(prev => {
        // Check if singer already exists (duplicate prevention)
        if (prev.some(s => s.id === singer.id)) {
          return prev;
        }
        // Insert in sorted order by name
        const newList = [...prev, singer].sort((a, b) => 
          compareStringsIgnoringSpecialChars(a.name, b.name)
        );
        
        // Update localStorage cache with the updated list
        // This ensures the cache is up-to-date for other components/tabs
        if (typeof window !== 'undefined') {
          const cacheData = JSON.stringify({
            timestamp: Date.now(),
            singers: newList,
          });
          
          if (!setLocalStorageItem(SINGERS_CACHE_KEY, cacheData)) {
            // Silently ignore storage errors (e.g., quota exceeded on mobile)
            console.warn('Failed to update singers cache in localStorage due to quota.');
          }
        }
        
        return newList;
      });
      
      // Dispatch global event to notify other components
      const centerIds = singer.centerIds || input.centerIds || [];
      if (centerIds.length > 0) {
        import('../utils/globalEventBus').then(({ globalEventBus }) => {
          globalEventBus.dispatch('singerCreated', { type: 'singerCreated', centerIds });
        });
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
      // Get the old singer to track center changes
      const oldSinger = singers.find(s => s.id === id);
      const oldCenterIds = oldSinger?.centerIds || [];
      
      const singer = await singerService.updateSinger(id, input);
      if (singer) {
        setSingers(prev => prev.map(s => s.id === id ? singer : s));
        // Clear localStorage cache so fresh data is fetched next time
        if (typeof window !== 'undefined') {
          removeLocalStorageItem(SINGERS_CACHE_KEY);
          
          // Dispatch global event to notify other components
          const newCenterIds = singer.centerIds || [];
          const centersRemoved = oldCenterIds.filter(cid => !newCenterIds.includes(cid));
          const centersAdded = newCenterIds.filter(cid => !oldCenterIds.includes(cid));
          
          if (centersRemoved.length > 0 || centersAdded.length > 0) {
            import('../utils/globalEventBus').then(({ globalEventBus }) => {
              globalEventBus.dispatch('singerUpdated', { 
                type: 'singerUpdated',
                centerIdsRemoved: centersRemoved,
                centerIdsAdded: centersAdded
              });
            });
          }
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
  }, [toast, singers]);

  const deleteSinger = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Get the singer before deleting to know which centers to update
      // Try from state first (fast), but fallback to fetching from backend if not found
      let singerToDelete = singers.find(s => s.id === id);
      let centerIds = singerToDelete?.centerIds || [];
      
      // If singer not in state, fetch from backend to get centerIds
      if (!singerToDelete || !centerIds.length) {
        const fetchedSinger = await singerService.getSingerById(id);
        if (fetchedSinger) {
          singerToDelete = fetchedSinger;
          centerIds = fetchedSinger.centerIds || [];
        }
      }
      
      await singerService.deleteSinger(id);
      
      // Update state optimistically
      setSingers(prev => prev.filter(singer => singer.id !== id));
      
      // Clear localStorage cache so fresh data is fetched next time
      if (typeof window !== 'undefined') {
        removeLocalStorageItem(SINGERS_CACHE_KEY);
        
        // Dispatch global event to notify other components
        // Always dispatch, even if no centers, so other components can refresh
        import('../utils/globalEventBus').then(({ globalEventBus }) => {
          globalEventBus.dispatch('singerDeleted', { 
            type: 'singerDeleted',
            centerIds: centerIds || []
          });
          // Also request refresh for singers to ensure consistency
          globalEventBus.requestRefresh('singers');
        });
      }
      
      // Refresh from backend to ensure state is in sync
      await fetchSingers(true);
      
      toast.success('Singer deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete singer';
      // Show toast notification but don't persist error in state
      // since we have a persistent error display in the UI
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast, singers]);

  const mergeSingers = useCallback(async (targetSingerId: string, singerIdsToMerge: string[]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Get centerIds of singers being merged before the merge (for event dispatch)
      const singersToMerge = singers.filter(s => singerIdsToMerge.includes(s.id));
      const allCenterIdsFromMerged = new Set<number>();
      singersToMerge.forEach(singer => {
        (singer.centerIds || []).forEach(id => allCenterIdsFromMerged.add(id));
      });
      
      // Get target singer's centerIds before merge
      const targetSinger = singers.find(s => s.id === targetSingerId);
      const targetCenterIdsBefore = targetSinger?.centerIds || [];
      
      const result = await singerService.mergeSingers(targetSingerId, singerIdsToMerge);
      
      // Clear localStorage caches for singers and pitches
      // Note: Pitches are also affected by merge (transferred/deleted), so we clear their cache too
      // The calling component (SingerManager) will refresh pitches after merge completes
      if (typeof window !== 'undefined') {
        removeLocalStorageItem(SINGERS_CACHE_KEY);
        removeLocalStorageItem('saiSongs:pitchesCache');
        
        // Dispatch global events to notify other components
        // 1. Dispatch singerDeleted for each merged singer
        const centerIdsArray = Array.from(allCenterIdsFromMerged);
        if (centerIdsArray.length > 0) {
          import('../utils/globalEventBus').then(({ globalEventBus }) => {
            // Dispatch deleted events for merged singers
            globalEventBus.dispatch('singerDeleted', {
              type: 'singerDeleted',
              centerIds: centerIdsArray
            });
          });
        }
        
        // 2. After refresh, we'll check if target singer's centers changed
        // For now, dispatch a general refresh request
        import('../utils/globalEventBus').then(({ globalEventBus }) => {
          globalEventBus.requestRefresh('singers');
          globalEventBus.requestRefresh('centers');
          globalEventBus.requestRefresh('pitches');
        });
      }
      
      // Refresh singers list to get updated data (merged singers are deleted, target singer updated)
      await fetchSingers(true);
      
      // After refresh, check if target singer's centers changed and dispatch singerUpdated if needed
      // Use setSingers functional form to access the latest state after fetchSingers updates it
      if (typeof window !== 'undefined') {
        setSingers(currentSingers => {
          const updatedTargetSinger = currentSingers.find(s => s.id === targetSingerId);
          if (updatedTargetSinger) {
            const targetCenterIdsAfter = updatedTargetSinger.centerIds || [];
            const centersRemoved = targetCenterIdsBefore.filter(cid => !targetCenterIdsAfter.includes(cid));
            const centersAdded = targetCenterIdsAfter.filter(cid => !targetCenterIdsBefore.includes(cid));
            
            if (centersRemoved.length > 0 || centersAdded.length > 0) {
              import('../utils/globalEventBus').then(({ globalEventBus }) => {
                globalEventBus.dispatch('singerUpdated', {
                  type: 'singerUpdated',
                  centerIdsRemoved: centersRemoved,
                  centerIdsAdded: centersAdded
                });
              });
            }
          }
          return currentSingers; // Return unchanged state
        });
      }
      
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
  }, [toast, fetchSingers, singers]);

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
