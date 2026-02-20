import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type {
  NamedSession,
  NamedSessionWithItems,
  CreateNamedSessionInput,
  UpdateNamedSessionInput,
  SessionItemWithDetails,
} from '../types';
import NamedSessionService from '../services/NamedSessionService';
import { useToast } from './ToastContext';
import { isOfflineError, addToOfflineQueue, generateTempId } from '../utils/offlineQueue';
import { getCacheItem, setCacheItem } from '../utils/cacheUtils';
import { CACHE_KEYS } from '../utils/cacheUtils';
import { globalEventBus } from '../utils/globalEventBus';

interface NamedSessionContextType {
  sessions: NamedSession[];
  currentSession: NamedSessionWithItems | null;
  loading: boolean;
  error: string | null;
  
  // Session operations
  loadSessions: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (input: CreateNamedSessionInput) => Promise<NamedSession | null>;
  updateSession: (id: string, input: UpdateNamedSessionInput) => Promise<NamedSession | null>;
  deleteSession: (id: string) => Promise<boolean>;
  duplicateSession: (id: string, newName: string) => Promise<NamedSession | null>;
  
  // Session item operations
  setSessionItems: (sessionId: string, items: Array<{
    songId: string;
    singerId?: string;
    pitch?: string;
  }>) => Promise<SessionItemWithDetails[] | null>;
  reorderSessionItems: (sessionId: string, itemIds: string[]) => Promise<boolean>;
  
  // UI state
  clearCurrentSession: () => void;
  clearError: () => void;
  clearState: () => void; // Clear all sessions and current session (for logout)
}

const NamedSessionContext = createContext<NamedSessionContextType | undefined>(undefined);

export const NamedSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isPresentationOnly = location.pathname.startsWith('/presentation') || location.pathname.startsWith('/session/present');

  const [sessions, setSessions] = useState<NamedSession[]>([]);
  const [currentSession, setCurrentSession] = useState<NamedSessionWithItems | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Load all sessions
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await NamedSessionService.getAllSessions();
      setSessions(data);
      // Persist to cache for offline use and browser cache stats
      if (typeof window !== 'undefined' && data.length > 0) {
        setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({
          timestamp: Date.now(),
          sessions: data,
        })).catch(() => {});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(message);
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load a specific session with items
  const loadSession = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await NamedSessionService.getSession(id);
      setCurrentSession(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load session';
      setError(message);
      showToast('error', message);
      throw err; // Re-throw so caller can clean up (e.g. close modal, clear loading state)
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Create a new session
  const createSession = useCallback(async (input: CreateNamedSessionInput): Promise<NamedSession | null> => {
    setLoading(true);
    setError(null);
    const tempId = generateTempId('session');
    const optimisticSession: NamedSession = { id: tempId, name: input.name, description: input.description, centerIds: input.centerIds, items: [] };
    try {
      if (typeof window !== 'undefined') {
        setSessions(prev => {
          const updated = [...prev, optimisticSession];
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: updated })).catch(() => {});
          return updated;
        });
      }
      const newSession = await NamedSessionService.createSession(input);
      if (typeof window !== 'undefined') {
        setSessions(prev => {
          const updated = prev.filter(s => s.id !== tempId);
          const merged = [...updated, newSession];
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: merged })).catch(() => {});
          return merged;
        });
      }
      showToast('success', 'Session created successfully');
      return newSession;
    } catch (err) {
      if (typeof window !== 'undefined') {
        setSessions(prev => {
          const reverted = prev.filter(s => s.id !== tempId);
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: reverted })).catch(() => {});
          return reverted;
        });
      }
      if (isOfflineError(err)) {
        addToOfflineQueue({
          type: 'create',
          entity: 'session',
          payload: { ...input, items: [] } as unknown as Record<string, unknown>,
          tempId,
          displayLabel: `Session: ${input.name}`,
        });
        setSessions(prev => [...prev, optimisticSession]);
        const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS);
        if (raw) {
          try {
            const { sessions } = JSON.parse(raw);
            const updated = [...(sessions || []), optimisticSession];
            setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: updated })).catch(() => {});
          } catch {
            // ignore
          }
        }
        showToast('success', 'Session saved offline. Will sync when online.');
        setLoading(false);
        return optimisticSession;
      }
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      showToast('error', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Update a session
  const updateSession = useCallback(async (id: string, input: UpdateNamedSessionInput): Promise<NamedSession | null> => {
    setLoading(true);
    setError(null);
    const existing = sessions.find(s => s.id === id);
    const optimisticSession = existing ? { ...existing, ...input } : null;
    try {
      if (optimisticSession && typeof window !== 'undefined') {
        setSessions(prev => {
          const updated = prev.map(s => s.id === id ? optimisticSession : s);
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: updated })).catch(() => {});
          return updated;
        });
        if (currentSession && currentSession.id === id) {
          setCurrentSession({ ...currentSession, ...input });
        }
      }
      const updatedSession = await NamedSessionService.updateSession(id, input);
      setSessions(prev => {
        const merged = prev.map(s => s.id === id ? updatedSession : s);
        setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: merged })).catch(() => {});
        return merged;
      });
      if (currentSession?.id === id) {
        setCurrentSession({ ...currentSession, ...updatedSession });
      }
      showToast('success', 'Session updated successfully');
      return updatedSession;
    } catch (err) {
      if (existing && typeof window !== 'undefined') {
        setSessions(prev => {
          const reverted = prev.map(s => s.id === id ? existing : s);
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: reverted })).catch(() => {});
          return reverted;
        });
        if (currentSession && currentSession.id === id) {
          setCurrentSession({ ...currentSession, ...existing });
        }
      }
      if (isOfflineError(err)) {
        addToOfflineQueue({
          type: 'update',
          entity: 'session',
          payload: { id, ...input } as unknown as Record<string, unknown>,
          displayLabel: `Session: ${input.name ?? sessions.find(s => s.id === id)?.name ?? id}`,
        });
        setSessions(prev => prev.map(s => s.id === id ? { ...s, ...input } : s));
        if (currentSession && currentSession.id === id) {
          setCurrentSession({ ...currentSession, ...input });
        }
        showToast('success', 'Session saved offline. Will sync when online.');
        setLoading(false);
        const existing = sessions.find(s => s.id === id);
        return existing ? ({ ...existing, ...input } as NamedSession) : null;
      }
      const message = err instanceof Error ? err.message : 'Failed to update session';
      setError(message);
      showToast('error', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentSession, sessions, showToast]);

  // Delete a session
  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const sessionToDelete = sessions.find(s => s.id === id);
    try {
      if (sessionToDelete && typeof window !== 'undefined') {
        setSessions(prev => {
          const updated = prev.filter(s => s.id !== id);
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: updated })).catch(() => {});
          return updated;
        });
        if (currentSession && currentSession.id === id) {
          setCurrentSession(null);
        }
      }
      await NamedSessionService.deleteSession(id);
      showToast('success', 'Session deleted successfully');
      return true;
    } catch (err) {
      if (sessionToDelete && typeof window !== 'undefined') {
        setSessions(prev => {
          const reverted = [...prev, sessionToDelete];
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: reverted })).catch(() => {});
          return reverted;
        });
      }
      if (isOfflineError(err)) {
        addToOfflineQueue({
          type: 'delete',
          entity: 'session',
          payload: { id },
          displayLabel: `Session: ${sessions.find(s => s.id === id)?.name ?? id}`,
        });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSession && currentSession.id === id) {
          setCurrentSession(null);
        }
        showToast('success', 'Session removed offline. Will sync when online.');
        setLoading(false);
        return true;
      }
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setError(message);
      showToast('error', message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentSession, showToast]);

  // Duplicate a session
  const duplicateSession = useCallback(async (id: string, newName: string): Promise<NamedSession | null> => {
    setLoading(true);
    setError(null);
    try {
      const newSession = await NamedSessionService.duplicateSession(id, newName);
      setSessions(prev => {
        const updated = [...prev, newSession];
        if (typeof window !== 'undefined') {
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: updated })).catch(() => {});
        }
        return updated;
      });
      showToast('success', 'Session duplicated successfully');
      return newSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate session';
      setError(message);
      showToast('error', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Set session items (replace all)
  const setSessionItems = useCallback(async (
    sessionId: string,
    items: Array<{ songId: string; singerId?: string; pitch?: string }>
  ): Promise<SessionItemWithDetails[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const updatedItems = await NamedSessionService.setSessionItems(sessionId, items);
      if (currentSession && currentSession.id === sessionId) {
        setCurrentSession({ ...currentSession, items: updatedItems });
      }
      // Update sessions cache so all sessions always have items
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, items: updatedItems } : s);
        if (typeof window !== 'undefined') {
          setCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS, JSON.stringify({ timestamp: Date.now(), sessions: updated })).catch(() => {});
        }
        return updated;
      });
      // Don't show toast here - it's an internal operation, parent will show appropriate message
      return updatedItems;
    } catch (err) {
      if (isOfflineError(err)) {
        addToOfflineQueue({
          type: 'update',
          entity: 'session',
          payload: { id: sessionId, items } as unknown as Record<string, unknown>,
          displayLabel: `Session items: ${currentSession?.name ?? sessionId}`,
        });
        if (currentSession && currentSession.id === sessionId) {
          const optimisticItems = items.map((item, i) => ({
            id: `temp-item-${i}`,
            sessionId,
            songId: item.songId,
            singerId: item.singerId,
            pitch: item.pitch,
            songName: '',
            singerName: '',
          }));
          setCurrentSession({ ...currentSession, items: optimisticItems as SessionItemWithDetails[] });
        }
        setLoading(false);
        return (currentSession?.items || []) as SessionItemWithDetails[];
      }
      const message = err instanceof Error ? err.message : 'Failed to update session items';
      setError(message);
      showToast('error', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentSession, showToast]);

  // Reorder session items
  const reorderSessionItems = useCallback(async (sessionId: string, itemIds: string[]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await NamedSessionService.reorderSessionItems(sessionId, itemIds);
      // Reload the session to get updated order
      if (currentSession && currentSession.id === sessionId) {
        await loadSession(sessionId);
      }
      showToast('success', 'Session items reordered successfully');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reorder session items';
      setError(message);
      showToast('error', message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentSession, loadSession, showToast]);

  // Clear current session
  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear all state (for logout)
  const clearState = useCallback(() => {
    setSessions([]);
    setCurrentSession(null);
    setError(null);
    hasLoadedRef.current = false; // Allow reloading after logout
  }, []);

  const hasLoadedRef = useRef(false);

  // Load sessions on mount - skip on presentation route to avoid concurrent fetches
  useEffect(() => {
    if (isPresentationOnly) return;
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSessions();
    }
  }, [loadSessions, isPresentationOnly]);

  // Reload sessions when offline sync completes
  useEffect(() => {
    const unsub = globalEventBus.on('dataRefreshNeeded', (detail) => {
      if (detail.resource === 'all' && !isPresentationOnly) {
        loadSessions();
      }
    });
    return unsub;
  }, [loadSessions, isPresentationOnly]);

  const value: NamedSessionContextType = {
    sessions,
    currentSession,
    loading,
    error,
    loadSessions,
    loadSession,
    createSession,
    updateSession,
    deleteSession,
    duplicateSession,
    setSessionItems,
    reorderSessionItems,
    clearCurrentSession,
    clearError,
    clearState,
  };

  return (
    <NamedSessionContext.Provider value={value}>
      {children}
    </NamedSessionContext.Provider>
  );
};

export const useNamedSessions = (): NamedSessionContextType => {
  const context = useContext(NamedSessionContext);
  if (!context) {
    throw new Error('useNamedSessions must be used within a NamedSessionProvider');
  }
  return context;
};

