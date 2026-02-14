import { describe, it, expect } from 'vitest';
import {
  isMultiSlideTemplate,
  getReferenceSlide,
  migrateToMultiSlide,
  getBackgroundStyles,
  getPositionClasses,
  getElementStyles,
  getSlideBackgroundStyles,
} from './templateUtils';
import type { PresentationTemplate, TemplateSlide } from '../types';

describe('templateUtils', () => {
  describe('isMultiSlideTemplate', () => {
    it('should return true for multi-slide template', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi',
        slides: [
          { background: { type: 'color', value: '#fff' } },
        ],
      } as PresentationTemplate;

      expect(isMultiSlideTemplate(template)).toBe(true);
    });

    it('should return false for legacy template', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Legacy',
        background: { type: 'color', value: '#fff' },
      } as PresentationTemplate;

      expect(isMultiSlideTemplate(template)).toBe(false);
    });

    it('should return false for empty slides array', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Empty',
        slides: [],
      } as PresentationTemplate;

      expect(isMultiSlideTemplate(template)).toBe(false);
    });

    it('should return false when slides is undefined', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'No Slides',
      } as PresentationTemplate;

      expect(isMultiSlideTemplate(template)).toBe(false);
    });
  });

  describe('getReferenceSlide', () => {
    it('should return reference slide at specified index', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi',
        slides: [
          { background: { type: 'color', value: '#000' } },
          { background: { type: 'color', value: '#fff' } },
        ],
        referenceSlideIndex: 1,
      } as PresentationTemplate;

      const refSlide = getReferenceSlide(template);
      expect(refSlide.background?.value).toBe('#fff');
    });

    it('should return first slide if referenceSlideIndex is 0', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi',
        slides: [
          { background: { type: 'color', value: '#fff' } },
        ],
        referenceSlideIndex: 0,
      } as PresentationTemplate;

      const refSlide = getReferenceSlide(template);
      expect(refSlide.background?.value).toBe('#fff');
    });

    it('should return first slide if referenceSlideIndex is undefined', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi',
        slides: [
          { background: { type: 'color', value: '#fff' } },
          { background: { type: 'color', value: '#000' } },
        ],
      } as PresentationTemplate;

      const refSlide = getReferenceSlide(template);
      expect(refSlide.background?.value).toBe('#fff');
    });

    it('should return first slide if index out of bounds', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi',
        slides: [
          { background: { type: 'color', value: '#fff' } },
        ],
        referenceSlideIndex: 5,
      } as PresentationTemplate;

      const refSlide = getReferenceSlide(template);
      expect(refSlide.background?.value).toBe('#fff');
    });

    it('should return legacy template as single slide', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Legacy',
        background: { type: 'color', value: '#fff' },
        images: [],
        videos: [],
        text: [],
      } as PresentationTemplate;

      const refSlide = getReferenceSlide(template);
      expect(refSlide.background?.value).toBe('#fff');
    });
  });

  describe('migrateToMultiSlide', () => {
    it('should return template unchanged if already multi-slide', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi',
        slides: [
          { background: { type: 'color', value: '#fff' } },
        ],
        referenceSlideIndex: 0,
      } as PresentationTemplate;

      const migrated = migrateToMultiSlide(template);
      expect(migrated).toEqual(template);
    });

    it('should convert legacy template to multi-slide format', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Legacy',
        background: { type: 'color', value: '#fff' },
        images: [{ id: '1', url: 'image.jpg' } as any],
        videos: [],
        text: [],
      } as PresentationTemplate;

      const migrated = migrateToMultiSlide(template);
      expect(migrated.slides).toHaveLength(1);
      expect(migrated.slides![0].background?.value).toBe('#fff');
      expect(migrated.slides![0].images).toHaveLength(1);
      expect(migrated.referenceSlideIndex).toBe(0);
    });

    it('should preserve legacy fields for backward compatibility', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Legacy',
        background: { type: 'color', value: '#fff' },
        images: [],
        videos: [],
        text: [],
      } as PresentationTemplate;

      const migrated = migrateToMultiSlide(template);
      expect(migrated.background).toBeDefined();
      expect(migrated.images).toBeDefined();
      expect(migrated.videos).toBeDefined();
      expect(migrated.text).toBeDefined();
    });
  });

  describe('getBackgroundStyles', () => {
    it('should return default white background when no template', () => {
      const styles = getBackgroundStyles(null);
      expect(styles.background).toBe('#ffffff');
    });

    it('should return default white background when no background defined', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('#ffffff');
    });

    it('should handle color background', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
        background: { type: 'color', value: '#ff0000' },
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('#ff0000');
    });

    it('should handle color background with opacity', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
        background: { type: 'color', value: '#ff0000', opacity: 0.5 },
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('should handle image background', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
        background: { type: 'image', value: 'image.jpg', opacity: 0.8 },
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('url(image.jpg)');
      expect(styles.backgroundSize).toBe('cover');
      expect(styles.backgroundPosition).toBe('center');
      expect(styles.opacity).toBe(0.8);
    });

    it('should handle video background', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
        background: { type: 'video', value: 'video.mp4', opacity: 0.9 },
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('#000000');
      expect(styles.opacity).toBe(0.9);
    });

    it('should default to opacity 1 when not specified', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
        background: { type: 'color', value: '#00ff00' },
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('#00ff00');
    });
  });

  describe('getPositionClasses', () => {
    it('should return absolute for undefined position', () => {
      expect(getPositionClasses(undefined)).toBe('absolute');
    });

    it('should return correct classes for top positions', () => {
      expect(getPositionClasses('top-left')).toContain('top-0 left-0');
      expect(getPositionClasses('top-center')).toContain('top-0');
      expect(getPositionClasses('top-center')).toContain('left-1/2');
      expect(getPositionClasses('top-right')).toContain('top-0 right-0');
    });

    it('should return correct classes for center positions', () => {
      expect(getPositionClasses('center-left')).toContain('top-1/2 left-0');
      expect(getPositionClasses('center')).toContain('top-1/2 left-1/2');
      expect(getPositionClasses('center-right')).toContain('top-1/2 right-0');
    });

    it('should return correct classes for bottom positions', () => {
      expect(getPositionClasses('bottom-left')).toContain('bottom-0 left-0');
      expect(getPositionClasses('bottom-center')).toContain('bottom-0');
      expect(getPositionClasses('bottom-right')).toContain('bottom-0 right-0');
    });

    it('should include absolute positioning for all', () => {
      expect(getPositionClasses('top-left')).toContain('absolute');
      expect(getPositionClasses('center')).toContain('absolute');
      expect(getPositionClasses('bottom-right')).toContain('absolute');
    });
  });

  describe('getElementStyles', () => {
    it('should return basic styles', () => {
      const element = {
        width: '100px',
        height: '50px',
        opacity: 0.8,
        zIndex: 5,
      };

      const styles = getElementStyles(element);
      // Width/height are converted to % of slide (1920x1080 default) so preview scales correctly
      expect(styles.width).toBe('5.208333333333334%'); // 100/1920*100
      expect(styles.height).toBe('4.62962962962963%');  // 50/1080*100
      expect(styles.opacity).toBe(0.8);
      expect(styles.zIndex).toBe(5);
    });

    it('should default opacity to 1', () => {
      const element = { width: '100px', height: '50px' };
      const styles = getElementStyles(element);
      expect(styles.opacity).toBe(1);
    });

    it('should default zIndex to 0', () => {
      const element = { width: '100px', height: '50px' };
      const styles = getElementStyles(element);
      expect(styles.zIndex).toBe(0);
    });

    it('should handle custom x position as number', () => {
      const element = { x: 100, width: '50px', height: '50px' };
      const styles = getElementStyles(element);
      // Numbers are now converted to percentages for proper scaling
      expect(styles.left).toBe('5.208333333333334%'); // 100/1920 * 100
    });

    it('should handle custom x position as string', () => {
      const element = { x: '50%', width: '50px', height: '50px' };
      const styles = getElementStyles(element);
      expect(styles.left).toBe('50%');
    });

    it('should handle custom y position as number', () => {
      const element = { y: 200, width: '50px', height: '50px' };
      const styles = getElementStyles(element);
      // Numbers are now converted to percentages for proper scaling
      expect(styles.top).toBe('18.51851851851852%'); // 200/1080 * 100
    });

    it('should handle custom y position as string', () => {
      const element = { y: '25%', width: '50px', height: '50px' };
      const styles = getElementStyles(element);
      expect(styles.top).toBe('25%');
    });

    it('should handle negative x position (number and px string) for scaling', () => {
      const element = { x: -100, width: '50px', height: '50px' };
      const styles = getElementStyles(element, 1920, 1080);
      expect(styles.left).toBe('-5.208333333333334%'); // -100/1920 * 100
    });

    it('should handle negative y position for scaling', () => {
      const element = { y: -50, width: '50px', height: '50px' };
      const styles = getElementStyles(element, 1920, 1080);
      expect(styles.top).toBe('-4.62962962962963%'); // -50/1080 * 100
    });

    it('should use percentage for zero x/y (not fall back to 0px)', () => {
      const element = { x: 0, y: 0, width: '50px', height: '50px' };
      const styles = getElementStyles(element, 1920, 1080);
      expect(styles.left).toBe('0%');
      expect(styles.top).toBe('0%');
    });

    it('should apply rotation for elements without predefined position', () => {
      const element = { x: 100, y: 100, rotation: 45, width: '50px', height: '50px' };
      const styles = getElementStyles(element);
      expect(styles.transform).toBe('rotate(45deg)');
      expect(styles.transformOrigin).toBe('center center');
    });

    it('should not apply rotation for elements with predefined position', () => {
      const element = { position: 'center', rotation: 45, width: '50px', height: '50px' };
      const styles = getElementStyles(element);
      expect(styles.transform).toBeUndefined();
    });

    it('should handle zero rotation', () => {
      const element = { x: 100, y: 100, rotation: 0, width: '50px', height: '50px' };
      const styles = getElementStyles(element);
      expect(styles.transform).toBe('rotate(0deg)');
    });
  });

  describe('getSlideBackgroundStyles', () => {
    it('should return default white when no slide', () => {
      const styles = getSlideBackgroundStyles(null);
      expect(styles.background).toBe('#ffffff');
    });

    it('should return default white when no background', () => {
      const slide: TemplateSlide = {};
      const styles = getSlideBackgroundStyles(slide);
      expect(styles.background).toBe('#ffffff');
    });

    it('should handle color background', () => {
      const slide: TemplateSlide = {
        background: { type: 'color', value: '#00ff00' },
      };
      const styles = getSlideBackgroundStyles(slide);
      expect(styles.background).toBe('#00ff00');
    });

    it('should handle color with opacity', () => {
      const slide: TemplateSlide = {
        background: { type: 'color', value: '#0000ff', opacity: 0.3 },
      };
      const styles = getSlideBackgroundStyles(slide);
      expect(styles.background).toBe('rgba(0, 0, 255, 0.3)');
    });

    it('should handle image background', () => {
      const slide: TemplateSlide = {
        background: { type: 'image', value: 'bg.jpg', opacity: 0.7 },
      };
      const styles = getSlideBackgroundStyles(slide);
      expect(styles.background).toBe('url(bg.jpg)');
      expect(styles.backgroundSize).toBe('cover');
      expect(styles.opacity).toBe(0.7);
    });

    it('should handle video background', () => {
      const slide: TemplateSlide = {
        background: { type: 'video', value: 'bg.mp4', opacity: 0.6 },
      };
      const styles = getSlideBackgroundStyles(slide);
      expect(styles.background).toBe('#000000');
      expect(styles.opacity).toBe(0.6);
    });

    it('should handle unknown background type', () => {
      const slide: TemplateSlide = {
        background: { type: 'unknown' as any, value: 'test' },
      };
      const styles = getSlideBackgroundStyles(slide);
      expect(styles.background).toBe('#ffffff');
    });

    it('should default opacity to 1', () => {
      const slide: TemplateSlide = {
        background: { type: 'color', value: '#ff00ff' },
      };
      const styles = getSlideBackgroundStyles(slide);
      expect(styles.background).toBe('#ff00ff');
    });
  });

  describe('hex to rgba conversion', () => {
    it('should convert 6-digit hex with opacity', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
        background: { type: 'color', value: '#ff8800', opacity: 0.5 },
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('rgba(255, 136, 0, 0.5)');
    });

    it('should parse hex correctly for various colors', () => {
      const testCases = [
        { hex: '#ffffff', opacity: 0.5, expected: 'rgba(255, 255, 255, 0.5)' },
        { hex: '#000000', opacity: 0.1, expected: 'rgba(0, 0, 0, 0.1)' },
        { hex: '#abcdef', opacity: 0.75, expected: 'rgba(171, 205, 239, 0.75)' },
      ];

      testCases.forEach(({ hex, opacity, expected }) => {
        const template: PresentationTemplate = {
          id: '1',
          name: 'Test',
          background: { type: 'color', value: hex, opacity },
        } as PresentationTemplate;

        const styles = getBackgroundStyles(template);
        expect(styles.background).toBe(expected);
      });
    });

    it('should not convert hex when opacity is 1', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Test',
        background: { type: 'color', value: '#ff0000', opacity: 1 },
      } as PresentationTemplate;

      const styles = getBackgroundStyles(template);
      expect(styles.background).toBe('#ff0000');
    });
  });
});
