import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Singer, CreateSingerInput, UpdateSingerInput, ServiceError } from '../types';
import { singerService } from '../services';
import { useToast } from './ToastContext';

interface SingerContextState {
  singers: Singer[];
  loading: boolean;
  error: ServiceError | null;
  fetchSingers: () => Promise<void>;
  getSingerById: (id: string) => Promise<Singer | null>;
  createSinger: (input: CreateSingerInput) => Promise<Singer | null>;
  updateSinger: (id: string, input: UpdateSingerInput) => Promise<Singer | null>;
  deleteSinger: (id: string) => Promise<boolean>;
  clearError: () => void;
}

const SingerContext = createContext<SingerContextState | undefined>(undefined);

interface SingerProviderProps {
  children: ReactNode;
}

export const SingerProvider: React.FC<SingerProviderProps> = ({ children }) => {
  const [singers, setSingers] = useState<Singer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const toast = useToast();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchSingers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const singers = await singerService.getAllSingers();
      setSingers(singers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch singers';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      setSingers(prev => [...prev, singer]);
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

  const deleteSinger = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const success = await singerService.deleteSinger(id);
      if (success) {
        setSingers(prev => prev.filter(singer => singer.id !== id));
        toast.success('Singer deleted successfully');
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete singer';
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

  const value: SingerContextState = {
    singers,
    loading,
    error,
    fetchSingers,
    getSingerById,
    createSinger,
    updateSinger,
    deleteSinger,
    clearError,
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
