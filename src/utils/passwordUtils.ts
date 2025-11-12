/**
 * Password validation utilities for admin authentication
 */

/**
 * Custom error class for rate limiting
 */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Custom error class for missing environment variable
 */
export class MissingPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingPasswordError';
  }
}

/**
 * Validates the provided password against the environment variable
 * 
 * @param password - The password to validate
 * @returns true if password is correct
 * @throws {MissingPasswordError} If VITE_ADMIN_PASSWORD is not configured
 * @throws {Error} If password is incorrect
 */
export function validatePassword(password: string): boolean {
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  
  // Handle missing environment variable
  if (!adminPassword) {
    throw new MissingPasswordError(
      'Admin password is not configured. Please set VITE_ADMIN_PASSWORD in .env.local'
    );
  }
  
  // Validate password
  if (password !== adminPassword) {
    throw new Error('Incorrect password');
  }
  
  return true;
}

/**
 * Interface for rate limiter state
 */
export interface RateLimiterState {
  attempts: number;
  lockoutUntil: number | null;
}

/**
 * Rate limiter class to track failed password attempts
 * Implements 5-minute lockout after 5 failed attempts
 */
export class RateLimiter {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  private attempts: number = 0;
  private lockoutUntil: number | null = null;

  /**
   * Check if the rate limiter is currently locked
   * 
   * @returns true if locked, false otherwise
   */
  isLocked(): boolean {
    if (this.lockoutUntil === null) {
      return false;
    }
    
    const now = Date.now();
    if (now >= this.lockoutUntil) {
      // Lockout period has expired, reset
      this.reset();
      return false;
    }
    
    return true;
  }

  /**
   * Get the remaining lockout time in milliseconds
   * 
   * @returns milliseconds remaining, or 0 if not locked
   */
  getRemainingLockoutTime(): number {
    if (this.lockoutUntil === null) {
      return 0;
    }
    
    const remaining = this.lockoutUntil - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Record a failed attempt
   * 
   * @throws {RateLimitError} If max attempts exceeded
   */
  recordFailedAttempt(): void {
    if (this.isLocked()) {
      const remainingMs = this.getRemainingLockoutTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new RateLimitError(
        `Too many failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
      );
    }
    
    this.attempts++;
    
    if (this.attempts >= RateLimiter.MAX_ATTEMPTS) {
      this.lockoutUntil = Date.now() + RateLimiter.LOCKOUT_DURATION_MS;
      throw new RateLimitError(
        'Too many failed attempts. Please wait 5 minutes before trying again.'
      );
    }
  }

  /**
   * Reset the rate limiter (called on successful authentication)
   */
  reset(): void {
    this.attempts = 0;
    this.lockoutUntil = null;
  }

  /**
   * Get the current number of attempts
   * 
   * @returns number of failed attempts
   */
  getAttempts(): number {
    return this.attempts;
  }

  /**
   * Get the current state for persistence or display
   * 
   * @returns current rate limiter state
   */
  getState(): RateLimiterState {
    return {
      attempts: this.attempts,
      lockoutUntil: this.lockoutUntil,
    };
  }

  /**
   * Restore state from a previous session (optional)
   * 
   * @param state - The state to restore
   */
  setState(state: RateLimiterState): void {
    this.attempts = state.attempts;
    this.lockoutUntil = state.lockoutUntil;
  }
}
