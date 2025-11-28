/**
 * TemplateService manages presentation templates
 * Handles CRUD operations, YAML parsing, and template validation
 */

import { databaseService } from './DatabaseService.js';
import { randomUUID } from 'crypto';
import * as yaml from 'js-yaml';

// Type definitions (matching src/types/index.ts)
export interface BackgroundElement {
  type: 'color' | 'image' | 'video';
  value: string;
  opacity?: number;
}

export interface ImageElement {
  id: string;
  url: string;
  position?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  x?: number | string;
  y?: number | string;
  width?: string;
  height?: string;
  opacity?: number;
  zIndex?: number;
}

export interface VideoElement {
  id: string;
  url: string;
  position?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  x?: number | string;
  y?: number | string;
  width?: string;
  height?: string;
  opacity?: number;
  zIndex?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export interface TextElement {
  id: string;
  content: string;
  position?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  x?: number | string;
  y?: number | string;
  fontSize?: string;
  color?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontFamily?: string;
  opacity?: number;
  zIndex?: number;
  maxWidth?: string;
}

export interface PresentationTemplate {
  id?: string;
  name: string;
  description?: string;
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  text?: TextElement[];
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  yaml?: string;
}

class TemplateService {
  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<PresentationTemplate[]> {
    try {
      const result = await databaseService.query<any>(`
        SELECT id, name, description, template_json, is_default, created_at, updated_at
        FROM presentation_templates
        ORDER BY is_default DESC, name ASC
      `, []);

      return result.map((row: any) => {
        let templateJson: any = {};
        try {
          console.log('📦 Raw TEMPLATE_JSON from DB:', row.NAME, row.TEMPLATE_JSON);
          templateJson = typeof row.TEMPLATE_JSON === 'string' ? JSON.parse(row.TEMPLATE_JSON) : row.TEMPLATE_JSON || {};
          console.log('✅ Parsed templateJson:', row.NAME, templateJson);
        } catch (e) {
          console.error('❌ Error parsing template JSON:', e);
        }

        const template = {
          id: row.ID,
          name: row.NAME,
          description: row.DESCRIPTION,
          background: templateJson.background,
          images: templateJson.images || [],
          videos: templateJson.videos || [],
          text: templateJson.text || [],
          isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
          createdAt: row.CREATED_AT,
          updatedAt: row.UPDATED_AT,
        } as PresentationTemplate;

        console.log('📋 Final template:', row.NAME, 'background:', template.background);

        // Reconstruct YAML from template data
        template.yaml = this.templateToYaml(template);

        return template;
      });
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<PresentationTemplate | null> {
    try {
      const result = await databaseService.query<any>(`
        SELECT id, name, description, template_json, is_default, created_at, updated_at
        FROM presentation_templates
        WHERE id = :1
      `, [id]);

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];
      let templateJson: any = {};
      try {
        console.log('📦 Raw TEMPLATE_JSON from DB (getTemplate):', row.NAME, row.TEMPLATE_JSON);
        templateJson = typeof row.TEMPLATE_JSON === 'string' ? JSON.parse(row.TEMPLATE_JSON) : row.TEMPLATE_JSON || {};
        console.log('✅ Parsed templateJson (getTemplate):', row.NAME, templateJson);
      } catch (e) {
        console.error('❌ Error parsing template JSON:', e);
      }

      const template = {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        background: templateJson.background,
        images: templateJson.images || [],
        videos: templateJson.videos || [],
        text: templateJson.text || [],
        isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      } as PresentationTemplate;

      // Reconstruct YAML from template data
      template.yaml = this.templateToYaml(template);

      return template;
    } catch (error) {
      console.error('Error fetching template:', error);
      throw error;
    }
  }

  /**
   * Get default template
   */
  async getDefaultTemplate(): Promise<PresentationTemplate | null> {
    try {
      const result = await databaseService.query<any>(`
        SELECT id, name, description, template_json, is_default, created_at, updated_at
        FROM presentation_templates
        WHERE is_default = 1
        FETCH FIRST 1 ROWS ONLY
      `, []);

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];
      let templateJson: any = {};
      try {
        templateJson = typeof row.TEMPLATE_JSON === 'string' ? JSON.parse(row.TEMPLATE_JSON) : row.TEMPLATE_JSON || {};
      } catch (e) {
        console.error('Error parsing template JSON:', e);
      }

      const template = {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        background: templateJson.background,
        images: templateJson.images || [],
        videos: templateJson.videos || [],
        text: templateJson.text || [],
        isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      } as PresentationTemplate;

      // Reconstruct YAML from template data
      template.yaml = this.templateToYaml(template);

      return template;
    } catch (error) {
      console.error('Error fetching default template:', error);
      throw error;
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(template: PresentationTemplate): Promise<PresentationTemplate> {
    try {
      const id = template.id || randomUUID();
      const templateJson = JSON.stringify({
        background: template.background,
        images: template.images || [],
        videos: template.videos || [],
        text: template.text || [],
      });

      // If this is set as default, unset other defaults
      if (template.isDefault) {
        await databaseService.query(
          'UPDATE presentation_templates SET is_default = 0',
          []
        );
      }

      await databaseService.query(`
        INSERT INTO presentation_templates
        (id, name, description, template_json, is_default, created_at, updated_at)
        VALUES (:1, :2, :3, :4, :5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        id,
        template.name,
        template.description || null,
        templateJson,
        template.isDefault ? 1 : 0,
      ]);

      // Invalidate cache after create
      const { cacheService } = await import('./CacheService.js');
      cacheService.invalidate('templates:all');

      return { ...template, id, createdAt: new Date(), updatedAt: new Date() };
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, template: Partial<PresentationTemplate>): Promise<PresentationTemplate> {
    try {
      const existing = await this.getTemplate(id);
      if (!existing) {
        throw new Error('Template not found');
      }

      const updated: PresentationTemplate = {
        ...existing,
        ...template,
        id,
      };

      const templateJson = JSON.stringify({
        background: updated.background,
        images: updated.images || [],
        videos: updated.videos || [],
        text: updated.text || [],
      });

      // If this is set as default, unset other defaults
      if (template.isDefault && !existing.isDefault) {
        await databaseService.query(
          'UPDATE presentation_templates SET is_default = 0',
          []
        );
      }

      await databaseService.query(`
        UPDATE presentation_templates
        SET name = :1, description = :2, template_json = :3, is_default = :4, updated_at = CURRENT_TIMESTAMP
        WHERE id = :5
      `, [
        updated.name,
        updated.description || null,
        templateJson,
        updated.isDefault ? 1 : 0,
        id,
      ]);

      // Invalidate cache after update
      const { cacheService } = await import('./CacheService.js');
      cacheService.invalidate('templates:all');

      return { ...updated, updatedAt: new Date() };
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Set a template as default (unsets others)
   */
  async setAsDefault(id: string): Promise<PresentationTemplate> {
    try {
      // First, unset all other templates as default
      await databaseService.query(
        'UPDATE presentation_templates SET is_default = 0',
        []
      );

      // Then set this one as default
      await databaseService.query(
        'UPDATE presentation_templates SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = :1',
        [id]
      );

      // Invalidate cache after update
      const { cacheService } = await import('./CacheService.js');
      cacheService.invalidate('templates:all');

      // Return the updated template
      const updated = await this.getTemplate(id);
      if (!updated) {
        throw new Error('Template not found after update');
      }
      return updated;
    } catch (error) {
      console.error('Error setting template as default:', error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await databaseService.query('DELETE FROM presentation_templates WHERE id = :1', [id]);
      
      // Invalidate cache after delete
      const { cacheService } = await import('./CacheService.js');
      cacheService.invalidate('templates:all');
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Parse YAML and convert to template object
   */
  parseYaml(yamlContent: string): Partial<PresentationTemplate> {
    try {
      const parsed = yaml.load(yamlContent) as any;
      return {
        name: parsed.name,
        description: parsed.description,
        background: parsed.background,
        images: parsed.images || [],
        videos: parsed.videos || [],
        text: parsed.text || [],
        yaml: yamlContent,
      };
    } catch (error) {
      console.error('Error parsing YAML:', error);
      throw new Error(`Invalid YAML format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert template to YAML
   */
  templateToYaml(template: PresentationTemplate): string {
    return yaml.dump({
      name: template.name,
      description: template.description,
      background: template.background,
      images: template.images || [],
      videos: template.videos || [],
      text: template.text || [],
    });
  }
}

export default new TemplateService();
