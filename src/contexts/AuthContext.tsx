import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';

export type UserRole = 'public' | 'viewer' | 'editor' | 'admin';

interface AuthContextState {
  isAuthenticated: boolean;
  userRole: UserRole;
  isEditor: boolean;
  isAdmin: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  downgradeRole: () => void;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_ROLE_KEY = 'songstudio_auth_role';
const AUTH_EXPIRY_KEY = 'songstudio_auth_expiry';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Use Vite proxy in development (/api), full URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>('public');

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
          setUserRole('public');
        }
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      // Call backend authentication endpoint
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        const role = data.role as UserRole;

        // Debug logging
        console.log('[AuthContext] Login successful:', { 
          receivedRole: role, 
          backendResponse: data 
        });

        // Store role and expiry in sessionStorage
        const expiryTime = Date.now() + SESSION_DURATION;
        sessionStorage.setItem(AUTH_ROLE_KEY, role);
        sessionStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
        
        console.log('[AuthContext] Stored in sessionStorage:', {
          role,
          stored: sessionStorage.getItem(AUTH_ROLE_KEY)
        });
        
        // Use flushSync to ensure state is updated synchronously
        // This prevents the "tabs not clickable" issue after login
        flushSync(() => {
          setUserRole(role);
        });
        
        console.log('[AuthContext] State updated to:', role);
        return true;
      } else {
        // Login failed
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Login failed:', error);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_ROLE_KEY);
    sessionStorage.removeItem(AUTH_EXPIRY_KEY);
    setUserRole('public');
  }, []);

  const downgradeRole = useCallback(() => {
    let newRole: UserRole = 'public';
    
    // Cycle down one level: admin → editor → viewer → public
    if (userRole === 'admin') {
      newRole = 'editor';
    } else if (userRole === 'editor') {
      newRole = 'viewer';
    } else if (userRole === 'viewer') {
      newRole = 'public';
    } else {
      // Already public, do nothing
      return;
    }

    // Update storage immediately (fast operation)
    if (newRole === 'public') {
      sessionStorage.removeItem(AUTH_ROLE_KEY);
      sessionStorage.removeItem(AUTH_EXPIRY_KEY);
    } else {
      sessionStorage.setItem(AUTH_ROLE_KEY, newRole);
      // Keep the same expiry time
    }
    
    // Defer state update to avoid blocking the click handler
    requestAnimationFrame(() => {
      setUserRole(newRole);
    });
  }, [userRole]);

  const value: AuthContextState = {
    isAuthenticated: userRole !== 'public', // Authenticated = viewer, editor, or admin
    userRole,
    isEditor: userRole === 'editor' || userRole === 'admin',
    isAdmin: userRole === 'admin',
    login,
    logout,
    downgradeRole,
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
