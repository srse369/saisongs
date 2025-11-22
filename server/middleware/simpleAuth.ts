import { Request, Response, NextFunction } from 'express';

/**
 * Simple authentication middleware
 * Checks for X-User-Role header indicating user has authenticated
 * 
 * Note: This is NOT cryptographically secure (anyone can set headers)
 * but provides reasonable protection in a trusted environment where:
 * - Frontend enforces login UI
 * - Direct API access is limited
 * - Users are trusted (internal team)
 * 
 * For production with untrusted users, upgrade to JWT tokens
 */

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.headers['x-user-role'] as string;

  if (!userRole || (userRole !== 'admin' && userRole !== 'editor' && userRole !== 'viewer')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  // Viewer role can only read (GET requests)
  if (userRole === 'viewer' && req.method !== 'GET') {
    return res.status(403).json({ 
      error: 'Read-only access',
      message: 'Viewer role can only view data, not modify it'
    });
  }

  // Attach role to request for downstream use
  (req as any).userRole = userRole;
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.headers['x-user-role'] as string;

  // First check if authenticated at all
  if (!userRole || (userRole !== 'admin' && userRole !== 'editor' && userRole !== 'viewer')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  // Then check if admin specifically
  if (userRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This action requires administrator privileges'
    });
  }

  (req as any).userRole = userRole;
  next();
};

