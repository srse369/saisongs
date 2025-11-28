import express from 'express';
import templateService from '../services/TemplateService.js';
import cacheService from '../services/CacheService.js';
import type { PresentationTemplate } from '../services/TemplateService.js';

const router = express.Router();

// Get all templates (uses cache)
router.get('/', async (req, res) => {
  try {
    const templates = await cacheService.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get default template
router.get('/default', async (req, res) => {
  try {
    const template = await templateService.getDefaultTemplate();
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
    const template = await templateService.getTemplate(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/', async (req, res) => {
  try {
    const template: PresentationTemplate = req.body;
    
    if (!template.name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const created = await templateService.createTemplate(template);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
    res.status(500).json({ error: errorMessage });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates: Partial<PresentationTemplate> = req.body;
    
    const updated = await templateService.updateTemplate(id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update template';
    res.status(500).json({ error: errorMessage });
  }
});

// Set template as default
router.post('/:id/set-default', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await templateService.setAsDefault(id);
    res.json({ message: 'Template set as default', template });
  } catch (error) {
    console.error('Error setting template as default:', error);
    res.status(500).json({ error: 'Failed to set template as default' });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await templateService.deleteTemplate(id);
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
