/**
 * API Client for communicating with the backend server
 * Replaces direct database calls with HTTP requests
 */

// In development, use /api (proxied by Vite)
// In production, use full URL from env var or default to deployed backend
export const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

export class ApiClient {
  private baseUrl: string;
  private failureCount: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 2; // Maximum 2 retry attempts
  private readonly MIN_BACKOFF_MS = 3000; // 3 seconds
  private readonly MAX_BACKOFF_MS = 10000; // 10 seconds max

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getBackoffDelay(endpoint: string): number {
    const failures = this.failureCount.get(endpoint) || 0;
    
    // After MAX_RETRIES, stop retrying completely
    if (failures > this.MAX_RETRIES) {
      return -1; // Signal to stop retrying
    }
    
    // First failure: retry immediately
    // Second failure: wait 3 seconds
    // Third+ failure: wait 10 seconds
    if (failures === 0) return 0;
    if (failures === 1) return this.MIN_BACKOFF_MS;
    return this.MAX_BACKOFF_MS;
  }

  private shouldAllowRequest(endpoint: string): boolean {
    const lastFailure = this.lastFailureTime.get(endpoint);
    const failures = this.failureCount.get(endpoint) || 0;
    
    // If no previous failure, allow request
    if (!lastFailure) {
      return true;
    }

    const backoffDelay = this.getBackoffDelay(endpoint);
    
    // If we've exceeded max retries, permanently block until manual reset
    if (backoffDelay === -1) {
      throw new Error(
        `Connection failed after ${this.MAX_RETRIES} attempts. Please check your internet connection or try again later.`
      );
    }
    
    const timeSinceFailure = Date.now() - lastFailure;
    
    // If still in backoff period, block the request
    if (timeSinceFailure < backoffDelay) {
      const remainingSeconds = Math.ceil((backoffDelay - timeSinceFailure) / 1000);
      throw new Error(
        `Retrying in ${remainingSeconds}s... (Attempt ${failures + 1}/${this.MAX_RETRIES + 1})`
      );
    }

    return true;
  }

  private recordSuccess(endpoint: string): void {
    this.failureCount.delete(endpoint);
    this.lastFailureTime.delete(endpoint);
  }

  private recordFailure(endpoint: string): void {
    const currentFailures = this.failureCount.get(endpoint) || 0;
    this.failureCount.set(endpoint, currentFailures + 1);
    this.lastFailureTime.set(endpoint, Date.now());
  }

  /**
   * Reset backoff state - useful when user explicitly clicks "Refresh" or "Retry"
   */
  public resetBackoff(endpoint?: string): void {
    if (endpoint) {
      this.failureCount.delete(endpoint);
      this.lastFailureTime.delete(endpoint);
    } else {
      // Reset all endpoints
      this.failureCount.clear();
      this.lastFailureTime.clear();
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Check if we should back off
    this.shouldAllowRequest(endpoint);

    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include', // Send session cookies with every request
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        
        // Only record failure and trigger backoff for server errors (5xx) or network errors,
        // not for client errors (4xx) like 400, 401, 403, 404
        if (response.status >= 500) {
          this.recordFailure(endpoint);
        }
        
        // Use message if available (more detailed), otherwise fall back to error field
        const errorMsg = error.message || error.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        this.recordSuccess(endpoint);
        return undefined as T;
      }

      const data = await response.json();
      this.recordSuccess(endpoint);
      return data;
    } catch (error) {
      this.recordFailure(endpoint);
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Generic HTTP methods
  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Songs API
  async getSongs() {
    return this.request('/songs');
  }

  async getSong(id: string) {
    return this.request(`/songs/${id}`);
  }

  async createSong(song: any) {
    return this.request('/songs', {
      method: 'POST',
      body: JSON.stringify(song),
    });
  }

  async updateSong(id: string, song: any) {
    return this.request(`/songs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(song),
    });
  }

  async deleteSong(id: string) {
    return this.request(`/songs/${id}`, {
      method: 'DELETE',
    });
  }

  // Singers API
  async getSingers() {
    return this.request('/singers');
  }

  async getSinger(id: string) {
    return this.request(`/singers/${id}`);
  }

  async createSinger(singer: any) {
    return this.request('/singers', {
      method: 'POST',
      body: JSON.stringify(singer),
    });
  }

  async updateSinger(id: string, singer: any) {
    return this.request(`/singers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(singer),
    });
  }

  async deleteSinger(id: string) {
    return this.request(`/singers/${id}`, {
      method: 'DELETE',
    });
  }

  // Pitches API
  async getPitches() {
    return this.request('/pitches');
  }

  async getPitch(id: string) {
    return this.request(`/pitches/${id}`);
  }

  async getSongPitches(songId: string) {
    return this.request(`/pitches/song/${songId}`);
  }

  async createPitch(pitch: any) {
    return this.request('/pitches', {
      method: 'POST',
      body: JSON.stringify(pitch),
    });
  }

  async updatePitch(id: string, pitch: any) {
    return this.request(`/pitches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pitch),
    });
  }

  async deletePitch(id: string) {
    return this.request(`/pitches/${id}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
