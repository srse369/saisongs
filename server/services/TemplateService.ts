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
  rotation?: number;
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
  rotation?: number;
}

export interface TextElement {
  id: string;
  content: string;
  position?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  x?: number | string;
  y?: number | string;
  width?: string;
  height?: string;
  fontSize?: string;
  color?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number;
  zIndex?: number;
  maxWidth?: string;
  rotation?: number;
}

// Song content styling for reference slides
export interface SongContentStyle {
  yPosition: number;        // Vertical position as percentage (0-100)
  fontSize: string;         // e.g., "48px", "3rem"
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  color: string;            // e.g., "#ffffff"
}

// Individual slide within a multi-slide template
export interface TemplateSlide {
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  text?: TextElement[];
  
  // Song content styling (only used on reference slides)
  songTitleStyle?: SongContentStyle;
  songLyricsStyle?: SongContentStyle;
  songTranslationStyle?: SongContentStyle;
}

// Multi-slide presentation template
// Aspect ratio options for templates
export type AspectRatio = '16:9' | '4:3';

export interface PresentationTemplate {
  id?: string;
  name: string;
  description?: string;
  aspectRatio?: AspectRatio;          // Template aspect ratio: '16:9' (default) or '4:3'
  
  // Multi-slide structure (new format)
  slides?: TemplateSlide[];           // Array of slides in the template
  referenceSlideIndex?: number;       // 0-based index of the slide used for song content overlay
  
  // Legacy single-slide fields (for backward compatibility)
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  text?: TextElement[];
  
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  yaml?: string;
}

// Helper to check if template uses multi-slide format
function isMultiSlideTemplate(templateJson: any): boolean {
  return Array.isArray(templateJson.slides) && templateJson.slides.length > 0;
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
    text: template.text,
  };
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

        // Handle both multi-slide (new) and single-slide (legacy) formats
        const template: PresentationTemplate = {
          id: row.ID,
          name: row.NAME,
          description: row.DESCRIPTION,
          isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
          createdAt: row.CREATED_AT,
          updatedAt: row.UPDATED_AT,
        };

        // Set aspect ratio (default to 16:9 for legacy templates)
        template.aspectRatio = templateJson.aspectRatio || '16:9';

        if (isMultiSlideTemplate(templateJson)) {
          // New multi-slide format
          template.slides = templateJson.slides;
          template.referenceSlideIndex = templateJson.referenceSlideIndex ?? 0;
          // Also populate legacy fields from reference slide for backward compatibility
          const refSlide = template.slides[template.referenceSlideIndex] || template.slides[0];
          template.background = refSlide?.background;
          template.images = refSlide?.images || [];
          template.videos = refSlide?.videos || [];
          template.text = refSlide?.text || [];
        } else {
          // Legacy single-slide format
          template.background = templateJson.background;
          template.images = templateJson.images || [];
          template.videos = templateJson.videos || [];
          template.text = templateJson.text || [];
          // Auto-migrate to multi-slide format structure
          template.slides = [{
            background: template.background,
            images: template.images,
            videos: template.videos,
            text: template.text,
          }];
          template.referenceSlideIndex = 0;
        }

        console.log('📋 Final template:', row.NAME, 'slides:', template.slides?.length, 'refIndex:', template.referenceSlideIndex);

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

      // Handle both multi-slide (new) and single-slide (legacy) formats
      const template: PresentationTemplate = {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      };

      // Set aspect ratio (default to 16:9 for legacy templates)
      template.aspectRatio = templateJson.aspectRatio || '16:9';

      if (isMultiSlideTemplate(templateJson)) {
        // New multi-slide format
        template.slides = templateJson.slides;
        template.referenceSlideIndex = templateJson.referenceSlideIndex ?? 0;
        // Also populate legacy fields from reference slide for backward compatibility
        const refSlide = template.slides[template.referenceSlideIndex] || template.slides[0];
        template.background = refSlide?.background;
        template.images = refSlide?.images || [];
        template.videos = refSlide?.videos || [];
        template.text = refSlide?.text || [];
      } else {
        // Legacy single-slide format
        template.background = templateJson.background;
        template.images = templateJson.images || [];
        template.videos = templateJson.videos || [];
        template.text = templateJson.text || [];
        // Auto-migrate to multi-slide format structure
        template.slides = [{
          background: template.background,
          images: template.images,
          videos: template.videos,
          text: template.text,
        }];
        template.referenceSlideIndex = 0;
      }

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

      // Handle both multi-slide (new) and single-slide (legacy) formats
      const template: PresentationTemplate = {
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        isDefault: row.IS_DEFAULT === 1 || row.IS_DEFAULT === '1',
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      };

      // Set aspect ratio (default to 16:9 for legacy templates)
      template.aspectRatio = templateJson.aspectRatio || '16:9';

      if (isMultiSlideTemplate(templateJson)) {
        // New multi-slide format
        template.slides = templateJson.slides;
        template.referenceSlideIndex = templateJson.referenceSlideIndex ?? 0;
        // Also populate legacy fields from reference slide for backward compatibility
        const refSlide = template.slides[template.referenceSlideIndex] || template.slides[0];
        template.background = refSlide?.background;
        template.images = refSlide?.images || [];
        template.videos = refSlide?.videos || [];
        template.text = refSlide?.text || [];
      } else {
        // Legacy single-slide format
        template.background = templateJson.background;
        template.images = templateJson.images || [];
        template.videos = templateJson.videos || [];
        template.text = templateJson.text || [];
        // Auto-migrate to multi-slide format structure
        template.slides = [{
          background: template.background,
          images: template.images,
          videos: template.videos,
          text: template.text,
        }];
        template.referenceSlideIndex = 0;
      }

      // Reconstruct YAML from template data
      template.yaml = this.templateToYaml(template);

      return template;
    } catch (error) {
      console.error('Error fetching default template:', error);
      throw error;
    }
  }

  /**
   * Build the JSON structure to save to database
   * Saves in new multi-slide format while maintaining backward compatibility
   */
  private buildTemplateJson(template: PresentationTemplate): string {
    // If template has slides array, save in new format
    if (template.slides && template.slides.length > 0) {
      return JSON.stringify({
        aspectRatio: template.aspectRatio || '16:9',
        slides: template.slides,
        referenceSlideIndex: template.referenceSlideIndex ?? 0,
      });
    }
    
    // Legacy format - convert to multi-slide format when saving
    const slide: TemplateSlide = {
      background: template.background,
      images: template.images || [],
      videos: template.videos || [],
      text: template.text || [],
    };
    
    return JSON.stringify({
      aspectRatio: template.aspectRatio || '16:9',
      slides: [slide],
      referenceSlideIndex: 0,
    });
  }

  /**
   * Create a new template
   */
  async createTemplate(template: PresentationTemplate): Promise<PresentationTemplate> {
    try {
      const id = template.id || randomUUID();
      const templateJson = this.buildTemplateJson(template);

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

      // Return with normalized structure
      const result: PresentationTemplate = {
        ...template,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Ensure slides array is populated
      if (!result.slides || result.slides.length === 0) {
        result.slides = [{
          background: result.background,
          images: result.images || [],
          videos: result.videos || [],
          text: result.text || [],
        }];
        result.referenceSlideIndex = 0;
      }
      
      return result;
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

      const templateJson = this.buildTemplateJson(updated);

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
   * Supports both multi-slide and legacy single-slide YAML formats
   */
  parseYaml(yamlContent: string): Partial<PresentationTemplate> {
    try {
      const parsed = yaml.load(yamlContent) as any;
      
      // Parse aspect ratio (default to 16:9)
      const aspectRatio: AspectRatio = parsed.aspectRatio === '4:3' ? '4:3' : '16:9';
      
      // Check if this is a multi-slide template
      if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
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
          // Also populate legacy fields from reference slide
          background: refSlide?.background,
          images: refSlide?.images || [],
          videos: refSlide?.videos || [],
          text: refSlide?.text || [],
          yaml: yamlContent,
        };
      }
      
      // Legacy single-slide format
      const slide: TemplateSlide = {
        background: parsed.background,
        images: parsed.images || [],
        videos: parsed.videos || [],
        text: parsed.text || [],
      };
      const normalizedSlides = normalizeSlideRotations([slide]) || [slide];
      
      return {
        name: parsed.name,
        description: parsed.description,
        aspectRatio,
        slides: normalizedSlides,
        referenceSlideIndex: 0,
        // Also populate legacy fields
        background: normalizedSlides[0]?.background ?? parsed.background,
        images: normalizedSlides[0]?.images || [],
        videos: normalizedSlides[0]?.videos || [],
        text: normalizedSlides[0]?.text || [],
        yaml: yamlContent,
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
    // If template has slides array, use new format
    if (template.slides && template.slides.length > 0) {
      return yaml.dump({
        name: template.name,
        description: template.description,
        aspectRatio: template.aspectRatio || '16:9',
        slides: template.slides,
        referenceSlideIndex: template.referenceSlideIndex ?? 0,
      });
    }
    
    // Convert legacy format to multi-slide in YAML output
    return yaml.dump({
      name: template.name,
      description: template.description,
      aspectRatio: template.aspectRatio || '16:9',
      slides: [{
      background: template.background,
      images: template.images || [],
      videos: template.videos || [],
      text: template.text || [],
      }],
      referenceSlideIndex: 0,
    });
  }
}

export default new TemplateService();
