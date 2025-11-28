/**
 * TemplateService - Frontend API client for template operations
 */

import apiClient from './ApiClient';
import type { PresentationTemplate, TemplateReference } from '../types';

class TemplateService {
  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<PresentationTemplate[]> {
    try {
      const templates = await apiClient.get<PresentationTemplate[]>('/templates');
      return templates;
    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<PresentationTemplate> {
    try {
      const template = await apiClient.get<PresentationTemplate>(`/templates/${id}`);
      return template;
    } catch (error) {
      console.error('❌ Error fetching template:', error);
      throw error;
    }
  }

  /**
   * Get default template
   */
  async getDefaultTemplate(): Promise<PresentationTemplate | null> {
    try {
      const template = await apiClient.get<PresentationTemplate>('/templates/default');
      return template;
    } catch (error) {
      console.error('⚠️ No default template found:', error);
      return null;
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(template: PresentationTemplate): Promise<PresentationTemplate> {
    try {
      console.log('📊 Creating template:', template.name);
      const created = await apiClient.post<PresentationTemplate>('/templates', template);
      console.log('✅ Template created successfully');
      return created;
    } catch (error) {
      console.error('❌ Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, updates: Partial<PresentationTemplate>): Promise<PresentationTemplate> {
    try {
      console.log('📊 Updating template:', id);
      const updated = await apiClient.put<PresentationTemplate>(`/templates/${id}`, updates);
      console.log('✅ Template updated successfully');
      return updated;
    } catch (error) {
      console.error('❌ Error updating template:', error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      console.log('📊 Deleting template:', id);
      await apiClient.delete(`/templates/${id}`);
      console.log('✅ Template deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Set a template as default
   */
  async setAsDefault(id: string): Promise<PresentationTemplate> {
    try {
      console.log('📊 Setting template as default:', id);
      const updated = await apiClient.post<{ message: string; template: PresentationTemplate }>(
        `/templates/${id}/set-default`,
        {}
      );
      console.log('✅ Template set as default successfully');
      return (updated as any).template || updated;
    } catch (error) {
      console.error('❌ Error setting template as default:', error);
      throw error;
    }
  }

  /**
   * Validate YAML content
   */
  async validateYaml(yamlContent: string): Promise<{ valid: boolean; template?: Partial<PresentationTemplate>; error?: string }> {
    try {
      console.log('📊 Validating YAML...');
      const result = await apiClient.post<{ valid: boolean; template?: Partial<PresentationTemplate>; error?: string }>(
        '/templates/validate/yaml',
        { yaml: yamlContent }
      );
      if (result.valid) {
        console.log('✅ YAML is valid');
      } else {
        console.log('⚠️ YAML validation failed:', result.error);
      }
      return result;
    } catch (error) {
      console.error('❌ Error validating YAML:', error);
      throw error;
    }
  }

  /**
   * Get template list for selector dropdown
   */
  async getTemplateReferences(): Promise<TemplateReference[]> {
    try {
      const templates = await this.getAllTemplates();
      return templates.map(t => ({
        id: t.id || '',
        name: t.name,
        description: t.description,
        isDefault: t.isDefault || false,
      }));
    } catch (error) {
      console.error('❌ Error getting template references:', error);
      return [];
    }
  }
}

export default new TemplateService();
