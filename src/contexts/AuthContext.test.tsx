import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { ReactNode } from 'react';

// Test component to access auth context
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="user-role">{auth.userRole}</div>
      <div data-testid="is-editor">{auth.isEditor.toString()}</div>
      <div data-testid="is-admin">{auth.isAdmin.toString()}</div>
      <div data-testid="user-id">{auth.userId?.toString() || 'null'}</div>
      <div data-testid="user-name">{auth.userName || 'null'}</div>
      <div data-testid="user-email">{auth.userEmail || 'null'}</div>
      <div data-testid="is-loading">{auth.isLoading.toString()}</div>
      <button onClick={() => auth.setAuthenticatedUser('admin', 1, 'admin@test.com', 'Admin User', [1, 2], [1])}>
        Set Auth
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state and session check', () => {
    it('should start with public role and loading state', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading
      expect(screen.getByTestId('is-loading').textContent).toBe('true');

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('user-role').textContent).toBe('public');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    it('should check session on mount and restore authenticated user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authenticated: true,
          user: {
            id: 123,
            role: 'admin',
            name: 'Test Admin',
            email: 'admin@test.com',
            centerIds: [1, 2],
            editorFor: [3, 4],
          },
        }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-role').textContent).toBe('admin');
      expect(screen.getByTestId('user-id').textContent).toBe('123');
      expect(screen.getByTestId('user-name').textContent).toBe('Test Admin');
      expect(screen.getByTestId('user-email').textContent).toBe('admin@test.com');
      expect(screen.getByTestId('is-admin').textContent).toBe('true');
      expect(screen.getByTestId('is-editor').textContent).toBe('true');
    });

    it('should handle failed session check', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('user-role').textContent).toBe('public');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user-id').textContent).toBe('null');
    });

    it('should handle network errors during session check', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('user-role').textContent).toBe('public');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Session check error:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle unauthenticated session response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false, user: null }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('user-role').textContent).toBe('public');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });
  });

  describe('setAuthenticatedUser', () => {
    it('should set authenticated admin user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByText('Set Auth').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('user-role').textContent).toBe('admin');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('is-admin').textContent).toBe('true');
      expect(screen.getByTestId('is-editor').textContent).toBe('true');
      expect(screen.getByTestId('user-id').textContent).toBe('1');
      expect(screen.getByTestId('user-name').textContent).toBe('Admin User');
      expect(screen.getByTestId('user-email').textContent).toBe('admin@test.com');
    });

    it('should set editor user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      });

      const EditorTestComponent = () => {
        const auth = useAuth();
        return (
          <div>
            <div data-testid="is-editor">{auth.isEditor.toString()}</div>
            <div data-testid="is-admin">{auth.isAdmin.toString()}</div>
            <button onClick={() => auth.setAuthenticatedUser('editor', 2, 'editor@test.com')}>
              Set Editor
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <EditorTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-editor').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByText('Set Editor').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-editor').textContent).toBe('true');
      });

      expect(screen.getByTestId('is-admin').textContent).toBe('false');
    });

    it('should set viewer user (not editor, not admin)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      });

      const ViewerTestComponent = () => {
        const auth = useAuth();
        return (
          <div>
            <div data-testid="is-authenticated">{auth.isAuthenticated.toString()}</div>
            <div data-testid="is-editor">{auth.isEditor.toString()}</div>
            <div data-testid="is-admin">{auth.isAdmin.toString()}</div>
            <button onClick={() => auth.setAuthenticatedUser('viewer', 3, 'viewer@test.com')}>
              Set Viewer
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <ViewerTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByText('Set Viewer').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      expect(screen.getByTestId('is-editor').textContent).toBe('false');
      expect(screen.getByTestId('is-admin').textContent).toBe('false');
    });
  });

  describe('logout', () => {
    it('should logout and reset to public role', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            authenticated: true,
            user: {
              id: 1,
              role: 'admin',
              name: 'Admin',
              email: 'admin@test.com',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role').textContent).toBe('admin');
      });

      await act(async () => {
        screen.getByText('Logout').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('user-role').textContent).toBe('public');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user-id').textContent).toBe('null');
      expect(screen.getByTestId('user-name').textContent).toBe('null');
      expect(screen.getByTestId('user-email').textContent).toBe('null');
    });

    it('should reset state even if logout API fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            authenticated: true,
            user: {
              id: 1,
              role: 'admin',
              email: 'admin@test.com',
            },
          }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role').textContent).toBe('admin');
      });

      await act(async () => {
        screen.getByText('Logout').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('user-role').textContent).toBe('public');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const BadComponent = () => {
        useAuth(); // This should throw
        return <div>Should not render</div>;
      };

      expect(() => {
        render(<BadComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Role-based properties', () => {
    it('should correctly compute isEditor for editor role', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authenticated: true,
          user: {
            id: 1,
            role: 'editor',
            email: 'editor@test.com',
          },
        }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-editor').textContent).toBe('true');
      });

      expect(screen.getByTestId('is-admin').textContent).toBe('false');
    });

    it('should correctly compute isAuthenticated for all non-public roles', async () => {
      for (const role of ['viewer', 'editor', 'admin'] as const) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            authenticated: true,
            user: {
              id: 1,
              role,
              email: `${role}@test.com`,
            },
          }),
        });

        const { unmount } = render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
        });

        unmount();
      }
    });
  });
});
