import { describe, it, expect, beforeEach, vi } from 'vitest';
import namedSessionService from './NamedSessionService';
import apiClient from './ApiClient';
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

vi.mock('./ApiClient');

describe('NamedSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Named Sessions', () => {
    describe('getAllSessions', () => {
      it('should fetch all sessions', async () => {
        const mockSessions: NamedSession[] = [
          {
            id: '1',
            name: 'Session 1',
            description: 'Test session',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(apiClient.get).mockResolvedValue(mockSessions);

        const result = await namedSessionService.getAllSessions();

        expect(result).toEqual(mockSessions);
        expect(apiClient.get).toHaveBeenCalledWith('/sessions');
      });
    });

    describe('getSession', () => {
      it('should fetch session by id with items', async () => {
        const mockSession: NamedSessionWithItems = {
          id: '1',
          name: 'Session 1',
          description: 'Test',
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vi.mocked(apiClient.get).mockResolvedValue(mockSession);

        const result = await namedSessionService.getSession('1');

        expect(result).toEqual(mockSession);
        expect(apiClient.get).toHaveBeenCalledWith('/sessions/1');
      });
    });

    describe('createSession', () => {
      it('should create new session', async () => {
        const input: CreateNamedSessionInput = {
          name: 'New Session',
          description: 'Test notes',
        };

        const mockCreated: NamedSession = {
          id: '1',
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vi.mocked(apiClient.post).mockResolvedValue(mockCreated);

        const result = await namedSessionService.createSession(input);

        expect(result).toEqual(mockCreated);
        expect(apiClient.post).toHaveBeenCalledWith('/sessions', input);
      });
    });

    describe('updateSession', () => {
      it('should update session', async () => {
        const input: UpdateNamedSessionInput = {
          name: 'Updated Session',
        };

        const mockUpdated: NamedSession = {
          id: '1',
          name: 'Updated Session',
          description: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vi.mocked(apiClient.put).mockResolvedValue(mockUpdated);

        const result = await namedSessionService.updateSession('1', input);

        expect(result).toEqual(mockUpdated);
        expect(apiClient.put).toHaveBeenCalledWith('/sessions/1', input);
      });
    });

    describe('deleteSession', () => {
      it('should delete session', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue(undefined);

        await namedSessionService.deleteSession('1');

        expect(apiClient.delete).toHaveBeenCalledWith('/sessions/1');
      });
    });
  });

  describe('Session Items', () => {
    describe('getSessionItems', () => {
      it('should fetch session items with details', async () => {
        const mockItems: SessionItemWithDetails[] = [
          {
            id: '1',
            sessionId: 'session1',
            songId: 'song1',
            singerId: 'singer1',
            pitch: 'C',
            sequenceOrder: 0,
            songName: 'Amazing Grace',
            singerName: 'John Doe',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(apiClient.get).mockResolvedValue(mockItems);

        const result = await namedSessionService.getSessionItems('session1');

        expect(result).toEqual(mockItems);
        expect(apiClient.get).toHaveBeenCalledWith('/sessions/session1/items');
      });
    });

    describe('addSessionItem', () => {
      it('should add item to session', async () => {
        const input: CreateSessionItemInput = {
          sessionId: 'session1',
          songId: 'song1',
          singerId: 'singer1',
          pitch: 'C',
          sequenceOrder: 0,
        };

        const mockItem: SessionItem = {
          id: '1',
          sessionId: 'session1',
          songId: 'song1',
          singerId: 'singer1',
          pitch: 'C',
          sequenceOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vi.mocked(apiClient.post).mockResolvedValue(mockItem);

        const result = await namedSessionService.addSessionItem(input);

        expect(result).toEqual(mockItem);
        expect(apiClient.post).toHaveBeenCalledWith('/sessions/session1/items', input);
      });
    });

    describe('updateSessionItem', () => {
      it('should update session item', async () => {
        const input: UpdateSessionItemInput = {
          pitch: 'G',
        };

        const mockItem: SessionItem = {
          id: '1',
          sessionId: 'session1',
          songId: 'song1',
          singerId: 'singer1',
          pitch: 'G',
          sequenceOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vi.mocked(apiClient.put).mockResolvedValue(mockItem);

        const result = await namedSessionService.updateSessionItem('1', input);

        expect(result).toEqual(mockItem);
        expect(apiClient.put).toHaveBeenCalledWith('/sessions/items/1', input);
      });
    });

    describe('deleteSessionItem', () => {
      it('should delete session item', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue(undefined);

        await namedSessionService.deleteSessionItem('1');

        expect(apiClient.delete).toHaveBeenCalledWith('/sessions/items/1');
      });
    });

    describe('reorderSessionItems', () => {
      it('should reorder session items', async () => {
        vi.mocked(apiClient.put).mockResolvedValue(undefined);

        const itemIds = ['item1', 'item3', 'item2'];

        await namedSessionService.reorderSessionItems('session1', itemIds);

        expect(apiClient.put).toHaveBeenCalledWith('/sessions/session1/reorder', { itemIds });
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('setSessionItems', () => {
      it('should replace all session items', async () => {
        const items = [
          { songId: 'song1', singerId: 'singer1', pitch: 'C' },
          { songId: 'song2', singerId: 'singer2', pitch: 'G' },
        ];

        const mockResult: SessionItemWithDetails[] = [
          {
            id: '1',
            sessionId: 'session1',
            songId: 'song1',
            singerId: 'singer1',
            pitch: 'C',
            sequenceOrder: 0,
            songName: 'Song 1',
            singerName: 'Singer 1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        vi.mocked(apiClient.put).mockResolvedValue(mockResult);

        const result = await namedSessionService.setSessionItems('session1', items);

        expect(result).toEqual(mockResult);
        expect(apiClient.put).toHaveBeenCalledWith('/sessions/session1/items', { items });
      });
    });

    describe('duplicateSession', () => {
      it('should duplicate session with new name', async () => {
        const mockDuplicated: NamedSession = {
          id: '2',
          name: 'Copy of Session',
          description: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vi.mocked(apiClient.post).mockResolvedValue(mockDuplicated);

        const result = await namedSessionService.duplicateSession('1', 'Copy of Session');

        expect(result).toEqual(mockDuplicated);
        expect(apiClient.post).toHaveBeenCalledWith('/sessions/1/duplicate', {
          newName: 'Copy of Session',
        });
      });
    });
  });
});
