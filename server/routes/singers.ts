/// <reference types="../types/express" />
import express from 'express';
import { cacheService } from '../services/CacheService.js';
import { databaseReadService } from '../services/DatabaseReadService.js';
import { databaseWriteService } from '../services/DatabaseWriteService.js';
import { requireEditor, requireAuth, requireAdmin } from '../middleware/simpleAuth.js';

const router = express.Router();

// Get all singers - all authenticated users can view, but filtered by center access
router.get('/', requireAuth, async (req, res) => {
  try {
    // Force cache invalidation if requested
    if (req.query.nocache === 'true') {
      cacheService.invalidate('singers:all');
    }

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
        // Singers without centerIds are visible to everyone
        if (!singer.centerIds || singer.centerIds.length === 0) {
          return true;
        }
        // Check if singer belongs to any accessible center
        return singer.centerIds.some((cid: number) => accessibleCenters.includes(cid));
      });
    }

    // For viewers, strip sensitive information (email) except for their own record
    if (user?.role === 'viewer') {
      const sanitizedSingers = singers.map(singer => {
        // Allow viewers to see their own email
        if (singer.id === user.id) {
          return singer;
        }
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

// Get singer by ID - requires editor/admin role OR viewing own record
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Check if user is viewing their own record
    const isOwnRecord = user?.id === id;

    // Viewers can only view their own record
    if (user?.role === 'viewer' && !isOwnRecord) {
      return res.status(403).json({
        error: 'This action requires editor or administrator privileges',
        message: 'You can only view your own singer profile'
      });
    }

    // Editors and admins can view any record
    if (!isOwnRecord && user?.role !== 'editor' && user?.role !== 'admin') {
      return res.status(403).json({
        error: 'This action requires editor or administrator privileges'
      });
    }

    const singer = await cacheService.getSinger(id);

    if (!singer) {
      return res.status(404).json({ error: 'Singer not found' });
    }

    // Prevent browser caching to ensure fresh data after updates
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(singer);
  } catch (error) {
    console.error('Error fetching singer:', error);
    res.status(500).json({ error: 'Failed to fetch singer' });
  }
});

// Create new singer - requires editor or admin role
router.post('/', requireEditor, async (req, res) => {
  try {
    const { name, gender, email } = req.body;
    const centerIds = req.body.centerIds ?? req.body.center_ids;
    const user = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Singer name is required' });
    }

    // Validate gender if provided
    if (gender && !['Male', 'Female', 'Boy', 'Girl', 'Other'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be one of: Male, Female, Boy, Girl, Other' });
    }

    // Validate that at least one center is selected
    if (!centerIds || centerIds.length === 0) {
      return res.status(400).json({ error: 'At least one center must be selected' });
    }

    // For editors, validate they can only assign singers to centers they have editor access to
    if (user?.role === 'editor' && centerIds && centerIds.length > 0) {
      // Use the user's editorFor array directly from session
      const editableCenterIds = user.editorFor || [];

      // Check if all requested centerIds are in the editable list
      const invalidCenters = centerIds.filter((cid: number) => !editableCenterIds.includes(cid));
      if (invalidCenters.length > 0) {
        console.log('Access denied (create):', {
          userId: user.id,
          requestedCenters: centerIds,
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
      // Return 409 Conflict with error message including the existing singer ID
      return res.status(409).json({
        error: `Singer "${name}" already exists`,
        existingSingerId: normalizedDuplicate.id
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const newSinger = await cacheService.createSinger({ name, gender, email, centerIds, createdBy: user.email });
    res.status(201).json(newSinger);
  } catch (error) {
    console.error('Error creating singer:', error);
    res.status(500).json({ error: 'Failed to create singer' });
  }
});

// Update singer - requires editor/admin role OR updating own record
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gender, email } = req.body;
    const centerIds = req.body.centerIds ?? req.body.center_ids;
    const user = req.user;

    // Check if user is updating their own record
    const isOwnRecord = user?.id === id;

    // Viewers can only update their own record
    if (user?.role === 'viewer' && !isOwnRecord) {
      return res.status(403).json({
        error: 'This action requires editor or administrator privileges',
        message: 'You can only edit your own singer profile'
      });
    }

    // Editors and admins can update any record
    if (!isOwnRecord && user?.role !== 'editor' && user?.role !== 'admin') {
      return res.status(403).json({
        error: 'This action requires editor or administrator privileges'
      });
    }

    // Validate that at least one center is selected
    if (centerIds !== undefined && (!centerIds || centerIds.length === 0)) {
      return res.status(400).json({ error: 'At least one center must be selected' });
    }

    // Validate gender if provided
    if (gender && !['Male', 'Female', 'Boy', 'Girl', 'Other'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be one of: Male, Female, Boy, Girl, Other' });
    }

    // For editors, validate they can only ADD singers to centers they have editor access to
    if (user?.role === 'editor' && centerIds && centerIds.length > 0) {
      // Get the singer's current centerIds
      const singer = await cacheService.getSinger(id);
      const currentCenterIds = singer?.centerIds || [];

      // Find centers being ADDED (not already assigned)
      const newCenterIds = centerIds.filter((cid: number) => !currentCenterIds.includes(cid));

      if (newCenterIds.length > 0) {
        // Use the user's editorFor array directly from session
        const editableCenterIds = user.editorFor || [];

        // Check if all NEW centerIds are in the editable list
        const invalidCenters = newCenterIds.filter((cid: number) => !editableCenterIds.includes(cid));
        if (invalidCenters.length > 0) {
          console.log('Access denied:', {
            userId: user.id,
            currentCenters: currentCenterIds,
            requestedCenters: centerIds,
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

    await cacheService.updateSinger(id, { name, gender, email, centerIds, updatedBy: user.email });

    // Also invalidate the singers:all cache to ensure list views get fresh data
    cacheService.invalidate('singers:all');

    res.json({ message: 'Singer updated successfully' });
  } catch (error) {
    console.error('Error updating singer:', error);
    res.status(500).json({ error: 'Failed to update singer' });
  }
});

// Delete singer - requires editor/admin role OR deleting own record
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Check if user is deleting their own record
    const isOwnRecord = user?.id === id;

    // Viewers can only delete their own record
    if (user?.role === 'viewer' && !isOwnRecord) {
      return res.status(403).json({
        error: 'This action requires editor or administrator privileges',
        message: 'You can only delete your own singer profile'
      });
    }

    // Editors and admins can delete any record (with center restrictions for editors)
    if (!isOwnRecord && user?.role !== 'editor' && user?.role !== 'admin') {
      return res.status(403).json({
        error: 'This action requires editor or administrator privileges'
      });
    }

    // Get the singer to check center assignment
    const singer = await cacheService.getSinger(id);
    if (!singer) {
      return res.status(404).json({
        error: 'Singer not found',
        message: 'The singer you are trying to delete does not exist'
      });
    }

    // Check if singer has any pitch associations (applies to ALL users including admins)
    const pitchCount = await databaseReadService.getSingerPitchCount(id);

    if (pitchCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete singer',
        message: `This singer has ${pitchCount} pitch(es) and cannot be deleted. Please remove all pitch associations first.`
      });
    }

    // For editors (non-admins) deleting someone else's record, validate they can only delete singers from their centers
    if (user?.role === 'editor' && !isOwnRecord) {
      const singerCenterIds = singer.centerIds || [];
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
    const isAdminValue = req.body.isAdmin ?? req.body.is_admin;

    // Validate isAdmin value
    if (isAdminValue !== 0 && isAdminValue !== 1 && isAdminValue !== true && isAdminValue !== false) {
      return res.status(400).json({ error: 'isAdmin must be 0 or 1 (or true/false)' });
    }

    // Convert boolean to number if needed
    const adminValue = (isAdminValue === true || isAdminValue === 1) ? 1 : 0;

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

// Update user editorFor (admin only)
router.patch('/:id/editor-for', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const editorForValue = req.body.editorFor ?? req.body.editor_for;

    // Validate editorFor is an array
    if (!Array.isArray(editorForValue)) {
      return res.status(400).json({ error: 'editorFor must be an array of center IDs' });
    }

    // Validate all elements are numbers
    for (const centerId of editorForValue) {
      if (typeof centerId !== 'number') {
        return res.status(400).json({
          error: `Invalid center ID "${centerId}". All elements must be numbers`
        });
      }
    }

    // Update editorFor
    await cacheService.updateUserEditorFor(id, editorForValue);
    res.json({
      message: 'Editor centers updated successfully',
      editorFor: editorForValue
    });
  } catch (error) {
    console.error('Error updating editor_for:', error);
    res.status(500).json({ error: 'Failed to update editor_for' });
  }
});

// Merge multiple singers into one - requires editor or admin role
router.post('/merge', requireEditor, async (req, res) => {
  try {
    const { targetSingerId, singerIdsToMerge } = req.body;
    const user = req.user;

    // Validate input
    if (!targetSingerId || !singerIdsToMerge || !Array.isArray(singerIdsToMerge)) {
      return res.status(400).json({
        error: 'targetSingerId and singerIdsToMerge array are required'
      });
    }

    if (singerIdsToMerge.length === 0) {
      return res.status(400).json({
        error: 'singerIdsToMerge must contain at least one singer ID'
      });
    }

    // Ensure target singer is not in the merge list
    if (singerIdsToMerge.includes(targetSingerId)) {
      return res.status(400).json({
        error: 'Target singer cannot be in the list of singers to merge'
      });
    }

    // Get all singers to validate they exist and check permissions
    const targetSinger = await cacheService.getSinger(targetSingerId);
    if (!targetSinger) {
      return res.status(404).json({ error: 'Target singer not found' });
    }

    // Fetch all singers to merge with better error handling
    const singersToMerge: any[] = [];
    for (const id of singerIdsToMerge) {
      const singer = await cacheService.getSinger(id);
      if (!singer) {
        return res.status(404).json({
          error: `Singer with ID ${id} not found`
        });
      }
      singersToMerge.push(singer);
    }

    // For editors (non-admins), validate they have access to all singers
    if (user?.role === 'editor') {
      const editableCenterIds = user.editorFor || [];

      // Check target singer
      const targetCenterIds = targetSinger.centerIds || [];
      const hasAccessToTarget = targetCenterIds.some(centerId =>
        editableCenterIds.includes(centerId)
      );
      if (!hasAccessToTarget) {
        return res.status(403).json({
          error: 'You do not have editor access to the target singer'
        });
      }

      // Check all singers to merge
      for (const singer of singersToMerge) {
        const singerCenterIds = singer.centerIds || [];
        const hasAccess = singerCenterIds.some(centerId =>
          editableCenterIds.includes(centerId)
        );
        if (!hasAccess) {
          return res.status(403).json({
            error: `You do not have editor access to singer: ${singer.name}`
          });
        }
      }
    }

    // Perform the merge in a transaction-like manner
    try {
      // Step 1: Get all pitches for target singer to identify conflicts
      const targetPitches = await databaseReadService.getSingerPitches(targetSingerId);
      const targetSongIds = new Set(targetPitches.map(p => p.songId));
      let targetSingerPitchCountUp: number = 0;
      const songIdsPitchCountDown = new Map<string, number>();
      const centerIdsSingerCountDown = new Map<number, number>();

      // Step 2: For each singer being merged, handle their pitches
      for (const singerId of singerIdsToMerge) {
        // Get singer being merged
        const singer = singersToMerge.find(s => s.id === singerId);
        if (singer) {
          const singerCenterIds = singer.centerIds || [];
          singerCenterIds.forEach(centerId => {
            centerIdsSingerCountDown.set(centerId, (centerIdsSingerCountDown.get(centerId) ?? 0) - 1);
          });
        }

        // Get pitches for this singer
        const mergePitches = await databaseReadService.getSingerPitches(singerId);

        // Process each pitch
        for (const pitch of mergePitches) {
          const songId = pitch.songId;
          const pitchId = pitch.id;

          if (targetSongIds.has(songId)) {
            // Conflict: target singer already has this song (from initial state or previous transfer) - delete this pitch
            await databaseWriteService.deletePitchById(pitchId);
            songIdsPitchCountDown.set(songId, (songIdsPitchCountDown.get(songId) ?? 0) - 1);
          } else {
            // No conflict: transfer this pitch to target singer
            await databaseWriteService.updatePitchSinger(pitchId, targetSingerId);

            // Add to target's song set so future duplicates from other merged singers are deleted
            targetSongIds.add(songId);
            targetSingerPitchCountUp += 1
          }
        }
      }

      // Delete the merged singers
      for (const singerId of singerIdsToMerge) {
        await cacheService.deleteSinger(singerId);
      }

      // Invalidate caches
      cacheService.invalidate('pitches:all');
      cacheService.invalidatePattern('singers:');

      res.json({
        message: 'Singers merged successfully',
        targetSingerPitchCountUp: targetSingerPitchCountUp,
        songIdsPitchCountDown: Object.fromEntries(songIdsPitchCountDown),
        centerIdsSingerCountDown: Object.fromEntries(centerIdsSingerCountDown),
      });
    } catch (error) {
      console.error('Error during merge operation:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error merging singers:', error);
    res.status(500).json({
      error: 'Failed to merge singers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
