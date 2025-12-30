import React, { useState, useEffect, useCallback } from 'react';
import type { UserRole } from '../../contexts/AuthContext';

interface OTPLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: UserRole, userId: string, email: string, name?: string, centerIds?: number[], editorFor?: number[]) => void;
}

type Step = 'email' | 'otp';

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

export const OTPLoginDialog: React.FC<OTPLoginDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('email');
      setEmail('');
      setOtp('');
      setError('');
      setLoading(false);
      setOtpExpiry(null);
      setCountdown(0);
    }
  }, [isOpen]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (otpExpiry && step === 'otp') {
      const interval = setInterval(() => {
        const remaining = Math.floor((otpExpiry - Date.now()) / 1000);
        if (remaining <= 0) {
          setCountdown(0);
          setError('OTP expired. Please request a new one.');
          setStep('email');
          setOtpExpiry(null);
        } else {
          setCountdown(remaining);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [otpExpiry, step]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('otp');
        setOtpExpiry(Date.now() + 10 * 60 * 1000); // 10 minutes
        setError('');
      } else {
        // Show specific message for non-existent email
        if (response.status === 404) {
          setError(data.message || 'Please contact your nearest center to get access.');
        } else {
          setError(data.error || 'Failed to send OTP. Please try again.');
        }
      }
    } catch (err) {
      console.error('Request OTP error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          code: otp.trim() 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const role = data.role as UserRole;
        const userId = data.user?.id || '';
        const userEmail = data.user?.email || email.trim().toLowerCase();
        const userName = data.user?.name;
        const centerIds = data.user?.centerIds || [];
        const editorFor = data.user?.editorFor || [];
        onSuccess(role, userId, userEmail, userName, centerIds, editorFor);
        onClose();
      } else {
        setError(data.error || 'Invalid OTP. Please try again.');
        setOtp('');
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = useCallback(() => {
    setStep('email');
    setOtp('');
    setError('');
    setOtpExpiry(null);
    setCountdown(0);
  }, []);

  // Handle Escape key globally when dialog is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {step === 'email' ? 'Sign In' : 'Enter OTP'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>

            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              We'll send a 6-digit code to your email. Please check your inbox or junk/spam folder.
            </p>

            <div className="text-xs text-gray-800 dark:text-gray-200 text-center bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <i className="fas fa-info-circle mr-1"></i>
              <strong>Note:</strong> Your email must be registered in the system. For registration, please contact your center admin. <br/><br/>If you are not sure, send feedback by clicking the feedback button that is at the bottom right of the screen after you close this popup.
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter 6-digit code
              </label>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Sent to: <span className="font-medium">{email}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 bg-blue-50 dark:bg-blue-900/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                💡 Didn't receive the code? Check your spam/junk folder
              </div>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                required
                autoFocus
                autoComplete="one-time-code"
                disabled={loading}
                maxLength={6}
              />
              {countdown > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Code expires in {formatCountdown(countdown)}
                </div>
              )}
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={handleBackToEmail}
                disabled={loading}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Back to Email
              </button>
            </div>

            <p className="text-sm text-gray-500 text-center">
              Didn't receive the code? Click "Back to Email" to resend
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
