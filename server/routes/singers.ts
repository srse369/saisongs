import express from 'express';
import { cacheService } from '../services/CacheService.js';
import { databaseService } from '../services/DatabaseService.js';
import { requireEditor, requireAuth, requireAdmin } from '../middleware/simpleAuth.js';

const router = express.Router();

// Get all singers - all authenticated users can view, but filtered by center access
router.get('/', requireAuth, async (req, res) => {
  try {
    const allSingers = await cacheService.getAllSingers();
    
    // Filter singers by center access
    const user = req.user;
    let singers = allSingers;
    
    // Admins see all singers
    if (user?.role !== 'admin') {
      // For editors and viewers, combine their accessible centers
      const centerIds = user?.centerIds || [];
      const editorFor = user?.editorFor || [];
      const accessibleCenters = [...new Set([...centerIds, ...editorFor])];
      
      // Filter singers to only those in accessible centers or untagged singers
      singers = allSingers.filter(singer => {
        // Singers without center_ids are visible to everyone
        if (!singer.center_ids || singer.center_ids.length === 0) {
          return true;
        }
        // Check if singer belongs to any accessible center
        return singer.center_ids.some((cid: number) => accessibleCenters.includes(cid));
      });
    }
    
    // For viewers, strip sensitive information (email)
    if (user?.role === 'viewer') {
      const sanitizedSingers = singers.map(singer => {
        const { email, ...rest } = singer;
        return rest;
      });
      return res.json(sanitizedSingers);
    }
    
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

// Get singer by ID - requires editor or admin role (viewers cannot view details)
router.get('/:id', requireEditor, async (req, res) => {
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

// Create new singer - requires editor or admin role
router.post('/', requireEditor, async (req, res) => {
  try {
    const { name, gender, email, center_ids } = req.body;
    const user = req.user;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Singer name is required' });
    }
    
    // Validate gender if provided
    if (gender && !['Male', 'Female', 'Boy', 'Girl', 'Other'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be one of: Male, Female, Boy, Girl, Other' });
    }
    
    // Validate that at least one center is selected
    if (!center_ids || center_ids.length === 0) {
      return res.status(400).json({ error: 'At least one center must be selected' });
    }
    
    // For editors, validate they can only assign singers to centers they have editor access to
    if (user?.role === 'editor' && center_ids && center_ids.length > 0) {
      // Use the user's editorFor array directly from session
      const editableCenterIds = user.editorFor || [];
      
      // Check if all requested center_ids are in the editable list
      const invalidCenters = center_ids.filter((cid: number) => !editableCenterIds.includes(cid));
      if (invalidCenters.length > 0) {
        console.log('Access denied (create):', {
          userId: user.id,
          requestedCenters: center_ids,
          editableCenters: editableCenterIds,
          invalidCenters
        });
        return res.status(403).json({ 
          error: 'You can only assign singers to centers where you have editor access' 
        });
      }
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
        gender: duplicate.gender || duplicate.GENDER,
        created_at: duplicate.created_at || duplicate.CREATED_AT,
        updated_at: duplicate.updated_at || duplicate.UPDATED_AT,
      };
      
      console.log(`⚠️  Singer "${name}" already exists with ID: ${normalizedDuplicate.id}`);
      // Return the existing singer instead of creating a duplicate
      return res.status(200).json(normalizedDuplicate);
    }
    
    const newSinger = await cacheService.createSinger(name, gender, email, center_ids, user.email);
    res.status(201).json(newSinger);
  } catch (error) {
    console.error('Error creating singer:', error);
    res.status(500).json({ error: 'Failed to create singer' });
  }
});

// Update singer - requires editor or admin role
router.put('/:id', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gender, email, center_ids } = req.body;
    const user = req.user;
    
    // Validate that at least one center is selected
    if (center_ids !== undefined && (!center_ids || center_ids.length === 0)) {
      return res.status(400).json({ error: 'At least one center must be selected' });
    }
    
    // Validate gender if provided
    if (gender && !['Male', 'Female', 'Boy', 'Girl', 'Other'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be one of: Male, Female, Boy, Girl, Other' });
    }
    
    // For editors, validate they can only ADD singers to centers they have editor access to
    if (user?.role === 'editor' && center_ids && center_ids.length > 0) {
      // Get the singer's current center_ids
      const singer = await cacheService.getSinger(id);
      const currentCenterIds = singer?.center_ids || [];
      
      // Find centers being ADDED (not already assigned)
      const newCenterIds = center_ids.filter((cid: number) => !currentCenterIds.includes(cid));
      
      if (newCenterIds.length > 0) {
        // Use the user's editorFor array directly from session
        const editableCenterIds = user.editorFor || [];
        
        // Check if all NEW center_ids are in the editable list
        const invalidCenters = newCenterIds.filter((cid: number) => !editableCenterIds.includes(cid));
        if (invalidCenters.length > 0) {
          console.log('Access denied:', {
            userId: user.id,
            currentCenters: currentCenterIds,
            requestedCenters: center_ids,
            newCenters: newCenterIds,
            editableCenters: editableCenterIds,
            invalidCenters
          });
          return res.status(403).json({ 
            error: 'You can only add singers to centers where you have editor access' 
          });
        }
      }
    }
    
    await cacheService.updateSinger(id, name, gender, email, center_ids, user.email);
    res.json({ message: 'Singer updated successfully' });
  } catch (error) {
    console.error('Error updating singer:', error);
    res.status(500).json({ error: 'Failed to update singer' });
  }
});

// Delete singer - requires editor or admin role
router.delete('/:id', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    // Get the singer to check center assignment
    const singer = await cacheService.getSinger(id);
    if (!singer) {
      return res.status(404).json({ 
        error: 'Singer not found',
        message: 'The singer you are trying to delete does not exist'
      });
    }
    
    // Check if singer has any pitch associations (applies to ALL users including admins)
    const pitchQuery = 'SELECT COUNT(*) as count FROM song_singer_pitches WHERE singer_id = HEXTORAW(:1)';
    const pitchResult = await databaseService.query(pitchQuery, [id]);
    const pitchCount = pitchResult[0]?.COUNT || 0;
    
    if (pitchCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete singer',
        message: `This singer has ${pitchCount} pitch(es) and cannot be deleted. Please remove all pitch associations first.`
      });
    }
    
    // For editors (non-admins), validate they can only delete singers from their centers
    if (user?.role === 'editor') {
      const singerCenterIds = singer.center_ids || [];
      const editableCenterIds = user.editorFor || [];
      
      // Check if singer belongs to at least one center the editor manages
      const hasAccess = singerCenterIds.some((centerId: number) => editableCenterIds.includes(centerId));
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only delete singers from centers you manage'
        });
      }
    }
    
    await cacheService.deleteSinger(id);
    res.json({ message: 'Singer deleted successfully' });
  } catch (error) {
    console.error('Error deleting singer:', error);
    res.status(500).json({ error: 'Failed to delete singer' });
  }
});

// Update admin status - requires admin role only
router.patch('/:id/admin', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_admin } = req.body;
    
    // Validate is_admin value
    if (is_admin !== 0 && is_admin !== 1 && is_admin !== true && is_admin !== false) {
      return res.status(400).json({ error: 'is_admin must be 0 or 1 (or true/false)' });
    }
    
    // Convert boolean to number if needed
    const adminValue = (is_admin === true || is_admin === 1) ? 1 : 0;
    
    // Update admin status
    await cacheService.updateSingerAdminStatus(id, adminValue);
    res.json({ 
      message: 'Admin status updated successfully',
      is_admin: adminValue 
    });
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// Update user editor_for (admin only)
router.patch('/:id/editor-for', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { editor_for } = req.body;
    
    // Validate editor_for is an array
    if (!Array.isArray(editor_for)) {
      return res.status(400).json({ error: 'editor_for must be an array of center IDs' });
    }
    
    // Validate all elements are numbers
    for (const centerId of editor_for) {
      if (typeof centerId !== 'number') {
        return res.status(400).json({ 
          error: `Invalid center ID "${centerId}". All elements must be numbers` 
        });
      }
    }
    
    // Update editor_for
    await cacheService.updateUserEditorFor(id, editor_for);
    res.json({ 
      message: 'Editor centers updated successfully',
      editor_for 
    });
  } catch (error) {
    console.error('Error updating editor_for:', error);
    res.status(500).json({ error: 'Failed to update editor_for' });
  }
});

export default router;
