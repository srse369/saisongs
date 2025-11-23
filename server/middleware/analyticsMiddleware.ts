import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/AnalyticsService.js';

/**
 * Middleware to track page visits for analytics
 * Non-blocking - doesn't slow down requests
 */
export const trackVisit = (req: Request, res: Response, next: NextFunction) => {
  // Don't track API calls, only page visits
  if (req.path.startsWith('/api')) {
    return next();
  }

  // Get real client IP (handle proxies like nginx)
  const ipAddress = (
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-real-ip']?.toString() ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  );

  // Get user role from header (if authenticated)
  const userRole = (req.headers['x-user-role'] as string) || 'public';

  // Track asynchronously (don't block the request)
  setImmediate(() => {
    const referrer = req.headers['referer'] || req.headers['referrer'];
    analyticsService.trackVisitor({
      ipAddress,
      userAgent: req.headers['user-agent'],
      pagePath: req.path,
      referrer: Array.isArray(referrer) ? referrer[0] : referrer,
      userRole
    }).catch(error => {
      // Silently log errors - don't disrupt user experience
      console.error('[Analytics] Track visitor error:', error.message);
    });
  });

  next();
};

