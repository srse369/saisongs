import { describe, it, expect, beforeEach, vi } from 'vitest';
import { feedbackService } from './FeedbackService';
import { apiClient } from './ApiClient';
import type { Feedback, FeedbackListResponse, FeedbackUpdateData } from './FeedbackService';

vi.mock('./ApiClient');

describe('FeedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFeedback', () => {
    it('should fetch feedback without filters', async () => {
      const mockResponse: FeedbackListResponse = {
        total: 2,
        feedback: [
          {
            id: '1',
            category: 'bug',
            feedback: 'Bug report',
            email: 'user@example.com',
            status: 'new',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
          {
            id: '2',
            category: 'feature',
            feedback: 'Feature request',
            email: 'user2@example.com',
            status: 'in-progress',
            createdAt: new Date('2024-01-02'),
            updatedAt: new Date('2024-01-02'),
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await feedbackService.getFeedback();

      expect(result.total).toBe(2);
      expect(result.feedback).toHaveLength(2);
      expect(apiClient.get).toHaveBeenCalledWith('/feedback');
    });

    it('should fetch feedback with status filter', async () => {
      const mockResponse: FeedbackListResponse = {
        total: 1,
        feedback: [
          {
            id: '1',
            category: 'bug',
            feedback: 'Bug report',
            email: 'user@example.com',
            status: 'new',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await feedbackService.getFeedback({ status: 'new' });

      expect(apiClient.get).toHaveBeenCalledWith('/feedback?status=new');
    });

    it('should fetch feedback with category filter', async () => {
      const mockResponse: FeedbackListResponse = {
        total: 1,
        feedback: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await feedbackService.getFeedback({ category: 'bug' });

      expect(apiClient.get).toHaveBeenCalledWith('/feedback?category=bug');
    });

    it('should fetch feedback with limit and offset', async () => {
      const mockResponse: FeedbackListResponse = {
        total: 100,
        feedback: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await feedbackService.getFeedback({ limit: 10, offset: 20 });

      expect(apiClient.get).toHaveBeenCalledWith('/feedback?limit=10&offset=20');
    });

    it('should fetch feedback with multiple filters', async () => {
      const mockResponse: FeedbackListResponse = {
        total: 5,
        feedback: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await feedbackService.getFeedback({
        status: 'resolved',
        category: 'feature',
        limit: 25,
        offset: 50,
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/feedback?status=resolved&category=feature&limit=25&offset=50'
      );
    });

    it('should convert date strings to Date objects', async () => {
      const mockResponse = {
        total: 1,
        feedback: [
          {
            id: '1',
            category: 'bug',
            feedback: 'Test',
            email: 'test@example.com',
            status: 'new',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse as any);

      const result = await feedbackService.getFeedback();

      expect(result.feedback[0].createdAt).toBeInstanceOf(Date);
      expect(result.feedback[0].updatedAt).toBeInstanceOf(Date);
      expect(result.feedback[0].createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(result.feedback[0].updatedAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should handle optional fields in feedback', async () => {
      const mockResponse: FeedbackListResponse = {
        total: 1,
        feedback: [
          {
            id: '1',
            category: 'question',
            feedback: 'Question',
            email: 'user@example.com',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            url: 'https://example.com/page',
            status: 'closed',
            adminNotes: 'Resolved by admin',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
          },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await feedbackService.getFeedback();

      expect(result.feedback[0].ipAddress).toBe('192.168.1.1');
      expect(result.feedback[0].userAgent).toBe('Mozilla/5.0');
      expect(result.feedback[0].url).toBe('https://example.com/page');
      expect(result.feedback[0].adminNotes).toBe('Resolved by admin');
    });
  });

  describe('updateFeedback', () => {
    it('should update feedback status', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue(undefined);

      const updateData: FeedbackUpdateData = {
        status: 'resolved',
      };

      await feedbackService.updateFeedback('1', updateData);

      expect(apiClient.patch).toHaveBeenCalledWith('/feedback/1', updateData);
    });

    it('should update feedback admin notes', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue(undefined);

      const updateData: FeedbackUpdateData = {
        adminNotes: 'Fixed in version 2.0',
      };

      await feedbackService.updateFeedback('1', updateData);

      expect(apiClient.patch).toHaveBeenCalledWith('/feedback/1', updateData);
    });

    it('should update both status and admin notes', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue(undefined);

      const updateData: FeedbackUpdateData = {
        status: 'closed',
        adminNotes: 'User confirmed resolution',
      };

      await feedbackService.updateFeedback('1', updateData);

      expect(apiClient.patch).toHaveBeenCalledWith('/feedback/1', updateData);
    });
  });

  describe('deleteFeedback', () => {
    it('should delete feedback by id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await feedbackService.deleteFeedback('1');

      expect(apiClient.delete).toHaveBeenCalledWith('/feedback/1');
    });
  });
});
