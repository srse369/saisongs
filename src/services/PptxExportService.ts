import pptxgen from 'pptxgenjs';
import type { PresentationTemplate, TemplateSlide, TextElement, ImageElement, VideoElement, AudioElement, AspectRatio, Slide } from '../types';
import { ASPECT_RATIO_DIMENSIONS } from '../types';
import { API_BASE_URL } from './ApiClient';
import { formatPitch } from '../utils/pitchUtils';

// Text run with formatting for pptxgenjs
interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

/**
 * Service to export templates to PowerPoint format
 */
class PptxExportService {
  /**
   * Get the base URL for media files
   * Uses API_BASE_URL for relative paths (like /pptx-media/...)
   */
  private getMediaBaseUrl(): string {
    // API_BASE_URL already includes the correct server origin
    // Remove any trailing /api if present
    return API_BASE_URL.replace(/\/api\/?$/, '');
  }

  /**
   * Resolve a URL to a full absolute URL
   */
  private resolveUrl(url: string): string {
    if (!url) return url;
    
    // Already absolute or data URL
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    
    // Relative URL - prepend media base URL
    const baseUrl = this.getMediaBaseUrl();
    return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
  }

  /**
   * Check if a URL is external (different domain)
   */
  private isExternalUrl(url: string): boolean {
    if (!url || url.startsWith('data:')) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname !== window.location.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Get the proxy URL for external media
   */
  private getProxyUrl(externalUrl: string): string {
    const baseUrl = this.getMediaBaseUrl();
    return `${baseUrl}/api/proxy-media?url=${encodeURIComponent(externalUrl)}`;
  }

  /**
   * Validate and sanitize a hex color value
   * Returns a valid 6-character hex string without #, or a default color
   */
  private sanitizeColor(color: string | undefined, defaultColor: string = '000000'): string {
    if (!color) return defaultColor;
    
    // Remove # prefix if present
    let hex = color.replace(/^#/, '');
    
    // If it's a 3-character hex, expand to 6
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    // Validate it's a proper 6-character hex
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
      console.warn(`Invalid color value: ${color}, using default: ${defaultColor}`);
      return defaultColor;
    }
    
    return hex.toUpperCase();
  }

  /**
   * Validate a dimension value - must be a finite positive number
   */
  private sanitizeDimension(value: number, defaultValue: number = 0, minValue: number = 0): number {
    if (!Number.isFinite(value) || value < minValue) {
      return defaultValue;
    }
    return value;
  }

  /**
   * Validate base64 image data
   */
  private isValidBase64Image(data: string): boolean {
    if (!data) return false;
    // Check for proper data URL format
    if (!data.startsWith('data:image/')) return false;
    // Check it has base64 content
    if (!data.includes('base64,')) return false;
    // Check the base64 part isn't empty
    const base64Part = data.split('base64,')[1];
    return !!base64Part && base64Part.length > 100; // Reasonable minimum for an image
  }

  /**
   * Validate base64 media data (video/audio)
   */
  private isValidBase64Media(data: string): boolean {
    if (!data) return false;
    // Check for proper data URL format
    if (!data.startsWith('data:')) return false;
    // Check it has base64 content
    if (!data.includes('base64,')) return false;
    // Check the base64 part isn't empty
    const base64Part = data.split('base64,')[1];
    return !!base64Part && base64Part.length > 50;
  }
  /**
   * Convert a template to a PowerPoint file and trigger download
   */
  async exportTemplate(template: PresentationTemplate): Promise<void> {
    const pptx = new pptxgen();

    // Set presentation properties
    pptx.author = 'Sai Devotional Song Studio';
    pptx.title = template.name;
    pptx.subject = template.description || 'Presentation Template';
    pptx.company = 'Sai Devotional Song Studio';

    // Get aspect ratio and dimensions
    const aspectRatio: AspectRatio = template.aspectRatio || '16:9';
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    
    // PowerPoint uses inches - standard sizes:
    // 16:9 = 10" x 5.625"
    // 4:3 = 10" x 7.5"
    const slideWidthInches = 10;
    const slideHeightInches = aspectRatio === '4:3' ? 7.5 : 5.625;
    
    pptx.defineLayout({ name: 'CUSTOM', width: slideWidthInches, height: slideHeightInches });
    pptx.layout = 'CUSTOM';

    // Process each slide
    const slides = template.slides || [];
    const referenceSlideIndex = template.referenceSlideIndex ?? 0;
    
    if (slides.length === 0) {
      // Handle legacy single-slide template
      if (template.background || template.text || template.images) {
        const legacySlide: TemplateSlide = {
          background: template.background,
          images: template.images,
          text: template.text,
        };
        await this.addSlide(pptx, legacySlide, dimensions, slideWidthInches, slideHeightInches, true);
      } else {
        // Create a default slide if no slides exist
        const slide = pptx.addSlide();
        slide.addText('No slides in template', {
          x: 0.5,
          y: slideHeightInches / 2 - 0.5,
          w: slideWidthInches - 1,
          h: 1,
          fontSize: 24,
          color: '363636',
          align: 'center',
        });
      }
    } else {
      for (let i = 0; i < slides.length; i++) {
        const slideTemplate = slides[i];
        const isReferenceSlide = i === referenceSlideIndex;
        await this.addSlide(pptx, slideTemplate, dimensions, slideWidthInches, slideHeightInches, isReferenceSlide);
      }
    }

    // Generate and download the file
    const fileName = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
    await pptx.writeFile({ fileName });
  }

  /**
   * Export a session (array of Slide objects with song content) to PowerPoint
   * This creates slides with actual song lyrics, singer names, and pitch info
   */
  async exportSession(
    sessionSlides: Slide[],
    template: PresentationTemplate | null,
    sessionName: string = 'Session'
  ): Promise<void> {
    const pptx = new pptxgen();

    // Set presentation properties
    pptx.author = 'Sai Devotional Song Studio';
    pptx.title = sessionName;
    pptx.subject = 'Session Presentation';
    pptx.company = 'Sai Devotional Song Studio';

    // Get aspect ratio and dimensions from template
    const aspectRatio: AspectRatio = template?.aspectRatio || '16:9';
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    
    const slideWidthInches = 10;
    const slideHeightInches = aspectRatio === '4:3' ? 7.5 : 5.625;
    
    pptx.defineLayout({ name: 'CUSTOM', width: slideWidthInches, height: slideHeightInches });
    pptx.layout = 'CUSTOM';

    // Get reference slide template for song content styling
    const referenceSlideIndex = template?.referenceSlideIndex ?? 0;
    const referenceSlide = template?.slides?.[referenceSlideIndex];
    
    // Log template audio info for debugging
    console.log('Template backgroundAudio:', template?.backgroundAudio ? 'Yes' : 'No');
    template?.slides?.forEach((s, i) => {
      console.log(`Template slide ${i}: ${s.audios?.length || 0} audios`);
    });

    // Process each session slide
    for (let i = 0; i < sessionSlides.length; i++) {
      const sessionSlide = sessionSlides[i];
      const isFirstSlide = i === 0;
      
      // For static slides (intro/outro), use their own templateSlide
      // For song slides, use the reference slide
      const slideTemplate = sessionSlide.slideType === 'static' 
        ? sessionSlide.templateSlide 
        : referenceSlide;
      
      await this.addSessionSlide(
        pptx,
        sessionSlide,
        slideTemplate,
        referenceSlide,
        template,
        dimensions,
        slideWidthInches,
        slideHeightInches,
        isFirstSlide
      );
    }

    // Generate and download the file
    const fileName = `${sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
    await pptx.writeFile({ fileName });
  }

  /**
   * Add a session slide with song content
   * @param slideTemplate - The template for this specific slide (could be intro/outro or reference slide)
   * @param referenceSlide - The reference slide used for song content styling
   * @param isFirstSlide - Whether this is the first slide (for adding background audio)
   */
  private async addSessionSlide(
    pptx: pptxgen,
    sessionSlide: Slide,
    slideTemplate: TemplateSlide | undefined,
    referenceSlide: TemplateSlide | undefined,
    template: PresentationTemplate | null,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number,
    isFirstSlide: boolean = false
  ): Promise<void> {
    const slide = pptx.addSlide();

    // Use slideTemplate for the visual layout (background, images, text, etc.)
    // Add background from slide template
    if (slideTemplate?.background) {
      if (slideTemplate.background.type === 'color') {
        const color = this.sanitizeColor(slideTemplate.background.value, '000000');
        slide.background = { color };
      } else if (slideTemplate.background.type === 'image' && slideTemplate.background.value) {
        try {
          const imageUrl = slideTemplate.background.value;
          let imageData: string | undefined;
          
          if (imageUrl.startsWith('data:')) {
            if (this.isValidBase64Image(imageUrl)) {
              imageData = imageUrl;
            }
          } else {
            imageData = await this.imageUrlToBase64(imageUrl);
          }

          if (imageData && this.isValidBase64Image(imageData)) {
            slide.addImage({
              data: imageData,
              x: 0,
              y: 0,
              w: slideWidthInches,
              h: slideHeightInches,
              sizing: { type: 'cover', w: slideWidthInches, h: slideHeightInches },
            });
          } else {
            slide.background = { color: '1A1A2E' };
          }
        } catch (error) {
          console.warn('Failed to add background image:', error);
          slide.background = { color: '1A1A2E' };
        }
      }
    } else {
      // Default dark background
      slide.background = { color: '1A1A2E' };
    }

    // Add template images from this slide's template
    const images = slideTemplate?.images || [];
    for (const image of images) {
      await this.addImage(slide, image, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Add template text elements from this slide's template
    const textElements = slideTemplate?.text || [];
    for (const text of textElements) {
      this.addText(slide, text, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Add template videos from this slide's template
    const videos = slideTemplate?.videos || [];
    for (const video of videos) {
      await this.addVideo(slide, video, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Add template audios from this slide's template
    const audios = slideTemplate?.audios || [];
    console.log(`Slide ${sessionSlide.index}: Found ${audios.length} audio elements, slideType: ${sessionSlide.slideType}`);
    for (const audio of audios) {
      console.log(`  Audio: ${audio.url?.substring(0, 50)}...`);
      await this.addAudio(slide, audio, templateDimensions, slideWidthInches, slideHeightInches);
    }
    
    // Add template-level backgroundAudio to the first slide
    if (isFirstSlide && template?.backgroundAudio) {
      console.log('Adding template backgroundAudio to first slide');
      await this.addAudio(slide, template.backgroundAudio, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Only add song content for song slides (not static intro/outro slides)
    if (sessionSlide.slideType !== 'static') {
      // Use referenceSlide for song content styling
      this.addSongContent(slide, sessionSlide, referenceSlide, templateDimensions, slideWidthInches, slideHeightInches);
    }
  }

  /**
   * Add song content (lyrics, title, translation) to a slide
   */
  private addSongContent(
    slide: pptxgen.Slide,
    sessionSlide: Slide,
    referenceSlide: TemplateSlide | undefined,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number
  ): void {
    // Default styles if template doesn't have them
    const defaultTitleStyle = {
      x: 40, y: 54, width: templateDimensions.width - 80, height: 100,
      fontSize: '48px', fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'Arial',
      textAlign: 'center', color: '#ffffff',
    };
    const defaultLyricsStyle = {
      x: 40, y: 180, width: templateDimensions.width - 80, height: templateDimensions.height - 300,
      fontSize: '36px', fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'Arial',
      textAlign: 'center', color: '#ffffff',
    };
    const defaultTranslationStyle = {
      x: 40, y: templateDimensions.height - 150, width: templateDimensions.width - 80, height: 120,
      fontSize: '24px', fontWeight: 'normal', fontStyle: 'normal', fontFamily: 'Arial',
      textAlign: 'center', color: '#cccccc',
    };

    // Song Title - only the song name, no singer/pitch (that goes in bottom left)
    const titleStyle = referenceSlide?.songTitleStyle || defaultTitleStyle;
    if (sessionSlide.songName) {
      const x = this.round((titleStyle.x / templateDimensions.width) * slideWidthInches);
      const y = this.round((titleStyle.y / templateDimensions.height) * slideHeightInches);
      const w = this.round((titleStyle.width / templateDimensions.width) * slideWidthInches);
      const h = titleStyle.height 
        ? this.round((titleStyle.height / templateDimensions.height) * slideHeightInches)
        : 0.5;
      
      const fontSizePt = this.parseFontSize(titleStyle.fontSize, templateDimensions.height, slideHeightInches);
      
      slide.addText(sessionSlide.songName, {
        x: this.sanitizeDimension(x, 0),
        y: this.sanitizeDimension(y, 0),
        w: this.sanitizeDimension(w, 2, 0.1),
        h: this.sanitizeDimension(h, 0.5, 0.1),
        fontSize: Math.max(8, Math.min(fontSizePt, 72)),
        color: this.sanitizeColor(titleStyle.color, 'FFFFFF'),
        fontFace: titleStyle.fontFamily || 'Arial',
        bold: titleStyle.fontWeight === 'bold',
        italic: titleStyle.fontStyle === 'italic',
        align: (titleStyle.textAlign as 'left' | 'center' | 'right') || 'center',
        valign: 'top',
        margin: 0,
      });
    }

    // Song Lyrics
    const lyricsStyle = referenceSlide?.songLyricsStyle || defaultLyricsStyle;
    if (sessionSlide.content) {
      const x = this.round((lyricsStyle.x / templateDimensions.width) * slideWidthInches);
      const y = this.round((lyricsStyle.y / templateDimensions.height) * slideHeightInches);
      const w = this.round((lyricsStyle.width / templateDimensions.width) * slideWidthInches);
      const h = lyricsStyle.height 
        ? this.round((lyricsStyle.height / templateDimensions.height) * slideHeightInches)
        : 2;
      
      const fontSizePt = this.parseFontSize(lyricsStyle.fontSize, templateDimensions.height, slideHeightInches);
      const defaultColor = this.sanitizeColor(lyricsStyle.color, 'FFFFFF');
      
      // Parse formatted lyrics text
      const textRuns = this.parseFormattedText(sessionSlide.content, defaultColor);
      
      if (textRuns.length > 0) {
        const pptxRuns = this.textRunsToPptx(textRuns, defaultColor, lyricsStyle.fontFamily || 'Arial', Math.max(8, Math.min(fontSizePt, 60)));
        
        slide.addText(pptxRuns, {
          x: this.sanitizeDimension(x, 0),
          y: this.sanitizeDimension(y, 0),
          w: this.sanitizeDimension(w, 2, 0.1),
          h: this.sanitizeDimension(h, 2, 0.1),
          align: (lyricsStyle.textAlign as 'left' | 'center' | 'right') || 'center',
          valign: 'top',
          margin: 0,
        });
      }
    }

    // Song Translation
    const translationStyle = referenceSlide?.songTranslationStyle || defaultTranslationStyle;
    if (sessionSlide.translation) {
      const x = this.round((translationStyle.x / templateDimensions.width) * slideWidthInches);
      const y = this.round((translationStyle.y / templateDimensions.height) * slideHeightInches);
      const w = this.round((translationStyle.width / templateDimensions.width) * slideWidthInches);
      const h = translationStyle.height 
        ? this.round((translationStyle.height / templateDimensions.height) * slideHeightInches)
        : 1;
      
      const fontSizePt = this.parseFontSize(translationStyle.fontSize, templateDimensions.height, slideHeightInches);
      const defaultColor = this.sanitizeColor(translationStyle.color, 'CCCCCC');
      
      // Parse formatted translation text
      const textRuns = this.parseFormattedText(sessionSlide.translation, defaultColor);
      
      if (textRuns.length > 0) {
        const pptxRuns = this.textRunsToPptx(textRuns, defaultColor, translationStyle.fontFamily || 'Arial', Math.max(6, Math.min(fontSizePt, 36)));
        
        slide.addText(pptxRuns, {
          x: this.sanitizeDimension(x, 0),
          y: this.sanitizeDimension(y, 0),
          w: this.sanitizeDimension(w, 2, 0.1),
          h: this.sanitizeDimension(h, 1, 0.1),
          align: (translationStyle.textAlign as 'left' | 'center' | 'right') || 'center',
          valign: 'top',
          margin: 0,
        });
      }
    }

    // Current Song Info (bottom left) - shows "Current: {singer} - {formattedPitch} ({pitch})"
    // Matches SlideView.tsx format exactly with semi-transparent dark background
    const bottomLeftStyle = referenceSlide?.bottomLeftTextStyle;
    if (bottomLeftStyle && (sessionSlide.singerName || sessionSlide.pitch)) {
      // Build text runs - regular text and bold pitch
      const textParts: pptxgen.TextProps[] = [];
      // Use direct font size conversion for UI elements (not proportional scaling)
      const fontSizePt = this.parseFontSizeDirect(bottomLeftStyle.fontSize);
      const textColor = this.sanitizeColor(bottomLeftStyle.color, 'FFFFFF');
      const fontFace = bottomLeftStyle.fontFamily || 'Arial';
      
      // "Current: {singerName}"
      let regularText = 'Current:';
      if (sessionSlide.singerName) {
        regularText += ` ${sessionSlide.singerName}`;
      }
      if (sessionSlide.singerName && sessionSlide.pitch) {
        regularText += ' - ';
      }
      
      textParts.push({
        text: regularText,
        options: { fontSize: fontSizePt, color: textColor, fontFace, bold: false }
      });
      
      // Pitch part is bold
      if (sessionSlide.pitch) {
        const formattedPitch = sessionSlide.pitch.includes(' / ')
          ? sessionSlide.pitch.split(' / ').map(p => formatPitch(p.trim())).join(' / ')
          : formatPitch(sessionSlide.pitch);
        const displayPitch = sessionSlide.pitch.replace(/#/g, '♯');
        
        textParts.push({
          text: `${formattedPitch} (${displayPitch})`,
          options: { fontSize: fontSizePt, color: textColor, fontFace, bold: true }
        });
      }
      
      const x = this.round((bottomLeftStyle.x / templateDimensions.width) * slideWidthInches);
      const y = this.round((bottomLeftStyle.y / templateDimensions.height) * slideHeightInches);
      const w = this.round((bottomLeftStyle.width / templateDimensions.width) * slideWidthInches);
      const h = bottomLeftStyle.height 
        ? this.round((bottomLeftStyle.height / templateDimensions.height) * slideHeightInches)
        : 0.4;
      
      slide.addText(textParts, {
        x: this.sanitizeDimension(x, 0),
        y: this.sanitizeDimension(y, 0),
        w: this.sanitizeDimension(w, 2, 0.1),
        h: this.sanitizeDimension(h, 0.4, 0.1),
        align: 'left', // Current song is always left aligned
        valign: 'top',
        margin: [0.05, 0.1, 0.05, 0.1], // top, right, bottom, left padding
        fill: { color: '111827', transparency: 50 }, // bg-gray-900 with 50% transparency
        shape: 'roundRect',
        rectRadius: 0.1,
      });
    }

    // Next Song Info (bottom right) - shows "Next: {songName} - {singer} - {formattedPitch} ({pitch})"
    // Matches SlideView.tsx format exactly with semi-transparent dark background
    const bottomRightStyle = referenceSlide?.bottomRightTextStyle;
    if (bottomRightStyle && sessionSlide.nextSongName) {
      const textParts: pptxgen.TextProps[] = [];
      // Use direct font size conversion for UI elements (not proportional scaling)
      const fontSizePt = this.parseFontSizeDirect(bottomRightStyle.fontSize);
      const textColor = this.sanitizeColor(bottomRightStyle.color, 'FFFFFF');
      const fontFace = bottomRightStyle.fontFamily || 'Arial';
      
      if (sessionSlide.nextIsContinuation) {
        // Continuation: "Next: {songName} (contd.)"
        textParts.push({
          text: `Next: ${sessionSlide.nextSongName} (contd.)`,
          options: { fontSize: fontSizePt, color: textColor, fontFace, bold: false }
        });
      } else {
        // Regular text: "Next: {songName} - {singer} - "
        let regularText = `Next: ${sessionSlide.nextSongName}`;
        if (sessionSlide.nextSingerName) {
          regularText += ` - ${sessionSlide.nextSingerName}`;
        }
        if (sessionSlide.nextPitch) {
          regularText += ' - ';
        }
        
        textParts.push({
          text: regularText,
          options: { fontSize: fontSizePt, color: textColor, fontFace, bold: false }
        });
        
        // Pitch part is bold
        if (sessionSlide.nextPitch) {
          const formattedPitch = sessionSlide.nextPitch.includes(' / ')
            ? sessionSlide.nextPitch.split(' / ').map(p => formatPitch(p.trim())).join(' / ')
            : formatPitch(sessionSlide.nextPitch);
          const displayPitch = sessionSlide.nextPitch.replace(/#/g, '♯');
          
          textParts.push({
            text: `${formattedPitch} (${displayPitch})`,
            options: { fontSize: fontSizePt, color: textColor, fontFace, bold: true }
          });
        }
      }
      
      const x = this.round((bottomRightStyle.x / templateDimensions.width) * slideWidthInches);
      const y = this.round((bottomRightStyle.y / templateDimensions.height) * slideHeightInches);
      const w = this.round((bottomRightStyle.width / templateDimensions.width) * slideWidthInches);
      const h = bottomRightStyle.height 
        ? this.round((bottomRightStyle.height / templateDimensions.height) * slideHeightInches)
        : 0.4;
      
      slide.addText(textParts, {
        x: this.sanitizeDimension(x, 0),
        y: this.sanitizeDimension(y, 0),
        w: this.sanitizeDimension(w, 2, 0.1),
        h: this.sanitizeDimension(h, 0.4, 0.1),
        align: 'right', // Next song is always right aligned
        valign: 'middle',
        margin: [0.05, 0.1, 0.05, 0.1], // top, right, bottom, left padding
        fill: { color: '111827', transparency: 50 }, // bg-gray-900 with 50% transparency
        shape: 'roundRect',
        rectRadius: 0.1,
      });
    }
  }

  /**
   * Parse text with formatting tags into text runs
   * Supports: <b>bold</b>, <i>italic</i>, <c:RRGGBB>color</c:RRGGBB>, <br>
   */
  private parseFormattedText(text: string, defaultColor?: string): TextRun[] {
    if (!text) return [];
    
    const runs: TextRun[] = [];
    let remaining = text;
    
    // Replace <br> and <br/> with newlines
    remaining = remaining.replace(/<br\s*\/?>/gi, '\n');
    
    // Replace <p> tags
    remaining = remaining.replace(/<p\s*>/gi, '');
    remaining = remaining.replace(/<\/p\s*>/gi, '\n');
    
    // Process nested tags recursively
    const processSegment = (segment: string, inheritedBold: boolean, inheritedItalic: boolean, inheritedColor?: string): TextRun[] => {
      const result: TextRun[] = [];
      let pos = 0;
      
      while (pos < segment.length) {
        // Find the next tag
        const boldMatch = segment.substring(pos).match(/^<b>(.*?)<\/b>/is);
        const italicMatch = segment.substring(pos).match(/^<i>(.*?)<\/i>/is);
        const colorMatch = segment.substring(pos).match(/^<c:([0-9a-fA-F]{6})>(.*?)<\/c:[0-9a-fA-F]{6}>/is);
        
        // Check if any tag starts at current position
        if (boldMatch) {
          const innerRuns = processSegment(boldMatch[1], true, inheritedItalic, inheritedColor);
          result.push(...innerRuns);
          pos += boldMatch[0].length;
        } else if (italicMatch) {
          const innerRuns = processSegment(italicMatch[1], inheritedBold, true, inheritedColor);
          result.push(...innerRuns);
          pos += italicMatch[0].length;
        } else if (colorMatch) {
          const color = colorMatch[1].toUpperCase();
          const innerRuns = processSegment(colorMatch[2], inheritedBold, inheritedItalic, color);
          result.push(...innerRuns);
          pos += colorMatch[0].length;
        } else {
          // Find the next tag or end of string
          let nextTagPos = segment.length;
          const nextBold = segment.substring(pos).search(/<b>/i);
          const nextItalic = segment.substring(pos).search(/<i>/i);
          const nextColor = segment.substring(pos).search(/<c:[0-9a-fA-F]{6}>/i);
          
          if (nextBold !== -1 && pos + nextBold < nextTagPos) nextTagPos = pos + nextBold;
          if (nextItalic !== -1 && pos + nextItalic < nextTagPos) nextTagPos = pos + nextItalic;
          if (nextColor !== -1 && pos + nextColor < nextTagPos) nextTagPos = pos + nextColor;
          
          // Extract plain text up to next tag
          const plainText = segment.substring(pos, nextTagPos);
          if (plainText) {
            result.push({
              text: plainText,
              bold: inheritedBold,
              italic: inheritedItalic,
              color: inheritedColor,
            });
          }
          pos = nextTagPos;
        }
      }
      
      return result;
    };
    
    const parsedRuns = processSegment(remaining, false, false, defaultColor);
    
    // Merge consecutive runs with same formatting
    for (const run of parsedRuns) {
      if (runs.length > 0) {
        const lastRun = runs[runs.length - 1];
        if (lastRun.bold === run.bold && 
            lastRun.italic === run.italic && 
            lastRun.color === run.color) {
          lastRun.text += run.text;
          continue;
        }
      }
      runs.push(run);
    }
    
    return runs;
  }

  /**
   * Convert text runs to pptxgenjs format
   */
  private textRunsToPptx(runs: TextRun[], defaultColor: string, fontFace: string, fontSize: number): pptxgen.TextProps[] {
    return runs.map(run => ({
      text: run.text,
      options: {
        bold: run.bold || false,
        italic: run.italic || false,
        color: this.sanitizeColor(run.color || defaultColor, defaultColor),
        fontFace,
        fontSize,
      },
    }));
  }

  /**
   * Add a slide to the presentation
   */
  private async addSlide(
    pptx: pptxgen,
    slideTemplate: TemplateSlide,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number,
    isReferenceSlide: boolean
  ): Promise<void> {
    const slide = pptx.addSlide();

    // Add background
    if (slideTemplate.background) {
      if (slideTemplate.background.type === 'color') {
        const color = this.sanitizeColor(slideTemplate.background.value, '000000');
        slide.background = { color };
      } else if (slideTemplate.background.type === 'image' && slideTemplate.background.value) {
        try {
          const imageUrl = slideTemplate.background.value;
          let imageData: string | undefined;
          
          if (imageUrl.startsWith('data:')) {
            // Validate base64 image data
            if (this.isValidBase64Image(imageUrl)) {
              imageData = imageUrl;
            }
          } else {
            imageData = await this.imageUrlToBase64(imageUrl);
          }

          if (imageData && this.isValidBase64Image(imageData)) {
            // Add as a full-slide image for better control over sizing
            // Using 'cover' sizing to fill the slide while maintaining aspect ratio
            slide.addImage({
              data: imageData,
              x: 0,
              y: 0,
              w: slideWidthInches,
              h: slideHeightInches,
              sizing: { type: 'cover', w: slideWidthInches, h: slideHeightInches },
            });
          } else {
            // Invalid image data, use fallback color
            slide.background = { color: '1A1A2E' };
          }
        } catch (error) {
          console.warn('Failed to add background image:', error);
          // Fallback to a default color
          slide.background = { color: '1A1A2E' };
        }
      }
    }

    // Add images
    const images = slideTemplate.images || [];
    for (const image of images) {
      await this.addImage(slide, image, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Add text elements (the property is 'text', not 'textElements')
    const textElements = slideTemplate.text || [];
    for (const text of textElements) {
      this.addText(slide, text, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Add video elements
    const videos = slideTemplate.videos || [];
    for (const video of videos) {
      await this.addVideo(slide, video, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Add audio elements
    const audios = slideTemplate.audios || [];
    for (const audio of audios) {
      await this.addAudio(slide, audio, templateDimensions, slideWidthInches, slideHeightInches);
    }

    // Add song content placeholders if this is the reference slide
    if (isReferenceSlide) {
      // Song Title placeholder
      if (slideTemplate.songTitleStyle) {
        this.addSongContentPlaceholder(
          slide,
          slideTemplate.songTitleStyle,
          '[Song Title]',
          templateDimensions,
          slideWidthInches,
          slideHeightInches
        );
      }
      
      // Song Lyrics placeholder
      if (slideTemplate.songLyricsStyle) {
        this.addSongContentPlaceholder(
          slide,
          slideTemplate.songLyricsStyle,
          '[Song Lyrics Will Appear Here]',
          templateDimensions,
          slideWidthInches,
          slideHeightInches
        );
      }
      
      // Song Translation placeholder
      if (slideTemplate.songTranslationStyle) {
        this.addSongContentPlaceholder(
          slide,
          slideTemplate.songTranslationStyle,
          '[Translation]',
          templateDimensions,
          slideWidthInches,
          slideHeightInches
        );
      }
    }
  }

  /**
   * Add a song content placeholder to a slide
   */
  private addSongContentPlaceholder(
    slide: pptxgen.Slide,
    style: { x: number; y: number; width: number; height?: number; fontSize: string; fontWeight: string; fontStyle?: string; fontFamily?: string; textAlign: string; color: string },
    placeholderText: string,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number
  ): void {
    // Convert pixel coordinates to inches using rounded values
    const x = this.round((style.x / templateDimensions.width) * slideWidthInches);
    const y = this.round((style.y / templateDimensions.height) * slideHeightInches);
    const w = this.round((style.width / templateDimensions.width) * slideWidthInches);
    const h = style.height 
      ? this.round((style.height / templateDimensions.height) * slideHeightInches)
      : 1;

    // Parse font size
    const fontSizePt = this.parseFontSize(style.fontSize, templateDimensions.height, slideHeightInches);

    // Validate dimensions and font size
    const safeX = this.sanitizeDimension(x, 0);
    const safeY = this.sanitizeDimension(y, 0);
    const safeW = this.sanitizeDimension(w, 2, 0.1);
    const safeH = this.sanitizeDimension(h, 1, 0.1);
    const safeFontSize = Math.max(6, Math.min(fontSizePt, 120));

    slide.addText(placeholderText, {
      x: safeX,
      y: safeY,
      w: safeW,
      h: safeH,
      fontSize: safeFontSize,
      color: this.sanitizeColor(style.color, 'FFFFFF'),
      fontFace: style.fontFamily || 'Arial',
      bold: style.fontWeight === 'bold',
      italic: style.fontStyle === 'italic',
      align: (style.textAlign as 'left' | 'center' | 'right') || 'center',
      valign: 'top',
      margin: 0,
    });
  }

  /**
   * Add an image to a slide
   */
  private async addImage(
    slide: pptxgen.Slide,
    image: ImageElement,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number
  ): Promise<void> {
    try {
      // Convert and validate position/dimensions
      const x = this.sanitizeDimension(this.parsePosition(image.x, templateDimensions.width, slideWidthInches), 0);
      const y = this.sanitizeDimension(this.parsePosition(image.y, templateDimensions.height, slideHeightInches), 0);
      const w = this.sanitizeDimension(this.parseSize(image.width, templateDimensions.width, slideWidthInches) || 2, 2, 0.1);
      const h = this.sanitizeDimension(this.parseSize(image.height, templateDimensions.height, slideHeightInches) || 2, 2, 0.1);

      let imageData: string | undefined;
      
      if (image.url.startsWith('data:')) {
        if (this.isValidBase64Image(image.url)) {
          imageData = image.url;
        }
      } else {
        imageData = await this.imageUrlToBase64(image.url);
      }

      if (imageData && this.isValidBase64Image(imageData)) {
        slide.addImage({
          data: imageData,
          x,
          y,
          w,
          h,
          rotate: image.rotation || 0,
        });
      }
    } catch (error) {
      console.warn('Failed to add image:', error);
    }
  }

  /**
   * Add a video to a slide
   * Videos are added as online links (no fetching/embedding needed)
   */
  private async addVideo(
    slide: pptxgen.Slide,
    video: VideoElement,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number
  ): Promise<void> {
    try {
      // Convert and validate position/dimensions
      const x = this.sanitizeDimension(this.parsePosition(video.x, templateDimensions.width, slideWidthInches), 0);
      const y = this.sanitizeDimension(this.parsePosition(video.y, templateDimensions.height, slideHeightInches), 0);
      const w = this.sanitizeDimension(this.parseSize(video.width, templateDimensions.width, slideWidthInches) || 4, 4, 0.5);
      const h = this.sanitizeDimension(this.parseSize(video.height, templateDimensions.height, slideHeightInches) || 3, 3, 0.5);

      const videoUrl = video.url;
      if (!videoUrl) return;
      
      // Data URL - embed directly
      if (videoUrl.startsWith('data:')) {
        slide.addMedia({
          type: 'video',
          data: videoUrl,
          x,
          y,
          w,
          h,
        });
        console.log('Added embedded video from data URL');
        return;
      }
      
      // All other videos - add as online link (no fetching)
      const fullUrl = this.resolveUrl(videoUrl);
      slide.addMedia({
        type: 'online',
        link: fullUrl,
        x,
        y,
        w,
        h,
      });
      console.log('Added video as online link:', fullUrl);
    } catch (error) {
      console.warn('Failed to add video:', error);
    }
  }

  /**
   * Add audio to a slide
   * Note: Embedded audio may trigger PowerPoint repair, but audio will be preserved after repair.
   */
  private async addAudio(
    slide: pptxgen.Slide,
    audio: AudioElement,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number
  ): Promise<void> {
    try {
      // Convert and validate position/dimensions
      const x = this.sanitizeDimension(this.parsePosition(audio.x, templateDimensions.width, slideWidthInches), 0);
      const y = this.sanitizeDimension(this.parsePosition(audio.y, templateDimensions.height, slideHeightInches), 0);
      const w = this.sanitizeDimension(this.parseSize(audio.width, templateDimensions.width, slideWidthInches) || 1, 1, 0.25);
      const h = this.sanitizeDimension(this.parseSize(audio.height, templateDimensions.height, slideHeightInches) || 1, 1, 0.25);

      const audioUrl = audio.url;
      if (!audioUrl) {
        console.warn('Audio element has no URL, skipping');
        return;
      }
      
      if (audioUrl.startsWith('data:')) {
        // Data URL - embed directly
        slide.addMedia({
          type: 'audio',
          data: audioUrl,
          x,
          y,
          w,
          h,
        });
        console.log('Added embedded audio from data URL');
      } else {
        // Fetch and embed
        const fullUrl = this.resolveUrl(audioUrl);
        const isExternal = this.isExternalUrl(fullUrl);
        
        // For external URLs, use the proxy
        const fetchUrl = isExternal ? this.getProxyUrl(fullUrl) : fullUrl;
        console.log('Fetching audio from:', fetchUrl, isExternal ? '(via proxy)' : '(direct)');
        
        try {
          const response = await fetch(fetchUrl, {
            credentials: isExternal ? 'omit' : 'include',
            mode: 'cors',
          });
          
          if (response.ok) {
            const blob = await response.blob();
            
            if (blob.size > 0) {
              const base64 = await this.blobToBase64(blob);
              
              if (base64) {
                slide.addMedia({
                  type: 'audio',
                  data: base64,
                  x,
                  y,
                  w,
                  h,
                });
                console.log('Added embedded audio from URL:', fullUrl);
              }
            }
          } else {
            console.warn('Failed to fetch audio, status:', response.status, 'URL:', fetchUrl);
          }
        } catch (fetchError) {
          console.warn('Failed to fetch audio:', fetchError, 'URL:', fetchUrl);
        }
      }
    } catch (error) {
      console.warn('Failed to add audio:', error);
    }
  }

  /**
   * Convert a Blob to base64 data URI
   */
  private blobToBase64(blob: Blob): Promise<string | undefined> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Add text to a slide with formatting support
   */
  private addText(
    slide: pptxgen.Slide,
    text: TextElement,
    templateDimensions: { width: number; height: number },
    slideWidthInches: number,
    slideHeightInches: number
  ): void {
    // Convert and validate dimensions
    const rawX = this.parsePosition(text.x, templateDimensions.width, slideWidthInches);
    const rawY = this.parsePosition(text.y, templateDimensions.height, slideHeightInches);
    const x = this.sanitizeDimension(rawX, 0);
    const y = this.sanitizeDimension(rawY, 0);
    const w = this.sanitizeDimension(this.parseSize(text.width, templateDimensions.width, slideWidthInches) || (slideWidthInches - x - 0.5), 2, 0.1);
    const h = this.sanitizeDimension(this.parseSize(text.height, templateDimensions.height, slideHeightInches) || 1, 1, 0.1);

    // Parse and validate font size
    const fontSizePt = Math.max(6, Math.min(this.parseFontSize(text.fontSize || '24px', templateDimensions.height, slideHeightInches), 120));
    
    // Sanitize color
    const defaultColor = this.sanitizeColor(text.color, '000000');
    const fontFace = text.fontFamily || 'Arial';
    
    // Parse the formatted text into runs
    const textRuns = this.parseFormattedText(text.content || '', defaultColor);
    
    if (textRuns.length === 0) {
      return; // No text to add
    }
    
    // Sanitize colors in text runs
    textRuns.forEach(run => {
      if (run.color) {
        run.color = this.sanitizeColor(run.color, defaultColor);
      }
    });
    
    // Check if we have any formatting (if not, use simple text)
    const hasFormatting = textRuns.some(r => r.bold || r.italic || (r.color && r.color !== defaultColor));
    
    if (!hasFormatting && textRuns.length === 1) {
      // Simple text without formatting tags
      slide.addText(textRuns[0].text, {
        x,
        y,
        w,
        h,
        fontSize: fontSizePt,
        color: defaultColor,
        fontFace,
        bold: text.fontWeight === 'bold' || (parseInt(text.fontWeight || '400') >= 700),
        italic: text.fontStyle === 'italic',
        align: (text.textAlign as 'left' | 'center' | 'right') || 'left',
        valign: 'top', // Align to top to match CSS positioning
        rotate: text.rotation || 0,
        margin: 0, // Remove default margins
      });
    } else {
      // Rich text with formatting
      const pptxRuns = this.textRunsToPptx(textRuns, defaultColor, fontFace, fontSizePt);
      
      slide.addText(pptxRuns, {
        x,
        y,
        w,
        h,
        align: (text.textAlign as 'left' | 'center' | 'right') || 'left',
        valign: 'top', // Align to top to match CSS positioning
        rotate: text.rotation || 0,
        margin: 0, // Remove default margins
      });
    }
  }

  /**
   * Parse font size to points (proportional scaling for main content)
   */
  private parseFontSize(fontSizeStr: string, templateHeight: number, slideHeightInches: number): number {
    let fontSizePt = 12;
    
    if (fontSizeStr.endsWith('px')) {
      const px = parseFloat(fontSizeStr);
      // Scale based on template height to slide height ratio
      fontSizePt = Math.round((px / templateHeight) * slideHeightInches * 72);
    } else if (fontSizeStr.endsWith('pt')) {
      fontSizePt = parseFloat(fontSizeStr);
    } else if (fontSizeStr.endsWith('rem') || fontSizeStr.endsWith('em')) {
      fontSizePt = parseFloat(fontSizeStr) * 16 * 0.75;
    } else {
      fontSizePt = parseFloat(fontSizeStr) || 12;
    }

    // Clamp font size to reasonable range
    return Math.max(6, Math.min(fontSizePt, 120));
  }

  /**
   * Parse font size to points (direct conversion for UI elements like current/next song)
   * 1px ≈ 0.75pt (at 96dpi)
   */
  private parseFontSizeDirect(fontSizeStr: string): number {
    let fontSizePt = 12;
    
    if (fontSizeStr.endsWith('px')) {
      const px = parseFloat(fontSizeStr);
      // Direct conversion: 1px = 0.75pt
      fontSizePt = Math.round(px * 0.75);
    } else if (fontSizeStr.endsWith('pt')) {
      fontSizePt = parseFloat(fontSizeStr);
    } else if (fontSizeStr.endsWith('rem') || fontSizeStr.endsWith('em')) {
      // 1rem = 16px = 12pt
      fontSizePt = parseFloat(fontSizeStr) * 12;
    } else {
      fontSizePt = parseFloat(fontSizeStr) || 12;
    }

    // Clamp font size to reasonable range
    return Math.max(8, Math.min(fontSizePt, 48));
  }

  /**
   * Round to 4 decimal places to avoid floating point precision issues
   */
  private round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }

  /**
   * Parse position value (can be number, pixels, or percentage)
   */
  private parsePosition(
    value: number | string | undefined,
    templateSize: number,
    slideSize: number
  ): number {
    if (value === undefined || value === null) return 0;
    
    let pixels: number;
    
    if (typeof value === 'number') {
      pixels = value;
    } else {
      const strValue = String(value);
      if (strValue.endsWith('%')) {
        const percent = parseFloat(strValue) / 100;
        return this.round(percent * slideSize);
      }
      // Assume pixels - strip 'px' suffix if present
      pixels = parseFloat(strValue.replace('px', ''));
      if (isNaN(pixels)) return 0;
    }
    
    // Convert pixels to inches using the ratio
    return this.round((pixels / templateSize) * slideSize);
  }

  /**
   * Parse size value (can be string with px, %, or em)
   */
  private parseSize(
    value: string | undefined,
    templateSize: number,
    slideSize: number
  ): number | undefined {
    if (!value) return undefined;
    
    if (value.endsWith('%')) {
      const percent = parseFloat(value) / 100;
      return this.round(percent * slideSize);
    }
    
    if (value.endsWith('px')) {
      const pixels = parseFloat(value);
      return this.round((pixels / templateSize) * slideSize);
    }
    
    // Try parsing as number (assume pixels)
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return this.round((num / templateSize) * slideSize);
    }
    
    return undefined;
  }

  /**
   * Convert an image URL to base64 data URI
   * Uses proxy for external URLs to bypass CORS restrictions
   */
  private async imageUrlToBase64(url: string): Promise<string | undefined> {
    const fullUrl = this.resolveUrl(url);
    const isExternal = this.isExternalUrl(fullUrl);
    
    // For external URLs, use the proxy
    const fetchUrl = isExternal ? this.getProxyUrl(fullUrl) : fullUrl;
    
    try {
      console.log('Fetching image from:', fetchUrl, isExternal ? '(via proxy)' : '(direct)');
      
      const response = await fetch(fetchUrl, {
        credentials: isExternal ? 'omit' : 'include',
        mode: 'cors',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        console.warn('Failed to fetch image, status:', response.status, 'URL:', fetchUrl);
      }
    } catch (error) {
      console.warn('Failed to fetch image:', error, 'URL:', fetchUrl);
    }
    
    // Fallback for non-proxied: try loading via Image element and canvas
    if (!isExternal) {
      try {
        console.log('Trying Image element fallback for:', fullUrl);
        return await this.loadImageViaCanvas(fullUrl);
      } catch (error) {
        console.warn('Image element fallback failed:', error);
      }
    }
    
    return undefined;
  }

  /**
   * Load an image via Image element and convert to base64 using canvas
   * This can work for some cross-origin images
   */
  private loadImageViaCanvas(url: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            console.log('Successfully loaded image via canvas');
            resolve(dataUrl);
          } else {
            resolve(undefined);
          }
        } catch {
          // Canvas tainted by cross-origin data
          console.warn('Canvas tainted by cross-origin image:', url);
          resolve(undefined);
        }
      };
      
      img.onerror = () => {
        console.warn('Image element failed to load:', url);
        resolve(undefined);
      };
      
      // Add cache-busting to avoid cached CORS errors
      img.src = url.includes('?') ? `${url}&_cb=${Date.now()}` : `${url}?_cb=${Date.now()}`;
    });
  }
}

export const pptxExportService = new PptxExportService();
