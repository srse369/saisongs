import express from 'express';
import { databaseService } from '../services/DatabaseService.js';
import { cacheService } from '../services/CacheService.js';

const router = express.Router();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// Get all pitch associations
router.get('/', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'pitches:all';
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - fetch from database
    const pitches = await databaseService.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      JOIN songs s ON ssp.song_id = s.id
      JOIN singers si ON ssp.singer_id = si.id
      ORDER BY s.name, si.name
    `);

    // Cache the results
    cacheService.set(cacheKey, pitches, CACHE_TTL);

    res.json(pitches);
  } catch (error) {
    console.error('Error fetching pitches:', error);
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
    res.status(500).json({ error: 'Failed to fetch pitches' });
  }
});

// Get pitch by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pitches = await databaseService.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        s.name as song_name,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      JOIN songs s ON ssp.song_id = s.id
      JOIN singers si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.id) = :1
    `, [id]);
    
    if (pitches.length === 0) {
      return res.status(404).json({ error: 'Pitch association not found' });
    }
    
    res.json(pitches[0]);
  } catch (error) {
    console.error('Error fetching pitch:', error);
    res.status(500).json({ error: 'Failed to fetch pitch' });
  }
});

// Get pitches for a specific song
router.get('/song/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    const pitches = await databaseService.query(`
      SELECT 
        RAWTOHEX(ssp.id) as id,
        RAWTOHEX(ssp.song_id) as song_id,
        RAWTOHEX(ssp.singer_id) as singer_id,
        ssp.pitch,
        si.name as singer_name,
        ssp.created_at,
        ssp.updated_at
      FROM song_singer_pitches ssp
      JOIN singers si ON ssp.singer_id = si.id
      WHERE RAWTOHEX(ssp.song_id) = :1
      ORDER BY si.name
    `, [songId]);
    
    res.json(pitches);
  } catch (error) {
    console.error('Error fetching song pitches:', error);
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
    res.status(500).json({ error: 'Failed to fetch song pitches' });
  }
});

// Create new pitch association
router.post('/', async (req, res) => {
  try {
    const { song_id, singer_id, pitch } = req.body;

    await databaseService.query(`
      INSERT INTO song_singer_pitches (song_id, singer_id, pitch)
      VALUES (HEXTORAW(:1), HEXTORAW(:2), :3)
    `, [song_id, singer_id, pitch]);

    // Invalidate pitches cache
    cacheService.invalidatePattern('pitches:');

    res.status(201).json({ message: 'Pitch association created successfully' });
  } catch (error) {
    console.error('Error creating pitch:', error);
    res.status(500).json({ error: 'Failed to create pitch association' });
  }
});

// Update pitch association
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pitch } = req.body;

    await databaseService.query(`
      UPDATE song_singer_pitches SET
        pitch = :1,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :2
    `, [pitch, id]);

    // Invalidate pitches cache
    cacheService.invalidatePattern('pitches:');

    res.json({ message: 'Pitch association updated successfully' });
  } catch (error) {
    console.error('Error updating pitch:', error);
    res.status(500).json({ error: 'Failed to update pitch association' });
  }
});

// Delete pitch association
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await databaseService.query(`
      DELETE FROM song_singer_pitches WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    // Invalidate pitches cache
    cacheService.invalidatePattern('pitches:');
    
    res.json({ message: 'Pitch association deleted successfully' });
  } catch (error) {
    console.error('Error deleting pitch:', error);
    res.status(500).json({ error: 'Failed to delete pitch association' });
  }
});

export default router;
