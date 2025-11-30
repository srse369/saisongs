/**
 * Template rendering utilities for applying templates to presentation slides
 */

import type { PresentationTemplate, TemplateSlide } from '../types';

// =============================================================================
// Template helper functions
// =============================================================================

/**
 * Check if template uses new multi-slide format
 */
export function isMultiSlideTemplate(template: PresentationTemplate): boolean {
  return Array.isArray(template.slides) && template.slides.length > 0;
}

/**
 * Get the reference slide from a template (the slide used for song content overlay)
 */
export function getReferenceSlide(template: PresentationTemplate): TemplateSlide {
  if (isMultiSlideTemplate(template)) {
    const index = template.referenceSlideIndex ?? 0;
    return template.slides![index] || template.slides![0];
  }
  // Legacy format - return the template itself as a single slide
  return {
    background: template.background,
    images: template.images,
    videos: template.videos,
    text: template.text,
  };
}

/**
 * Migrate legacy template to multi-slide format
 */
export function migrateToMultiSlide(template: PresentationTemplate): PresentationTemplate {
  if (isMultiSlideTemplate(template)) {
    return template; // Already in new format
  }
  
  // Convert legacy single-slide to multi-slide with one slide
  return {
    ...template,
    slides: [{
      background: template.background,
      images: template.images,
      videos: template.videos,
      text: template.text,
    }],
    referenceSlideIndex: 0,
    // Keep legacy fields for backward compatibility during transition
    background: template.background,
    images: template.images,
    videos: template.videos,
    text: template.text,
  };
}

/**
 * Get CSS styles from background element
 */
export const getBackgroundStyles = (template: PresentationTemplate | null): React.CSSProperties => {
  if (!template?.background) {
    return { background: '#ffffff' };
  }

  const { type, value, opacity = 1 } = template.background;

  switch (type) {
    case 'color':
      // Convert hex to rgba if opacity is less than 1
      let bgColor = value;
      if (opacity < 1 && value.startsWith('#')) {
        // Parse hex color and convert to rgba
        const hex = value.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        bgColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
      return {
        background: bgColor, // Use 'background' instead of 'backgroundColor' to override CSS gradients
      };
    case 'image':
      return {
        background: `url(${value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity,
      };
    case 'video':
      // Video backgrounds are handled separately in SlideView
      return {
        background: '#000000',
        opacity,
      };
    default:
      return { background: '#ffffff' };
  }
};

/**
 * Get position classes for overlay elements
 */
export const getPositionClasses = (
  position?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
): string => {
  // If no position specified, custom x/y will be used via inline styles
  if (!position) {
    return 'absolute';
  }
  
  const positionMap: Record<string, string> = {
    'top-left': 'top-0 left-0',
    'top-center': 'top-0 left-1/2 -translate-x-1/2',
    'top-right': 'top-0 right-0',
    'center-left': 'top-1/2 left-0 -translate-y-1/2',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'center-right': 'top-1/2 right-0 -translate-y-1/2',
    'bottom-left': 'bottom-0 left-0',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-0 right-0',
  };
  return `absolute ${positionMap[position] || ''}`;
};

/**
 * Get inline styles for positioned elements
 */
export const getElementStyles = (element: any): React.CSSProperties => {
  const styles: React.CSSProperties = {
    width: element.width,
    height: element.height,
    opacity: element.opacity ?? 1,
    zIndex: element.zIndex || 0,
  };

  // Add custom x/y positioning if provided
  if (element.x !== undefined) {
    styles.left = typeof element.x === 'number' ? `${element.x}px` : element.x;
  }
  if (element.y !== undefined) {
    styles.top = typeof element.y === 'number' ? `${element.y}px` : element.y;
  }

  return styles;
};

/**
 * Render template background
 */
export const TemplateBackground: React.FC<{ template: PresentationTemplate | null }> = ({ template }) => {
  if (!template?.background) {
    return null;
  }

  const { type, value } = template.background;

  if (type === 'video') {
    return (
      <video
        src={value}
        autoPlay
        loop
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: -1, opacity: template.background.opacity ?? 1 }}
      />
    );
  }

  return null; // Color and image backgrounds are handled via CSS
};

/**
 * Render image overlays
 */
export const TemplateImages: React.FC<{ template: PresentationTemplate | null }> = ({ template }) => {
  if (!template?.images || template.images.length === 0) {
    return null;
  }

  return (
    <>
      {template.images.map((image) => (
        <img
          key={image.id}
          src={image.url}
          alt={`overlay-${image.id}`}
          className={`absolute ${getPositionClasses(image.position)}`}
          style={getElementStyles(image)}
        />
      ))}
    </>
  );
};

/**
 * Render video overlays
 */
export const TemplateVideos: React.FC<{ template: PresentationTemplate | null }> = ({ template }) => {
  if (!template?.videos || template.videos.length === 0) {
    return null;
  }

  return (
    <>
      {template.videos.map((video) => (
        <video
          key={video.id}
          src={video.url}
          autoPlay={video.autoPlay ?? true}
          loop={video.loop ?? true}
          muted={video.muted ?? true}
          className={`absolute ${getPositionClasses(video.position)}`}
          style={getElementStyles(video)}
        />
      ))}
    </>
  );
};

/**
 * Render text overlays
 */
export const TemplateText: React.FC<{ template: PresentationTemplate | null }> = ({ template }) => {
  if (!template?.text || template.text.length === 0) {
    return null;
  }

  return (
    <>
      {template.text.map((textElement) => (
        <div
          key={textElement.id}
          className={`absolute ${getPositionClasses(textElement.position)}`}
          style={{
            ...getElementStyles(textElement),
            fontSize: textElement.fontSize,
            color: textElement.color,
            fontWeight: textElement.fontWeight,
            fontFamily: textElement.fontFamily,
            maxWidth: textElement.maxWidth,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            padding: '1rem',
          }}
        >
          {textElement.content}
        </div>
      ))}
    </>
  );
};

// =============================================================================
// Individual TemplateSlide helper functions (for multi-slide templates)
// These work with individual slide definitions rather than full templates
// =============================================================================

/**
 * Get CSS styles from a TemplateSlide's background element
 */
export const getSlideBackgroundStyles = (slide: TemplateSlide | null): React.CSSProperties => {
  if (!slide?.background) {
    return { background: '#ffffff' };
  }

  const { type, value, opacity = 1 } = slide.background;

  switch (type) {
    case 'color':
      let bgColor = value;
      if (opacity < 1 && value.startsWith('#')) {
        const hex = value.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        bgColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
      return { background: bgColor };
    case 'image':
      return {
        background: `url(${value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity,
      };
    case 'video':
      return { background: '#000000', opacity };
    default:
      return { background: '#ffffff' };
  }
};

/**
 * Render slide background (for individual TemplateSlide)
 */
export const SlideBackground: React.FC<{ templateSlide: TemplateSlide | null }> = ({ templateSlide }) => {
  if (!templateSlide?.background) {
    return null;
  }

  const { type, value } = templateSlide.background;

  if (type === 'video') {
    return (
      <video
        src={value}
        autoPlay
        loop
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: -1, opacity: templateSlide.background.opacity ?? 1 }}
      />
    );
  }

  return null;
};

/**
 * Render image overlays (for individual TemplateSlide)
 */
export const SlideImages: React.FC<{ templateSlide: TemplateSlide | null }> = ({ templateSlide }) => {
  if (!templateSlide?.images || templateSlide.images.length === 0) {
    return null;
  }

  return (
    <>
      {templateSlide.images.map((image) => (
        <img
          key={image.id}
          src={image.url}
          alt={`overlay-${image.id}`}
          className={`absolute ${getPositionClasses(image.position)}`}
          style={getElementStyles(image)}
        />
      ))}
    </>
  );
};

/**
 * Render video overlays (for individual TemplateSlide)
 */
export const SlideVideos: React.FC<{ templateSlide: TemplateSlide | null }> = ({ templateSlide }) => {
  if (!templateSlide?.videos || templateSlide.videos.length === 0) {
    return null;
  }

  return (
    <>
      {templateSlide.videos.map((video) => (
        <video
          key={video.id}
          src={video.url}
          autoPlay={video.autoPlay ?? true}
          loop={video.loop ?? true}
          muted={video.muted ?? true}
          className={`absolute ${getPositionClasses(video.position)}`}
          style={getElementStyles(video)}
        />
      ))}
    </>
  );
};

/**
 * Render text overlays (for individual TemplateSlide)
 */
export const SlideText: React.FC<{ templateSlide: TemplateSlide | null }> = ({ templateSlide }) => {
  if (!templateSlide?.text || templateSlide.text.length === 0) {
    return null;
  }

  return (
    <>
      {templateSlide.text.map((textElement) => (
        <div
          key={textElement.id}
          className={`absolute ${getPositionClasses(textElement.position)}`}
          style={{
            ...getElementStyles(textElement),
            fontSize: textElement.fontSize,
            color: textElement.color,
            fontWeight: textElement.fontWeight,
            fontFamily: textElement.fontFamily,
            maxWidth: textElement.maxWidth,
            textAlign: textElement.textAlign || 'center',
            whiteSpace: 'pre-wrap',
            padding: '1rem',
          }}
        >
          {textElement.content}
        </div>
      ))}
    </>
  );
};
