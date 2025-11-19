import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

export type UserRole = 'viewer' | 'editor' | 'admin';

interface AuthContextState {
  isAuthenticated: boolean;
  userRole: UserRole;
  isEditor: boolean;
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Sairam999';
const EDITOR_PASSWORD = import.meta.env.VITE_EDITOR_PASSWORD || 'Editor999';
const AUTH_ROLE_KEY = 'songstudio_auth_role';
const AUTH_EXPIRY_KEY = 'songstudio_auth_expiry';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>('viewer');

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      const storedRole = sessionStorage.getItem(AUTH_ROLE_KEY) as UserRole | null;
      const expiry = sessionStorage.getItem(AUTH_EXPIRY_KEY);
      
      if (storedRole && expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (Date.now() < expiryTime) {
          setUserRole(storedRole);
        } else {
          // Session expired
          sessionStorage.removeItem(AUTH_ROLE_KEY);
          sessionStorage.removeItem(AUTH_EXPIRY_KEY);
          setUserRole('viewer');
        }
      }
    };

    checkAuth();
  }, []);

  const login = useCallback((password: string): boolean => {
    let role: UserRole = 'viewer';
    
    if (password === ADMIN_PASSWORD) {
      role = 'admin';
    } else if (password === EDITOR_PASSWORD) {
      role = 'editor';
    } else {
      return false;
    }
    
    const expiryTime = Date.now() + SESSION_DURATION;
    sessionStorage.setItem(AUTH_ROLE_KEY, role);
    sessionStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
    setUserRole(role);
    return true;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_ROLE_KEY);
    sessionStorage.removeItem(AUTH_EXPIRY_KEY);
    setUserRole('viewer');
  }, []);

  const value: AuthContextState = {
    isAuthenticated: userRole !== 'viewer',
    userRole,
    isEditor: userRole === 'editor' || userRole === 'admin',
    isAdmin: userRole === 'admin',
    login,
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
