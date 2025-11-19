import express from 'express';
import { databaseService } from '../services/DatabaseService.js';

const router = express.Router();

// Get all singers
router.get('/', async (req, res) => {
  try {
    const singers = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        created_at,
        updated_at
      FROM singers
      ORDER BY name
    `);
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
    const singers = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        created_at,
        updated_at
      FROM singers
      WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    if (singers.length === 0) {
      return res.status(404).json({ error: 'Singer not found' });
    }
    
    res.json(singers[0]);
  } catch (error) {
    console.error('Error fetching singer:', error);
    res.status(500).json({ error: 'Failed to fetch singer' });
  }
});

// Create new singer
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    await databaseService.query(`
      INSERT INTO singers (name) VALUES (:1)
    `, [name]);

    res.status(201).json({ message: 'Singer created successfully' });
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

    await databaseService.query(`
      UPDATE singers SET
        name = :1,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :2
    `, [name, id]);

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
    await databaseService.query(`
      DELETE FROM singers WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    res.json({ message: 'Singer deleted successfully' });
  } catch (error) {
    console.error('Error deleting singer:', error);
    res.status(500).json({ error: 'Failed to delete singer' });
  }
});

export default router;
