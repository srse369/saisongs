import { Request, Response, NextFunction } from 'express';

/**
 * Session-based authentication middleware
 * Checks for active session and validates user role
 * 
 * Sessions are managed via express-session with secure cookies
 */

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  const userRole = req.session.userRole;

  if (!userRole || (userRole !== 'admin' && userRole !== 'editor' && userRole !== 'viewer')) {
    return res.status(401).json({ 
      error: 'Invalid session',
      message: 'Your session is invalid. Please log in again.'
    });
  }

  // Note: Viewer write restrictions are enforced at the route level
  // Sessions: viewers can create/edit/delete (for presentation purposes)
  // Songs/Templates: viewers blocked by explicit role checks in route handlers

  // Attach user info to request for downstream use
  (req as any).user = {
    id: req.session.userId,
    email: req.session.userEmail,
    name: req.session.userName,
    role: userRole,
    centerIds: req.session.centerIds || [],
    editorFor: req.session.editorFor || []
  };
  (req as any).userRole = userRole;
  (req as any).userId = req.session.userId;
  next();
};

export const requireEditor = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  const userRole = req.session.userRole;

  if (!userRole || (userRole !== 'admin' && userRole !== 'editor' && userRole !== 'viewer')) {
    return res.status(401).json({ 
      error: 'Invalid session',
      message: 'Your session is invalid. Please log in again.'
    });
  }

  // Check if editor or admin (viewer cannot modify)
  if (userRole !== 'editor' && userRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Editor access required',
      message: 'This action requires editor or administrator privileges'
    });
  }

  // Attach user info to request for downstream use
  (req as any).user = {
    id: req.session.userId,
    email: req.session.userEmail,
    name: req.session.userName,
    role: userRole,
    centerIds: req.session.centerIds || [],
    editorFor: req.session.editorFor || []
  };
  (req as any).userRole = userRole;
  (req as any).userId = req.session.userId;
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  const userRole = req.session.userRole;

  if (!userRole || (userRole !== 'admin' && userRole !== 'editor' && userRole !== 'viewer')) {
    return res.status(401).json({ 
      error: 'Invalid session',
      message: 'Your session is invalid. Please log in again.'
    });
  }

  // Then check if admin specifically
  if (userRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This action requires administrator privileges'
    });
  }

  // Attach user info to request for downstream use
  (req as any).user = {
    id: req.session.userId,
    email: req.session.userEmail,
    name: req.session.userName,
    role: userRole,
    centerIds: req.session.centerIds || [],
    editorFor: req.session.editorFor || []
  };
  (req as any).userRole = userRole;
  (req as any).userId = req.session.userId;
  next();
};

