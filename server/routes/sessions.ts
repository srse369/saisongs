import express from 'express';
import { cacheService } from '../services/CacheService.js';
import { databaseService } from '../services/DatabaseService.js';
import { requireAuth, requireEditor, optionalAuth } from '../middleware/simpleAuth.js';
import { handleSessionError } from '../utils/errorHandlers.js';

const router = express.Router();

// ============ Named Sessions ============

// Get all sessions - Public endpoint for presentation purposes
// Uses optionalAuth to populate req.user if logged in (for center-based filtering)
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Bypass cache to always get fresh data (filtering is user-specific)
    const db = await (cacheService as any).getDatabase();
    const sessions = await db.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        center_ids,
        created_by,
        created_at,
        updated_at
      FROM song_sessions 
      ORDER BY name
    `);

    const mappedSessions = sessions.map((row: any) => {
      let centerIds: number[] | undefined = undefined;
      try {
        if (row.CENTER_IDS) {
          const parsed = JSON.parse(row.CENTER_IDS);
          if (Array.isArray(parsed) && parsed.length > 0) {
            centerIds = parsed;
          }
        }
      } catch (e) {
        console.error('[SESSIONS] Error parsing center_ids:', e);
      }

      return {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        center_ids: centerIds,
        created_by: row.CREATED_BY,
        createdAt: new Date(row.CREATED_AT).toISOString(),
        updatedAt: new Date(row.UPDATED_AT).toISOString(),
      };
    });

    const allSessions = mappedSessions;
    const user = req.user;
    
    // Filter sessions based on user role and centers
    let filteredSessions = allSessions;
    
    if (!user) {
      // Non-authenticated users see only public sessions (no center restriction)
      filteredSessions = allSessions.filter(s => !s.center_ids || s.center_ids.length === 0);
    } else if (user.role === 'admin') {
      // Admins see all sessions
      filteredSessions = allSessions;
    } else if (user.role === 'editor') {
      // Editors see sessions for their centers + public sessions
      const editorCenterIds = user.editorFor || [];
      filteredSessions = allSessions.filter(s => {
        const sessionCenterIds = s.center_ids || [];
        // Show if public OR if editor manages at least one of the session's centers
        return sessionCenterIds.length === 0 || 
          sessionCenterIds.some((cid: number) => editorCenterIds.includes(cid));
      });
    } else if (user.role === 'viewer') {
      // Viewers see sessions for their centers + public sessions + their own sessions
      const userCenterIds = user.centerIds || [];
      filteredSessions = allSessions.filter(s => {
        const sessionCenterIds = s.center_ids || [];
        // Show if: public OR user's center OR created by user
        return sessionCenterIds.length === 0 || 
          sessionCenterIds.some((cid: number) => userCenterIds.includes(cid)) ||
          s.created_by === user.email;
      });
    }
    
    res.json(filteredSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    // Return empty array if database not configured or connection failed (for development)
    if (error instanceof Error && (
      error.message.includes('not configured') ||
      error.message.includes('connection request timeout') ||
      error.message.includes('connection failed') ||
      error.message.includes('TLS handshake')
    )) {
      console.log('⚠️  Database not ready, returning empty array');
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session by ID with items - Public endpoint for presentation purposes
// Uses optionalAuth to populate req.user if logged in (for center-based access control)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await cacheService.getSession(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const user = req.user;
    const sessionCenterIds = session.center_ids || [];
    
    // Check access based on user role and centers
    if (sessionCenterIds.length > 0) {
      // Session is restricted to specific centers
      if (!user) {
        // Non-authenticated users can't access center-restricted sessions
        return res.status(403).json({ error: 'Access denied', message: 'This session is restricted to specific centers' });
      } else if (user.role === 'admin') {
        // Admins can access all sessions
      } else if (user.role === 'editor') {
        // Editors must manage at least one of the session's centers
        const editorCenterIds = user.editorFor || [];
        const hasAccess = sessionCenterIds.some((cid: number) => editorCenterIds.includes(cid));
        if (!hasAccess) {
          return res.status(403).json({ 
            error: 'Access denied', 
            message: 'This session is restricted to centers you do not manage' 
          });
        }
      } else if (user.role === 'viewer') {
        // Viewers must belong to one of the session's centers OR be the creator
        const userCenterIds = user.centerIds || [];
        const hasAccess = sessionCenterIds.some((cid: number) => userCenterIds.includes(cid)) ||
          session.created_by === user.email;
        if (!hasAccess) {
          return res.status(403).json({ 
            error: 'Access denied', 
            message: 'This session is restricted to centers you do not belong to' 
          });
        }
      }
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create session
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, center_ids } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For non-admins, auto-assign their center(s) if no center_ids specified
    let sessionCenterIds = center_ids;
    if (user.role !== 'admin' && (!center_ids || center_ids.length === 0)) {
      // Use the user's primary center(s)
      sessionCenterIds = user.centerIds || [];
    }

    const session = await cacheService.createSession(name, description, sessionCenterIds, user.email);
    res.status(201).json(session);
  } catch (error: any) {
    console.error('Error creating session:', error);
    const dbError = handleSessionError(error);
    if (dbError) {
      return res.status(dbError.status).json(dbError.json);
    }
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, center_ids } = req.body;
    const user = req.user;

    if (name === undefined && description === undefined && center_ids === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Get existing session to check ownership
    const existingSession = await cacheService.getSession(id);
    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Admins can edit any session
    if (user.role !== 'admin') {
      // Viewers can only edit their own sessions
      if (user.role === 'viewer') {
        if (existingSession.created_by !== user.email) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'You can only edit sessions that you created'
          });
        }
      } 
      // Editors can only edit sessions for centers they manage
      else if (user.role === 'editor') {
        const editorCenterIds = user.editorFor || [];
        const sessionCenterIds = existingSession.center_ids || [];
        
        // Check if editor manages at least one of the session's centers
        const hasAccess = sessionCenterIds.length === 0 || 
          sessionCenterIds.some((cid: number) => editorCenterIds.includes(cid));
        
        if (!hasAccess) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'You can only edit sessions for centers where you are an editor'
          });
        }
      }
    }

    const session = await cacheService.updateSession(id, { name, description, center_ids, updated_by: user.email });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error: any) {
    console.error('Error updating session:', error);
    const dbError = handleSessionError(error);
    if (dbError) {
      return res.status(dbError.status).json(dbError.json);
    }
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the session to check ownership and centers
    const session = await cacheService.getSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Admins can delete any session
    if (user.role === 'admin') {
      await cacheService.deleteSession(id);
      return res.status(204).send();
    }

    // Viewers can only delete their own sessions
    if (user.role === 'viewer') {
      if (session.created_by !== user.email) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only delete sessions that you created'
        });
      }
      await cacheService.deleteSession(id);
      return res.status(204).send();
    }

    // Editors can only delete sessions for centers they manage
    if (user.role === 'editor') {
      const editorCenterIds = user.editorFor || [];
      const sessionCenterIds = session.center_ids || [];
      
      // Check if editor manages at least one of the session's centers
      const hasAccess = sessionCenterIds.length === 0 || 
        sessionCenterIds.some((cid: number) => editorCenterIds.includes(cid));
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only delete sessions for centers where you are an editor'
        });
      }
      
      await cacheService.deleteSession(id);
      return res.status(204).send();
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    console.error('Session ID:', req.params.id);
    console.error('User:', req.user);
    res.status(500).json({ 
      error: 'Failed to delete session',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// ============ Session Items ============

// Get session items
router.get('/:sessionId/items', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const items = await cacheService.getSessionItems(sessionId);
    res.json(items);
  } catch (error) {
    console.error('Error fetching session items:', error);
    // Return empty array if database not configured or connection failed (for development)
    if (error instanceof Error && (
      error.message.includes('not configured') ||
      error.message.includes('connection request timeout') ||
      error.message.includes('connection failed') ||
      error.message.includes('TLS handshake')
    )) {
      console.log('⚠️  Database not ready, returning empty array');
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch session items' });
  }
});

// Add session item
router.post('/:sessionId/items', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { songId, singerId, pitch, sequenceOrder } = req.body;
    const user = req.user;

    if (!songId || sequenceOrder === undefined) {
      return res.status(400).json({ error: 'songId and sequenceOrder are required' });
    }

    // Viewers can only add items to their own sessions
    if (user.role === 'viewer') {
      const session = await cacheService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.created_by !== user.email) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only add items to sessions that you created'
        });
      }
    }

    await cacheService.addSessionItem(sessionId, { songId, singerId, pitch, sequenceOrder });
    res.status(201).json({ message: 'Session item added successfully' });
  } catch (error: any) {
    console.error('Error adding session item:', error);
    if (error.message && error.message.includes('unique constraint')) {
      return res.status(409).json({ error: 'Duplicate sequence order in session' });
    }
    res.status(500).json({ error: 'Failed to add session item' });
  }
});

// Update session item
router.put('/items/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { singerId, pitch, sequenceOrder } = req.body;
    const user = req.user;

    if (singerId === undefined && pitch === undefined && sequenceOrder === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Viewers can only update items in their own sessions
    if (user.role === 'viewer') {
      // Query database to get the session_id for this item
      const result = await databaseService.query(
        'SELECT RAWTOHEX(session_id) as session_id FROM song_session_items WHERE RAWTOHEX(id) = :1',
        [id]
      );
      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Session item not found' });
      }
      const sessionId = result[0].SESSION_ID || result[0].session_id;
      const session = await cacheService.getSession(sessionId);
      if (!session || session.created_by !== user.email) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only update items in sessions that you created'
        });
      }
    }

    await cacheService.updateSessionItem(id, { singerId, pitch, sequenceOrder });
    res.json({ message: 'Session item updated successfully' });
  } catch (error: any) {
    console.error('Error updating session item:', error);
    if (error.message && error.message.includes('unique constraint')) {
      return res.status(409).json({ error: 'Duplicate sequence order in session' });
    }
    res.status(500).json({ error: 'Failed to update session item' });
  }
});

// Delete session item
router.delete('/items/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Viewers can only delete items from their own sessions
    if (user.role === 'viewer') {
      // Query database to get the session_id for this item
      const result = await databaseService.query(
        'SELECT RAWTOHEX(session_id) as session_id FROM song_session_items WHERE RAWTOHEX(id) = :1',
        [id]
      );
      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Session item not found' });
      }
      const sessionId = result[0].SESSION_ID || result[0].session_id;
      const session = await cacheService.getSession(sessionId);
      if (!session || session.created_by !== user.email) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only delete items from sessions that you created'
        });
      }
    }

    await cacheService.deleteSessionItem(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session item:', error);
    res.status(500).json({ error: 'Failed to delete session item' });
  }
});

// Reorder session items
router.put('/:sessionId/reorder', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { itemIds } = req.body;
    const user = req.user;

    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds must be an array' });
    }

    // Viewers can only reorder items in their own sessions
    if (user.role === 'viewer') {
      const session = await cacheService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.created_by !== user.email) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only reorder items in sessions that you created'
        });
      }
    }

    await cacheService.reorderSessionItems(sessionId, itemIds);
    res.status(204).send();
  } catch (error) {
    console.error('Error reordering session items:', error);
    res.status(500).json({ error: 'Failed to reorder session items' });
  }
});

// Set all session items (replace existing)
router.put('/:sessionId/items', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { items } = req.body;
    const user = req.user;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    // Viewers can only set items in their own sessions
    if (user.role === 'viewer') {
      const session = await cacheService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.created_by !== user.email) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only set items in sessions that you created'
        });
      }
    }

    const resultItems = await cacheService.setSessionItems(sessionId, items);
    res.json(resultItems);
  } catch (error) {
    console.error('Error setting session items:', error);
    res.status(500).json({ error: 'Failed to set session items' });
  }
});

// Duplicate session
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({ error: 'newName is required' });
    }

    const session = await cacheService.duplicateSession(id, newName);
    res.status(201).json(session);
  } catch (error: any) {
    console.error('Error duplicating session:', error);
    const dbError = handleSessionError(error);
    if (dbError) {
      return res.status(dbError.status).json(dbError.json);
    }
    res.status(500).json({ error: 'Failed to duplicate session' });
  }
});

export default router;
