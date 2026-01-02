/**
 * TemplateService manages presentation templates
 * Handles CRUD operations, YAML parsing, and template validation
 */

import { databaseReadService } from './DatabaseReadService.js';
import { databaseWriteService } from './DatabaseWriteService.js';
import { cacheService } from './CacheService.js';
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

export interface AudioElement {
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
  volume?: number;
  visualHidden?: boolean;
  // Multi-slide audio support (1-based slide numbers)
  startSlide?: number;  // 1-based slide number to start playing on
  endSlide?: number;    // 1-based slide number to stop playing on
  playAcrossAllSlides?: boolean;
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
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number;
  zIndex?: number;
  maxWidth?: string;
  rotation?: number;
}

// Song content styling for reference slides
export interface SongContentStyle {
  // Position in slide coordinates (pixels)
  x: number;
  y: number;
  width: number;
  height?: number;
  // Font styling
  fontSize: string;         // e.g., "48px", "3rem"
  fontWeight: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign: 'left' | 'center' | 'right';
  color: string;            // e.g., "#ffffff"
  // Legacy: yPosition as percentage (deprecated, use y instead)
  yPosition?: number;
}

// Individual slide within a multi-slide template
export interface TemplateSlide {
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  audios?: AudioElement[];
  text?: TextElement[];

  // Song content styling (only used on reference slides)
  songTitleStyle?: SongContentStyle;
  songLyricsStyle?: SongContentStyle;
  songTranslationStyle?: SongContentStyle;
}

// Multi-slide presentation template
// Aspect ratio options for templates
export type AspectRatio = '16:9' | '4:3';

// Default song content styles for reference slides
const DEFAULT_SONG_TITLE_STYLE: SongContentStyle = {
  x: 40,
  y: 54, // ~5% of 1080
  width: 1840,
  fontSize: '48px',
  fontWeight: 'bold',
  textAlign: 'center',
  color: '#ffffff',
};

const DEFAULT_SONG_LYRICS_STYLE: SongContentStyle = {
  x: 40,
  y: 216, // ~20% of 1080
  width: 1840,
  fontSize: '36px',
  fontWeight: 'bold',
  textAlign: 'center',
  color: '#ffffff',
};

const DEFAULT_SONG_TRANSLATION_STYLE: SongContentStyle = {
  x: 40,
  y: 810, // ~75% of 1080
  width: 1840,
  fontSize: '24px',
  fontWeight: 'normal',
  textAlign: 'center',
  color: '#ffffff',
};

// Ensure a slide has song content styles, applying defaults if missing
function ensureSongContentStyles(slide: TemplateSlide, aspectRatio: AspectRatio = '16:9'): TemplateSlide {
  const dimensions = aspectRatio === '4:3' ? { width: 1600, height: 1200 } : { width: 1920, height: 1080 };
  const scaleY = dimensions.height / 1080;
  const scaleX = dimensions.width / 1920;

  return {
    ...slide,
    songTitleStyle: slide.songTitleStyle || {
      ...DEFAULT_SONG_TITLE_STYLE,
      x: Math.round(DEFAULT_SONG_TITLE_STYLE.x * scaleX),
      y: Math.round(DEFAULT_SONG_TITLE_STYLE.y * scaleY),
      width: Math.round(DEFAULT_SONG_TITLE_STYLE.width * scaleX),
    },
    songLyricsStyle: slide.songLyricsStyle || {
      ...DEFAULT_SONG_LYRICS_STYLE,
      x: Math.round(DEFAULT_SONG_LYRICS_STYLE.x * scaleX),
      y: Math.round(DEFAULT_SONG_LYRICS_STYLE.y * scaleY),
      width: Math.round(DEFAULT_SONG_LYRICS_STYLE.width * scaleX),
    },
    songTranslationStyle: slide.songTranslationStyle || {
      ...DEFAULT_SONG_TRANSLATION_STYLE,
      x: Math.round(DEFAULT_SONG_TRANSLATION_STYLE.x * scaleX),
      y: Math.round(DEFAULT_SONG_TRANSLATION_STYLE.y * scaleY),
      width: Math.round(DEFAULT_SONG_TRANSLATION_STYLE.width * scaleX),
    },
  };
}

export interface PresentationTemplate {
  id?: string;
  name: string;
  description?: string;
  aspectRatio?: AspectRatio;          // Template aspect ratio: '16:9' (default) or '4:3'
  centerIds?: number[];              // Centers that have access to this template

  // Multi-slide structure (new format)
  slides?: TemplateSlide[];           // Array of slides in the template
  referenceSlideIndex?: number;       // 0-based index of the slide used for song content overlay

  // Legacy single-slide fields (for backward compatibility)
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  audios?: AudioElement[];
  text?: TextElement[];

  isDefault?: boolean;
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  yaml?: string;
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

class TemplateService {
  /**
   * Map template JSON to PresentationTemplate
   */
  mapTemplateJson(id: string, name: string, description: string, isDefault: boolean, centerIds: [], templateJson: any, createdAt: Date, createdBy: string, updatedAt: Date, updatedBy: string): PresentationTemplate {
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
   */
  mapTemplateRow(row: any): PresentationTemplate {
    // Center Ids
    const centerIds: [] = typeof row.CENTER_IDS === 'string' ? JSON.parse(row.CENTER_IDS) : row.CENTER_IDS || [];

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
      const id = template.id || randomUUID();

      // If this is set as default, unset other defaults
      if (template.isDefault) {
        await databaseWriteService.unsetAllDefaultTemplates(template.createdBy || '');
      }

      const row = await databaseWriteService.createTemplate(
        id,
        template.name,
        template.description || null,
        this.buildTemplateJson(template),
        this.buildCenterIdsJson(template),
        template.isDefault || false,
        template.createdBy || ''
      );

      // Invalidate cache after create
      cacheService.invalidate('templates:all');

      return this.mapTemplateRow(row);
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

      // Invalidate cache after update
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
  async setAsDefault(id: string, updatedBy: string): Promise<PresentationTemplate> {
    try {
      // Then set this one as default
      await databaseWriteService.setTemplateAsDefault(id, updatedBy);

      // Invalidate cache after update
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
      await databaseWriteService.deleteTemplate(id);

      // Invalidate cache after delete
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

export default new TemplateService();
