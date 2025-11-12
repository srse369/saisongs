/**
 * API Client for communicating with the backend server
 * Replaces direct database calls with HTTP requests
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
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
