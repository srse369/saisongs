import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validatePassword,
  RateLimiter,
  RateLimitError,
  MissingPasswordError,
} from './passwordUtils';

describe('Password Authentication', () => {
  describe('validatePassword', () => {
    beforeEach(() => {
      // Reset environment variable before each test
      vi.stubEnv('VITE_ADMIN_PASSWORD', 'test-password-123');
    });

    it('should return true for correct password', () => {
      expect(validatePassword('test-password-123')).toBe(true);
    });

    it('should throw error for incorrect password', () => {
      expect(() => validatePassword('wrong-password')).toThrow('Incorrect password');
    });

    it('should throw MissingPasswordError when environment variable is not set', () => {
      vi.stubEnv('VITE_ADMIN_PASSWORD', '');
      
      expect(() => validatePassword('any-password')).toThrow(MissingPasswordError);
      expect(() => validatePassword('any-password')).toThrow(
        'Admin password is not configured'
      );
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter();
    });

    it('should not be locked initially', () => {
      expect(rateLimiter.isLocked()).toBe(false);
      expect(rateLimiter.getAttempts()).toBe(0);
    });

    it('should track failed attempts', () => {
      rateLimiter.recordFailedAttempt();
      expect(rateLimiter.getAttempts()).toBe(1);

      rateLimiter.recordFailedAttempt();
      expect(rateLimiter.getAttempts()).toBe(2);
    });

    it('should lock after 5 failed attempts', () => {
      // Record 4 attempts - should not lock
      for (let i = 0; i < 4; i++) {
        rateLimiter.recordFailedAttempt();
      }
      expect(rateLimiter.isLocked()).toBe(false);
      expect(rateLimiter.getAttempts()).toBe(4);

      // 5th attempt should trigger lockout
      expect(() => rateLimiter.recordFailedAttempt()).toThrow(RateLimitError);
      expect(() => rateLimiter.recordFailedAttempt()).toThrow(
        /Too many failed attempts.*5 minute/
      );
      expect(rateLimiter.isLocked()).toBe(true);
    });

    it('should prevent attempts while locked', () => {
      // Lock the rate limiter
      for (let i = 0; i < 5; i++) {
        try {
          rateLimiter.recordFailedAttempt();
        } catch (e) {
          // Expected on 5th attempt
        }
      }

      expect(rateLimiter.isLocked()).toBe(true);

      // Try to record another attempt while locked
      expect(() => rateLimiter.recordFailedAttempt()).toThrow(RateLimitError);
      expect(() => rateLimiter.recordFailedAttempt()).toThrow(/Please wait.*minute/);
    });

    it('should reset attempts on successful authentication', () => {
      rateLimiter.recordFailedAttempt();
      rateLimiter.recordFailedAttempt();
      expect(rateLimiter.getAttempts()).toBe(2);

      rateLimiter.reset();
      expect(rateLimiter.getAttempts()).toBe(0);
      expect(rateLimiter.isLocked()).toBe(false);
    });

    it('should calculate remaining lockout time', () => {
      // Lock the rate limiter
      for (let i = 0; i < 5; i++) {
        try {
          rateLimiter.recordFailedAttempt();
        } catch (e) {
          // Expected on 5th attempt
        }
      }

      const remainingTime = rateLimiter.getRemainingLockoutTime();
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(5 * 60 * 1000); // 5 minutes in ms
    });

    it('should unlock after lockout period expires', () => {
      // Lock the rate limiter
      for (let i = 0; i < 5; i++) {
        try {
          rateLimiter.recordFailedAttempt();
        } catch (e) {
          // Expected on 5th attempt
        }
      }

      expect(rateLimiter.isLocked()).toBe(true);

      // Manually set lockout to past time to simulate expiration
      const state = rateLimiter.getState();
      rateLimiter.setState({
        attempts: state.attempts,
        lockoutUntil: Date.now() - 1000, // 1 second ago
      });

      expect(rateLimiter.isLocked()).toBe(false);
      expect(rateLimiter.getAttempts()).toBe(0); // Should be reset
    });

    it('should persist and restore state', () => {
      rateLimiter.recordFailedAttempt();
      rateLimiter.recordFailedAttempt();
      rateLimiter.recordFailedAttempt();

      const state = rateLimiter.getState();
      expect(state.attempts).toBe(3);

      // Create new rate limiter and restore state
      const newRateLimiter = new RateLimiter();
      newRateLimiter.setState(state);

      expect(newRateLimiter.getAttempts()).toBe(3);
      expect(newRateLimiter.getState()).toEqual(state);
    });
  });
});
