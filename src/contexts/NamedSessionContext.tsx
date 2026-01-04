import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type {
  NamedSession,
  NamedSessionWithItems,
  CreateNamedSessionInput,
  UpdateNamedSessionInput,
  SessionItemWithDetails,
} from '../types';
import NamedSessionService from '../services/NamedSessionService';
import { useToast } from './ToastContext';

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
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Create a new session
  const createSession = useCallback(async (input: CreateNamedSessionInput): Promise<NamedSession | null> => {
    setLoading(true);
    setError(null);
    try {
      const newSession = await NamedSessionService.createSession(input);
      setSessions(prev => [...prev, newSession]);
      showToast('success', 'Session created successfully');
      return newSession;
    } catch (err) {
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
    try {
      const updatedSession = await NamedSessionService.updateSession(id, input);
      setSessions(prev => prev.map(s => s.id === id ? updatedSession : s));
      if (currentSession && currentSession.id === id) {
        setCurrentSession({ ...currentSession, ...updatedSession });
      }
      showToast('success', 'Session updated successfully');
      return updatedSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update session';
      setError(message);
      showToast('error', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentSession, showToast]);

  // Delete a session
  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await NamedSessionService.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSession && currentSession.id === id) {
        setCurrentSession(null);
      }
      showToast('success', 'Session deleted successfully');
      return true;
    } catch (err) {
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
      setSessions(prev => [...prev, newSession]);
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
      // Don't show toast here - it's an internal operation, parent will show appropriate message
      return updatedItems;
    } catch (err) {
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

  // Load sessions on mount (only once)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSessions();
    }
  }, [loadSessions]);

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

