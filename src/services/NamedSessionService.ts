import type {
  NamedSession,
  NamedSessionWithItems,
  CreateNamedSessionInput,
  UpdateNamedSessionInput,
  CreateSessionItemInput,
  UpdateSessionItemInput,
  SessionItem,
  SessionItemWithDetails,
} from '../types';
import apiClient from './ApiClient';
import { getCacheItem } from '../utils/cacheUtils';
import { CACHE_KEYS } from '../utils/cacheUtils';

const SESSIONS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

class NamedSessionService {
  // ============ Named Sessions ============

  async getAllSessions(): Promise<NamedSession[]> {
    if (typeof window !== 'undefined') {
      const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS);
      if (raw) {
        try {
          const { timestamp, sessions } = JSON.parse(raw) as { timestamp: number; sessions: any[] };
          if (Array.isArray(sessions)) {
            const useCache = isOffline() || Date.now() - timestamp < SESSIONS_CACHE_TTL_MS;
            if (useCache) {
              return sessions as NamedSession[];
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
      if (isOffline()) throw new Error('Offline: No cached sessions');
    }
    try {
      const data = await apiClient.get('/sessions');
      return data as NamedSession[];
    } catch {
      if (typeof window !== 'undefined') {
        const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS);
        if (raw) {
          try {
            const { sessions } = JSON.parse(raw) as { timestamp: number; sessions: any[] };
            if (Array.isArray(sessions)) {
              return sessions as NamedSession[];
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
      throw new Error('Failed to load sessions');
    }
  }

  async getSession(id: string): Promise<NamedSessionWithItems | null> {
    if (typeof window !== 'undefined') {
      const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS);
      if (raw) {
        try {
          const { timestamp, sessions } = JSON.parse(raw) as { timestamp: number; sessions: any[] };
          if (Array.isArray(sessions)) {
            const useCache = isOffline() || Date.now() - timestamp < SESSIONS_CACHE_TTL_MS;
            if (useCache) {
              const found = sessions.find((s: any) => s.id === id);
              if (found) {
                if (isOffline() && !Array.isArray(found.items)) {
                  throw new Error('Session not available offline. Use Take Offline to cache sessions with songs.');
                }
                return found;
              }
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes('Take Offline')) throw e;
          // Ignore parse errors
        }
      }
      if (isOffline()) throw new Error('Offline: Session not found in cache');
    }
    try {
      return await apiClient.get(`/sessions/${id}`);
    } catch {
      if (typeof window !== 'undefined') {
        const raw = await getCacheItem(CACHE_KEYS.SAI_SONGS_SESSIONS);
        if (raw) {
          try {
            const { sessions } = JSON.parse(raw) as { timestamp: number; sessions: any[] };
            const found = Array.isArray(sessions) ? sessions.find((s: any) => s.id === id) : null;
            if (found) {
              if (isOffline() && !Array.isArray(found.items)) {
                throw new Error('Session not available offline. Use Take Offline to cache sessions with songs.');
              }
              return found;
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes('Take Offline')) throw e;
            // Ignore parse errors
          }
        }
      }
      throw new Error('Failed to load session');
    }
  }

  async createSession(input: CreateNamedSessionInput): Promise<NamedSession> {
    return apiClient.post('/sessions', input);
  }

  async updateSession(id: string, input: UpdateNamedSessionInput): Promise<NamedSession> {
    return apiClient.put(`/sessions/${id}`, input);
  }

  async deleteSession(id: string): Promise<void> {
    return apiClient.delete(`/sessions/${id}`);
  }

  // ============ Session Items ============

  async getSessionItems(sessionId: string): Promise<SessionItemWithDetails[]> {
    return apiClient.get(`/sessions/${sessionId}/items`);
  }

  async addSessionItem(input: CreateSessionItemInput): Promise<SessionItem> {
    return apiClient.post(`/sessions/${input.sessionId}/items`, input);
  }

  async updateSessionItem(id: string, input: UpdateSessionItemInput): Promise<SessionItem> {
    return apiClient.put(`/sessions/items/${id}`, input);
  }

  async deleteSessionItem(id: string): Promise<void> {
    return apiClient.delete(`/sessions/items/${id}`);
  }

  async reorderSessionItems(sessionId: string, itemIds: string[]): Promise<void> {
    return apiClient.put(`/sessions/${sessionId}/reorder`, { itemIds });
  }

  // ============ Bulk Operations ============

  async setSessionItems(
    sessionId: string,
    items: Array<{
      songId: string;
      singerId?: string;
      pitch?: string;
    }>
  ): Promise<SessionItemWithDetails[]> {
    return apiClient.put(`/sessions/${sessionId}/items`, { items });
  }

  async duplicateSession(id: string, newName: string): Promise<NamedSession> {
    return apiClient.post(`/sessions/${id}/duplicate`, { newName });
  }
}

export default new NamedSessionService();

