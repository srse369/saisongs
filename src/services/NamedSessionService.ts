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

class NamedSessionService {
  // ============ Named Sessions ============

  async getAllSessions(): Promise<NamedSession[]> {
    return apiClient.get('/sessions');
  }

  async getSession(id: string): Promise<NamedSessionWithItems | null> {
    return apiClient.get(`/sessions/${id}`);
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

