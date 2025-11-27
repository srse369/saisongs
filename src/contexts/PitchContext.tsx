import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { SongSingerPitch, CreatePitchInput, UpdatePitchInput, ServiceError } from '../types';
import { pitchService } from '../services';
import { useToast } from './ToastContext';

interface PitchContextState {
  pitches: SongSingerPitch[];
  loading: boolean;
  error: ServiceError | null;
  fetchAllPitches: () => Promise<void>;
  getPitchesForSong: (songId: string) => Promise<void>;
  getPitchesForSinger: (singerId: string) => Promise<void>;
  createPitch: (input: CreatePitchInput) => Promise<SongSingerPitch | null>;
  updatePitch: (id: string, input: UpdatePitchInput) => Promise<SongSingerPitch | null>;
  deletePitch: (id: string) => Promise<boolean>;
  clearError: () => void;
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

  const fetchAllPitches = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent retry loops: if we've already fetched and failed, don't retry automatically
    if (!forceRefresh && hasFetched && error) {
      return;
    }
    
    // Reset backoff for explicit user-triggered refreshes
    if (forceRefresh) {
      const { apiClient } = await import('../services/ApiClient');
      apiClient.resetBackoff('/pitches');
      setError(null);
      setHasFetched(false);
    }
    
    setLoading(true);
    setError(null);
    try {
      const all = await pitchService.getAllPitches();
      setPitches(all);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pitches';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setHasFetched(true);
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
      setPitches(prev => [...prev, pitch]);
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

  const deletePitch = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const success = await pitchService.deletePitch(id);
      if (success) {
        setPitches(prev => prev.filter(pitch => pitch.id !== id));
        toast.success('Pitch association deleted successfully');
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete pitch';
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
