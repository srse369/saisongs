/**
 * TemplateService - Frontend API client for template operations
 */

import apiClient from './ApiClient';
import { CACHE_KEYS, getLocalStorageItem, setLocalStorageItem } from '../utils/cacheUtils';
import type { PresentationTemplate, TemplateReference } from '../types';

const DEFAULT_TEMPLATE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Simple in-memory cache for individual templates (5 second TTL)
interface TemplateCache {
  template: PresentationTemplate;
  timestamp: number;
}
const templateCache = new Map<string, TemplateCache>();
const templateFetchPromises = new Map<string, Promise<PresentationTemplate>>();
const TEMPLATE_CACHE_TTL_MS = 5000; // 5 seconds

/**
 * Clear the template cache (for testing purposes)
 */
export const clearTemplateCache = () => {
  templateCache.clear();
  templateFetchPromises.clear();
};

class TemplateService {
  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<PresentationTemplate[]> {
    try {
      const templates = await apiClient.get<PresentationTemplate[]>('/templates');
      // Update individual template cache when we fetch all
      templates.forEach(template => {
        if (template.id) {
          templateCache.set(template.id, {
            template,
            timestamp: Date.now()
          });
        }
      });
      // Also cache the default template for use in new tabs (presentation preview)
      const defaultT = templates.find((t) => t.isDefault);
      if (defaultT && typeof window !== 'undefined') {
        setLocalStorageItem(
          CACHE_KEYS.SAI_SONGS_DEFAULT_TEMPLATE,
          JSON.stringify({ timestamp: Date.now(), template: defaultT })
        );
      }
      return templates;
    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Get template by ID (with caching and promise deduplication)
   */
  async getTemplate(id: string): Promise<PresentationTemplate> {
    // Check cache first
    const cached = templateCache.get(id);
    if (cached && Date.now() - cached.timestamp < TEMPLATE_CACHE_TTL_MS) {
      return cached.template;
    }

    // Check if fetch is already in progress
    const existingPromise = templateFetchPromises.get(id);
    if (existingPromise) {
      return existingPromise;
    }

    // Start new fetch
    const fetchPromise = (async () => {
      try {
        const template = await apiClient.get<PresentationTemplate>(`/templates/${id}`);
        // Cache the result
        templateCache.set(id, {
          template,
          timestamp: Date.now()
        });
        return template;
      } catch (error) {
        console.error('❌ Error fetching template:', error);
        throw error;
      } finally {
        // Remove from in-flight promises
        templateFetchPromises.delete(id);
      }
    })();

    // Store the promise
    templateFetchPromises.set(id, fetchPromise);
    return fetchPromise;
  }

  /**
   * Get default template (uses localStorage cache first to avoid backend fetch in new tabs)
   */
  async getDefaultTemplate(): Promise<PresentationTemplate | null> {
    // 1. Try dedicated default template cache (survives new tab / page reload)
    if (typeof window !== 'undefined') {
      const cachedRaw = getLocalStorageItem(CACHE_KEYS.SAI_SONGS_DEFAULT_TEMPLATE);
      if (cachedRaw) {
        try {
          const { timestamp, template } = JSON.parse(cachedRaw) as { timestamp: number; template: PresentationTemplate };
          if (template && Date.now() - timestamp < DEFAULT_TEMPLATE_CACHE_TTL_MS) {
            return template;
          }
        } catch {
          // Ignore parse errors
        }
      }
      // 2. Try templates list cache - find default (populated when user visited Templates tab)
      const templatesRaw = getLocalStorageItem(CACHE_KEYS.SAI_SONGS_TEMPLATES);
      if (templatesRaw) {
        try {
          const { timestamp, templates } = JSON.parse(templatesRaw) as { timestamp: number; templates: PresentationTemplate[] };
          if (Array.isArray(templates) && Date.now() - timestamp < DEFAULT_TEMPLATE_CACHE_TTL_MS) {
            const defaultT = templates.find((t) => t.isDefault);
            if (defaultT) return defaultT;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    // 3. Fetch from backend and cache on success
    try {
      const template = await apiClient.get<PresentationTemplate>('/templates/default');
      if (template && typeof window !== 'undefined') {
        setLocalStorageItem(
          CACHE_KEYS.SAI_SONGS_DEFAULT_TEMPLATE,
          JSON.stringify({ timestamp: Date.now(), template })
        );
      }
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
      // Clear cache since list has changed
      templateCache.clear();
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
      // Invalidate cached entry for this template
      templateCache.delete(id);
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
      // Remove from cache
      templateCache.delete(id);
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
   * Duplicate a template with a new name and center assignments
   */
  async duplicateTemplate(id: string, name: string, centerIds: number[]): Promise<PresentationTemplate> {
    try {
      console.log('📊 Duplicating template:', id);
      const duplicated = await apiClient.post<PresentationTemplate>(
        `/templates/${id}/duplicate`,
        { name, centerIds }
      );
      console.log('✅ Template duplicated successfully');
      return duplicated;
    } catch (error) {
      console.error('❌ Error duplicating template:', error);
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
