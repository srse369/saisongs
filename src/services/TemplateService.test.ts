import { describe, it, expect, beforeEach, vi } from 'vitest';
import templateService, { clearTemplateCache } from './TemplateService';
import apiClient from './ApiClient';
import type { PresentationTemplate } from '../types';

vi.mock('./ApiClient');

describe('TemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Clear the template cache before each test
    clearTemplateCache();
  });

  describe('getAllTemplates', () => {
    it('should fetch all templates', async () => {
      const mockTemplates: PresentationTemplate[] = [
        {
          id: '1',
          name: 'Template 1',
          description: 'Test template',
          slides: [],
          
          
          isDefault: false,
          center_ids: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue(mockTemplates);

      const result = await templateService.getAllTemplates();

      expect(result).toEqual(mockTemplates);
      expect(apiClient.get).toHaveBeenCalledWith('/templates');
    });

    it('should throw error when API fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));

      await expect(templateService.getAllTemplates()).rejects.toThrow('API Error');
      expect(console.error).toHaveBeenCalledWith('❌ Error fetching templates:', expect.any(Error));
    });
  });

  describe('getTemplate', () => {
    it('should fetch template by ID', async () => {
      const fixedDate = new Date('2025-01-01T00:00:00Z');
      const mockTemplate: PresentationTemplate = {
        id: '1',
        name: 'Template 1',
        description: 'Test',
        slides: [],
        
        
        isDefault: false,
        center_ids: [],
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockTemplate);

      const result = await templateService.getTemplate('1');

      expect(result).toEqual(mockTemplate);
      expect(apiClient.get).toHaveBeenCalledWith('/templates/1');
    });
  });

  describe('getDefaultTemplate', () => {
    it('should fetch default template', async () => {
      const mockTemplate: PresentationTemplate = {
        id: '1',
        name: 'Default',
        description: 'Default template',
        slides: [],
        
        
        isDefault: true,
        center_ids: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockTemplate);

      const result = await templateService.getDefaultTemplate();

      expect(result).toEqual(mockTemplate);
      expect(apiClient.get).toHaveBeenCalledWith('/templates/default');
    });

    it('should return null when no default template exists', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'));

      const result = await templateService.getDefaultTemplate();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('⚠️ No default template found:', expect.any(Error));
    });
  });

  describe('createTemplate', () => {
    it('should create new template', async () => {
      const input: PresentationTemplate = {
        name: 'New Template',
        description: 'Test',
        slides: [],
        
        
        isDefault: false,
        center_ids: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreated = { ...input, id: '1' };

      vi.mocked(apiClient.post).mockResolvedValue(mockCreated);

      const result = await templateService.createTemplate(input);

      expect(result).toEqual(mockCreated);
      expect(apiClient.post).toHaveBeenCalledWith('/templates', input);
      expect(console.log).toHaveBeenCalledWith('📊 Creating template:', 'New Template');
      expect(console.log).toHaveBeenCalledWith('✅ Template created successfully');
    });
  });

  describe('updateTemplate', () => {
    it('should update template', async () => {
      const updates = { name: 'Updated Template' };
      const mockUpdated: PresentationTemplate = {
        id: '1',
        name: 'Updated Template',
        description: 'Test',
        slides: [],
        
        
        isDefault: false,
        center_ids: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.put).mockResolvedValue(mockUpdated);

      const result = await templateService.updateTemplate('1', updates);

      expect(result).toEqual(mockUpdated);
      expect(apiClient.put).toHaveBeenCalledWith('/templates/1', updates);
      expect(console.log).toHaveBeenCalledWith('📊 Updating template:', '1');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await templateService.deleteTemplate('1');

      expect(apiClient.delete).toHaveBeenCalledWith('/templates/1');
      expect(console.log).toHaveBeenCalledWith('📊 Deleting template:', '1');
      expect(console.log).toHaveBeenCalledWith('✅ Template deleted successfully');
    });
  });

  describe('setAsDefault', () => {
    it('should set template as default', async () => {
      const mockTemplate: PresentationTemplate = {
        id: '1',
        name: 'Default Template',
        description: 'Test',
        slides: [],
        
        
        isDefault: true,
        center_ids: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        message: 'Success',
        template: mockTemplate,
      });

      const result = await templateService.setAsDefault('1');

      expect(result).toEqual(mockTemplate);
      expect(apiClient.post).toHaveBeenCalledWith('/templates/1/set-default', {});
      expect(console.log).toHaveBeenCalledWith('📊 Setting template as default:', '1');
    });

    it('should handle response without nested template object', async () => {
      const mockTemplate: PresentationTemplate = {
        id: '1',
        name: 'Template',
        description: 'Test',
        slides: [],
        
        
        isDefault: true,
        center_ids: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockTemplate);

      const result = await templateService.setAsDefault('1');

      expect(result).toEqual(mockTemplate);
    });
  });

  describe('duplicateTemplate', () => {
    it('should duplicate template with new name and centers', async () => {
      const mockDuplicated: PresentationTemplate = {
        id: '2',
        name: 'Copy of Template',
        description: 'Duplicated',
        slides: [],
        
        
        isDefault: false,
        center_ids: [1, 2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockDuplicated);

      const result = await templateService.duplicateTemplate('1', 'Copy of Template', [1, 2]);

      expect(result).toEqual(mockDuplicated);
      expect(apiClient.post).toHaveBeenCalledWith('/templates/1/duplicate', {
        name: 'Copy of Template',
        center_ids: [1, 2],
      });
    });
  });

  describe('validateYaml', () => {
    it('should validate valid YAML', async () => {
      const mockResponse = {
        valid: true,
        template: { name: 'Test', slides: [] },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await templateService.validateYaml('name: Test\nslides: []');

      expect(result.valid).toBe(true);
      expect(result.template).toBeDefined();
      expect(apiClient.post).toHaveBeenCalledWith('/templates/validate/yaml', {
        yaml: 'name: Test\nslides: []',
      });
      expect(console.log).toHaveBeenCalledWith('✅ YAML is valid');
    });

    it('should return error for invalid YAML', async () => {
      const mockResponse = {
        valid: false,
        error: 'Invalid syntax',
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await templateService.validateYaml('invalid: [}');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid syntax');
      expect(console.log).toHaveBeenCalledWith('⚠️ YAML validation failed:', 'Invalid syntax');
    });
  });

  describe('getTemplateReferences', () => {
    it('should return template references for dropdown', async () => {
      const mockTemplates: PresentationTemplate[] = [
        {
          id: '1',
          name: 'Template 1',
          description: 'First',
          slides: [],
          
          
          isDefault: true,
          center_ids: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Template 2',
          description: 'Second',
          slides: [],
          
          
          isDefault: false,
          center_ids: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue(mockTemplates);

      const result = await templateService.getTemplateReferences();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        name: 'Template 1',
        description: 'First',
        isDefault: true,
      });
      expect(result[1]).toEqual({
        id: '2',
        name: 'Template 2',
        description: 'Second',
        isDefault: false,
      });
    });

    it('should return empty array when fetch fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));

      const result = await templateService.getTemplateReferences();

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
