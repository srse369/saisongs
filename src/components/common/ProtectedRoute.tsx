import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordDialog } from '../admin/PasswordDialog';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // If not authenticated when component mounts, show password dialog
    if (!isAuthenticated) {
      setShowPasswordDialog(true);
    }
  }, [isAuthenticated]);

  // If user successfully logged in, render the protected content
  if (loginSuccess || isAuthenticated) {
    if (requireAdmin && !isAdmin) {
      // User is authenticated but not admin
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700 dark:text-gray-300">This page requires administrator privileges.</p>
          <button 
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      );
    }
    return <>{children}</>;
  }

  // Show password dialog if not authenticated
  return (
    <>
      <PasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false);
          // If they close without logging in, go back
          window.history.back();
        }}
        onSuccess={() => {
          setShowPasswordDialog(false);
          setLoginSuccess(true);
        }}
      />
      {/* Show loading state while dialog is open */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Authentication required...</p>
        </div>
      </div>
    </>
  );
};
