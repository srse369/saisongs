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
    await cacheService.createPitch(req.body);
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
