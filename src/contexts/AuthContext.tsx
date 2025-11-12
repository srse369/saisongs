import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AuthContextState {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Sairam999';
const AUTH_KEY = 'songstudio_auth';
const AUTH_EXPIRY_KEY = 'songstudio_auth_expiry';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = sessionStorage.getItem(AUTH_KEY);
      const expiry = sessionStorage.getItem(AUTH_EXPIRY_KEY);
      
      if (authStatus === 'true' && expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (Date.now() < expiryTime) {
          setIsAuthenticated(true);
        } else {
          // Session expired
          sessionStorage.removeItem(AUTH_KEY);
          sessionStorage.removeItem(AUTH_EXPIRY_KEY);
          setIsAuthenticated(false);
        }
      }
    };

    checkAuth();
  }, []);

  const login = useCallback((password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      const expiryTime = Date.now() + SESSION_DURATION;
      sessionStorage.setItem(AUTH_KEY, 'true');
      sessionStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_EXPIRY_KEY);
    setIsAuthenticated(false);
  }, []);

  const value: AuthContextState = {
    isAuthenticated,
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
