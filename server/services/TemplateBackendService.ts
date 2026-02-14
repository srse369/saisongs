/**
 * TemplateBackendService manages presentation templates
 * Handles CRUD operations, YAML parsing, and template validation
 */

import { databaseReadService } from './DatabaseReadService.js';
import { databaseWriteService } from './DatabaseWriteService.js';
import { randomUUID } from 'crypto';
import * as yaml from 'js-yaml';
import type {
  BackgroundElement,
  ImageElement,
  VideoElement,
  AudioElement,
  TextElement,
  SongContentStyle,
  TemplateSlide,
  AspectRatio,
  PresentationTemplate,
} from '../../src/types/index.js';
import {
  ensureSongContentStyles,
} from '../../src/types/index.js';

// Re-export types for backward compatibility
export type {
  BackgroundElement,
  ImageElement,
  VideoElement,
  AudioElement,
  TextElement,
  SongContentStyle,
  TemplateSlide,
  AspectRatio,
  PresentationTemplate,
};

export function parseYaml(yamlContent: string): Partial<PresentationTemplate> {
  return templateBackendService.parseYaml(yamlContent);
}

// Normalize rotation values to whole integers on all elements in all slides
function normalizeSlideRotations(slides: TemplateSlide[] | undefined): TemplateSlide[] | undefined {
  if (!Array.isArray(slides)) return slides;

  return slides.map((slide) => {
    if (!slide) return slide;

    const images =
      slide.images &&
      slide.images.map((img) => {
        if (!img) return img;
        if (img.rotation !== undefined) {
          const r =
            typeof img.rotation === 'number'
              ? img.rotation
              : parseFloat(String(img.rotation));
          if (!Number.isNaN(r)) {
            img.rotation = Math.round(r);
          }
        }
        return img;
      });

    const videos =
      slide.videos &&
      slide.videos.map((vid) => {
        if (!vid) return vid;
        if (vid.rotation !== undefined) {
          const r =
            typeof vid.rotation === 'number'
              ? vid.rotation
              : parseFloat(String(vid.rotation));
          if (!Number.isNaN(r)) {
            vid.rotation = Math.round(r);
          }
        }
        return vid;
      });

    const text =
      slide.text &&
      slide.text.map((txt) => {
        if (!txt) return txt;
        if (txt.rotation !== undefined) {
          const r =
            typeof txt.rotation === 'number'
              ? txt.rotation
              : parseFloat(String(txt.rotation));
          if (!Number.isNaN(r)) {
            txt.rotation = Math.round(r);
          }
        }
        return txt;
      });

    return {
      ...slide,
      images,
      videos,
      text,
    };
  });
}

// Helper to get reference slide from template
function getReferenceSlide(template: PresentationTemplate): TemplateSlide {
  if (template.slides && template.slides.length > 0) {
    const index = template.referenceSlideIndex ?? 0;
    return template.slides[index] || template.slides[0];
  }
  return {
    background: template.background,
    images: template.images,
    videos: template.videos,
    audios: template.audios,
    text: template.text,
  };
}

class TemplateBackendService {
  /**
   * Map template JSON to PresentationTemplate
   */
  mapTemplateJson(id: string, name: string, description: string, isDefault: boolean, centerIds: number[], templateJson: any, createdAt: Date, createdBy: string, updatedAt: Date, updatedBy: string): PresentationTemplate {
    const template: PresentationTemplate = {
      id: id,
      name: name,
      description: description,
      isDefault: isDefault,
      centerIds: centerIds || [],
      createdAt: createdAt,
      createdBy: createdBy,
      updatedAt: updatedAt,
      updatedBy: updatedBy,
    };

    // New multi-slide format
    template.aspectRatio = templateJson.aspectRatio || '16:9';
    template.slides = templateJson.slides;
    template.referenceSlideIndex = templateJson.referenceSlideIndex ?? 0;
    // Also populate legacy fields from reference slide for backward compatibility
    if (template.slides && template.slides.length > 0) {
      const refSlide = template.slides[template.referenceSlideIndex ?? 0] || template.slides[0];
      template.background = refSlide?.background;
      template.images = refSlide?.images || [];
      template.videos = refSlide?.videos || [];
      template.audios = refSlide?.audios || [];
      template.text = refSlide?.text || [];
    }

    // Ensure reference slide has song content styles with defaults
    if (template.slides && template.slides.length > 0) {
      const refIndex = template.referenceSlideIndex ?? 0;
      template.slides[refIndex] = ensureSongContentStyles(
        template.slides[refIndex],
        template.aspectRatio || '16:9'
      );
    }

    // Reconstruct YAML from template data
    template.yaml = this.templateToYaml(template);

    return template;
  }

  /**
   * Map template row to PresentationTemplate
   * Handles both uppercase and lowercase column names (Oracle may return either).
   */
  mapTemplateRow(row: any): PresentationTemplate {
    const rawCenterIds = row.CENTER_IDS ?? row.center_ids;
    let centerIds: number[] = [];
    if (rawCenterIds != null && rawCenterIds !== '') {
      try {
        const parsed = typeof rawCenterIds === 'string' ? JSON.parse(rawCenterIds) : rawCenterIds;
        centerIds = Array.isArray(parsed)
          ? parsed.map((id: number | string) => Number(id)).filter((n: number) => !Number.isNaN(n))
          : [];
      } catch (e) {
        console.error('Error parsing template center_ids:', e);
      }
    }

    // Template JSON
    let templateJson: any = {};
    try {
      templateJson = typeof row.TEMPLATE_JSON === 'string' ? JSON.parse(row.TEMPLATE_JSON) : row.TEMPLATE_JSON || {};
    } catch (e) {
      console.error('❌ Error parsing template JSON:', e);
    }

    return this.mapTemplateJson(row.ID || row.id, row.NAME || row.name, row.DESCRIPTION || row.description, row.IS_DEFAULT || row.isDefault, centerIds, templateJson, row.CREATED_AT || row.createdAt, row.CREATED_BY || row.createdBy, row.UPDATED_AT || row.updatedAt, row.UPDATED_BY || row.updatedBy);
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<PresentationTemplate[]> {
    try {
      const result = await databaseReadService.getAllTemplates();

      return result.map((row: any) => {
        return this.mapTemplateRow(row);
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
      const row = await databaseReadService.getTemplateById(id);

      if (!row) {
        return null;
      }

      return this.mapTemplateRow(row);
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
      const row = await databaseReadService.getDefaultTemplate();

      if (!row) {
        return null;
      }

      return this.mapTemplateRow(row);
    } catch (error) {
      console.error('Error fetching default template:', error);
      throw error;
    }
  }

  /**
   * Build the JSON template structure to save to database
   */
  private buildTemplateJson(template: PresentationTemplate): string {
    return JSON.stringify({
      aspectRatio: template.aspectRatio || '16:9',
      slides: template.slides,
      referenceSlideIndex: template.referenceSlideIndex ?? 0,
    });
  }

  /**
   * Build the JSON center ids structure to save to database
   */
  private buildCenterIdsJson(template: PresentationTemplate): string | null {
    return template.centerIds && template.centerIds.length > 0
      ? JSON.stringify(template.centerIds)
      : null;
  }

  /**
   * Create a new template
   */
  async createTemplate(template: PresentationTemplate): Promise<PresentationTemplate> {
    try {
      // Always generate a new id on the server to avoid unique constraint violations
      // (e.g. client sending same id on retry or duplicate submit)
      const id = randomUUID();

      // If this is set as default, unset other defaults
      if (template.isDefault) {
        await databaseWriteService.unsetAllDefaultTemplates(template.createdBy || '');
      }

      await databaseWriteService.createTemplate(
        id,
        template.name,
        template.description || null,
        this.buildTemplateJson(template),
        this.buildCenterIdsJson(template),
        template.isDefault || false,
        template.createdBy || ''
      );

      const created = await this.getTemplate(id);
      if (!created) throw new Error('Template not found after create');
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ORA-00001') || message.includes('unique constraint')) {
        // Template was likely created by a prior request (e.g. double submit). Return existing.
        const all = await this.getAllTemplates();
        const existing = all.find(t => t.name === template.name);
        if (existing) return existing;
        throw new Error('A template with this name already exists. Please use a different name.');
      }
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

      // If this is set as default, unset other defaults
      if (template.isDefault && !existing.isDefault) {
        await databaseWriteService.unsetAllDefaultTemplates(template.updatedBy || '');
      }

      await databaseWriteService.updateTemplate(
        id,
        updated.name,
        updated.description || null,
        this.buildTemplateJson(updated),
        this.buildCenterIdsJson(updated),
        updated.isDefault || false,
        updated.updatedBy || ''
      );

      return { ...updated, updatedAt: new Date() };
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await databaseWriteService.deleteTemplate(id);
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Set a template as default (unsets others)
   */
  async setAsDefault(id: string, updatedBy: string): Promise<PresentationTemplate> {
    try {
      // Then set this one as default
      await databaseWriteService.setTemplateAsDefault(id, updatedBy);

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
   * Parse YAML and convert to template object
   * Supports both multi-slide and legacy single-slide YAML formats
   */
  parseYaml(yamlContent: string): Partial<PresentationTemplate> {
    try {
      const parsed = yaml.load(yamlContent) as any;

      // Parse aspect ratio (default to 16:9)
      const aspectRatio: AspectRatio = parsed.aspectRatio === '4:3' ? '4:3' : '16:9';

      // New multi-slide format
      const refIndex = parsed.referenceSlideIndex ?? 0;
      const normalizedSlides = normalizeSlideRotations(parsed.slides) || parsed.slides;
      const refSlide = normalizedSlides[refIndex] || normalizedSlides[0];

      return {
        name: parsed.name,
        description: parsed.description,
        aspectRatio,
        slides: normalizedSlides,
        referenceSlideIndex: refIndex,
        background: refSlide?.background,
        images: refSlide?.images || [],
        videos: refSlide?.videos || [],
        audios: refSlide?.audios || [],
        text: refSlide?.text || [],
      };
    } catch (error) {
      console.error('Error parsing YAML:', error);
      throw new Error(`Invalid YAML format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert template to YAML
   * Always outputs in new multi-slide format
   */
  templateToYaml(template: PresentationTemplate): string {
    return yaml.dump({
      name: template.name,
      description: template.description,
      aspectRatio: template.aspectRatio || '16:9',
      slides: template.slides,
      referenceSlideIndex: template.referenceSlideIndex ?? 0,
    });
  }
}

const templateBackendService = new TemplateBackendService();
export default templateBackendService;
