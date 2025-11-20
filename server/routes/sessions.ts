import express from 'express';
import { cacheService } from '../services/CacheService.js';

const router = express.Router();

// ============ Named Sessions ============

// Get all sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await cacheService.getAllSessions();
    res.json(sessions);
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

// Get session by ID with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await cacheService.getSession(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create session
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const session = await cacheService.createSession(name, description);
    res.status(201).json(session);
  } catch (error: any) {
    console.error('Error creating session:', error);
    if (error.message && error.message.includes('unique constraint')) {
      return res.status(409).json({ error: 'Session name already exists' });
    }
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (name === undefined && description === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const session = await cacheService.updateSession(id, { name, description });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error: any) {
    console.error('Error updating session:', error);
    if (error.message && error.message.includes('unique constraint')) {
      return res.status(409).json({ error: 'Session name already exists' });
    }
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cacheService.deleteSession(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
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
router.post('/:sessionId/items', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { songId, singerId, pitch, sequenceOrder } = req.body;

    if (!songId || sequenceOrder === undefined) {
      return res.status(400).json({ error: 'songId and sequenceOrder are required' });
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
router.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { singerId, pitch, sequenceOrder } = req.body;

    if (singerId === undefined && pitch === undefined && sequenceOrder === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
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
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cacheService.deleteSessionItem(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session item:', error);
    res.status(500).json({ error: 'Failed to delete session item' });
  }
});

// Reorder session items
router.put('/:sessionId/reorder', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds must be an array' });
    }

    await cacheService.reorderSessionItems(sessionId, itemIds);
    res.status(204).send();
  } catch (error) {
    console.error('Error reordering session items:', error);
    res.status(500).json({ error: 'Failed to reorder session items' });
  }
});

// Set all session items (replace existing)
router.put('/:sessionId/items', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    const resultItems = await cacheService.setSessionItems(sessionId, items);
    res.json(resultItems);
  } catch (error) {
    console.error('Error setting session items:', error);
    res.status(500).json({ error: 'Failed to set session items' });
  }
});

// Duplicate session
router.post('/:id/duplicate', async (req, res) => {
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
    if (error.message && error.message.includes('unique constraint')) {
      return res.status(409).json({ error: 'Session name already exists' });
    }
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.status(500).json({ error: 'Failed to duplicate session' });
  }
});

export default router;
