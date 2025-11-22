import express from 'express';
import { cacheService } from '../services/CacheService.js';

const router = express.Router();

// Get all singers
router.get('/', async (req, res) => {
  try {
    const singers = await cacheService.getAllSingers();
    res.json(singers);
  } catch (error) {
    console.error('Error fetching singers:', error);
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
    res.status(500).json({ error: 'Failed to fetch singers' });
  }
});

// Get singer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const singer = await cacheService.getSinger(id);
    
    if (!singer) {
      return res.status(404).json({ error: 'Singer not found' });
    }
    
    res.json(singer);
  } catch (error) {
    console.error('Error fetching singer:', error);
    res.status(500).json({ error: 'Failed to fetch singer' });
  }
});

// Create new singer
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Singer name is required' });
    }
    
    // Check for duplicate singer (case-insensitive)
    const allSingers = await cacheService.getAllSingers();
    
    // Log any singers with null/undefined names
    const invalidSingers = allSingers.filter(s => !s.name);
    if (invalidSingers.length > 0) {
      console.warn(`⚠️  Found ${invalidSingers.length} singer(s) with null/undefined names:`, invalidSingers);
    }
    
    const duplicate = allSingers.find(
      s => s.name && s.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    
    if (duplicate) {
      // Normalize field names (Oracle might return uppercase or lowercase)
      const normalizedDuplicate = {
        id: duplicate.id || duplicate.ID,
        name: duplicate.name || duplicate.NAME,
        created_at: duplicate.created_at || duplicate.CREATED_AT,
        updated_at: duplicate.updated_at || duplicate.UPDATED_AT,
      };
      
      console.log(`⚠️  Singer "${name}" already exists with ID: ${normalizedDuplicate.id}`);
      // Return the existing singer instead of creating a duplicate
      return res.status(200).json(normalizedDuplicate);
    }
    
    const newSinger = await cacheService.createSinger(name);
    res.status(201).json(newSinger);
  } catch (error) {
    console.error('Error creating singer:', error);
    res.status(500).json({ error: 'Failed to create singer' });
  }
});

// Update singer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    await cacheService.updateSinger(id, name);
    res.json({ message: 'Singer updated successfully' });
  } catch (error) {
    console.error('Error updating singer:', error);
    res.status(500).json({ error: 'Failed to update singer' });
  }
});

// Delete singer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cacheService.deleteSinger(id);
    res.json({ message: 'Singer deleted successfully' });
  } catch (error) {
    console.error('Error deleting singer:', error);
    res.status(500).json({ error: 'Failed to delete singer' });
  }
});

export default router;
