import express from 'express';
import cacheService from '../services/CacheService.js';
import type { PresentationTemplate } from '../services/CacheService.js';
import { parseYaml } from '../services/CacheService.js';
import { requireAuth, requireEditor, optionalAuth } from '../middleware/simpleAuth.js';
import { databaseReadService } from '../services/DatabaseReadService.js';

const router = express.Router();

/** Normalize to numbers and merge centerIds + editorFor for access check */
function getAccessibleCenterIds(centerIds: number[] | undefined, editorFor: number[] | undefined): number[] {
  const a = (centerIds || []).map((id: number | string) => Number(id)).filter((n) => !Number.isNaN(n));
  const b = (editorFor || []).map((id: number | string) => Number(id)).filter((n) => !Number.isNaN(n));
  return [...new Set([...a, ...b])];
}

// Get all templates (uses cache)
// Uses optionalAuth to populate req.user if session exists, but doesn't require authentication
router.get('/', optionalAuth, async (req, res) => {
  try {
    const allTemplates = await cacheService.getAllTemplates();

    let templates: PresentationTemplate[];
    if (req.user) {
      let accessibleCenterIds = getAccessibleCenterIds(req.user.centerIds, req.user.editorFor);
      // If editor has no centers in session (e.g. stale session after being granted access), re-fetch from DB
      if (req.user.role === 'editor' && accessibleCenterIds.length === 0 && req.user.email) {
        try {
          const freshUser = await databaseReadService.getUserByEmail(req.user.email);
          if (freshUser) {
            accessibleCenterIds = getAccessibleCenterIds(freshUser.centerIds, freshUser.editorFor);
          }
        } catch (_) {
          // use session data as-is
        }
      }
      templates = cacheService.filterByCenterAccess<PresentationTemplate>(allTemplates, req.user.role, accessibleCenterIds);
    } else {
      templates = allTemplates.filter((t) => !t.centerIds || t.centerIds.length === 0);
    }

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get default template
// Uses optionalAuth to populate req.user if session exists
router.get('/default', optionalAuth, async (req, res) => {
  try {
    const allTemplates = await cacheService.getAllTemplates();

    let accessibleTemplates: PresentationTemplate[];
    if (req.user) {
      let accessibleCenterIds = getAccessibleCenterIds(req.user.centerIds, req.user.editorFor);
      if (req.user.role === 'editor' && accessibleCenterIds.length === 0 && req.user.email) {
        try {
          const freshUser = await databaseReadService.getUserByEmail(req.user.email);
          if (freshUser) {
            accessibleCenterIds = getAccessibleCenterIds(freshUser.centerIds, freshUser.editorFor);
          }
        } catch (_) {}
      }
      accessibleTemplates = cacheService.filterByCenterAccess(allTemplates, req.user.role, accessibleCenterIds);
    } else {
      accessibleTemplates = allTemplates.filter((t) => !t.centerIds || t.centerIds.length === 0);
    }

    // Find default template from accessible templates
    const template = accessibleTemplates.find(t => t.isDefault);
    if (!template) {
      return res.status(404).json({ error: 'No default template found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching default template:', error);
    res.status(500).json({ error: 'Failed to fetch default template' });
  }
});

// Get template by ID
// Uses optionalAuth to populate req.user if session exists
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await cacheService.getTemplate(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if user has access to this template based on center restrictions
    const templateCenterIds = template.centerIds || [];
    
    if (req.user) {
      // Authenticated user: check if they have access via their centers
      const accessibleCenterIds = [...(req.user.centerIds || []), ...(req.user.editorFor || [])];
      const hasAccess = req.user.role === 'admin' || 
                        templateCenterIds.length === 0 || 
                        templateCenterIds.some(cid => accessibleCenterIds.includes(cid));
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this template' });
      }
    } else {
      // Public user: only allow access to templates with no center restrictions
      if (templateCenterIds.length > 0) {
        return res.status(403).json({ error: 'Access denied: This template is restricted to specific centers' });
      }
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template (through CacheService for write-through caching)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    const template: PresentationTemplate = req.body;
    
    if (!template.name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Viewers cannot create templates
    if (user.role === 'viewer') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Viewers cannot create templates. Editor or admin access required.'
      });
    }

    // For editors, require at least one center (cannot create public templates) and must have access
    if (user.role === 'editor') {
      const templateCenterIds = template.centerIds || [];
      const editableCenterIds = user.editorFor || [];
      if (templateCenterIds.length === 0) {
        return res.status(400).json({
          error: 'Editors must assign the template to at least one center. Public templates are only for admins.'
        });
      }
      const hasAccess = templateCenterIds.every(cid => editableCenterIds.includes(cid));
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied: You can only create templates for centers you manage'
        });
      }
    }

    template.createdBy = user.email;
    const created = await cacheService.createTemplate(template);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
    const isDuplicateName = errorMessage.includes('already exists') || (error instanceof Error && error.message.includes('ORA-00001'));
    res.status(isDuplicateName ? 409 : 500).json({ error: errorMessage });
  }
});

// Update template (through CacheService for write-through caching)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    const { id } = req.params;
    const updates: Partial<PresentationTemplate> = req.body;
    
    // Get existing template to check permissions
    const existingTemplate = await cacheService.getTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Viewers cannot update templates
    if (user.role === 'viewer') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Viewers cannot update templates. Editor or admin access required.'
      });
    }

    // For editors, validate they have access to template's centers
    if (user.role === 'editor') {
      const existingCenterIds = existingTemplate.centerIds || [];
      const editableCenterIds = user.editorFor || [];
      const hasAccess = existingCenterIds.length === 0 || existingCenterIds.some(cid => editableCenterIds.includes(cid));
      
      if (!hasAccess) {
        // Get center names for better error message
        const allCenters = await cacheService.getAllCenters();
        const centerNames = existingCenterIds
          .map(cid => allCenters.find(c => c.id === cid)?.name || `Center ${cid}`)
          .join(', ');
        
        return res.status(403).json({ 
          error: 'Access denied',
          message: `You do not have editor access to this template's centers: ${centerNames}`
        });
      }

      // If updating centerIds, validate: editors cannot make template public (empty centerIds)
      if (updates.centerIds !== undefined) {
        if (updates.centerIds.length === 0) {
          return res.status(400).json({
            error: 'Editors cannot make a template public. Assign at least one center you manage.'
          });
        }
        const allNewCenters = updates.centerIds.every(cid => editableCenterIds.includes(cid));
        if (!allNewCenters) {
          const allCenters = await cacheService.getAllCenters();
          const invalidCenterIds = updates.centerIds.filter(cid => !editableCenterIds.includes(cid));
          const invalidCenterNames = invalidCenterIds
            .map(cid => allCenters.find(c => c.id === cid)?.name || `Center ${cid}`)
            .join(', ');
          return res.status(403).json({
            error: 'Access denied',
            message: `You can only assign templates to centers you manage. Missing access to: ${invalidCenterNames}`
          });
        }
      }
    }
    
    updates.updatedBy = user.email || '';
    const updated = await cacheService.updateTemplate(id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update template';
    res.status(500).json({ error: errorMessage });
  }
});

// Set template as default (through CacheService for write-through caching)
router.post('/:id/set-default', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    const { id } = req.params;
    const template = await cacheService.setTemplateAsDefault(id, user.email || '');
    res.json({ message: 'Template set as default', template });
  } catch (error) {
    console.error('Error setting template as default:', error);
    res.status(500).json({ error: 'Failed to set template as default' });
  }
});

// Duplicate template (through CacheService for write-through caching)
router.post('/:id/duplicate', requireEditor, async (req, res) => {
  try {
    const user = req.user;

    const { id } = req.params;
    const { name } = req.body;
    const centerIds = req.body.centerIds ?? req.body.center_ids;
    
    if (!name) {
      return res.status(400).json({ error: 'New template name is required' });
    }

    // Get existing template
    const existingTemplate = await cacheService.getTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // For editors, validate they have access to source template's centers
    if (user.role === 'editor') {
      const sourceCenterIds = existingTemplate.centerIds || [];
      const editableCenterIds = user.editorFor || [];
      
      // If source template has centers, editor must have access to at least one
      if (sourceCenterIds.length > 0) {
        const hasSourceAccess = sourceCenterIds.some(cid => editableCenterIds.includes(cid));
        
        if (!hasSourceAccess) {
          // Get center names for better error message
          const allCenters = await cacheService.getAllCenters();
          const sourceCenterNames = sourceCenterIds
            .map(cid => allCenters.find(c => c.id === cid)?.name || `Center ${cid}`)
            .join(', ');
          
          return res.status(403).json({ 
            error: 'Access denied',
            message: `You do not have editor access to the template's centers: ${sourceCenterNames}`
          });
        }
      }
      // If source template has no centers (global), editors can still duplicate it

      // Validate they have access to all requested centers for the duplicate
      if (centerIds && centerIds.length > 0) {
        const allCentersValid = centerIds.every((cid: number) => editableCenterIds.includes(cid));
        if (!allCentersValid) {
          // Get center names for better error message
          const allCenters = await cacheService.getAllCenters();
          const invalidCenterIds = centerIds.filter((cid: number) => !editableCenterIds.includes(cid));
          const invalidCenterNames = invalidCenterIds
            .map((cid: number) => allCenters.find(c => c.id === cid)?.name || `Center ${cid}`)
            .join(', ');
          
          return res.status(403).json({ 
            error: 'Access denied',
            message: `You do not have editor access to assign the duplicate to these centers: ${invalidCenterNames}`
          });
        }
      }
    }

    // Create duplicate template (exclude id and isDefault)
    const { id: _id, isDefault, createdAt, updatedAt, ...templateData } = existingTemplate;
    const duplicateTemplate: PresentationTemplate = {
      ...templateData,
      name,
      centerIds: centerIds || [],
      isDefault: false,
      createdBy: user.email || '',
    };

    const created = await cacheService.createTemplate(duplicateTemplate);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error duplicating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate template';
    res.status(500).json({ error: errorMessage });
  }
});

// Delete template (through CacheService for write-through caching)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    const { id } = req.params;
    
    // Get existing template to check permissions
    const existingTemplate = await cacheService.getTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Viewers cannot delete templates
    if (user.role === 'viewer') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Viewers cannot delete templates. Editor or admin access required.'
      });
    }

    // For editors, validate they have access to template's centers
    if (user.role === 'editor') {
      const templateCenterIds = existingTemplate.centerIds || [];
      const editableCenterIds = user.editorFor || [];
      const hasAccess = templateCenterIds.length === 0 || templateCenterIds.some(cid => editableCenterIds.includes(cid));
      
      if (!hasAccess) {
        // Get center names for better error message
        const allCenters = await cacheService.getAllCenters();
        const centerNames = templateCenterIds
          .map(cid => allCenters.find(c => c.id === cid)?.name || `Center ${cid}`)
          .join(', ');
        
        return res.status(403).json({ 
          error: 'Access denied',
          message: `You do not have editor access to delete this template. Required centers: ${centerNames}`
        });
      }
    }
    
    await cacheService.deleteTemplate(id);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Parse YAML and validate
router.post('/validate/yaml', async (req, res) => {
  try {
    const { yaml: yamlContent } = req.body;
    
    if (!yamlContent) {
      return res.status(400).json({ error: 'YAML content is required' });
    }

    const parsed = parseYaml(yamlContent);
    res.json({ valid: true, template: parsed });
  } catch (error) {
    console.error('Error parsing YAML:', error);
    const errorMessage = error instanceof Error ? error.message : 'Invalid YAML';
    res.status(400).json({ valid: false, error: errorMessage });
  }
});

export default router;
