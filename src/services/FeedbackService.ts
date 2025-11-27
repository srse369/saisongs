import { apiClient } from './ApiClient';

export interface Feedback {
  id: string;
  category: 'bug' | 'feature' | 'improvement' | 'question' | 'other';
  feedback: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  url?: string;
  status: 'new' | 'in-progress' | 'resolved' | 'closed';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackListResponse {
  total: number;
  feedback: Feedback[];
}

export interface FeedbackUpdateData {
  status?: 'new' | 'in-progress' | 'resolved' | 'closed';
  adminNotes?: string;
}

class FeedbackService {
  async getFeedback(filters?: {
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<FeedbackListResponse> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.set('status', filters.status);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    if (filters?.offset) params.set('offset', filters.offset.toString());

    const queryString = params.toString();
    const url = `/feedback${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<FeedbackListResponse>(url);
    
    // Convert date strings to Date objects
    response.feedback = response.feedback.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    }));
    
    return response;
  }

  async updateFeedback(id: string, data: FeedbackUpdateData): Promise<void> {
    await apiClient.patch(`/feedback/${id}`, data);
  }

  async deleteFeedback(id: string): Promise<void> {
    await apiClient.delete(`/feedback/${id}`);
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
