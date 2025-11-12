import express from 'express';
import { databaseService } from '../services/DatabaseService';

const router = express.Router();

// Get all pitch associations
router.get('/', async (req, res) => {
  try {
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
    res.json(pitches);
  } catch (error) {
    console.error('Error fetching pitches:', error);
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
    const { song_id, singer_id, pitch } = req.body;

    await databaseService.query(`
      UPDATE song_singer_pitches SET
        song_id = HEXTORAW(:1),
        singer_id = HEXTORAW(:2),
        pitch = :3,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :4
    `, [song_id, singer_id, pitch, id]);

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
    
    res.json({ message: 'Pitch association deleted successfully' });
  } catch (error) {
    console.error('Error deleting pitch:', error);
    res.status(500).json({ error: 'Failed to delete pitch association' });
  }
});

export default router;
