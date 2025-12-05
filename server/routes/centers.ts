import express from 'express';
import { cacheService } from '../services/CacheService.js';
import { databaseService } from '../services/DatabaseService.js';
import { requireAdmin, requireAuth } from '../middleware/simpleAuth.js';

const router = express.Router();

/**
 * GET /api/centers/editable
 * Get centers that the current user can edit
 * - Admins get all centers
 * - Editors get only centers where they are listed as editors
 */
router.get('/editable', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const allCenters = await cacheService.getAllCenters();

    // Check if user is admin - admins can edit all centers
    const isAdmin = user?.role === 'admin';

    if (isAdmin) {
      return res.json(allCenters);
    }

    // For editors, get their editorFor list from the session
    const editorFor = user?.editorFor || [];

    // Filter centers based on editorFor
    const editableCenters = allCenters.filter(center => 
      editorFor.includes(center.id)
    );

    return res.json(editableCenters);
  } catch (error) {
    console.error('[CENTERS] Error fetching editable centers:', error);
    return res.status(500).json({ error: 'Failed to fetch editable centers' });
  }
});

/**
 * GET /api/centers
 * Get all centers (accessible to all authenticated users)
 */
router.get('/', async (req, res) => {
  try {
    const centers = await cacheService.getAllCenters();
    return res.json(centers);
  } catch (error) {
    console.error('[CENTERS] Error fetching centers:', error);
    return res.status(500).json({ error: 'Failed to fetch centers' });
  }
});

/**
 * GET /api/centers/:id
 * Get a specific center by ID
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const center = await cacheService.getCenterById(id);

    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    return res.json(center);
  } catch (error) {
    console.error('[CENTERS] Error fetching center:', error);
    return res.status(500).json({ error: 'Failed to fetch center' });
  }
});

/**
 * POST /api/centers
 * Create a new center (admin only - enforce in middleware)
 */
router.post('/', requireAdmin, async (req, res) => {
  const { name, badge_text_color, editor_ids } = req.body;

  // Validate input
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Center name is required' });
  }

  const trimmedName = name.trim();
  const color = badge_text_color || '#000000';
  const editorIds = Array.isArray(editor_ids) ? editor_ids : [];

  // Validate hex color format
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid badge text color format (must be hex like #000000)' });
  }

  try {
    // Check if center with same name already exists
    const allCenters = await cacheService.getAllCenters();
    const existing = allCenters.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());

    if (existing) {
      return res.status(409).json({ error: 'A center with this name already exists' });
    }

    // Create new center
    const created = await cacheService.createCenter({
      name: trimmedName,
      badge_text_color: color,
      editor_ids: editorIds,
      created_by: req.user?.email
    });

    // Add editor access for each specified user
    if (created && editorIds.length > 0) {
      for (const userId of editorIds) {
        await cacheService.addUserEditorAccess(userId, created.id);
      }
    }

    console.log(`[CENTERS] Created new center: ${trimmedName} (ID: ${created?.id}), editors: ${editorIds.length}`);

    return res.status(201).json(created);
  } catch (error) {
    console.error('[CENTERS] Error creating center:', error);
    return res.status(500).json({ error: 'Failed to create center' });
  }
});

/**
 * PUT /api/centers/:id
 * Update a center (admin only - enforce in middleware)
 */
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, badge_text_color, editor_ids } = req.body;

  // Validate input
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Center name is required' });
  }

  const trimmedName = name.trim();
  const color = badge_text_color || '#000000';
  const newEditorIds = Array.isArray(editor_ids) ? editor_ids : [];

  // Validate hex color format
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid badge text color format (must be hex like #000000)' });
  }

  try {
    // Check if center exists
    const center = await cacheService.getCenterById(id);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Check if another center with same name exists
    const allCenters = await cacheService.getAllCenters();
    const existing = allCenters.find(c => 
      c.name.toLowerCase() === trimmedName.toLowerCase() && 
      c.id !== parseInt(id)
    );

    if (existing) {
      return res.status(409).json({ error: 'A center with this name already exists' });
    }

    const centerId = parseInt(id);
    const currentEditorIds = center.editor_ids || [];
    
    // Calculate which editors to add and remove (editor IDs are hex strings)
    const editorsToAdd = newEditorIds.filter((uid: string) => !currentEditorIds.includes(uid));
    const editorsToRemove = currentEditorIds.filter((uid: string) => !newEditorIds.includes(uid));

    // Update each user's editor_for array
    for (const userId of editorsToAdd) {
      await cacheService.addUserEditorAccess(userId, centerId);
    }

    for (const userId of editorsToRemove) {
      await cacheService.removeUserEditorAccess(userId, centerId);
    }

    // Update center
    const updated = await cacheService.updateCenter(id, {
      name: trimmedName,
      badge_text_color: color,
      editor_ids: newEditorIds,
      updated_by: req.user?.email
    });

    console.log(`[CENTERS] Updated center: ${trimmedName} (ID: ${id}), editors: ${newEditorIds.length}`);

    return res.json(updated);
  } catch (error) {
    console.error('[CENTERS] Error updating center:', error);
    return res.status(500).json({ error: 'Failed to update center' });
  }
});

/**
 * DELETE /api/centers/:id
 * Delete a center (admin only - enforce in middleware)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if center exists
    const center = await cacheService.getCenterById(id);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    const centerName = center.name;
    const centerId = parseInt(id);

    // Check if center is tagged to any singers (using cache)
    const allSingers = await cacheService.getAllSingers();
    const singersWithCenter = allSingers.filter(singer => 
      singer.centerIds && singer.centerIds.includes(centerId)
    );

    if (singersWithCenter.length > 0) {
      const singersList = singersWithCenter.map(singer => singer.name);
      
      return res.status(409).json({ 
        error: `Cannot delete center. ${singersWithCenter.length} singer(s) are tagged with this center.`,
        singersCount: singersWithCenter.length,
        dependencies: {
          type: 'singers',
          items: singersList
        }
      });
    }

    // Check if center is tagged in any templates (using cache)
    const allTemplates = await cacheService.getAllTemplates();
    const templatesWithCenter = allTemplates.filter(template =>
      template.center_ids && template.center_ids.includes(centerId)
    );

    if (templatesWithCenter.length > 0) {
      const templatesList = templatesWithCenter.map(template => template.name);
      
      return res.status(409).json({ 
        error: `Cannot delete center. ${templatesWithCenter.length} template(s) are tagged with this center.`,
        templatesCount: templatesWithCenter.length,
        dependencies: {
          type: 'templates',
          items: templatesList
        }
      });
    }

    // Check if center is tagged in any sessions (using cache)
    const allSessions = await cacheService.getAllSessions();
    const sessionsWithCenter = allSessions.filter(session =>
      session.centerIds && session.centerIds.includes(centerId)
    );

    if (sessionsWithCenter.length > 0) {
      const sessionsList = sessionsWithCenter.map(session => session.name);
      
      return res.status(409).json({ 
        error: `Cannot delete center. ${sessionsWithCenter.length} session(s) are tagged with this center.`,
        sessionsCount: sessionsWithCenter.length,
        dependencies: {
          type: 'sessions',
          items: sessionsList
        }
      });
    }

    // Delete center
    await cacheService.deleteCenter(id);

    console.log(`[CENTERS] Deleted center: ${centerName} (ID: ${id})`);

    return res.json({ success: true, message: 'Center deleted successfully' });
  } catch (error) {
    console.error('[CENTERS] Error deleting center:', error);
    return res.status(500).json({ error: 'Failed to delete center' });
  }
});

/**
 * GET /api/centers/:id/stats
 * Get usage statistics for a center (admin only)
 */
router.get('/:id/stats', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if center exists
    const center = await cacheService.getCenterById(id);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    const centerId = parseInt(id);

    // Get singer counts (using cache)
    const allSingers = await cacheService.getAllSingers();
    const singersCount = allSingers.filter(singer => 
      singer.centerIds && singer.centerIds.includes(centerId)
    ).length;

    // Get template counts (using cache)
    const allTemplates = await cacheService.getAllTemplates();
    const templatesCount = allTemplates.filter(template =>
      template.center_ids && template.center_ids.includes(centerId)
    ).length;

    // Get session counts (using cache)
    const allSessions = await cacheService.getAllSessions();
    const sessionsCount = allSessions.filter(session =>
      session.centerIds && session.centerIds.includes(centerId)
    ).length;

    const stats = {
      centerName: center.name,
      singersCount,
      templatesCount,
      sessionsCount,
    };

    return res.json(stats);
  } catch (error) {
    console.error('[CENTERS] Error fetching center stats:', error);
    return res.status(500).json({ error: 'Failed to fetch center statistics' });
  }
});

export default router;
