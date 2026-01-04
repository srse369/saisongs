import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Singer, CreateSingerInput, UpdateSingerInput, ServiceError } from '../types';
import { singerService } from '../services';
import { useToast } from './ToastContext';
import { compareStringsIgnoringSpecialChars } from '../utils';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from '../utils/cacheUtils';
import { globalEventBus } from '../utils/globalEventBus';

const SINGERS_CACHE_KEY = 'saiSongs:singersCache';
const SINGERS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

    const unsubscribeSingerCreated = globalEventBus.on('singerCreated', (detail) => {
      const { singer } = detail;
      if (singer) {
        setSingers(prev => {
          // Check if singer already exists (duplicate prevention)
          if (prev.some(s => s.id === singer.id)) {
            const updated = prev.map(s => s.id === singer.id ? singer as Singer : s);
            if (typeof window !== 'undefined') {
              setLocalStorageItem(SINGERS_CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                singers: updated,
              }));
            }
            return updated;
          }
          const updated = [...prev, singer as Singer];
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SINGERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerUpdated = globalEventBus.on('singerUpdated', (detail) => {
      const { singer } = detail;
      if (singer) {
        setSingers(prev => {
          const updated = prev.map(s => s.id === singer.id ? singer as Singer : s);
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SINGERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerDeleted = globalEventBus.on('singerDeleted', (detail) => {
      const { singer } = detail;
      if (singer) {
        setSingers(prev => {
          const updated = prev.filter(s => s.id !== singer.id);
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SINGERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribeSingerMerged = globalEventBus.on('singerMerged', (detail) => {
      const { singer, singerIdsRemoved } = detail;
      if (singer) {
        setSingers(prev => {
          let updated = prev.map(s => s.id === singer.id ? singer as Singer : s);
          updated = updated.filter(s => !singerIdsRemoved.includes(s.id));
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SINGERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribePitchCreated = globalEventBus.on('pitchCreated', (detail) => {
      const { pitch } = detail;
      if (pitch) {
        setSingers(prev => {
          const updated = prev.map(singer =>
            singer.id === pitch.singerId
              ? { ...singer, pitchCount: (singer.pitchCount ?? 0) + 1 }
              : singer
          );
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SINGERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            }));
          }
          return updated;
        });
      }
    });

    const unsubscribePitchDeleted = globalEventBus.on('pitchDeleted', (detail) => {
      const { pitch } = detail;
      if (pitch) {
        setSingers(prev => {
          const updated = prev.map(singer =>
            singer.id === pitch.singerId
              ? { ...singer, pitchCount: Math.max(0, (singer.pitchCount ?? 0) - 1) }
              : singer
          );
          if (typeof window !== 'undefined') {
            setLocalStorageItem(SINGERS_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              singers: updated,
            }));
          }
          return updated;
        });
      }
    });

    unsubscribes.push(unsubscribeSingerCreated, unsubscribeSingerUpdated, unsubscribeSingerDeleted, unsubscribeSingerMerged, unsubscribePitchCreated, unsubscribePitchDeleted);

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

      if (singer) {
        if (typeof window !== 'undefined') {
          // Dispatch global event to notify other components
          const centerIds = singer.centerIds || input.centerIds || [];
          globalEventBus.dispatch('singerCreated', { type: 'singerCreated', singer: singer, centerIds });
        }
        toast.success(`Singer ${singer.name} created successfully`);
        return singer;
      }
      console.error('Failed to create singer', input);
      toast.error(`Failed to create singer ${input.name}`);
      return null;
    } catch (err) {
      console.error(`Error creating singer ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error creating singer ${input.name}: ${err.message}`;
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
        // Clear localStorage cache so fresh data is fetched next time
        if (typeof window !== 'undefined') {
          // Dispatch global event to notify other components
          const newCenterIds = singer.centerIds || [];
          const centersRemoved = oldCenterIds.filter(cid => !newCenterIds.includes(cid));
          const centersAdded = newCenterIds.filter(cid => !oldCenterIds.includes(cid));

          globalEventBus.dispatch('singerUpdated', {
            type: 'singerUpdated',
            singer: singer,
            centerIdsRemoved: centersRemoved,
            centerIdsAdded: centersAdded
          });
        }
        toast.success(`Singer ${singer.name} updated successfully`);
        return singer;
      } else {
        console.error('Failed to update singer', input);
        toast.error(`Failed to update singer ${input.name}`);
        return null;
      }
    } catch (err) {
      console.error(`Error updating singer ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error updating singer ${input.name}: ${err.message}`;
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

      if (singerToDelete) {
        await singerService.deleteSinger(id);
        if (typeof window !== 'undefined') {
          // Dispatch global event to notify other components
          // Always dispatch, even if no centers, so other components can refresh
          globalEventBus.dispatch('singerDeleted', {
            type: 'singerDeleted',
            singer: singerToDelete || null,
            centerIds: centerIds || []
          });
        }
        toast.success(`Singer ${singerToDelete.name} deleted successfully`);
      } else {
        console.error(`Failed to delete singer ${id}`);
        toast.error('Failed to delete singer');
      }
    } catch (err) {
      console.error(`Error deleting singer ${id}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error deleting singer: ${err.message}`;
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast, singers]);

  /*
  * Merges multiple singers into one target singer
  * @param targetSingerId - The singer ID to keep
  * @param singerIdsToMerge - Array of singer IDs to merge into the target (not including the target singer)
  * @returns Result of the merge operation
  */
  const mergeSingers = useCallback(async (targetSingerId: string, singerIdsToMerge: string[]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Get target singer
      let targetSinger: Singer | undefined | null = singers.find(s => s.id === targetSingerId);
      if (!targetSinger) {
        targetSinger = await singerService.getSingerById(targetSingerId);
        if (!targetSinger) {
          console.error(`Failed to get target singer ${targetSingerId}`);
          toast.error(`Failed to get target singer ${targetSingerId}`);
          return false;
        }
      }

      // Get singers to merge
      let singersToMerge: Singer[] = [];
      singerIdsToMerge.forEach(async (singerId) => {
        let singer: Singer | null | undefined = singers.find(s => s.id === singerId);
        if (!singer) {
          singer = await singerService.getSingerById(singerId);
          if (singer) {
            singersToMerge.push(singer);
          } else {
            console.error(`Failed to get singer ${singerId}, possibly a partial merge`);
          }
        } else {
          singersToMerge.push(singer);
        }
      });

      const targetCenterIdsBefore = targetSinger?.centerIds || [];
      console.log('targetCenterIdsBefore', targetCenterIdsBefore);
      const allCenterIdsFromMerged = targetCenterIdsBefore.concat(singersToMerge.flatMap(s => s.centerIds || []));
      const targetCenterIdsAfter = [...new Set(allCenterIdsFromMerged)];
      console.log('targetCenterIdsAfter', targetCenterIdsAfter);
      targetSinger.centerIds = targetCenterIdsAfter;

      const result = await singerService.mergeSingers(targetSingerId, singerIdsToMerge);

      if (result) {
        const targetSingerPitchCountUp: number = result.targetSingerPitchCountUp || 0;
        const songIdsPitchCountDown: Map<string, number> = new Map(Object.entries(result.songIdsPitchCountDown || {}));
        const centerIdsSingerCountDown: Map<string, number> = new Map(Object.entries(result.centerIdsSingerCountDown || {}));

        if (typeof window !== 'undefined') {
          // Dispatch global events to notify other components
          console.log('dispatching singerMerged event', targetSinger, singerIdsToMerge, targetSingerPitchCountUp, songIdsPitchCountDown, centerIdsSingerCountDown);
          globalEventBus.dispatch('singerMerged', {
            type: 'singerMerged',
            singer: targetSinger || null,
            singerIdsRemoved: singerIdsToMerge,
            targetSingerPitchCountUp: targetSingerPitchCountUp,
            songIdsPitchCountDown: songIdsPitchCountDown,
            centerIdsSingerCountDown: centerIdsSingerCountDown,
          });
        }
        toast.success(`Successfully merged ${singerIdsToMerge.length} singers into ${targetSinger?.name}`);
        return true;
      }
      console.error('Failed to merge singers', targetSingerId, singerIdsToMerge);
      toast.error('Failed to merge singers');
      return false;
    } catch (err) {
      console.error(`Error merging singers ${targetSingerId}, ${singerIdsToMerge}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error merging singers: ${err.message}`;
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
