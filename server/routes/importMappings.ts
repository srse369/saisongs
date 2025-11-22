import express from 'express';
import cacheService from '../services/CacheService.js';

const router = express.Router();

// Get all song mappings
router.get('/songs', async (req, res) => {
  try {
    const mappings = await cacheService.getAllSongMappings();
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching song mappings:', error);
    res.status(500).json({ error: 'Failed to fetch song mappings' });
  }
});

// Get a specific song mapping by CSV name
router.get('/songs/:csvName', async (req, res) => {
  try {
    const { csvName } = req.params;
    const mapping = await cacheService.getSongMappingByName(csvName);
    
    if (mapping) {
      res.json(mapping);
    } else {
      res.status(404).json({ error: 'Mapping not found' });
    }
  } catch (error) {
    console.error('Error fetching song mapping:', error);
    res.status(500).json({ error: 'Failed to fetch song mapping' });
  }
});

// Create or update a song mapping
router.post('/songs', async (req, res) => {
  try {
    const { csv_song_name, db_song_id, db_song_name } = req.body;
    
    if (!csv_song_name || !db_song_id || !db_song_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await cacheService.saveSongMapping(csv_song_name, db_song_id, db_song_name);
    res.status(201).json({ message: 'Song mapping saved successfully' });
  } catch (error) {
    console.error('Error saving song mapping:', error);
    res.status(500).json({ error: 'Failed to save song mapping' });
  }
});

// Delete a song mapping
router.delete('/songs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cacheService.deleteSongMapping(id);
    res.json({ message: 'Song mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting song mapping:', error);
    res.status(500).json({ error: 'Failed to delete song mapping' });
  }
});

// Get all pitch mappings
router.get('/pitches', async (req, res) => {
  try {
    const mappings = await cacheService.getAllPitchMappings();
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching pitch mappings:', error);
    res.status(500).json({ error: 'Failed to fetch pitch mappings' });
  }
});

// Get a specific pitch mapping by original format
router.get('/pitches/:originalFormat', async (req, res) => {
  try {
    const { originalFormat } = req.params;
    const mapping = await cacheService.getPitchMappingByFormat(originalFormat);
    
    if (mapping) {
      res.json(mapping);
    } else {
      res.status(404).json({ error: 'Mapping not found' });
    }
  } catch (error) {
    console.error('Error fetching pitch mapping:', error);
    res.status(500).json({ error: 'Failed to fetch pitch mapping' });
  }
});

// Create or update a pitch mapping
router.post('/pitches', async (req, res) => {
  try {
    const { original_format, normalized_format } = req.body;
    
    if (!original_format || !normalized_format) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await cacheService.savePitchMapping(original_format, normalized_format);
    res.status(201).json({ message: 'Pitch mapping saved successfully' });
  } catch (error) {
    console.error('Error saving pitch mapping:', error);
    res.status(500).json({ error: 'Failed to save pitch mapping' });
  }
});

// Delete a pitch mapping
router.delete('/pitches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cacheService.deletePitchMapping(id);
    res.json({ message: 'Pitch mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting pitch mapping:', error);
    res.status(500).json({ error: 'Failed to delete pitch mapping' });
  }
});

export default router;

