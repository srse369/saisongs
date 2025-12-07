import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RateLimiter,
  RateLimitError,
} from './passwordUtils';

describe('Password Authentication', () => {
  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not be locked initially', () => {
      expect(rateLimiter.isLocked()).toBe(false);
      expect(rateLimiter.getAttempts()).toBe(0);
      expect(rateLimiter.getRemainingLockoutTime()).toBe(0);
    });

    it('should increment attempts on failed attempt', () => {
      rateLimiter.recordFailedAttempt();
      expect(rateLimiter.getAttempts()).toBe(1);
      
      rateLimiter.recordFailedAttempt();
      expect(rateLimiter.getAttempts()).toBe(2);
      
      rateLimiter.recordFailedAttempt();
      expect(rateLimiter.getAttempts()).toBe(3);
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
      expect(rateLimiter.getRemainingLockoutTime()).toBe(0);
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

      expect(rateLimiter.isLocked()).toBe(true);
      const remaining = rateLimiter.getRemainingLockoutTime();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(5 * 60 * 1000); // 5 minutes in ms
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

      // Fast-forward time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Should be unlocked now
      expect(rateLimiter.isLocked()).toBe(false);
      expect(rateLimiter.getRemainingLockoutTime()).toBe(0);
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
      expect(newRateLimiter.isLocked()).toBe(false);
    });

    it('should restore locked state correctly', () => {
      // Lock the original rate limiter
      for (let i = 0; i < 5; i++) {
        try {
          rateLimiter.recordFailedAttempt();
        } catch (e) {
          // Expected on 5th attempt
        }
      }

      const state = rateLimiter.getState();
      expect(state.lockoutUntil).not.toBeNull();

      // Restore to new rate limiter
      const newRateLimiter = new RateLimiter();
      newRateLimiter.setState(state);

      expect(newRateLimiter.isLocked()).toBe(true);
      expect(newRateLimiter.getRemainingLockoutTime()).toBeGreaterThan(0);
    });

    it('should handle edge case: exactly at lockout expiry', () => {
      // Lock the rate limiter
      for (let i = 0; i < 5; i++) {
        try {
          rateLimiter.recordFailedAttempt();
        } catch (e) {
          // Expected on 5th attempt
        }
      }

      expect(rateLimiter.isLocked()).toBe(true);

      // Advance to exactly 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Should be unlocked and reset
      expect(rateLimiter.isLocked()).toBe(false);
      expect(rateLimiter.getAttempts()).toBe(0);
    });
  });
});
