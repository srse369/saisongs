import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient } from './ApiClient';

describe('ApiClient', () => {
  let client: ApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new ApiClient('http://test-api.com');
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await client.get('/test');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should handle GET request errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(client.get('/test')).rejects.toThrow('Server error');
    });
  });

  describe('POST requests', () => {
    it('should make successful POST request with data', async () => {
      const mockData = { id: 1, name: 'Created' };
      const postData = { name: 'New Item' };
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockData,
      });

      const result = await client.post('/test', postData);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should handle POST without data', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await client.post('/test');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });
  });

  describe('PUT requests', () => {
    it('should make successful PUT request', async () => {
      const updateData = { id: 1, name: 'Updated' };
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => updateData,
      });

      const result = await client.put('/test/1', updateData);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      );
      expect(result).toEqual(updateData);
    });
  });

  describe('DELETE requests', () => {
    it('should make successful DELETE request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await client.delete('/test/1');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toBeUndefined();
    });

    it('should handle 204 No Content response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await client.delete('/test/1');
      expect(result).toBeUndefined();
    });
  });

  describe('PATCH requests', () => {
    it('should make successful PATCH request', async () => {
      const patchData = { name: 'Patched' };
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => patchData,
      });

      const result = await client.patch('/test/1', patchData);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patchData),
        })
      );
      expect(result).toEqual(patchData);
    });
  });

  describe('Error handling', () => {
    it.skip('should handle 4xx client errors without triggering backoff', async () => {
      const testClient = new ApiClient('http://test-api.com');
      
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
      });

      await expect(testClient.get('/test')).rejects.toThrow('Resource not found');
      
      // Should allow immediate retry for 4xx errors
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      
      const result = await testClient.get('/test');
      expect(result).toEqual({ success: true });
    });

    it.skip('should handle 5xx server errors with backoff', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(client.get('/test')).rejects.toThrow('Server error');
      
      // Next request should throw backoff error
      await expect(client.get('/test')).rejects.toThrow(/Retrying in \d+s/);
    });

    it('should use error message over error field when available', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Detailed error message', error: 'Generic error' }),
      });

      await expect(client.get('/test')).rejects.toThrow('Detailed error message');
    });

    it('should handle JSON parse errors in error responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => { throw new Error('Invalid JSON'); },
      });

      await expect(client.get('/test')).rejects.toThrow('Request failed');
    });

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failure'));

      await expect(client.get('/test')).rejects.toThrow('Network failure');
    });
  });

  describe('Backoff and retry logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.skip('should allow immediate retry on first failure', async () => {
      const testClient = new ApiClient('http://test-api.com');
      
      // First request fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 1' }),
      });

      await expect(testClient.get('/test-immediate')).rejects.toThrow('Error 1');
      
      // Second request should succeed (backoff delay is 0 for first failure)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const result = await testClient.get('/test-immediate');
      expect(result).toEqual({ success: true });
    });

    it.skip('should enforce backoff after multiple failures', async () => {
      const testClient = new ApiClient('http://test-api.com');
      
      // First failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 1' }),
      });
      await expect(testClient.get('/backoff-test')).rejects.toThrow('Error 1');

      // Advance time past first backoff
      vi.advanceTimersByTime(1000);

      // Second failure (immediate retry allowed)
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 2' }),
      });
      await expect(testClient.get('/backoff-test')).rejects.toThrow('Error 2');

      // Third attempt should be blocked by backoff (within 3 second window)
      await expect(testClient.get('/backoff-test')).rejects.toThrow(/Retrying in \d+s/);
    });

    it.skip('should block requests after max retries exceeded', async () => {
      const testClient = new ApiClient('http://test-api.com');
      
      // First failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 1' }),
      });
      await testClient.get('/max-retry-test').catch(() => {});

      // Second failure
      vi.advanceTimersByTime(1000);
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 2' }),
      });
      await testClient.get('/max-retry-test').catch(() => {});

      // Third failure
      vi.advanceTimersByTime(3000);
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error 3' }),
      });
      await testClient.get('/max-retry-test').catch(() => {});

      // After max retries, should throw permanent error
      await expect(testClient.get('/max-retry-test')).rejects.toThrow(/Connection failed after \d+ attempts/);
    });

    it.skip('should reset success state after successful request', async () => {
      const testClient = new ApiClient('http://test-api.com');
      
      // First request fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error' }),
      });
      await expect(testClient.get('/success-test')).rejects.toThrow();

      // Second request succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      await testClient.get('/success-test');

      // Third request should work normally (no backoff)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      const result = await testClient.get('/success-test');
      expect(result).toEqual({ success: true });
    });
  });

  describe('resetBackoff', () => {
    it.skip('should reset backoff for specific endpoint', async () => {
      const testClient = new ApiClient('http://test-api.com');
      
      // Cause first failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error' }),
      });
      try {
        await testClient.get('/reset-test');
      } catch {}

      // Second failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Error' }),
      });
      try {
        await testClient.get('/reset-test');
      } catch {}

      // Reset backoff
      testClient.resetBackoff('/reset-test');

      // Should allow request immediately
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      
      const result = await testClient.get('/reset-test');
      expect(result).toEqual({ success: true });
    });

    it('should reset all endpoints when called without parameter', async () => {
      const testClient = new ApiClient('http://test-api.com');
      
      // Cause failures on multiple endpoints
      for (const endpoint of ['/test1', '/test2']) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Error' }),
        });
        try {
          await testClient.get(endpoint);
        } catch {}
      }

      // Reset all
      testClient.resetBackoff();

      // Both should work
      for (const endpoint of ['/test1', '/test2']) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });
        const result = await testClient.get(endpoint);
        expect(result).toEqual({ success: true });
      }
    });
  });

  describe('Resource-specific methods', () => {
    describe('Songs API', () => {
      it('should get all songs', async () => {
        const songs = [{ id: 1, name: 'Song 1' }];
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => songs,
        });

        const result = await client.getSongs();
        expect(result).toEqual(songs);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/songs',
          expect.any(Object)
        );
      });

      it('should get single song', async () => {
        const song = { id: '1', name: 'Song 1' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => song,
        });

        const result = await client.getSong('1');
        expect(result).toEqual(song);
      });

      it('should create song', async () => {
        const newSong = { name: 'New Song' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', ...newSong }),
        });

        await client.createSong(newSong);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/songs',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(newSong),
          })
        );
      });

      it('should update song', async () => {
        const updates = { name: 'Updated Song' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', ...updates }),
        });

        await client.updateSong('1', updates);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/songs/1',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });

      it('should delete song', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        await client.deleteSong('1');
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/songs/1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    describe('Singers API', () => {
      it('should get all singers', async () => {
        const singers = [{ id: 1, name: 'Singer 1' }];
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => singers,
        });

        const result = await client.getSingers();
        expect(result).toEqual(singers);
      });

      it('should get single singer', async () => {
        const singer = { id: '1', name: 'Singer 1' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => singer,
        });

        const result = await client.getSinger('1');
        expect(result).toEqual(singer);
      });

      it('should create singer', async () => {
        const newSinger = { name: 'New Singer' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', ...newSinger }),
        });

        await client.createSinger(newSinger);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/singers',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('should update singer', async () => {
        const updates = { name: 'Updated Singer' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', ...updates }),
        });

        await client.updateSinger('1', updates);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/singers/1',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });

      it('should delete singer', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        await client.deleteSinger('1');
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/singers/1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    describe('Pitches API', () => {
      it('should get all pitches', async () => {
        const pitches = [{ id: 1, note: 'C' }];
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => pitches,
        });

        const result = await client.getPitches();
        expect(result).toEqual(pitches);
      });

      it('should get single pitch', async () => {
        const pitch = { id: '1', note: 'C' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => pitch,
        });

        const result = await client.getPitch('1');
        expect(result).toEqual(pitch);
      });

      it('should get song pitches', async () => {
        const pitches = [{ id: 1, note: 'C', song_id: '123' }];
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => pitches,
        });

        const result = await client.getSongPitches('123');
        expect(result).toEqual(pitches);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/pitches/song/123',
          expect.any(Object)
        );
      });

      it('should create pitch', async () => {
        const newPitch = { note: 'C', song_id: '1' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', ...newPitch }),
        });

        await client.createPitch(newPitch);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/pitches',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('should update pitch', async () => {
        const updates = { note: 'D' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', ...updates }),
        });

        await client.updatePitch('1', updates);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/pitches/1',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });

      it('should delete pitch', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        await client.deletePitch('1');
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/pitches/1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    describe('Health check', () => {
      it('should perform health check', async () => {
        const health = { status: 'ok' };
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => health,
        });

        const result = await client.healthCheck();
        expect(result).toEqual(health);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://test-api.com/health',
          expect.any(Object)
        );
      });
    });
  });
});
