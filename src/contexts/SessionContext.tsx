import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

const SESSION_STORAGE_KEY = 'songStudio:sessionSongs';

interface SessionEntry {
  songId: string;
  singerId?: string;
  pitch?: string;
}

interface SessionContextState {
  // All session entries with optional singer and pitch information
  entries: SessionEntry[];
  // Convenience list of songIds for existing consumers
  songIds: string[];
  // Optional singerId and pitch are used when adding from the Pitches tab
  addSong: (songId: string, singerId?: string, pitch?: string) => void;
  removeSong: (songId: string) => void;
  clearSession: () => void;
  reorderSession: (order: string[]) => void;
}

const SessionContext = createContext<SessionContextState | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [entries, setEntries] = useState<SessionEntry[]>([]);

  // Load session from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Backwards compatibility: older sessions stored as array of songIds (strings)
          if (parsed.length === 0 || typeof parsed[0] === 'string') {
            const songIds = parsed.filter((id: unknown) => typeof id === 'string') as string[];
            setEntries(songIds.map((songId) => ({ songId })));
          } else {
            // New format: array of objects with songId (and optional singerId)
            const validEntries: SessionEntry[] = parsed
              .filter(
                (item: unknown): item is SessionEntry =>
                  !!item && typeof item === 'object' && 'songId' in (item as Record<string, unknown>),
              )
              .map((item) => {
                const { songId, singerId, pitch } = item as SessionEntry;
                return { songId, singerId, pitch };
              });
            setEntries(validEntries);
          }
        }
      }
    } catch {
      // Ignore parse errors and start with empty session
    }
  }, []);

  // Persist session to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [entries]);

  const addSong = useCallback((songId: string, singerId?: string, pitch?: string) => {
    setEntries((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.songId === songId);
      // If song is already in the session, update its singer (if provided) but avoid duplicates
      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          // Only overwrite singerId/pitch when explicitly provided so we don't lose data
          singerId: singerId ?? existing.singerId,
          pitch: pitch ?? existing.pitch,
        };
        return updated;
      }
      return [...prev, { songId, singerId, pitch }];
    });
  }, []);

  const removeSong = useCallback((songId: string) => {
    setEntries((prev) => prev.filter((entry) => entry.songId !== songId));
  }, []);

  const clearSession = useCallback(() => {
    setEntries([]);
  }, []);

  const reorderSession = useCallback((order: string[]) => {
    setEntries((prev) => {
      if (!order || order.length === 0) return prev;

      const map = new Map(prev.map((entry) => [entry.songId, entry]));
      const reordered: SessionEntry[] = [];

      // Add entries in the specified order when they exist
      for (const songId of order) {
        const entry = map.get(songId);
        if (entry) {
          reordered.push(entry);
        }
      }

      // Append any remaining entries that weren't mentioned in order
      for (const entry of prev) {
        if (!order.includes(entry.songId)) {
          reordered.push(entry);
        }
      }

      return reordered;
    });
  }, []);

  const songIds = entries.map((entry) => entry.songId);

  const value: SessionContextState = {
    entries,
    songIds,
    addSong,
    removeSong,
    clearSession,
    reorderSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextState => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
};


