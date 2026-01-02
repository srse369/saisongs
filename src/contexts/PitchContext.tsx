import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SongSingerPitch, CreatePitchInput, UpdatePitchInput, ServiceError } from '../types';
import { pitchService } from '../services';
import { useToast } from './ToastContext';

const PITCHES_CACHE_KEY = 'saiSongs:pitchesCache';
const PITCHES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
        const cachedRaw = window.localStorage.getItem(PITCHES_CACHE_KEY);
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
        try {
          window.localStorage.setItem(
            PITCHES_CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              pitches: fetchedPitches,
            })
          );
        } catch (e) {
          // Silently ignore storage errors (e.g., quota exceeded on iOS)
          console.warn('Failed to cache pitches to localStorage:', e);
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
      
      // Add the pitch to local state immediately
      // (PitchManager will sort by song name so it appears in the right place)
      setPitches(prev => {
        // Check if pitch already exists (duplicate prevention)
        if (prev.some(p => p.id === pitch.id)) {
          return prev;
        }
        return [...prev, pitch];
      });
      
      // Clear localStorage caches for pitches and singers
      // Singer pitch count changes when a pitch is created, so we need to refresh singers
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PITCHES_CACHE_KEY);
        window.localStorage.removeItem('saiSongs:singersCache');
        // Also clear songs cache since song pitch count may change
        window.localStorage.removeItem('saiSongs:songsCache');
        
        // Dispatch global event to notify other components
        import('../utils/globalEventBus').then(({ globalEventBus }) => {
          globalEventBus.dispatch('pitchCreated', { 
            type: 'pitchCreated',
            singerId: pitch.singerId, 
            songId: pitch.songId 
          });
        });
        
        // Also dispatch legacy event for SongContext and SingerContext optimistic updates
        window.dispatchEvent(new CustomEvent('pitchCreated', { 
          detail: { singerId: pitch.singerId, songId: pitch.songId } 
        }));
      }
      
      toast.success('Pitch association created successfully');
      return pitch;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create pitch';
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
        setPitches(prev => prev.map(p => p.id === id ? pitch : p));
        // Clear localStorage cache so fresh data is fetched next time
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(PITCHES_CACHE_KEY);
        }
        toast.success('Pitch association updated successfully');
      }
      return pitch;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update pitch';
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
    // Get the pitch before deleting to know which singer/song to update
    let pitchToDelete: SongSingerPitch | undefined;
    
    try {
      setPitches(prev => {
        pitchToDelete = prev.find(p => p.id === id);
        return prev.filter(pitch => pitch.id !== id);
      });
      
      // Dispatch custom event IMMEDIATELY to update song and singer pitch counts
      // This allows optimistic update - if API call fails, we'll need to rollback
      if (typeof window !== 'undefined' && pitchToDelete) {
        // Dispatch legacy event for SongContext and SingerContext optimistic updates
        window.dispatchEvent(new CustomEvent('pitchDeleted', { 
          detail: { singerId: pitchToDelete.singerId, songId: pitchToDelete.songId } 
        }));
      }
      
      await pitchService.deletePitch(id);
      
      // Clear localStorage caches for pitches, singers, and songs
      // Pitch counts change when a pitch is deleted
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PITCHES_CACHE_KEY);
        window.localStorage.removeItem('saiSongs:singersCache');
        window.localStorage.removeItem('saiSongs:songsCache');
        
        // Dispatch global event to notify other components
        if (pitchToDelete?.singerId && pitchToDelete?.songId) {
          const { singerId, songId } = pitchToDelete;
          import('../utils/globalEventBus').then(({ globalEventBus }) => {
            globalEventBus.dispatch('pitchDeleted', { 
              type: 'pitchDeleted',
              singerId, 
              songId 
            });
          });
        }
      }
      
      toast.success('Pitch association deleted successfully');
    } catch (err) {
      // Rollback: restore the pitch to state and reverse the pitch count update
      if (typeof window !== 'undefined' && pitchToDelete) {
        setPitches(prev => {
          // Check if pitch already exists (might have been restored)
          if (prev.some(p => p.id === pitchToDelete!.id)) {
            return prev;
          }
          return [...prev, pitchToDelete!];
        });
        
        // Dispatch event to reverse the pitch count update
        if (pitchToDelete) {
          window.dispatchEvent(new CustomEvent('pitchCreated', { 
            detail: { singerId: pitchToDelete.singerId, songId: pitchToDelete.songId } 
          }));
        }
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete pitch';
      // Only show error via toast, don't persist to state
      // This prevents non-dismissible error banners in PitchManager
      toast.error(errorMessage);
      // Don't re-throw - error already shown via toast, prevents "Uncaught promise" console errors
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
