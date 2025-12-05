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

    // Check permissions: user must have editor access to the singer's centers
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the singer to check their center associations
    const singer = await cacheService.getSinger(singerId);
    if (!singer) {
      return res.status(404).json({ error: 'Singer not found' });
    }

    const singerCenterIds = singer.center_ids || [];
    
    // For editors, check if they have access to any of the singer's centers
    if (user.role === 'editor') {
      const editableCenterIds = user.editorFor || [];
      const hasAccess = singerCenterIds.some(cid => editableCenterIds.includes(cid));
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'You can only create pitches for singers from centers you manage' 
        });
      }
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
        // Return the existing pitch object for frontend to use
        return res.status(200).json(existing);
      }
      
      // If pitch is different, update it and return the updated pitch
      await cacheService.updatePitch(existing.id, pitch, user.email);
      // Fetch the updated pitch to return
      const updatedPitch = await cacheService.getPitch(existing.id);
      return res.status(200).json(updatedPitch);
    }
    
    // Create new pitch association
    const createdPitch = await cacheService.createPitch({
      song_id: songId,
      singer_id: singerId,
      pitch: pitch,
      created_by: user.email
    });
    res.status(201).json(createdPitch);
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

    // Check permissions: user must have editor access to the singer's centers
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the pitch to find the associated singer
    const existingPitch = await cacheService.getPitch(id);
    if (!existingPitch) {
      return res.status(404).json({ error: 'Pitch association not found' });
    }

    // Get the singer to check their center associations
    const singer = await cacheService.getSinger(existingPitch.singer_id);
    
    // Handle orphaned pitch (singer was deleted but pitch still exists)
    if (!singer) {
      console.warn(`⚠️  Orphaned pitch detected: ${id} (singer ${existingPitch.singer_id} not found). Denying update.`);
      return res.status(400).json({ 
        error: 'Cannot update orphaned pitch',
        message: 'This pitch references a singer that no longer exists. Please delete this pitch instead of updating it.'
      });
    }

    const singerCenterIds = singer.center_ids || [];
    
    // For editors, check if they have access to any of the singer's centers
    if (user.role === 'editor') {
      const editableCenterIds = user.editorFor || [];
      const hasAccess = singerCenterIds.some(cid => editableCenterIds.includes(cid));
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied: You do not have editor access to this singer\'s centers' 
        });
      }
    }

    await cacheService.updatePitch(id, pitch, user.email);
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

    // Check permissions: user must have editor access to the singer's centers
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the pitch to find the associated singer
    const existingPitch = await cacheService.getPitch(id);
    if (!existingPitch) {
      return res.status(404).json({ error: 'Pitch association not found' });
    }

    // Get the singer to check their center associations
    const singer = await cacheService.getSinger(existingPitch.singer_id);
    
    // Handle orphaned pitch (singer was deleted but pitch still exists due to CASCADE delay or cache issues)
    if (!singer) {
      console.warn(`⚠️  Orphaned pitch detected: ${id} (singer ${existingPitch.singer_id} not found). Allowing deletion.`);
      // Admins can delete orphaned pitches
      if (user.role === 'admin') {
        await cacheService.deletePitch(id);
        return res.json({ message: 'Orphaned pitch association deleted successfully' });
      }
      // Editors can delete orphaned pitches if they would have had access to the singer
      // Since we can't verify, we'll allow it for data cleanup purposes
      if (user.role === 'editor') {
        await cacheService.deletePitch(id);
        return res.json({ message: 'Orphaned pitch association deleted successfully' });
      }
      return res.status(403).json({ 
        error: 'Cannot delete orphaned pitch. Contact an admin for assistance.' 
      });
    }

    const singerCenterIds = singer.center_ids || [];
    
    // For editors, check if they have access to any of the singer's centers
    if (user.role === 'editor') {
      const editableCenterIds = user.editorFor || [];
      const hasAccess = singerCenterIds.some(cid => editableCenterIds.includes(cid));
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'You can only delete pitches for singers from centers you manage' 
        });
      }
    }

    await cacheService.deletePitch(id);
    res.json({ message: 'Pitch association deleted successfully' });
  } catch (error) {
    console.error('Error deleting pitch:', error);
    res.status(500).json({ error: 'Failed to delete pitch association' });
  }
});

export default router;
