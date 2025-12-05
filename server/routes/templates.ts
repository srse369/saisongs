import express from 'express';
import templateService from '../services/TemplateService.js';
import cacheService from '../services/CacheService.js';
import { requireAuth, requireEditor } from '../middleware/simpleAuth.js';
import type { PresentationTemplate } from '../services/TemplateService.js';

const router = express.Router();

// Get all templates (uses cache)
router.get('/', async (req, res) => {
  try {
    const allTemplates = await cacheService.getAllTemplates();
    
    // Filter templates by center access if user is authenticated
    let templates = allTemplates;
    if (req.user) {
      const accessibleCenterIds = [...(req.user.centerIds || []), ...(req.user.editorFor || [])];
      templates = cacheService.filterByCenterAccess(allTemplates, req.user.role, accessibleCenterIds);
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get default template
router.get('/default', async (req, res) => {
  try {
    const allTemplates = await cacheService.getAllTemplates();
    const template = allTemplates.find(t => t.isDefault || t.is_default);
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await cacheService.getTemplate(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
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

    // For editors, validate they have access to all template centers
    if (user.role === 'editor') {
      const templateCenterIds = template.center_ids || [];
      const editableCenterIds = user.editorFor || [];
      const hasAccess = templateCenterIds.every(cid => editableCenterIds.includes(cid));
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied: You can only create templates for centers you manage' 
        });
      }
    }

    const created = await cacheService.createTemplate(template);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
    res.status(500).json({ error: errorMessage });
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
      const existingCenterIds = existingTemplate.center_ids || [];
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

      // If updating center_ids, validate new centers too
      if (updates.center_ids) {
        const allNewCenters = updates.center_ids.every(cid => editableCenterIds.includes(cid));
        if (!allNewCenters) {
          // Get center names for better error message
          const allCenters = await cacheService.getAllCenters();
          const invalidCenterIds = updates.center_ids.filter(cid => !editableCenterIds.includes(cid));
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
    
    const updated = await cacheService.updateTemplate(id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update template';
    res.status(500).json({ error: errorMessage });
  }
});

// Set template as default (through CacheService for write-through caching)
router.post('/:id/set-default', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await cacheService.setTemplateAsDefault(id);
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
    const { name, center_ids } = req.body;
    
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
      const sourceCenterIds = existingTemplate.center_ids || [];
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
      if (center_ids && center_ids.length > 0) {
        const allCentersValid = center_ids.every((cid: number) => editableCenterIds.includes(cid));
        if (!allCentersValid) {
          // Get center names for better error message
          const allCenters = await cacheService.getAllCenters();
          const invalidCenterIds = center_ids.filter((cid: number) => !editableCenterIds.includes(cid));
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
    const { id: _id, isDefault, created_at, updated_at, ...templateData } = existingTemplate;
    const duplicateTemplate: PresentationTemplate = {
      ...templateData,
      name,
      center_ids: center_ids || [],
      isDefault: false,
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
      const templateCenterIds = existingTemplate.center_ids || [];
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

    const parsed = templateService.parseYaml(yamlContent);
    res.json({ valid: true, template: parsed });
  } catch (error) {
    console.error('Error parsing YAML:', error);
    const errorMessage = error instanceof Error ? error.message : 'Invalid YAML';
    res.status(400).json({ valid: false, error: errorMessage });
  }
});

export default router;
