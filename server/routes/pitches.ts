import express from 'express';
import { cacheService } from '../services/CacheService.js';

const router = express.Router();

// Get all pitch associations
router.get('/', async (req, res) => {
  try {
    const pitches = await cacheService.getAllPitches();
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
    const pitch = await cacheService.getPitch(id);
    
    if (!pitch) {
      return res.status(404).json({ error: 'Pitch association not found' });
    }
    
    res.json(pitch);
  } catch (error) {
    console.error('Error fetching pitch:', error);
    res.status(500).json({ error: 'Failed to fetch pitch' });
  }
});

// Get pitches for a specific song
router.get('/song/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    const pitches = await cacheService.getSongPitches(songId);
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
    // Accept both snake_case (from frontend) and camelCase (for compatibility)
    const songId = req.body.song_id || req.body.songId;
    const singerId = req.body.singer_id || req.body.singerId;
    const pitch = req.body.pitch;
    
    if (!songId || !singerId || !pitch) {
      return res.status(400).json({ 
        error: 'Missing required fields: song_id, singer_id, pitch',
        received: req.body 
      });
    }
    
    // Check for duplicate pitch (same song + singer combination)
    const allPitches = await cacheService.getAllPitches();
    const existing = allPitches.find(p => p.song_id === songId && p.singer_id === singerId);
    
    if (existing) {
      // Normalize both for comparison (trim whitespace, case-insensitive)
      const existingPitchNormalized = String(existing.pitch).trim();
      const newPitchNormalized = String(pitch).trim();
      
      // If pitch is the same, return existing (idempotent)
      if (existingPitchNormalized === newPitchNormalized) {
        return res.status(200).json({ 
          message: 'Pitch association already exists',
          pitch: existing,
          created: false,
          updated: false
        });
      }
      
      // If pitch is different, update it
      await cacheService.updatePitch(existing.id, pitch);
      return res.status(200).json({ 
        message: 'Pitch association updated',
        created: false,
        updated: true
      });
    }
    
    // Create new pitch association
    await cacheService.createPitch({
      song_id: songId,
      singer_id: singerId,
      pitch: pitch
    });
    res.status(201).json({ 
      message: 'Pitch association created successfully',
      created: true,
      updated: false
    });
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
    await cacheService.updatePitch(id, pitch);
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
    await cacheService.deletePitch(id);
    res.json({ message: 'Pitch association deleted successfully' });
  } catch (error) {
    console.error('Error deleting pitch:', error);
    res.status(500).json({ error: 'Failed to delete pitch association' });
  }
});

export default router;
