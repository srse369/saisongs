import express from 'express';
import { databaseService } from '../services/DatabaseService.js';
import { cacheService } from '../services/CacheService.js';

const router = express.Router();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// ============ Named Sessions ============

// Get all sessions
router.get('/', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'sessions:all';
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - fetch from database
    const sessions = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM named_sessions 
      ORDER BY name
    `);

    const mappedSessions = sessions.map((row: any) => ({
      id: row.ID,
      name: row.NAME,
      description: row.DESCRIPTION,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));

    // Cache the results
    cacheService.set(cacheKey, mappedSessions, CACHE_TTL);

    res.json(mappedSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session by ID with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get session
    const sessions = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionRow = sessions[0];

    // Get session items with details
    const items = await databaseService.query(`
      SELECT 
        RAWTOHEX(si.id) as id,
        RAWTOHEX(si.session_id) as session_id,
        RAWTOHEX(si.song_id) as song_id,
        RAWTOHEX(si.singer_id) as singer_id,
        si.pitch,
        si.sequence_order,
        si.created_at,
        si.updated_at,
        s.name as song_name,
        sg.name as singer_name
      FROM session_items si
      JOIN songs s ON si.song_id = s.id
      LEFT JOIN singers sg ON si.singer_id = sg.id
      WHERE RAWTOHEX(si.session_id) = :1
      ORDER BY si.sequence_order
    `, [id]);

    const mappedItems = items.map((row: any) => ({
      id: row.ID,
      sessionId: row.SESSION_ID,
      songId: row.SONG_ID,
      singerId: row.SINGER_ID || undefined,
      pitch: row.PITCH,
      sequenceOrder: row.SEQUENCE_ORDER,
      songName: row.SONG_NAME,
      singerName: row.SINGER_NAME,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));

    const session = {
      id: sessionRow.ID,
      name: sessionRow.NAME,
      description: sessionRow.DESCRIPTION,
      createdAt: sessionRow.CREATED_AT,
      updatedAt: sessionRow.UPDATED_AT,
      items: mappedItems,
    };

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

    await databaseService.query(`
      INSERT INTO named_sessions (name, description)
      VALUES (:1, :2)
    `, [String(name), String(description || '')]);

    // Fetch the created session
    const sessions = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM named_sessions 
      WHERE name = :1
    `, [name]);

    if (sessions.length === 0) {
      return res.status(500).json({ error: 'Failed to retrieve created session' });
    }

    const session = sessions[0];

    // Invalidate sessions cache
    cacheService.invalidatePattern('sessions:');

    res.status(201).json({
      id: session.ID,
      name: session.NAME,
      description: session.DESCRIPTION,
      createdAt: session.CREATED_AT,
      updatedAt: session.UPDATED_AT,
    });
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

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = :${paramIndex++}`);
      params.push(String(name));
    }
    if (description !== undefined) {
      updates.push(`description = :${paramIndex++}`);
      params.push(String(description || ''));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await databaseService.query(`
      UPDATE named_sessions 
      SET ${updates.join(', ')} 
      WHERE RAWTOHEX(id) = :${paramIndex}
    `, params);

    // Fetch updated session
    const sessions = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[0];
    res.json({
      id: session.ID,
      name: session.NAME,
      description: session.DESCRIPTION,
      createdAt: session.CREATED_AT,
      updatedAt: session.UPDATED_AT,
    });
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

    await databaseService.query(`
      DELETE FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

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

    const items = await databaseService.query(`
      SELECT 
        RAWTOHEX(si.id) as id,
        RAWTOHEX(si.session_id) as session_id,
        RAWTOHEX(si.song_id) as song_id,
        RAWTOHEX(si.singer_id) as singer_id,
        si.pitch,
        si.sequence_order,
        si.created_at,
        si.updated_at,
        s.name as song_name,
        sg.name as singer_name
      FROM session_items si
      JOIN songs s ON si.song_id = s.id
      LEFT JOIN singers sg ON si.singer_id = sg.id
      WHERE RAWTOHEX(si.session_id) = :1
      ORDER BY si.sequence_order
    `, [sessionId]);

    const mappedItems = items.map((row: any) => ({
      id: row.ID,
      sessionId: row.SESSION_ID,
      songId: row.SONG_ID,
      singerId: row.SINGER_ID || undefined,
      pitch: row.PITCH,
      sequenceOrder: row.SEQUENCE_ORDER,
      songName: row.SONG_NAME,
      singerName: row.SINGER_NAME,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));

    res.json(mappedItems);
  } catch (error) {
    console.error('Error fetching session items:', error);
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

    // Convert hex IDs to RAW for insertion
    await databaseService.query(`
      INSERT INTO session_items (session_id, song_id, singer_id, pitch, sequence_order)
      VALUES (
        HEXTORAW(:1),
        HEXTORAW(:2),
        ${singerId ? 'HEXTORAW(:3)' : 'NULL'},
        :${singerId ? '4' : '3'},
        :${singerId ? '5' : '4'}
      )
    `, singerId 
      ? [sessionId, songId, singerId, String(pitch || ''), sequenceOrder]
      : [sessionId, songId, String(pitch || ''), sequenceOrder]
    );

    // Invalidate sessions cache
    cacheService.invalidatePattern('sessions:');

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

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (singerId !== undefined) {
      if (singerId) {
        updates.push(`singer_id = HEXTORAW(:${paramIndex++})`);
        params.push(singerId);
      } else {
        updates.push('singer_id = NULL');
      }
    }
    if (pitch !== undefined) {
      updates.push(`pitch = :${paramIndex++}`);
      params.push(String(pitch || ''));
    }
    if (sequenceOrder !== undefined) {
      updates.push(`sequence_order = :${paramIndex++}`);
      params.push(sequenceOrder);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await databaseService.query(`
      UPDATE session_items 
      SET ${updates.join(', ')} 
      WHERE RAWTOHEX(id) = :${paramIndex}
    `, params);

    // Invalidate sessions cache
    cacheService.invalidatePattern('sessions:');

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

    await databaseService.query(`
      DELETE FROM session_items 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    // Invalidate sessions cache
    cacheService.invalidatePattern('sessions:');

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

    // Update each item's sequence order
    for (let i = 0; i < itemIds.length; i++) {
      await databaseService.query(`
        UPDATE session_items 
        SET sequence_order = :1, updated_at = CURRENT_TIMESTAMP 
        WHERE RAWTOHEX(id) = :2 AND RAWTOHEX(session_id) = :3
      `, [i + 1, itemIds[i], sessionId]);
    }

    // Invalidate sessions cache
    cacheService.invalidatePattern('sessions:');

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

    // Delete existing items
    await databaseService.query(`
      DELETE FROM session_items 
      WHERE RAWTOHEX(session_id) = :1
    `, [sessionId]);

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const { songId, singerId, pitch } = items[i];
      
      await databaseService.query(`
        INSERT INTO session_items (session_id, song_id, singer_id, pitch, sequence_order)
        VALUES (
          HEXTORAW(:1),
          HEXTORAW(:2),
          ${singerId ? 'HEXTORAW(:3)' : 'NULL'},
          :${singerId ? '4' : '3'},
          :${singerId ? '5' : '4'}
        )
      `, singerId 
        ? [sessionId, songId, singerId, String(pitch || ''), i + 1]
        : [sessionId, songId, String(pitch || ''), i + 1]
      );
    }

    // Fetch all items with details
    const resultItems = await databaseService.query(`
      SELECT 
        RAWTOHEX(si.id) as id,
        RAWTOHEX(si.session_id) as session_id,
        RAWTOHEX(si.song_id) as song_id,
        RAWTOHEX(si.singer_id) as singer_id,
        si.pitch,
        si.sequence_order,
        si.created_at,
        si.updated_at,
        s.name as song_name,
        sg.name as singer_name
      FROM session_items si
      JOIN songs s ON si.song_id = s.id
      LEFT JOIN singers sg ON si.singer_id = sg.id
      WHERE RAWTOHEX(si.session_id) = :1
      ORDER BY si.sequence_order
    `, [sessionId]);

    const mappedItems = resultItems.map((row: any) => ({
      id: row.ID,
      sessionId: row.SESSION_ID,
      songId: row.SONG_ID,
      singerId: row.SINGER_ID || undefined,
      pitch: row.PITCH,
      sequenceOrder: row.SEQUENCE_ORDER,
      songName: row.SONG_NAME,
      singerName: row.SINGER_NAME,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT,
    }));

    res.json(mappedItems);
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

    // Get original session
    const sessions = await databaseService.query(`
      SELECT name, description 
      FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [id]);

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const originalSession = sessions[0];

    // Create new session
    await databaseService.query(`
      INSERT INTO named_sessions (name, description)
      VALUES (:1, :2)
    `, [String(newName), String(originalSession.DESCRIPTION || '')]);

    // Get the new session ID
    const newSessions = await databaseService.query(`
      SELECT RAWTOHEX(id) as id 
      FROM named_sessions 
      WHERE name = :1
    `, [newName]);

    if (newSessions.length === 0) {
      return res.status(500).json({ error: 'Failed to retrieve duplicated session' });
    }

    const newSessionId = newSessions[0].ID;

    // Copy items
    await databaseService.query(`
      INSERT INTO session_items (session_id, song_id, singer_id, pitch, sequence_order)
      SELECT HEXTORAW(:1), song_id, singer_id, pitch, sequence_order
      FROM session_items
      WHERE RAWTOHEX(session_id) = :2
    `, [newSessionId, id]);

    // Fetch new session with full details
    const result = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        description,
        created_at,
        updated_at
      FROM named_sessions 
      WHERE RAWTOHEX(id) = :1
    `, [newSessionId]);

    const session = result[0];
    res.status(201).json({
      id: session.ID,
      name: session.NAME,
      description: session.DESCRIPTION,
      createdAt: session.CREATED_AT,
      updatedAt: session.UPDATED_AT,
    });
  } catch (error: any) {
    console.error('Error duplicating session:', error);
    if (error.message && error.message.includes('unique constraint')) {
      return res.status(409).json({ error: 'Session name already exists' });
    }
    res.status(500).json({ error: 'Failed to duplicate session' });
  }
});

export default router;
