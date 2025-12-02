/**
 * Template rendering utilities for applying templates to presentation slides
 */

import type { PresentationTemplate, TemplateSlide } from '../types';
import { getFontFamily } from './fonts';

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

   // Apply rotation for elements that use explicit x/y positioning (no predefined position classes)
   // This avoids overriding Tailwind's transform-based centering for position-based elements.
   if (element.rotation !== undefined && !element.position) {
     styles.transform = `rotate(${element.rotation}deg)`;
     styles.transformOrigin = 'center center';
   }

  return styles;
};

// =============================================================================
// YouTube helper functions
// =============================================================================

/**
 * Check if URL is a YouTube video
 */
const isYouTubeUrl = (url?: string): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      (u.hostname.includes('youtube.com') && (u.searchParams.has('v') || u.pathname.includes('/shorts/'))) ||
      u.hostname === 'youtu.be'
    );
  } catch {
    return false;
  }
};

/**
 * Convert YouTube URL to embed format
 */
const getYouTubeEmbedUrl = (url: string, autoPlay: boolean): string => {
  try {
    const u = new URL(url);
    let videoId: string | null = null;

    if (u.hostname === 'youtu.be') {
      videoId = u.pathname.replace('/', '');
    } else if (u.hostname.includes('youtube.com')) {
      // Check for Shorts format: /shorts/VIDEO_ID
      if (u.pathname.includes('/shorts/')) {
        videoId = u.pathname.split('/shorts/')[1]?.split('/')[0] || null;
      } else {
        // Regular video format: ?v=VIDEO_ID
        videoId = u.searchParams.get('v');
      }
    }

    if (!videoId) {
      return url;
    }

    const params = new URLSearchParams({
      autoplay: autoPlay ? '1' : '0',
      mute: '0', // Allow audio
      loop: '1',
      playlist: videoId, // Required for looping to work
      controls: '1', // Show controls so user can unmute
      showinfo: '0',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
    });

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return url;
  }
};

// =============================================================================
// Template rendering components
// =============================================================================

/**
 * Render template background
 */
export const TemplateBackground: React.FC<{ template: PresentationTemplate | null }> = ({ template }) => {
  if (!template?.background) {
    return null;
  }

  const { type, value } = template.background;

  if (type === 'video') {
    const isYouTube = isYouTubeUrl(value);

    if (isYouTube) {
      return (
        <iframe
          src={getYouTubeEmbedUrl(value, true)}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: -1, opacity: template.background.opacity ?? 1, border: 'none' }}
          allow="autoplay; encrypted-media; picture-in-picture"
          title="Background video"
        />
      );
    }

    return (
      <video
        src={value}
        autoPlay
        loop
        muted
        playsInline
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
      {template.videos.map((video) => {
        const isYouTube = isYouTubeUrl(video.url);
        const autoPlay = video.autoPlay ?? true;
        const hideVideo = video.hideVideo ?? false;
        const hideAudio = video.hideAudio ?? false;
        const visualHidden = video.visualHidden ?? false;

        // If visualHidden or hideAudio is true, hide the entire element but still play audio
        if (visualHidden || hideAudio) {
          if (isYouTube) {
            return (
              <iframe
                key={video.id}
                src={getYouTubeEmbedUrl(video.url, autoPlay)}
                style={{ 
                  display: 'none',
                }}
                allow="autoplay; encrypted-media"
                title={`Hidden Video ${video.id}`}
              />
            );
          } else {
            return (
              <video
                key={video.id}
                src={video.url}
                autoPlay={autoPlay}
                loop={video.loop ?? true}
                muted={video.muted ?? true}
                playsInline
                style={{ display: 'none' }}
              />
            );
          }
        }

        if (hideVideo) {
          // For YouTube videos with hideVideo, show compact iframe for audio playback
          if (isYouTube) {
            const audioWidth = (video.width === '320px' || video.width === '200px') ? '1200px' : (video.width || '1200px');
            const elementStyles = getElementStyles(video);
            const isFullscreen = !!document.fullscreenElement;
            const topPosition = isFullscreen ? '-355px' : '-340px';
            return (
              <div
                key={video.id}
                className={`absolute ${getPositionClasses(video.position)}`}
                style={{
                  ...elementStyles,
                  top: topPosition,  // Position video off-screen, controls at top
                  height: '400px',  // Always 400px height
                  display: 'block',
                  width: audioWidth,
                  zIndex: Math.max(elementStyles.zIndex || 0, 1),  // Ensure visible
                  overflow: 'visible',
                }}
              >
                <iframe
                  src={getYouTubeEmbedUrl(video.url, autoPlay)}
                  className="w-full h-full"
                  style={{ 
                    border: 'none',
                  }}
                  allow="autoplay; encrypted-media"
                  title={`Audio ${video.id}`}
                />
              </div>
            );
          }
          
          // For regular video files, render as audio with controls
          const audioWidth = (video.width === '320px' || video.width === '200px') ? '1200px' : (video.width || '1200px');
          const elementStyles = getElementStyles(video);
          return (
            <div
              key={video.id}
              className={`absolute ${getPositionClasses(video.position)}`}
              style={{
                ...elementStyles,
                display: 'block',
                width: audioWidth,  // Override small widths with 1200px
                zIndex: Math.max(elementStyles.zIndex || 0, 1),  // Ensure visible
              }}
            >
              <audio
                src={video.url}
                autoPlay={autoPlay}
                loop={video.loop ?? true}
                controls
                className="w-full"
                style={{
                  height: video.height || 'auto',
                }}
              />
            </div>
          );
        }

        if (isYouTube) {
          return (
            <iframe
              key={video.id}
              src={getYouTubeEmbedUrl(video.url, autoPlay)}
              className={`absolute ${getPositionClasses(video.position)}`}
              style={{ ...getElementStyles(video), border: 'none' }}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title={`Video ${video.id}`}
            />
          );
        }

        return (
          <video
            key={video.id}
            src={video.url}
            autoPlay={autoPlay}
            loop={video.loop ?? true}
            muted={video.muted ?? true}
            playsInline
            className={`absolute ${getPositionClasses(video.position)}`}
            style={getElementStyles(video)}
          />
        );
      })}
    </>
  );
};

/**
 * Render audio elements
 */
export const TemplateAudios: React.FC<{ template: PresentationTemplate | null }> = ({ template }) => {
  if (!template?.audios || template.audios.length === 0) {
    return null;
  }

  return (
    <>
      {template.audios.map((audio) => {
        const autoPlay = audio.autoPlay ?? true;
        const visualHidden = audio.visualHidden ?? false;

        return (
          <div
            key={audio.id}
            className={`absolute ${getPositionClasses(audio.position)}`}
            style={{
              ...getElementStyles(audio),
              width: audio.width || '1200px',
              display: 'block',
            }}
          >
            <audio
              src={audio.url}
              autoPlay={autoPlay}
              loop={audio.loop ?? false}
              controls={!visualHidden}
              className="w-full"
              style={{
                height: audio.height || 'auto',
                display: visualHidden ? 'none' : 'block',
              }}
            />
          </div>
        );
      })}
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
      {template.text.map((textElement) => {
        // Build text box styles: position first (x/y), then dimensions (width/height)
        const boxStyles: React.CSSProperties = {
          opacity: textElement.opacity ?? 1,
          zIndex: textElement.zIndex || 0,
        };

        // Position: use explicit x/y if provided
        if (textElement.x !== undefined) {
          boxStyles.left = typeof textElement.x === 'number' ? `${textElement.x}px` : textElement.x;
        }
        if (textElement.y !== undefined) {
          boxStyles.top = typeof textElement.y === 'number' ? `${textElement.y}px` : textElement.y;
        }

        // Dimensions: width controls text wrapping, height is auto-sized like Konva
        if (textElement.width) {
          boxStyles.width = typeof textElement.width === 'number' ? `${textElement.width}px` : textElement.width;
        } else if (textElement.maxWidth) {
          // Fallback to maxWidth for backward compatibility
          boxStyles.width = textElement.maxWidth;
        }
        // Note: We don't set a fixed height for text - Konva auto-sizes height based on content,
        // so we let CSS do the same. This ensures all lines of text are visible.

        // Rotation (only for explicit x/y positioned elements)
        if (textElement.rotation !== undefined && !textElement.position) {
          boxStyles.transform = `rotate(${textElement.rotation}deg)`;
          boxStyles.transformOrigin = 'center center';
        }

        // Text styling - match Konva canvas rendering
        boxStyles.fontSize = textElement.fontSize;
        boxStyles.color = textElement.color;
        boxStyles.fontWeight = textElement.fontWeight;
        boxStyles.fontStyle = textElement.fontStyle || 'normal';
        boxStyles.fontFamily = getFontFamily(textElement.fontFamily);
        boxStyles.textAlign = textElement.textAlign || 'center';
        boxStyles.whiteSpace = 'pre-wrap';
        // Konva uses lineHeight of 1.0 by default (font size = line height)
        boxStyles.lineHeight = 1;

        return (
          <div
            key={textElement.id}
            className={`absolute ${getPositionClasses(textElement.position)}`}
            style={boxStyles}
          >
            {textElement.content}
          </div>
        );
      })}
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
 * - HTML5 videos use <video>.
 * - YouTube URLs are rendered via an <iframe> embed.
 */
export const SlideVideos: React.FC<{ templateSlide: TemplateSlide | null }> = ({
  templateSlide,
}) => {
  if (!templateSlide?.videos || templateSlide.videos.length === 0) {
    return null;
  }

  return (
    <>
      {templateSlide.videos.map((video) => {
        const autoPlay = video.autoPlay ?? true;
        const baseStyles = getElementStyles(video);
        const width = video.width || '320px';
        const height = video.height || '180px';
        const isYouTube = isYouTubeUrl(video.url);
        const hideVideo = video.hideVideo ?? false;
        const hideAudio = video.hideAudio ?? false;
        const visualHidden = video.visualHidden ?? false;

        // If visualHidden or hideAudio is true, hide the entire element but still play audio
        if (visualHidden || hideAudio) {
          if (isYouTube) {
            return (
              <iframe
                key={video.id}
                src={getYouTubeEmbedUrl(video.url, autoPlay)}
                style={{ 
                  display: 'none',
                }}
                allow="autoplay; encrypted-media"
                title={`Hidden Video ${video.id}`}
              />
            );
          } else {
            return (
              <video
                key={video.id}
                src={video.url}
                autoPlay={autoPlay}
                loop={video.loop ?? true}
                muted={video.muted ?? true}
                playsInline
                style={{ display: 'none' }}
              />
            );
          }
        }

        if (hideVideo) {
          // For YouTube videos with hideVideo, we can't extract audio easily
          // Show a message or use iframe hidden (audio still plays)
          if (isYouTube) {
            const audioWidth = (video.width === '320px' || video.width === '200px') ? '1200px' : (video.width || '1200px');
            const isFullscreen = !!document.fullscreenElement;
            const topPosition = isFullscreen ? '-355px' : '-340px';
            return (
              <div
                key={video.id}
                className={`absolute ${getPositionClasses(video.position)}`}
                style={{
                  ...baseStyles,
                  top: topPosition,  // Position video off-screen, controls at top
                  height: '400px',  // Always 400px height
                  width: audioWidth,  // Override width after baseStyles
                  display: 'block',
                  zIndex: Math.max(baseStyles.zIndex || 0, 1),  // Ensure visible
                  overflow: 'visible',
                }}
              >
                <iframe
                  src={getYouTubeEmbedUrl(video.url, autoPlay)}
                  className="w-full h-full"
                  style={{ 
                    border: 'none',
                  }}
                  allow="autoplay; encrypted-media"
                  title={`Audio ${video.id}`}
                />
              </div>
            );
          }
          
          // For regular video files, render as audio with controls
          const audioWidth = (video.width === '320px' || video.width === '200px') ? '1200px' : (video.width || '1200px');
          return (
            <div
              key={video.id}
              className={`absolute ${getPositionClasses(video.position)}`}
              style={{
                ...baseStyles,
                display: 'block',
                width: audioWidth,  // Override small widths with 1200px
                zIndex: Math.max(baseStyles.zIndex || 0, 1),  // Ensure visible
              }}
            >
              <audio
                src={video.url}
                autoPlay={autoPlay}
                loop={video.loop ?? true}
                controls
                className="w-full"
                style={{
                  height: video.height || 'auto',
                }}
              />
            </div>
          );
        }

        return (
          <div
            key={video.id}
            className={`absolute ${getPositionClasses(video.position)}`}
            style={{
              ...baseStyles,
              width,
              height,
              backgroundColor: '#000',
            }}
          >
            {isYouTube && video.url ? (
              <iframe
                src={getYouTubeEmbedUrl(video.url, autoPlay)}
                className="w-full h-full"
                style={{ 
                  border: 'none',
                }}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={`Video ${video.id}`}
              />
            ) : (
              <video
                src={video.url}
                autoPlay={autoPlay}
                loop={video.loop ?? true}
                muted={video.muted ?? true}
                playsInline
                controls={!autoPlay}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        );
      })}
    </>
  );
};

/**
 * Render audio elements (for individual TemplateSlide)
 */
export const SlideAudios: React.FC<{ templateSlide: TemplateSlide | null }> = ({ templateSlide }) => {
  if (!templateSlide?.audios || templateSlide.audios.length === 0) {
    return null;
  }

  return (
    <>
      {templateSlide.audios.map((audio) => {
        const autoPlay = audio.autoPlay ?? true;
        const visualHidden = audio.visualHidden ?? false;
        const baseStyles = getElementStyles(audio);

        return (
          <div
            key={audio.id}
            className={`absolute ${getPositionClasses(audio.position)}`}
            style={{
              ...baseStyles,
              width: audio.width || '1200px',
              display: 'block',
            }}
          >
            <audio
              src={audio.url}
              autoPlay={autoPlay}
              loop={audio.loop ?? false}
              controls={!visualHidden}
              className="w-full"
              style={{
                height: audio.height || 'auto',
                display: visualHidden ? 'none' : 'block',
              }}
            />
          </div>
        );
      })}
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
      {templateSlide.text.map((textElement) => {
        // Build text box styles: position first (x/y), then dimensions (width/height)
        const boxStyles: React.CSSProperties = {
          opacity: textElement.opacity ?? 1,
          zIndex: textElement.zIndex || 0,
        };

        // Position: use explicit x/y if provided
        if (textElement.x !== undefined) {
          boxStyles.left = typeof textElement.x === 'number' ? `${textElement.x}px` : textElement.x;
        }
        if (textElement.y !== undefined) {
          boxStyles.top = typeof textElement.y === 'number' ? `${textElement.y}px` : textElement.y;
        }

        // Dimensions: width controls text wrapping, height is auto-sized like Konva
        if (textElement.width) {
          boxStyles.width = typeof textElement.width === 'number' ? `${textElement.width}px` : textElement.width;
        } else if (textElement.maxWidth) {
          // Fallback to maxWidth for backward compatibility
          boxStyles.width = textElement.maxWidth;
        }
        // Note: We don't set a fixed height for text - Konva auto-sizes height based on content,
        // so we let CSS do the same. This ensures all lines of text are visible.

        // Rotation (only for explicit x/y positioned elements)
        if (textElement.rotation !== undefined && !textElement.position) {
          boxStyles.transform = `rotate(${textElement.rotation}deg)`;
          boxStyles.transformOrigin = 'center center';
        }

        // Text styling - match Konva canvas rendering
        boxStyles.fontSize = textElement.fontSize;
        boxStyles.color = textElement.color;
        boxStyles.fontWeight = textElement.fontWeight;
        boxStyles.fontStyle = textElement.fontStyle || 'normal';
        boxStyles.fontFamily = getFontFamily(textElement.fontFamily);
        boxStyles.textAlign = textElement.textAlign || 'center';
        boxStyles.whiteSpace = 'pre-wrap';
        // Konva uses lineHeight of 1.0 by default (font size = line height)
        boxStyles.lineHeight = 1;

        return (
          <div
            key={textElement.id}
            className={`absolute ${getPositionClasses(textElement.position)}`}
            style={boxStyles}
          >
            {textElement.content}
          </div>
        );
      })}
    </>
  );
};
