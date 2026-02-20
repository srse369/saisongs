import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SongSingerPitch, CreatePitchInput, UpdatePitchInput, ServiceError } from '../types';
import { pitchService } from '../services';
import { useToast } from './ToastContext';
import { getCacheItem, setCacheItem } from '../utils/cacheUtils';
import { globalEventBus } from '../utils/globalEventBus';
import { isOfflineError, addToOfflineQueue, generateTempId, resolveNameFromCache } from '../utils/offlineQueue';

const PITCHES_CACHE_KEY = 'saiSongs:pitchesCache';
const PITCHES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PitchContextState {
  pitches: SongSingerPitch[];
  loading: boolean;
  error: ServiceError | null;
  hasFetched: boolean;
  fetchAllPitches: (forceRefresh?: boolean) => Promise<void>;
  getPitchesForSong: (songId: string) => Promise<void>;
  getPitchesForSinger: (singerId: string) => Promise<void>;
  createPitch: (input: CreatePitchInput) => Promise<SongSingerPitch | null>;
  updatePitch: (id: string, input: UpdatePitchInput) => Promise<SongSingerPitch | null>;
  deletePitch: (id: string) => Promise<void>;
  clearError: () => void;
  clearState: () => void;
}

const PitchContext = createContext<PitchContextState | undefined>(undefined);

interface PitchProviderProps {
  children: ReactNode;
}

export const PitchProvider: React.FC<PitchProviderProps> = ({ children }) => {
  const [pitches, setPitches] = useState<SongSingerPitch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const toast = useToast();

  // Listen for pitch creation/deletion events to update state optimistically
  useEffect(() => {
    let unsubscribes: (() => void)[] = [];

    const unsubscribePitchCreated = globalEventBus.on('pitchCreated', (detail) => {
      const { pitch, tempId } = detail;
      if (pitch) {
        setPitches(prev => {
          let updated: SongSingerPitch[];
          if (tempId) {
            updated = prev.filter(p => p.id !== tempId);
          } else if (prev.some(p => p.id === pitch.id)) {
            updated = prev.map(p => p.id === pitch.id ? pitch : p);
          } else {
            updated = [...prev, pitch];
          }
          if (typeof window !== 'undefined') {
            setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: updated })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribePitchUpdated = globalEventBus.on('pitchUpdated', (detail) => {
      const { pitch } = detail;
      if (pitch) {
        setPitches(prev => {
          // Check if pitch already exists (duplicate prevention)
          let updated: SongSingerPitch[];
          if (prev.some(p => p.id === pitch.id)) {
            updated = prev.map(p => p.id === pitch.id ? pitch : p);
          } else {
            updated = [...prev, pitch];
          }
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              pitches: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    const unsubscribePitchDeleted = globalEventBus.on('pitchDeleted', (detail) => {
      const { pitch } = detail;
      if (pitch) {
        setPitches(prev => {
          const updated = prev.filter(p => p.id !== pitch.id);
          // Update localStorage cache to keep it in sync
          if (typeof window !== 'undefined') {
            setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              pitches: updated,
            })).catch(() => {});
          }
          return updated;
        });
      }
    });

    unsubscribes.push(unsubscribePitchCreated, unsubscribePitchUpdated, unsubscribePitchDeleted);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearState = useCallback(() => {
    setPitches([]);
    setError(null);
    setHasFetched(false);
  }, []);

  const fetchAllPitches = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent retry loops: if we've already fetched and failed, don't retry automatically
    if (!forceRefresh && hasFetched && error) {
      return;
    }

    // Reset backoff for explicit user-triggered refreshes
    if (forceRefresh && typeof window !== 'undefined') {
      const { apiClient } = await import('../services/ApiClient');
      apiClient.resetBackoff('/pitches');
      setError(null);
      setHasFetched(false);
    }

    setLoading(true);
    setError(null);
    try {
      // Try to hydrate from browser cache first to speed up page load,
      // unless the caller explicitly requested a forced refresh.
      if (!forceRefresh && typeof window !== 'undefined') {
        const cachedRaw = await getCacheItem(PITCHES_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as {
              timestamp: number;
              pitches: SongSingerPitch[];
            };
            const now = Date.now();
            if (cached.timestamp && now - cached.timestamp < PITCHES_CACHE_TTL_MS && Array.isArray(cached.pitches)) {
              setPitches(cached.pitches);
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
      const fetchedPitches = await pitchService.getAllPitches(forceRefresh);
      setPitches(fetchedPitches);
      setHasFetched(true);

      // Persist to cache for subsequent loads
      if (typeof window !== 'undefined') {
        const cacheData = JSON.stringify({
          timestamp: Date.now(),
          pitches: fetchedPitches,
        });

        if (!(await setCacheItem(PITCHES_CACHE_KEY, cacheData))) {
          // Silently ignore storage errors (e.g., quota exceeded on mobile)
          // Pitches will be fetched from server on next load
          console.warn('Failed to cache pitches to localStorage due to quota. Pitches will be fetched from server on next load.');
        }
      }
    } catch (err) {
      // Offline fallback: use cached data even if expired so app works without network
      if (typeof window !== 'undefined') {
        const cachedRaw = await getCacheItem(PITCHES_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as { timestamp: number; pitches: SongSingerPitch[] };
            if (cached.pitches && Array.isArray(cached.pitches)) {
              setPitches(cached.pitches);
              setHasFetched(true);
              return;
            }
          } catch {
            // Fall through to error
          }
        }
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pitches';
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

  const getPitchesForSong = useCallback(async (songId: string) => {
    setLoading(true);
    setError(null);
    try {
      const pitches = await pitchService.getPitchesForSong(songId);
      setPitches(pitches);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pitches for song';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getPitchesForSinger = useCallback(async (singerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const pitches = await pitchService.getPitchesForSinger(singerId);
      setPitches(pitches);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pitches for singer';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createPitch = useCallback(async (input: CreatePitchInput): Promise<SongSingerPitch | null> => {
    setLoading(true);
    setError(null);
    const tempId = generateTempId('pitch');
    const optimisticPitch: SongSingerPitch = { id: tempId, songId: input.songId, singerId: input.singerId, pitch: input.pitch };
    try {
      if (typeof window !== 'undefined') {
        setPitches(prev => {
          const updated = [...prev, optimisticPitch];
          setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: updated })).catch(() => {});
          return updated;
        });
      }
      const pitch = await pitchService.createPitch(input);

      if (pitch) {
        // Dispatch global event to notify other components
        if (typeof window !== 'undefined') {
          globalEventBus.dispatch('pitchCreated', { type: 'pitchCreated', pitch, tempId });
        }
        toast.success(`Pitch association created successfully`);
        return pitch;
      }
      if (typeof window !== 'undefined') {
        setPitches(prev => {
          const reverted = prev.filter(p => p.id !== tempId);
          setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: reverted })).catch(() => {});
          return reverted;
        });
      }
      console.error('Failed to create pitch', input);
      toast.error('Failed to create pitch association');
      return null;
    } catch (err) {
      if (typeof window !== 'undefined') {
        setPitches(prev => {
          const reverted = prev.filter(p => p.id !== tempId);
          setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: reverted })).catch(() => {});
          return reverted;
        });
      }
      if (isOfflineError(err)) {
        const [songName, singerName] = await Promise.all([
          resolveNameFromCache(input.songId, 'song'),
          resolveNameFromCache(input.singerId, 'singer'),
        ]);
        addToOfflineQueue({
          type: 'create',
          entity: 'pitch',
          payload: { ...input, songName: songName ?? '', singerName: singerName ?? '' } as unknown as Record<string, unknown>,
          tempId,
          displayLabel: `Pitch: ${(songName ?? '') || input.songId} / ${(singerName ?? '') || input.singerId} / ${input.pitch}`,
        });
        globalEventBus.dispatch('pitchCreated', { type: 'pitchCreated', pitch: optimisticPitch });
        toast.success(`Pitch saved offline. Will sync when online.`);
        return optimisticPitch;
      }
      console.error(`Error creating pitch ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error creating pitch: ${err}`;
      setError({ code: 'UNKNOWN_ERROR', message: errorMessage });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updatePitch = useCallback(async (id: string, input: UpdatePitchInput): Promise<SongSingerPitch | null> => {
    setLoading(true);
    setError(null);
    const existing = pitches.find((p) => p.id === id);
    const optimisticPitch = existing ? { ...existing, ...input } : null;
    try {
      if (optimisticPitch && typeof window !== 'undefined') {
        setPitches(prev => {
          const updated = prev.map(p => p.id === id ? optimisticPitch : p);
          setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: updated })).catch(() => {});
          return updated;
        });
      }
      const pitch = await pitchService.updatePitch(id, input);
      if (pitch) {
        // Dispatch global event to notify other components
        if (typeof window !== 'undefined') {
          globalEventBus.dispatch('pitchUpdated', {
            type: 'pitchUpdated',
            pitch: pitch
          });
        }
        toast.success('Pitch association updated successfully');
        return pitch;
      }
      if (existing && typeof window !== 'undefined') {
        setPitches(prev => {
          const reverted = prev.map(p => p.id === id ? existing : p);
          setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: reverted })).catch(() => {});
          return reverted;
        });
      }
      console.error('Failed to update pitch', input);
      toast.error('Failed to update pitch association');
      return null;
    } catch (err) {
      if (existing && typeof window !== 'undefined') {
        setPitches(prev => {
          const reverted = prev.map(p => p.id === id ? existing : p);
          setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: reverted })).catch(() => {});
          return reverted;
        });
      }
      if (isOfflineError(err)) {
        const existing = pitches.find((p) => p.id === id);
        if (existing) {
          const [resolvedSong, resolvedSinger] = await Promise.all([
            resolveNameFromCache(existing.songId, 'song'),
            resolveNameFromCache(existing.singerId, 'singer'),
          ]);
          const songName = existing.songName ?? resolvedSong ?? '';
          const singerName = existing.singerName ?? resolvedSinger ?? '';
          addToOfflineQueue({
            type: 'update',
            entity: 'pitch',
            payload: { id, ...input, songName, singerName } as unknown as Record<string, unknown>,
            displayLabel: `Pitch: ${songName || existing.songId} / ${singerName || existing.singerId} → ${input.pitch ?? existing.pitch}`,
          });
          const optimisticPitch: SongSingerPitch = { ...existing, ...input };
          globalEventBus.dispatch('pitchUpdated', { type: 'pitchUpdated', pitch: optimisticPitch });
          toast.success(`Pitch saved offline. Will sync when online.`);
          setLoading(false);
          return optimisticPitch;
        }
      }
      console.error(`Error updating pitch ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error updating pitch: ${err}`;
      setError({ code: 'UNKNOWN_ERROR', message: errorMessage });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, pitches]);

  const deletePitch = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Get the pitch before deleting to know which singer/song to update
      // Try from state first (fast), but fallback to fetching from backend if not found
      let pitchToDelete = pitches.find(p => p.id === id);

      // If pitch not in state, fetch from backend to get full pitch data
      if (!pitchToDelete) {
        // Note: We don't have a getPitchById method, so we'll proceed with what we have
        // The event listener will handle the state update optimistically
      }

      if (pitchToDelete) {
        if (typeof window !== 'undefined') {
          setPitches(prev => {
            const updated = prev.filter(p => p.id !== id);
            setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: updated })).catch(() => {});
            return updated;
          });
        }
        await pitchService.deletePitch(id);
        if (typeof window !== 'undefined') {
          // Dispatch global event to notify other components
          globalEventBus.dispatch('pitchDeleted', {
            type: 'pitchDeleted',
            pitch: pitchToDelete
          });
        }
        toast.success('Pitch association deleted successfully');
      } else {
        if (pitchToDelete && typeof window !== 'undefined') {
          setPitches(prev => {
            const reverted = [...prev, pitchToDelete];
            setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: reverted })).catch(() => {});
            return reverted;
          });
        }
        console.error(`Failed to delete pitch ${id}`);
        toast.error('Failed to delete pitch association');
      }
    } catch (err) {
      if (pitchToDelete && typeof window !== 'undefined') {
        setPitches(prev => {
          const reverted = [...prev, pitchToDelete];
          setCacheItem(PITCHES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), pitches: reverted })).catch(() => {});
          return reverted;
        });
      }
      if (isOfflineError(err)) {
        const pitchToDelete = pitches.find((p) => p.id === id);
        if (pitchToDelete) {
          const [resolvedSong, resolvedSinger] = await Promise.all([
            resolveNameFromCache(pitchToDelete.songId, 'song'),
            resolveNameFromCache(pitchToDelete.singerId, 'singer'),
          ]);
          const songName = pitchToDelete.songName ?? resolvedSong ?? '';
          const singerName = pitchToDelete.singerName ?? resolvedSinger ?? '';
          addToOfflineQueue({
            type: 'delete',
            entity: 'pitch',
            payload: { id, songName, singerName, pitch: pitchToDelete.pitch },
            displayLabel: `Pitch: ${songName || pitchToDelete.songId} / ${singerName || pitchToDelete.singerId} (${pitchToDelete.pitch})`,
          });
          globalEventBus.dispatch('pitchDeleted', { type: 'pitchDeleted', pitch: pitchToDelete });
          toast.success(`Pitch removed offline. Will sync when online.`);
          setLoading(false);
          return;
        }
      }
      console.error(`Error deleting pitch ${id}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error deleting pitch: ${err}`;
      setError({ code: 'UNKNOWN_ERROR', message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast, pitches]);

  const value: PitchContextState = {
    pitches,
    loading,
    error,
    hasFetched,
    fetchAllPitches,
    getPitchesForSong,
    getPitchesForSinger,
    createPitch,
    updatePitch,
    deletePitch,
    clearError,
    clearState,
  };

  return <PitchContext.Provider value={value}>{children}</PitchContext.Provider>;
};

export const usePitches = (): PitchContextState => {
  const context = useContext(PitchContext);
  if (context === undefined) {
    throw new Error('usePitches must be used within a PitchProvider');
  }
  return context;
};
