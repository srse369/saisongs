import { pptxParserService } from './PptxParserService';
import type { 
  PresentationTemplate, 
  TemplateSlide, 
  ImageElement, 
  TextElement, 
  VideoElement,
  BackgroundElement,
  AspectRatio 
} from '../types';
import { 
  ASPECT_RATIO_DIMENSIONS, 
  DEFAULT_SONG_TITLE_STYLE,
  DEFAULT_SONG_LYRICS_STYLE,
  DEFAULT_SONG_TRANSLATION_STYLE
} from '../types';

export class PptxImportService {
  /**
   * Extract dominant color from an image data URL
   * Uses edge sampling to get background color, avoiding content in the center
   */
  private async extractDominantColor(imageDataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = () => {
        try {
          // Create a canvas to sample the image
          const canvas = document.createElement('canvas');
          const width = Math.min(img.width, 200);
          const height = Math.min(img.height, 200);
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve('#ffffff'); // Default to white if canvas fails
            return;
          }
          
          // Draw the image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Sample colors from edges and corners (likely to be background)
          // This avoids content in the center
          const samplePoints: [number, number][] = [
            // Corners
            [5, 5], [width - 5, 5], [5, height - 5], [width - 5, height - 5],
            // Top edge
            [width / 4, 5], [width / 2, 5], [3 * width / 4, 5],
            // Bottom edge
            [width / 4, height - 5], [width / 2, height - 5], [3 * width / 4, height - 5],
            // Left edge
            [5, height / 4], [5, height / 2], [5, 3 * height / 4],
            // Right edge
            [width - 5, height / 4], [width - 5, height / 2], [width - 5, 3 * height / 4],
          ];
          
          // Collect colors from sample points
          const colors: { r: number; g: number; b: number; count: number }[] = [];
          
          for (const [x, y] of samplePoints) {
            const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
            const r = pixel[0];
            const g = pixel[1];
            const b = pixel[2];
            const a = pixel[3];
            
            // Skip transparent pixels
            if (a < 128) continue;
            
            // Find if this color already exists (with some tolerance)
            const existing = colors.find(c => 
              Math.abs(c.r - r) < 30 && 
              Math.abs(c.g - g) < 30 && 
              Math.abs(c.b - b) < 30
            );
            
            if (existing) {
              existing.count++;
              // Update to average
              existing.r = Math.round((existing.r + r) / 2);
              existing.g = Math.round((existing.g + g) / 2);
              existing.b = Math.round((existing.b + b) / 2);
            } else {
              colors.push({ r, g, b, count: 1 });
            }
          }
          
          if (colors.length === 0) {
            resolve('#ffffff'); // Default to white if no colors found
            return;
          }
          
          // Get the most common color
          colors.sort((a, b) => b.count - a.count);
          const dominant = colors[0];
          
          // Convert to hex
          const hex = `#${dominant.r.toString(16).padStart(2, '0')}${dominant.g.toString(16).padStart(2, '0')}${dominant.b.toString(16).padStart(2, '0')}`;
          console.log('Dominant edge color:', hex, 'from', colors.length, 'unique colors');
          resolve(hex);
        } catch (error) {
          console.error('Error extracting color:', error);
          resolve('#ffffff'); // Default to white on error
        }
      };
      
      img.onerror = () => {
        resolve('#ffffff'); // Default to white if image fails to load
      };
      
      img.src = imageDataUrl;
    });
  }

  /**
   * Import a PowerPoint file and convert it to our template format
   */
  async importPptxFile(file: File, templateName: string): Promise<PresentationTemplate> {
    // Parse the PowerPoint file
    const { slides: parsedSlides, dimensions } = await pptxParserService.parsePptxFile(file);

    // Determine our slide dimensions based on aspect ratio
    const aspectRatio: AspectRatio = dimensions.aspectRatio;
    const targetDimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    const targetWidth = targetDimensions.width;
    const targetHeight = targetDimensions.height;

    // Convert PowerPoint slides (these become slides 2, 3, 4, etc.)
    const importedSlides: TemplateSlide[] = parsedSlides.map((parsedSlide, index) => {
      return this.convertSlide(
        parsedSlide,
        index,
        dimensions.width,
        dimensions.height,
        targetWidth,
        targetHeight
      );
    });

    // Try to extract background color from first imported slide
    let referenceBackgroundColor = '#1a1a2e'; // Default dark background
    
    if (importedSlides.length > 0 && importedSlides[0].background) {
      const firstBg = importedSlides[0].background;
      
      console.log('First slide background:', firstBg);
      
      if (firstBg.type === 'color' && firstBg.value) {
        // Use the solid color directly
        referenceBackgroundColor = firstBg.value;
        console.log('Using solid background color:', referenceBackgroundColor);
      } else if (firstBg.type === 'image' && firstBg.value) {
        // Extract dominant color from the background image
        try {
          referenceBackgroundColor = await this.extractDominantColor(firstBg.value);
          console.log('Extracted dominant color from image:', referenceBackgroundColor);
        } catch (error) {
          console.warn('Failed to extract dominant color from background image:', error);
        }
      }
    } else {
      console.log('No background found on first imported slide, using default');
    }

    // Create a reference slide as the first slide with default song content styles
    const referenceSlide: TemplateSlide = {
      background: { type: 'color', value: referenceBackgroundColor },
      images: [],
      videos: [],
      audios: [],
      text: [],
      songTitleStyle: { ...DEFAULT_SONG_TITLE_STYLE },
      songLyricsStyle: { ...DEFAULT_SONG_LYRICS_STYLE },
      songTranslationStyle: { ...DEFAULT_SONG_TRANSLATION_STYLE },
    };

    // Combine: reference slide first, then imported slides
    const slides = [referenceSlide, ...importedSlides];

    // Create the template
    const template: PresentationTemplate = {
      // Don't set an ID - let the database assign one when created
      name: templateName,
      description: `Imported from PowerPoint: ${file.name}`,
      aspectRatio,
      slides,
      // Reference slide is always index 0
      referenceSlideIndex: 0,
      background: referenceSlide.background,
      images: referenceSlide.images,
      videos: referenceSlide.videos,
      audios: referenceSlide.audios,
      text: referenceSlide.text,
      isDefault: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return template;
  }

  /**
   * Convert a parsed PowerPoint slide to our TemplateSlide format
   */
  private convertSlide(
    parsedSlide: any,
    slideIndex: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number
  ): TemplateSlide {
    const slide: TemplateSlide = {
      images: [],
      videos: [],
      audios: [],
      text: [],
    };

    // Convert background
    if (parsedSlide.background) {
      slide.background = this.convertBackground(parsedSlide.background);
    }

    // Convert images
    if (parsedSlide.images && parsedSlide.images.length > 0) {
      slide.images = parsedSlide.images.map((img: any, idx: number) =>
        this.convertImage(img, idx, sourceWidth, sourceHeight, targetWidth, targetHeight)
      );
    }

    // Convert text boxes
    if (parsedSlide.textBoxes && parsedSlide.textBoxes.length > 0) {
      slide.text = parsedSlide.textBoxes.map((txt: any, idx: number) =>
        this.convertTextBox(txt, idx, sourceWidth, sourceHeight, targetWidth, targetHeight)
      );
    }

    // Convert videos
    if (parsedSlide.videos && parsedSlide.videos.length > 0) {
      slide.videos = parsedSlide.videos.map((vid: any, idx: number) =>
        this.convertVideo(vid, idx, sourceWidth, sourceHeight, targetWidth, targetHeight)
      );
    }

    return slide;
  }

  /**
   * Convert background from PowerPoint format to our format
   */
  private convertBackground(parsedBackground: any): BackgroundElement {
    if (parsedBackground.type === 'solid') {
      return {
        type: 'color',
        value: parsedBackground.value,
      };
    } else if (parsedBackground.type === 'image' && parsedBackground.imageData) {
      return {
        type: 'image',
        value: parsedBackground.imageData,
      };
    }

    // Default to white background
    return {
      type: 'color',
      value: '#ffffff',
    };
  }

  /**
   * Convert image from PowerPoint format to our format
   */
  private convertImage(
    parsedImage: any,
    index: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number
  ): ImageElement {
    const scaledPosition = this.scalePosition(
      parsedImage.x,
      parsedImage.y,
      parsedImage.width,
      parsedImage.height,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight
    );

    return {
      id: parsedImage.id || `imported-image-${index}`,
      url: parsedImage.imageData,
      x: `${scaledPosition.x}px`,
      y: `${scaledPosition.y}px`,
      width: `${scaledPosition.width}px`,
      height: `${scaledPosition.height}px`,
      rotation: parsedImage.rotation,
      opacity: 1,
    };
  }

  /**
   * Convert text box from PowerPoint format to our format
   */
  private convertTextBox(
    parsedText: any,
    index: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number
  ): TextElement {
    const scaledPosition = this.scalePosition(
      parsedText.x,
      parsedText.y,
      parsedText.width,
      parsedText.height,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight
    );

    // Scale font size proportionally
    let fontSize = '16px';
    if (parsedText.fontSize) {
      const scaleFactor = targetHeight / sourceHeight;
      const scaledFontSize = Math.round(parsedText.fontSize * scaleFactor);
      fontSize = `${scaledFontSize}px`;
    }

    return {
      id: parsedText.id || `imported-text-${index}`,
      content: parsedText.content,
      x: `${scaledPosition.x}px`,
      y: `${scaledPosition.y}px`,
      width: `${scaledPosition.width}px`,
      height: `${scaledPosition.height}px`,
      fontSize,
      fontFamily: parsedText.fontFamily,
      color: parsedText.color || '#000000',
      fontWeight: parsedText.bold ? 'bold' : 'normal',
      fontStyle: parsedText.italic ? 'italic' : 'normal',
      textAlign: parsedText.align || 'left',
      rotation: parsedText.rotation,
      opacity: 1,
    };
  }

  /**
   * Convert video from PowerPoint format to our format
   */
  private convertVideo(
    parsedVideo: any,
    index: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number
  ): VideoElement {
    const scaledPosition = this.scalePosition(
      parsedVideo.x,
      parsedVideo.y,
      parsedVideo.width,
      parsedVideo.height,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight
    );

    return {
      id: parsedVideo.id || `imported-video-${index}`,
      url: parsedVideo.videoData,
      x: `${scaledPosition.x}px`,
      y: `${scaledPosition.y}px`,
      width: `${scaledPosition.width}px`,
      height: `${scaledPosition.height}px`,
      autoPlay: false,
      loop: false,
      muted: true,
      opacity: 1,
    };
  }

  /**
   * Scale position and size from PowerPoint coordinates to our slide coordinates
   */
  private scalePosition(
    x: number,
    y: number,
    width: number,
    height: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number
  ): { x: number; y: number; width: number; height: number } {
    // PowerPoint uses EMUs (English Metric Units)
    // 914400 EMUs = 1 inch
    // We need to scale from source dimensions to target dimensions

    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;

    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY),
      width: Math.round(width * scaleX),
      height: Math.round(height * scaleY),
    };
  }
}

export const pptxImportService = new PptxImportService();
