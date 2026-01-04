import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SongSingerPitch, CreatePitchInput, UpdatePitchInput, ServiceError } from '../types';
import { pitchService } from '../services';
import { useToast } from './ToastContext';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from '../utils/cacheUtils';
import { globalEventBus } from '../utils/globalEventBus';

const PITCHES_CACHE_KEY = 'saiSongs:pitchesCache';
const PITCHES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PitchContextState {
  pitches: SongSingerPitch[];
  loading: boolean;
  error: ServiceError | null;
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
            setLocalStorageItem(PITCHES_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              pitches: updated,
            }));
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
            setLocalStorageItem(PITCHES_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              pitches: updated,
            }));
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
            setLocalStorageItem(PITCHES_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              pitches: updated,
            }));
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
        const cachedRaw = getLocalStorageItem(PITCHES_CACHE_KEY);
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

        if (!setLocalStorageItem(PITCHES_CACHE_KEY, cacheData)) {
          // Silently ignore storage errors (e.g., quota exceeded on mobile)
          // Pitches will be fetched from server on next load
          console.warn('Failed to cache pitches to localStorage due to quota. Pitches will be fetched from server on next load.');
        }
      }
    } catch (err) {
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
    try {
      const pitch = await pitchService.createPitch(input);

      if (pitch) {
        // Dispatch global event to notify other components
        if (typeof window !== 'undefined') {
          globalEventBus.dispatch('pitchCreated', {
            type: 'pitchCreated',
            pitch: pitch
          });
        }
        toast.success(`Pitch association created successfully`);
        return pitch;
      }
      console.error('Failed to create pitch', input);
      toast.error('Failed to create pitch association');
      return null;
    } catch (err) {
      console.error(`Error creating pitch ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error creating pitch: ${err}`;
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

  const updatePitch = useCallback(async (id: string, input: UpdatePitchInput): Promise<SongSingerPitch | null> => {
    setLoading(true);
    setError(null);
    try {
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
      } else {
        console.error('Failed to update pitch', input);
        toast.error('Failed to update pitch association');
        return null;
      }
    } catch (err) {
      console.error(`Error updating pitch ${input}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error updating pitch: ${err}`;
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
        console.error(`Failed to delete pitch ${id}`);
        toast.error('Failed to delete pitch association');
      }
    } catch (err) {
      console.error(`Error deleting pitch ${id}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error deleting pitch: ${err}`;
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast, pitches]);

  const value: PitchContextState = {
    pitches,
    loading,
    error,
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
