import React, { useState, useEffect, useRef } from 'react';
import { RateLimiter, RateLimitError } from '../../utils/passwordUtils';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Props for the PasswordDialog component
 */
interface PasswordDialogProps {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Callback function when dialog is closed */
  onClose: () => void;
  /** Callback function when authentication succeeds */
  onSuccess: () => void;
}

/**
 * Password Dialog component for admin authentication
 * 
 * Provides a modal dialog for password entry with the following features:
 * - Password validation against environment variable
 * - Rate limiting (5 attempts, 5-minute lockout)
 * - Error message display
 * - Focus management for accessibility
 * - Keyboard navigation (Escape to close)
 * 
 * @component
 * @example
 * ```tsx
 * <PasswordDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => openImportUI()}
 * />
 * ```
 */
export const PasswordDialog: React.FC<PasswordDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rateLimiter] = useState(() => new RateLimiter());
  const [isLocked, setIsLocked] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && passwordInputRef.current) {
      // Focus the password input when dialog opens
      passwordInputRef.current.focus();
    }
  }, [isOpen]);

  // Clear password field when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  /**
   * Handles dialog cancellation
   * Clears password and error state, then closes the dialog
   */
  const handleCancel = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  /**
   * Handles form submission and password validation
   * Implements rate limiting and error handling
   * 
   * @param event - Form submission event
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Check if locked
    if (rateLimiter.isLocked()) {
      setIsLocked(true);
      const remainingMs = rateLimiter.getRemainingLockoutTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      setError(`Too many failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`);
      return;
    }

    try {
      // Login through auth context (calls backend API)
      const success = await login(password);
      
      if (success) {
        // Success - reset rate limiter and trigger success callback
        rateLimiter.reset();
        setPassword('');
        setError(null);
        onSuccess();
        onClose();
      } else {
        throw new Error('Invalid password');
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setIsLocked(true);
        setError(err.message);
      } else {
        // Record failed attempt
        try {
          rateLimiter.recordFailedAttempt();
          setError('Incorrect password. Please try again.');
        } catch (rateLimitErr) {
          if (rateLimitErr instanceof RateLimitError) {
            setIsLocked(true);
            setError(rateLimitErr.message);
          }
        }
      }
    }
  };

  /**
   * Handles clicks on the backdrop (outside the dialog)
   * Closes the dialog only if the backdrop itself was clicked
   * 
   * @param event - Mouse click event
   */
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Login
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 transition-colors"
            aria-label="Close dialog"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="mb-4">
            <label
              htmlFor="admin-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Enter Password
            </label>
            <input
              ref={passwordInputRef}
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLocked}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed"
              placeholder="Password"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLocked || !password.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
