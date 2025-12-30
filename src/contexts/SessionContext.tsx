import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

// Use sessionStorage (tab-specific) instead of localStorage (shared across tabs)
// This ensures each browser tab has its own independent live session
const SESSION_STORAGE_KEY = 'saiSongs:sessionSongs';

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
  removeSong: (songId: string, singerId?: string) => void;
  clearSession: () => void;
  reorderSession: (order: string[]) => void;
}

const SessionContext = createContext<SessionContextState | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [entries, setEntries] = useState<SessionEntry[]>([]);

  // Load session from sessionStorage on mount (tab-specific storage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
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

  // Persist session to sessionStorage whenever it changes (tab-specific)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [entries]);

  const addSong = useCallback((songId: string, singerId?: string, pitch?: string) => {
    setEntries((prev) => {
      // Check if this exact song+singer combination exists
      const existingIndex = prev.findIndex((entry) => 
        entry.songId === songId && entry.singerId === singerId
      );
      
      // If the exact song+singer combination exists, update the pitch if provided
      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          // Only overwrite pitch when explicitly provided
          pitch: pitch ?? existing.pitch,
        };
        return updated;
      }
      
      // Add new entry (allows same song with different singers)
      return [...prev, { songId, singerId, pitch }];
    });
  }, []);

  const removeSong = useCallback((songId: string, singerId?: string) => {
    setEntries((prev) => {
      // If singerId is provided, remove only the specific song+singer combination
      if (singerId) {
        return prev.filter((entry) => !(entry.songId === songId && entry.singerId === singerId));
      }
      // If no singerId, remove all entries with this songId (backwards compatibility)
      return prev.filter((entry) => entry.songId !== songId);
    });
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


