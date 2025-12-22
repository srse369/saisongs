import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';

export type UserRole = 'public' | 'viewer' | 'editor' | 'admin';

interface AuthContextState {
  isAuthenticated: boolean;
  userRole: UserRole;
  isEditor: boolean;
  isAdmin: boolean;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  centerIds: number[];
  editorFor: number[];
  isLoading: boolean;
  setAuthenticatedUser: (role: UserRole, userId: number, email: string, name?: string, centerIds?: number[], editorFor?: number[]) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Use Vite proxy in development (/api), full URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>('public');
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [centerIds, setCenterIds] = useState<number[]>([]);
  const [editorFor, setEditorFor] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/session`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setUserRole(data.user.role as UserRole);
            setUserId(data.user.id);
            setUserName(data.user.name);
            setUserEmail(data.user.email);
            setCenterIds(data.user.centerIds || []);
            setEditorFor(data.user.editorFor || []);
          } else {
            setUserRole('public');
            setUserId(null);
            setUserName(null);
            setUserEmail(null);
            setCenterIds([]);
            setEditorFor([]);
          }
        } else {
          setUserRole('public');
          setUserId(null);
          setUserName(null);
          setUserEmail(null);
          setCenterIds([]);
          setEditorFor([]);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setUserRole('public');
        setUserId(null);
        setUserName(null);
        setUserEmail(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const setAuthenticatedUser = useCallback((role: UserRole, id: number, email: string, name?: string, centersIds?: number[], editorsFor?: number[]) => {
    // Clear localStorage cache on login
    localStorage.clear();
    
    // Use flushSync to ensure state is updated synchronously
    flushSync(() => {
      setUserRole(role);
      setUserId(id);
      setUserName(name || null);
      setUserEmail(email);
      setCenterIds(centersIds || []);
      setEditorFor(editorsFor || []);
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUserRole('public');
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setCenterIds([]);
      setEditorFor([]);
    }
  }, []);

  const value: AuthContextState = {
    isAuthenticated: userRole !== 'public', // Authenticated = viewer, editor, or admin
    userRole,
    userId,
    userName,
    userEmail,
    centerIds,
    editorFor,
    isEditor: userRole === 'editor' || userRole === 'admin',
    isAdmin: userRole === 'admin',
    isLoading,
    setAuthenticatedUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextState => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
