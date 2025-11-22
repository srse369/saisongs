import express from 'express';
import { cacheService } from '../services/CacheService.js';

const router = express.Router();

// Get all songs
router.get('/', async (req, res) => {
  try {
    const songs = await cacheService.getAllSongs();
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs:', error);
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
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Get song by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const song = await cacheService.getSong(id);
    
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    res.json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Create new song
router.post('/', async (req, res) => {
  try {
    // Debug: Log what we received
    console.log('📝 Creating song with data:', {
      name: req.body.name,
      external_source_url: req.body.external_source_url?.substring(0, 50),
      has_lyrics: !!req.body.lyrics,
      lyrics_length: req.body.lyrics?.length || 0,
      has_meaning: !!req.body.meaning,
      meaning_length: req.body.meaning?.length || 0
    });

    await cacheService.createSong(req.body);
    res.status(201).json({ message: 'Song created successfully' });
  } catch (error) {
    console.error('Error creating song:', error);
    res.status(500).json({ error: 'Failed to create song' });
  }
});

// Update song
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cacheService.updateSong(id, req.body);
    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// Delete song
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cacheService.deleteSong(id);
    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

export default router;
