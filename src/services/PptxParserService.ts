import PizZip from 'pizzip';

interface ParsedSlide {
  background?: {
    type: 'solid' | 'image';
    value: string;
    imageData?: string;
    filename?: string;
  };
  images: Array<{
    id: string;
    imageData: string;
    filename?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }>;
  textBoxes: Array<{
    id: string;
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    rotation?: number;
  }>;
  videos: Array<{
    id: string;
    videoData: string;
    filename?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  audios: Array<{
    id: string;
    audioData: string;
    filename?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  width: number;
  height: number;
}

interface PptxDimensions {
  width: number;
  height: number;
  aspectRatio: '16:9' | '4:3';
}

class PptxParserService {
  private zip: PizZip | null = null;
  private mediaFiles: Map<string, string> = new Map();
  private mediaBlobs: Map<string, { blob: Blob; mimeType: string }> = new Map();
  private themeColors: Map<string, string> = new Map();
  private colorMap: Map<string, string> = new Map();
  private allThemes: Map<string, Map<string, string>> = new Map(); // Store all themes
  private slideThemes: Map<number, string> = new Map(); // Map slide number to theme filename
  private masterDefaults: Map<string, { fontSize?: number; fontFamily?: string; color?: string }> = new Map(); // Default text properties from masters

  async parsePptxFile(file: File): Promise<{
    slides: ParsedSlide[];
    dimensions: PptxDimensions;
  }> {
    const arrayBuffer = await file.arrayBuffer();
    return this.parsePptxBuffer(arrayBuffer);
  }

  parsePptxBuffer(buffer: ArrayBuffer): {
    slides: ParsedSlide[];
    dimensions: PptxDimensions;
  } {
    this.zip = new PizZip(buffer);
    
    const dimensions = this.getPresentationDimensions();
    this.parseColorMap(); // Parse color mapping first
    this.parseAllThemes(); // Parse all themes and store them
    this.extractMediaFiles();
    
    const slideCount = this.getSlideCount();
    const slides: ParsedSlide[] = [];
    
    for (let i = 1; i <= slideCount; i++) {
      // Detect which theme this slide uses
      const themeName = this.getSlideTheme(i);
      this.slideThemes.set(i, themeName);
      
      // Set the theme colors for this slide
      const slideThemeColors = this.allThemes.get(themeName);
      if (slideThemeColors) {
        this.themeColors = slideThemeColors;
        console.log(`Slide ${i} using ${themeName}`);
      }
      
      // Parse master defaults for this slide
      this.parseMasterDefaults(i);
      
      const slide = this.parseSlide(i, dimensions);
      slides.push(slide);
    }
    
    return { slides, dimensions };
  }

  /**
   * Get extracted media files as Blobs for uploading to cloud storage
   */
  getMediaBlobs(): Map<string, { blob: Blob; mimeType: string }> {
    return this.mediaBlobs;
  }

  /**
   * Clear cached media files and blobs
   */
  clearCache(): void {
    this.mediaFiles.clear();
    this.mediaBlobs.clear();
  }

  private parseColorMap(): void {
    // Parse the color map from presentation.xml or slide masters
    let clrMap: Element | null = null;
    
    // Try presentation.xml first
    const presentationXml = this.zip?.file('ppt/presentation.xml')?.asText();
    if (presentationXml) {
      try {
        const doc = this.parseXml(presentationXml);
        clrMap = doc.querySelector('p\\:clrMap, clrMap');
      } catch (error) {
        console.warn('Failed to parse presentation.xml for color map:', error);
      }
    }
    
    // If not found, try slide master (slideMaster1.xml)
    if (!clrMap) {
      const masterXml = this.zip?.file('ppt/slideMasters/slideMaster1.xml')?.asText();
      if (masterXml) {
        try {
          const doc = this.parseXml(masterXml);
          clrMap = doc.querySelector('p\\:clrMap, clrMap');
          if (clrMap) {
            console.log('Found color map in slideMaster1.xml');
          }
        } catch (error) {
          console.warn('Failed to parse slideMaster1.xml for color map:', error);
        }
      }
    }
    
    if (clrMap) {
      // Parse attributes - default mapping is used if attributes not present
      this.colorMap.set('bg1', clrMap.getAttribute('bg1') || 'lt1');
      this.colorMap.set('tx1', clrMap.getAttribute('tx1') || 'dk1');
      this.colorMap.set('bg2', clrMap.getAttribute('bg2') || 'lt2');
      this.colorMap.set('tx2', clrMap.getAttribute('tx2') || 'dk2');
      this.colorMap.set('accent1', clrMap.getAttribute('accent1') || 'accent1');
      this.colorMap.set('accent2', clrMap.getAttribute('accent2') || 'accent2');
      this.colorMap.set('accent3', clrMap.getAttribute('accent3') || 'accent3');
      this.colorMap.set('accent4', clrMap.getAttribute('accent4') || 'accent4');
      this.colorMap.set('accent5', clrMap.getAttribute('accent5') || 'accent5');
      this.colorMap.set('accent6', clrMap.getAttribute('accent6') || 'accent6');
      this.colorMap.set('hlink', clrMap.getAttribute('hlink') || 'accent5');
      this.colorMap.set('folHlink', clrMap.getAttribute('folHlink') || 'accent6');
      
      console.log('Parsed color map:', Object.fromEntries(this.colorMap));
    } else {
      console.warn('No color map found, using defaults');
      // Set default mappings
      this.colorMap.set('bg1', 'lt1');
      this.colorMap.set('tx1', 'dk1');
      this.colorMap.set('bg2', 'lt2');
      this.colorMap.set('tx2', 'dk2');
      this.colorMap.set('accent1', 'accent1');
      this.colorMap.set('accent2', 'accent2');
      this.colorMap.set('accent3', 'accent3');
      this.colorMap.set('accent4', 'accent4');
      this.colorMap.set('accent5', 'accent5');
      this.colorMap.set('accent6', 'accent6');
    }
  }

  /**
   * Get the theme file used by a specific slide by following relationships:
   * slide -> slideLayout -> slideMaster -> theme
   */
  private getSlideTheme(slideNumber: number): string {
    try {
      // Step 1: Read slide relationships
      const slideRelsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
      const slideRelsXml = this.zip?.file(slideRelsPath)?.asText();
      if (!slideRelsXml) {
        console.warn(`No relationships found for slide ${slideNumber}, using theme1.xml`);
        return 'theme1.xml';
      }

      const slideRelsDoc = this.parseXml(slideRelsXml);
      const layoutRel = Array.from(slideRelsDoc.querySelectorAll('Relationship')).find(rel => 
        rel.getAttribute('Type')?.includes('slideLayout')
      );
      
      if (!layoutRel) {
        console.warn(`No slideLayout relationship found for slide ${slideNumber}`);
        return 'theme1.xml';
      }

      const layoutPath = layoutRel.getAttribute('Target')?.replace('../', 'ppt/');
      if (!layoutPath) return 'theme1.xml';

      // Step 2: Read slideLayout relationships
      const layoutNumber = layoutPath.match(/slideLayout(\d+)\.xml/)?.[1];
      if (!layoutNumber) return 'theme1.xml';

      const layoutRelsPath = `ppt/slideLayouts/_rels/slideLayout${layoutNumber}.xml.rels`;
      const layoutRelsXml = this.zip?.file(layoutRelsPath)?.asText();
      if (!layoutRelsXml) {
        console.warn(`No relationships found for slideLayout ${layoutNumber}`);
        return 'theme1.xml';
      }

      const layoutRelsDoc = this.parseXml(layoutRelsXml);
      const masterRel = Array.from(layoutRelsDoc.querySelectorAll('Relationship')).find(rel => 
        rel.getAttribute('Type')?.includes('slideMaster')
      );
      
      if (!masterRel) {
        console.warn(`No slideMaster relationship found for slideLayout ${layoutNumber}`);
        return 'theme1.xml';
      }

      const masterPath = masterRel.getAttribute('Target')?.replace('../', 'ppt/');
      if (!masterPath) return 'theme1.xml';

      // Step 3: Read slideMaster relationships
      const masterNumber = masterPath.match(/slideMaster(\d+)\.xml/)?.[1];
      if (!masterNumber) return 'theme1.xml';

      const masterRelsPath = `ppt/slideMasters/_rels/slideMaster${masterNumber}.xml.rels`;
      const masterRelsXml = this.zip?.file(masterRelsPath)?.asText();
      if (!masterRelsXml) {
        console.warn(`No relationships found for slideMaster ${masterNumber}`);
        return 'theme1.xml';
      }

      const masterRelsDoc = this.parseXml(masterRelsXml);
      const themeRel = Array.from(masterRelsDoc.querySelectorAll('Relationship')).find(rel => 
        rel.getAttribute('Type')?.includes('theme')
      );
      
      if (!themeRel) {
        console.warn(`No theme relationship found for slideMaster ${masterNumber}`);
        return 'theme1.xml';
      }

      const themePath = themeRel.getAttribute('Target')?.replace('../', '');
      const themeName = themePath?.split('/').pop() || 'theme1.xml';
      
      console.log(`Slide ${slideNumber} -> layout${layoutNumber} -> master${masterNumber} -> ${themeName}`);
      return themeName;

    } catch (error) {
      console.error(`Error detecting theme for slide ${slideNumber}:`, error);
      return 'theme1.xml';
    }
  }

  /**
   * Parse default text properties from master slide and layout
   */
  private parseMasterDefaults(slideNumber: number): void {
    try {
      // Get the slide layout and master numbers
      const slideRelsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
      const slideRelsXml = this.zip?.file(slideRelsPath)?.asText();
      if (!slideRelsXml) return;

      const slideRelsDoc = this.parseXml(slideRelsXml);
      const layoutRel = Array.from(slideRelsDoc.querySelectorAll('Relationship')).find(rel => 
        rel.getAttribute('Type')?.includes('slideLayout')
      );
      if (!layoutRel) return;

      const layoutPath = layoutRel.getAttribute('Target')?.replace('../', 'ppt/');
      const layoutNumber = layoutPath?.match(/slideLayout(\d+)\.xml/)?.[1];
      if (!layoutNumber) return;

      // Get master number from layout
      const layoutRelsPath = `ppt/slideLayouts/_rels/slideLayout${layoutNumber}.xml.rels`;
      const layoutRelsXml = this.zip?.file(layoutRelsPath)?.asText();
      if (!layoutRelsXml) return;

      const layoutRelsDoc = this.parseXml(layoutRelsXml);
      const masterRel = Array.from(layoutRelsDoc.querySelectorAll('Relationship')).find(rel => 
        rel.getAttribute('Type')?.includes('slideMaster')
      );
      if (!masterRel) return;

      const masterPath = masterRel.getAttribute('Target')?.replace('../', 'ppt/');
      const masterNumber = masterPath?.match(/slideMaster(\d+)\.xml/)?.[1];
      if (!masterNumber) return;

      // Parse master slide for default text properties
      const masterXmlPath = `ppt/slideMasters/slideMaster${masterNumber}.xml`;
      const masterXml = this.zip?.file(masterXmlPath)?.asText();
      if (!masterXml) return;

      const masterDoc = this.parseXml(masterXml);
      const defaults: { fontSize?: number; fontFamily?: string; color?: string } = {};

      // Look for default text properties in the master
      const txStyles = masterDoc.querySelector('p\\:txStyles, txStyles');
      if (txStyles) {
        // Try to get body style (most common for content)
        const bodyStyle = txStyles.querySelector('p\\:bodyStyle, bodyStyle');
        if (bodyStyle) {
          const lvl1pPr = bodyStyle.querySelector('a\\:lvl1pPr, lvl1pPr');
          if (lvl1pPr) {
            const defRPr = lvl1pPr.querySelector('a\\:defRPr, defRPr');
            if (defRPr) {
              // Extract font size
              const sz = defRPr.getAttribute('sz');
              if (sz) {
                defaults.fontSize = (parseInt(sz) / 100) * (4 / 3);
              }

              // Extract font family
              const typeface = defRPr.querySelector('a\\:latin, latin')?.getAttribute('typeface');
              if (typeface && typeface !== '+mn-lt' && typeface !== '+mj-lt') {
                defaults.fontFamily = typeface;
              }

              // Extract color
              const solidFill = defRPr.querySelector('a\\:solidFill, solidFill');
              if (solidFill) {
                defaults.color = this.extractColor(solidFill);
              }
            }
          }
        }
      }

      this.masterDefaults.set(`slide${slideNumber}`, defaults);
      console.log(`Slide ${slideNumber} master defaults:`, defaults);

    } catch (error) {
      console.error(`Error parsing master defaults for slide ${slideNumber}:`, error);
    }
  }

  /**
   * Parse all theme files and store them
   */
  private parseAllThemes(): void {
    // PowerPoint can have multiple theme files (theme1.xml, theme2.xml, etc.)
    // Parse ALL themes and store them
    
    for (let i = 1; i <= 10; i++) {
      const themeName = `theme${i}.xml`;
      const themeXml = this.zip?.file(`ppt/theme/${themeName}`)?.asText();
      if (!themeXml) continue;
      
      try {
        const themeColors = new Map<string, string>();
        const doc = this.parseXml(themeXml);
        const clrScheme = doc.querySelector('a\\:clrScheme, clrScheme');
        if (!clrScheme) continue;

        const colorMap = {
          'dk1': 'a\\:dk1, dk1',
          'lt1': 'a\\:lt1, lt1',
          'dk2': 'a\\:dk2, dk2',
          'lt2': 'a\\:lt2, lt2',
          'accent1': 'a\\:accent1, accent1',
          'accent2': 'a\\:accent2, accent2',
          'accent3': 'a\\:accent3, accent3',
          'accent4': 'a\\:accent4, accent4',
          'accent5': 'a\\:accent5, accent5',
          'accent6': 'a\\:accent6, accent6',
        };

        for (const [colorName, selector] of Object.entries(colorMap)) {
          const colorElement = clrScheme.querySelector(selector);
          if (colorElement) {
            const srgbClr = colorElement.querySelector('a\\:srgbClr, srgbClr');
            if (srgbClr) {
              const val = srgbClr.getAttribute('val');
              if (val) {
                themeColors.set(colorName, `#${val}`);
              }
            } else {
              const sysClr = colorElement.querySelector('a\\:sysClr, sysClr');
              if (sysClr) {
                const lastClr = sysClr.getAttribute('lastClr');
                if (lastClr) {
                  themeColors.set(colorName, `#${lastClr}`);
                }
              }
            }
          }
        }
        
        this.allThemes.set(themeName, themeColors);
        
        console.log(`Loaded ${themeName} with ${themeColors.size} colors`);
      } catch (error) {
        console.error(`Failed to parse ${themeName}:`, error);
      }
    }
    
    console.log(`Parsed ${this.allThemes.size} themes: ${Array.from(this.allThemes.keys()).join(', ')}`);
  }

  private getDefaultSchemeColor(scheme: string): string {
    const defaults: Record<string, string> = {
      'dk1': '#000000',
      'lt1': '#ffffff',
      'dk2': '#44546a',
      'lt2': '#e7e6e6',
      'accent1': '#4472c4',
      'accent2': '#ed7d31',
      'accent3': '#a5a5a5',
      'accent4': '#ffc000',
      'accent5': '#5b9bd5',
      'accent6': '#70ad47',
      // Background and text color defaults
      'bg1': '#ffffff',
      'bg2': '#000000',
      'tx1': '#000000',
      'tx2': '#ffffff',
    };
    return defaults[scheme] || '#000000';
  }

  private getPresentationDimensions(): PptxDimensions {
    const presentationXml = this.zip?.file('ppt/presentation.xml')?.asText();
    if (!presentationXml) {
      return { width: 9144000, height: 5143500, aspectRatio: '16:9' };
    }

    const doc = this.parseXml(presentationXml);
    const sldSz = doc.querySelector('sldSz');
    
    if (sldSz) {
      const width = parseInt(sldSz.getAttribute('cx') || '9144000');
      const height = parseInt(sldSz.getAttribute('cy') || '5143500');
      const ratio = width / height;
      const aspectRatio = Math.abs(ratio - 16/9) < Math.abs(ratio - 4/3) ? '16:9' : '4:3';
      return { width, height, aspectRatio };
    }

    return { width: 9144000, height: 5143500, aspectRatio: '16:9' };
  }

  private getSlideCount(): number {
    const files = Object.keys(this.zip?.files || {});
    const slideFiles = files.filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
    return slideFiles.length;
  }

  private extractMediaFiles(): void {
    const files = Object.keys(this.zip?.files || {});
    
    const imageFiles = files.filter(f => f.match(/^ppt\/media\/image\d+\.(png|jpg|jpeg|gif|bmp)$/i));
    for (const imagePath of imageFiles) {
      const imageData = this.zip?.file(imagePath)?.asUint8Array();
      if (imageData) {
        const base64 = this.uint8ArrayToBase64(imageData);
        const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        const filename = imagePath.split('/').pop() || '';
        this.mediaFiles.set(filename, dataUrl);
        
        // Also store as Blob for cloud upload
        const blob = new Blob([imageData as any], { type: mimeType });
        this.mediaBlobs.set(filename, { blob, mimeType });
      }
    }

    const videoFiles = files.filter(f => f.match(/^ppt\/media\/media\d+\.(mp4|mov|avi|wmv)$/i));
    for (const videoPath of videoFiles) {
      const videoData = this.zip?.file(videoPath)?.asUint8Array();
      if (videoData) {
        const base64 = this.uint8ArrayToBase64(videoData);
        const ext = videoPath.split('.').pop()?.toLowerCase() || 'mp4';
        const mimeType = `video/${ext}`;
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        const filename = videoPath.split('/').pop() || '';
        this.mediaFiles.set(filename, dataUrl);
        
        // Also store as Blob for cloud upload
        const blob = new Blob([videoData as any], { type: mimeType });
        this.mediaBlobs.set(filename, { blob, mimeType });
      }
    }

    // Extract audio files (mp4 can be audio too - m4a is mp4 audio container)
    const audioFiles = files.filter(f => f.match(/^ppt\/media\/media\d+\.(mp3|wav|m4a|mp4|aac|wma|ogg)$/i));
    for (const audioPath of audioFiles) {
      const audioData = this.zip?.file(audioPath)?.asUint8Array();
      if (audioData) {
        const base64 = this.uint8ArrayToBase64(audioData);
        const ext = audioPath.split('.').pop()?.toLowerCase() || 'mp3';
        const mimeType = ext === 'mp3' ? 'audio/mpeg' : 
                        ext === 'wav' ? 'audio/wav' :
                        ext === 'm4a' ? 'audio/mp4' :
                        ext === 'aac' ? 'audio/aac' :
                        ext === 'ogg' ? 'audio/ogg' : 'audio/x-ms-wma';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        const filename = audioPath.split('/').pop() || '';
        this.mediaFiles.set(filename, dataUrl);
        
        // Also store as Blob for cloud upload
        const blob = new Blob([audioData as any], { type: mimeType });
        this.mediaBlobs.set(filename, { blob, mimeType });
      }
    }
  }

  private parseSlideRelationships(slideNumber: number): Map<string, string> {
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    const relsXml = this.zip?.file(relsPath)?.asText();
    
    const relationships = new Map<string, string>();
    if (!relsXml) return relationships;

    const doc = this.parseXml(relsXml);
    const rels = doc.querySelectorAll('Relationship');
    
    for (const rel of Array.from(rels)) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      
      if (id && target) {
        const filename = target.split('/').pop() || '';
        relationships.set(id, filename);
      }
    }
    
    return relationships;
  }

  private parseSlide(slideNumber: number, dimensions: PptxDimensions): ParsedSlide {
    const slideXml = this.zip?.file(`ppt/slides/slide${slideNumber}.xml`)?.asText();
    
    if (!slideXml) {
      return {
        images: [],
        textBoxes: [],
        videos: [],
        width: dimensions.width,
        height: dimensions.height,
      };
    }

    const relationships = this.parseSlideRelationships(slideNumber);
    const doc = this.parseXml(slideXml);
    
    // Try to get background from slide, then fall back to layout/master
    let background = this.parseBackground(doc, relationships);
    
    // If no background found, check the slide layout and master
    if (!background) {
      background = this.parseBackgroundFromMaster(slideNumber, relationships);
    }
    
    // Check for groups (p:grpSp) which contain nested shapes/images
    const groups = doc.querySelectorAll('p\\:grpSp, grpSp');
    console.log('parseSlide: Found', groups.length, 'groups');
    
    // Use counters to ensure unique IDs across grouped and direct elements
    let imageCounter = 1;
    let textCounter = 1;
    
    // Parse groups first to extract nested elements with correct positions
    const groupImages: ParsedSlide['images'] = [];
    const groupTextBoxes: ParsedSlide['textBoxes'] = [];
    
    for (const group of Array.from(groups)) {
      const grpSpPr = group.querySelector('p\\:grpSpPr, grpSpPr');
      const groupXfrm = grpSpPr?.querySelector('a\\:xfrm, xfrm');
      
      // Get group offset (position on slide)
      const groupOff = groupXfrm?.querySelector('a\\:off, off');
      const groupX = parseInt(groupOff?.getAttribute('x') || '0');
      const groupY = parseInt(groupOff?.getAttribute('y') || '0');
      
      // Get child offset (internal coordinate system origin)
      const chOff = groupXfrm?.querySelector('a\\:chOff, chOff');
      const childOffX = parseInt(chOff?.getAttribute('x') || '0');
      const childOffY = parseInt(chOff?.getAttribute('y') || '0');
      
      // The actual offset to apply is: groupPosition - childOffset
      // This converts from group's internal coordinates to slide coordinates
      const groupPosition = {
        x: groupX - childOffX,
        y: groupY - childOffY,
        width: 0,
        height: 0
      };
      
      // Parse nested shapes in group
      const groupShapes = group.querySelectorAll('p\\:sp, sp');
      const groupPics = group.querySelectorAll('p\\:pic, pic');
      
      console.log(`Group offset: (${groupX}, ${groupY}), child offset: (${childOffX}, ${childOffY}), final: (${groupPosition.x}, ${groupPosition.y})`);
      console.log(`Group has ${groupShapes.length} shapes and ${groupPics.length} pics`);
      
      // Parse images in group
      const nestedImages = this.parseImages(
        [...Array.from(groupShapes), ...Array.from(groupPics)] as any, 
        relationships,
        groupPosition,
        imageCounter
      );
      imageCounter += nestedImages.length;
      groupImages.push(...nestedImages);
      
      // Parse text boxes in group
      const nestedTextBoxes = this.parseTextBoxes(groupShapes, slideNumber, groupPosition, textCounter);
      textCounter += nestedTextBoxes.length;
      groupTextBoxes.push(...nestedTextBoxes);
    }
    
    // Get only direct children shapes/pics (not inside groups)
    // We need to filter out elements that have a grpSp ancestor
    const allShapes = doc.querySelectorAll('p\\:sp, sp');
    const allPics = doc.querySelectorAll('p\\:pic, pic');
    
    const directShapes = Array.from(allShapes).filter(shape => {
      // Check if any ancestor is a group
      let parent = shape.parentElement;
      while (parent && parent !== doc.documentElement) {
        if (parent.tagName.toLowerCase().includes('grpsp')) {
          return false; // This shape is inside a group
        }
        parent = parent.parentElement;
      }
      return true; // Direct child of slide
    });
    
    const directPics = Array.from(allPics).filter(pic => {
      let parent = pic.parentElement;
      while (parent && parent !== doc.documentElement) {
        if (parent.tagName.toLowerCase().includes('grpsp')) {
          return false;
        }
        parent = parent.parentElement;
      }
      return true;
    });
    
    console.log('parseSlide: Found', directShapes.length, 'direct shapes,', directPics.length, 'direct pics');
    
    // Combine direct shapes and pics for image parsing (non-grouped elements)
    const directShapesNodeList = directShapes as any;
    const images = this.parseImages([...directShapes, ...directPics] as any, relationships, undefined, imageCounter);
    images.push(...groupImages);
    
    // Create a NodeList-like object for text parsing
    const directShapesForText = {
      length: directShapes.length,
      item: (index: number) => directShapes[index],
      forEach: (callback: any) => directShapes.forEach(callback),
      [Symbol.iterator]: function* () {
        for (let i = 0; i < directShapes.length; i++) {
          yield directShapes[i];
        }
      }
    };
    
    const textBoxes = this.parseTextBoxes(directShapesForText as any, slideNumber, undefined, textCounter);
    textBoxes.push(...groupTextBoxes);
    
    // Also parse tables as text boxes
    const tables = doc.querySelectorAll('p\\:graphicFrame, graphicFrame');
    const tableTextBoxes = this.parseTables(tables);
    textBoxes.push(...tableTextBoxes);
    
    const videos = this.parseVideos(directShapesForText as any, relationships);
    
    // Parse audio from multiple sources: shapes, graphic frames, and slide-level audio
    const audios = this.parseAudios(doc, directShapesForText as any, relationships);

    console.log('Parsed slide:', {
      imagesCount: images.length,
      imageFilenames: images.map(img => img.filename),
      videosCount: videos.length,
      audiosCount: audios.length,
      textBoxesCount: textBoxes.length,
      hasBackground: !!background,
      backgroundType: background?.type,
      backgroundFilename: background?.filename
    });

    return {
      background,
      images,
      textBoxes,
      videos,
      audios,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  private parseBackgroundFromMaster(slideNumber: number, slideRelationships: Map<string, string>): ParsedSlide['background'] {
    try {
      // Get the slide layout relationship
      const layoutRel = Array.from(slideRelationships.entries())
        .find(([_, target]) => target.includes('slideLayout'));
      
      if (!layoutRel) {
        console.log('No slide layout relationship found');
        return undefined;
      }
      
      const layoutFile = `ppt/slideLayouts/${layoutRel[1]}`;
      const layoutXml = this.zip?.file(layoutFile)?.asText();
      
      if (!layoutXml) {
        console.log('Could not read layout file:', layoutFile);
        return undefined;
      }
      
      const layoutDoc = this.parseXml(layoutXml);
      const layoutRels = this.parseLayoutRelationships(layoutRel[1].replace('.xml', ''));
      
      // Check layout background
      let background = this.parseBackground(layoutDoc, layoutRels);
      if (background) {
        console.log('Found background in slide layout');
        return background;
      }
      
      // If not in layout, check master slide
      const masterRel = Array.from(layoutRels.entries())
        .find(([_, target]) => target.includes('slideMaster'));
      
      if (!masterRel) {
        console.log('No master slide relationship found');
        return undefined;
      }
      
      const masterFile = `ppt/slideMasters/${masterRel[1]}`;
      const masterXml = this.zip?.file(masterFile)?.asText();
      
      if (!masterXml) {
        console.log('Could not read master file:', masterFile);
        return undefined;
      }
      
      const masterDoc = this.parseXml(masterXml);
      const masterRels = this.parseMasterRelationships(masterRel[1].replace('.xml', ''));
      
      background = this.parseBackground(masterDoc, masterRels);
      if (background) {
        console.log('Found background in master slide');
      }
      
      return background;
    } catch (error) {
      console.error('Error parsing master background:', error);
      return undefined;
    }
  }

  private parseLayoutRelationships(layoutName: string): Map<string, string> {
    const relsPath = `ppt/slideLayouts/_rels/${layoutName}.xml.rels`;
    const relsXml = this.zip?.file(relsPath)?.asText();
    
    const relationships = new Map<string, string>();
    if (!relsXml) return relationships;

    const doc = this.parseXml(relsXml);
    const rels = doc.querySelectorAll('Relationship');
    
    for (const rel of Array.from(rels)) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      
      if (id && target) {
        const filename = target.split('/').pop() || '';
        relationships.set(id, filename);
      }
    }
    
    return relationships;
  }

  private parseMasterRelationships(masterName: string): Map<string, string> {
    const relsPath = `ppt/slideMasters/_rels/${masterName}.xml.rels`;
    const relsXml = this.zip?.file(relsPath)?.asText();
    
    const relationships = new Map<string, string>();
    if (!relsXml) return relationships;

    const doc = this.parseXml(relsXml);
    const rels = doc.querySelectorAll('Relationship');
    
    for (const rel of Array.from(rels)) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      
      if (id && target) {
        const filename = target.split('/').pop() || '';
        relationships.set(id, filename);
      }
    }
    
    return relationships;
  }

  private parseBackground(doc: Document, relationships: Map<string, string>): ParsedSlide['background'] {
    const bg = doc.querySelector('p\\:bg, bg');
    if (!bg) {
      console.log('No background element found in slide');
      return undefined;
    }

    // Check for solid fill
    const solidFill = bg.querySelector('a\\:solidFill, solidFill');
    if (solidFill) {
      const color = this.extractColor(solidFill);
      if (color) {
        console.log('Found solid background color:', color);
        return { type: 'solid', value: color };
      }
    }

    // Check for image fill
    const blipFill = bg.querySelector('a\\:blipFill, blipFill');
    if (blipFill) {
      const blip = blipFill.querySelector('a\\:blip, blip');
      const embed = blip?.getAttribute('r:embed') || blip?.getAttribute('embed');
      
      if (embed) {
        const filename = relationships.get(embed);
        const imageData = filename ? this.mediaFiles.get(filename) : undefined;
        
        if (imageData) {
          console.log('Found image background');
          return {
            type: 'image',
            value: imageData,
            imageData,
            filename,
          };
        }
      }
    }

    console.log('No background color or image found, returning undefined');
    return undefined;
  }

  private parseImages(
    shapes: NodeListOf<Element>, 
    relationships: Map<string, string>,
    groupPosition?: { x: number; y: number; width: number; height: number },
    startCounter: number = 1
  ): ParsedSlide['images'] {
    const images: ParsedSlide['images'] = [];
    let imageCounter = startCounter;

    console.log('parseImages: Found', shapes.length, 'shapes', groupPosition ? '(in group)' : '');

    for (const shape of Array.from(shapes)) {
      const blipFill = shape.querySelector('p\\:blipFill, blipFill');
      console.log('Shape:', shape.tagName, 'has blipFill:', !!blipFill);
      if (!blipFill) continue;

      const blip = blipFill.querySelector('a\\:blip, blip');
      const embed = blip?.getAttribute('r:embed') || blip?.getAttribute('embed');
      console.log('Embed ID:', embed);
      
      if (embed) {
        const filename = relationships.get(embed);
        const imageData = filename ? this.mediaFiles.get(filename) : undefined;
        
        if (imageData) {
          const xfrm = shape.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
          const position = this.extractPosition(xfrm);
          const rotation = this.extractRotation(xfrm);

          // If this element is in a group, add the group's offset
          const finalX = groupPosition ? groupPosition.x + position.x : position.x;
          const finalY = groupPosition ? groupPosition.y + position.y : position.y;

          images.push({
            id: `image_${imageCounter++}`,
            imageData,
            filename,
            x: finalX,
            y: finalY,
            width: position.width,
            height: position.height,
            rotation,
          });
        }
      }
    }

    return images;
  }

  private parseTextBoxes(
    shapes: NodeListOf<Element>, 
    slideNumber: number,
    groupPosition?: { x: number; y: number; width: number; height: number },
    startCounter: number = 1
  ): ParsedSlide['textBoxes'] {
    const textBoxes: ParsedSlide['textBoxes'] = [];
    let textCounter = startCounter;

    // Get master defaults for this slide
    const masterDefaults = this.masterDefaults.get(`slide${slideNumber}`) || {};

    for (const shape of Array.from(shapes)) {
      const txBody = shape.querySelector('p\\:txBody, txBody');
      if (!txBody) continue;

      const paragraphs = txBody.querySelectorAll('a\\:p, p');
      let content = '';
      // Track default properties for the entire text box (used if no run properties exist)
      let defaultFontSize: number | undefined;
      let defaultFontFamily: string | undefined;
      let defaultColor: string | undefined;
      let defaultBold = false;
      let defaultItalic = false;
      let align: 'left' | 'center' | 'right' = 'left';

      for (const para of Array.from(paragraphs)) {
        const pPr = para.querySelector('a\\:pPr, pPr');
        
        if (pPr) {
          const algn = pPr.getAttribute('algn');
          if (algn === 'ctr') align = 'center';
          else if (algn === 'r') align = 'right';
          
          // Check for default text properties at paragraph level
          const defRPr = pPr.querySelector('a\\:defRPr, defRPr');
          if (defRPr && !defaultFontSize) {
            const sz = defRPr.getAttribute('sz');
            if (sz) {
              // PowerPoint stores font size in hundredths of a point (e.g., 2400 = 24pt)
              // Convert to points, then to pixels (1pt = 4/3 px)
              const points = parseInt(sz) / 100;
              defaultFontSize = points * (4 / 3);
            }
            
            const typeface = defRPr.querySelector('a\\:latin, latin')?.getAttribute('typeface');
            if (typeface) defaultFontFamily = typeface;
            
            const solidFill = defRPr.querySelector('a\\:solidFill, solidFill');
            if (solidFill) defaultColor = this.extractColor(solidFill);
            
            if (defRPr.getAttribute('b') === '1') defaultBold = true;
            if (defRPr.getAttribute('i') === '1') defaultItalic = true;
          }
        }

        // Process all child elements in order to preserve line breaks and styling
        const children = Array.from(para.children);
        
        // First pass: collect all runs with their formatting
        const runs: Array<{ text: string; bold: boolean; italic: boolean; color?: string }> = [];
        
        for (const child of children) {
          const tagName = child.tagName.toLowerCase();
          
          // Check for line breaks
          if (tagName.includes('br')) {
            runs.push({ text: '<br>', bold: false, italic: false });
          }
          // Check for text runs
          else if (tagName.includes('r')) {
            const text = child.querySelector('a\\:t, t')?.textContent || '';
            if (!text) continue;

            // Extract formatting for this specific run
            const rPr = child.querySelector('a\\:rPr, rPr');
            let runBold = defaultBold;
            let runItalic = defaultItalic;
            let runColor: string | undefined = defaultColor;
            
            if (rPr) {
              const sz = rPr.getAttribute('sz');
              if (sz) {
                const points = parseInt(sz) / 100;
                const fontSize = points * (4 / 3);
                if (!defaultFontSize) defaultFontSize = fontSize;
              }
              
              const typeface = rPr.querySelector('a\\:latin, latin')?.getAttribute('typeface');
              if (typeface && !defaultFontFamily) {
                defaultFontFamily = typeface;
                // Log problematic fonts for debugging
                if (typeface.includes('Corsiva') || typeface.includes('Tai Lue')) {
                  console.log(`Found special font: ${typeface}, size from sz attr: ${sz}`)
                }
              }
              
              const solidFill = rPr.querySelector('a\\:solidFill, solidFill');
              if (solidFill) {
                runColor = this.extractColor(solidFill);
                // Log color extraction for problematic fonts
                if (defaultFontFamily && (defaultFontFamily.includes('Corsiva') || defaultFontFamily.includes('Tai Lue'))) {
                  console.log(`Color for ${defaultFontFamily}: ${runColor}`);
                }
              }
              
              if (rPr.getAttribute('b') === '1') runBold = true;
              if (rPr.getAttribute('i') === '1') runItalic = true;
            }

            // Set default color from first run if not set
            if (!defaultColor && runColor) {
              defaultColor = runColor;
            }
            
            runs.push({ text, bold: runBold, italic: runItalic, color: runColor });
          }
        }
        
        // Second pass: merge consecutive runs with same formatting and build styled text
        let i = 0;
        while (i < runs.length) {
          const run = runs[i];
          
          if (run.text === '<br>') {
            content += '<br>';
            i++;
            continue;
          }
          
          // Collect all consecutive runs with the same formatting
          let mergedText = run.text;
          let j = i + 1;
          while (j < runs.length && 
                 runs[j].text !== '<br>' &&
                 runs[j].bold === run.bold && 
                 runs[j].italic === run.italic && 
                 runs[j].color === run.color) {
            mergedText += runs[j].text;
            j++;
          }
          
          // Apply styling tags to merged text
          let styledText = mergedText;
          
          // Apply bold first (innermost)
          if (run.bold !== defaultBold) {
            if (run.bold) {
              styledText = `<b>${styledText}</b>`;
            }
          }
          
          // Apply italic
          if (run.italic !== defaultItalic) {
            if (run.italic) {
              styledText = `<i>${styledText}</i>`;
            }
          }
          
          // Apply color last (outermost) - this ensures color wraps around bold/italic
          if (run.color && defaultColor && run.color !== defaultColor) {
            const colorHex = run.color.replace('#', '');
            styledText = `<c:${colorHex}>${styledText}</c:${colorHex}>`;
          }
          
          content += styledText;
          i = j;
        }
        
        content += '\n';
      }

      content = content.trimEnd();
      if (content) {
        const xfrm = shape.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
        const position = this.extractPosition(xfrm);
        const rotation = this.extractRotation(xfrm);

        // Provide reasonable defaults if values are missing
        // Use inheritance chain: element -> paragraph -> master defaults -> fallbacks
        if (!defaultFontSize) {
          // Try to get font size from text body properties
          const bodyPr = txBody.querySelector('a\\:bodyPr, bodyPr');
          if (bodyPr) {
            const defTextPr = bodyPr.querySelector('a\\:defPPr > a\\:defRPr, defPPr > defRPr');
            if (defTextPr) {
              const sz = defTextPr.getAttribute('sz');
              if (sz) {
                defaultFontSize = (parseInt(sz) / 100) * (4 / 3);
              }
            }
          }
          // Use master defaults
          if (!defaultFontSize && masterDefaults.fontSize) {
            defaultFontSize = masterDefaults.fontSize;
            console.log(`Using master default font size: ${defaultFontSize}px`);
          }
          // Final fallback
          if (!defaultFontSize) {
            defaultFontSize = 24; // 18pt default
            console.warn(`No font size found for text, using fallback: ${defaultFontSize}px`);
          }
        }
        
        if (!defaultFontFamily) {
          // Use master defaults
          if (masterDefaults.fontFamily) {
            defaultFontFamily = masterDefaults.fontFamily;
            console.log(`Using master default font family: ${defaultFontFamily}`);
          } else {
            defaultFontFamily = 'Arial'; // Fallback font
          }
        }
        
        if (!defaultColor) {
          // Use master defaults
          if (masterDefaults.color) {
            defaultColor = masterDefaults.color;
            console.log(`Using master default color: ${defaultColor}`);
          } else {
            defaultColor = '#000000'; // Fallback color
          }
        }

        console.log('Text box parsed:', {
          content: content.substring(0, 50),
          fontSize: defaultFontSize,
          fontFamily: defaultFontFamily,
          color: defaultColor,
          bold: defaultBold,
          italic: defaultItalic,
          align,
          inGroup: !!groupPosition
        });

        // If this element is in a group, add the group's offset
        const finalX = groupPosition ? groupPosition.x + position.x : position.x;
        const finalY = groupPosition ? groupPosition.y + position.y : position.y;

        textBoxes.push({
          id: `text_${textCounter++}`,
          content,
          x: finalX,
          y: finalY,
          width: position.width,
          height: position.height,
          fontSize: defaultFontSize,
          fontFamily: defaultFontFamily,
          color: defaultColor,
          bold: defaultBold,
          italic: defaultItalic,
          align,
          rotation,
        });
      }
    }

    return textBoxes;
  }

  private parseVideos(shapes: NodeListOf<Element>, relationships: Map<string, string>): ParsedSlide['videos'] {
    const videos: ParsedSlide['videos'] = [];
    let videoCounter = 1;

    for (const shape of Array.from(shapes)) {
      const videoFile = shape.querySelector('p\\:videoFile, videoFile');
      if (!videoFile) continue;

      const link = videoFile.getAttribute('r:link') || videoFile.getAttribute('link');
      if (link) {
        const filename = relationships.get(link);
        const videoData = filename ? this.mediaFiles.get(filename) : undefined;
        
        if (videoData) {
          const xfrm = shape.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
          const position = this.extractPosition(xfrm);

          videos.push({
            id: `video_${videoCounter++}`,
            videoData,
            filename,
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height,
          });
        }
      }
    }

    return videos;
  }

  private parseAudios(doc: Document, shapes: NodeListOf<Element>, relationships: Map<string, string>): ParsedSlide['audios'] {
    const audios: ParsedSlide['audios'] = [];
    let audioCounter = 1;

    console.log('Parsing audio - relationships:', Array.from(relationships.entries()));
    console.log('Total shapes to check:', shapes.length);

    // Method 1: Check for audio in shapes with audioFile element
    for (const shape of Array.from(shapes)) {
      // Check what type of media element this is
      const audioFile = shape.querySelector('p\\:audioFile, audioFile');
      const videoFile = shape.querySelector('p\\:videoFile, videoFile');
      
      if (videoFile) {
        console.log('Found videoFile element (skipping for audio):', videoFile.getAttribute('r:link') || videoFile.getAttribute('link'));
      }
      
      if (audioFile) {
        console.log('Found audioFile element in shape:', audioFile.outerHTML);
        
        const link = audioFile.getAttribute('r:link') || audioFile.getAttribute('link');
        console.log('Audio link ID:', link);
        
        if (link) {
          const filename = relationships.get(link);
          console.log('Resolved filename:', filename);
          
          const audioData = filename ? this.mediaFiles.get(filename) : undefined;
          
          if (audioData) {
            // Try to get position from shape's transform
            let xfrm = shape.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
            
            // If no xfrm found, check if there's a pic (picture) element with the audio's visual representation
            if (!xfrm) {
              const pic = shape.querySelector('p\\:pic, pic');
              if (pic) {
                xfrm = pic.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
                console.log('Found xfrm in pic element for audio');
              }
            }
            
            const position = this.extractPosition(xfrm);
            console.log('Audio from shape - position:', position, 'xfrm found:', !!xfrm);

            // Use default EMU values if position is invalid
            const finalPosition = (position.width > 0 && position.height > 0) 
              ? position 
              : { x: 914400, y: 5715000, width: 2743200, height: 548640 };

            audios.push({
              id: `audio_${audioCounter++}`,
              audioData,
              filename,
              x: finalPosition.x,
              y: finalPosition.y,
              width: finalPosition.width,
              height: finalPosition.height,
            });
          } else {
            console.warn('Audio file not found in mediaFiles:', filename);
          }
        }
      }
    }

    // Method 2: Check graphic frames for embedded audio
    const graphicFrames = doc.querySelectorAll('p\\:graphicFrame, graphicFrame');
    console.log('Checking', graphicFrames.length, 'graphic frames for audio');
    
    for (const frame of Array.from(graphicFrames)) {
      // Look for audio in graphic data
      const audioCD = frame.querySelector('p\\:audioCD, audioCD');
      const audioFile = frame.querySelector('p\\:audioFile, audioFile');
      
      if (audioCD || audioFile) {
        console.log('Found audio in graphicFrame:', audioFile?.outerHTML || audioCD?.outerHTML);
        
        const link = audioFile?.getAttribute('r:link') || audioFile?.getAttribute('link') ||
                     audioCD?.getAttribute('r:link') || audioCD?.getAttribute('link');
        
        if (link) {
          const filename = relationships.get(link);
          const audioData = filename ? this.mediaFiles.get(filename) : undefined;
          
          if (audioData) {
            const xfrm = frame.querySelector('a\\:xfrm, xfrm, p\\:xfrm');
            const position = this.extractPosition(xfrm);

            console.log('Found audio in graphicFrame:', { filename, position });

            audios.push({
              id: `audio_${audioCounter++}`,
              audioData,
              filename,
              x: position.x,
              y: position.y,
              width: position.width,
              height: position.height,
            });
          }
        }
      }
    }

    // Method 3: Scan all relationship entries for audio files (mp4 can be audio too)
    console.log('Scanning all relationships for audio files...');
    for (const [relId, filename] of relationships.entries()) {
      const isAudio = filename.match(/\.(mp3|wav|m4a|mp4|aac|wma|ogg)$/i);
      const alreadyFound = audios.some(a => a.filename === filename);
      
      if (isAudio && !alreadyFound) {
        console.log('Found audio relationship:', relId, '->', filename);
        
        const audioData = this.mediaFiles.get(filename);
        if (audioData) {
          // Try multiple ways to find elements referencing this relationship
          // 1. Standard r:link/r:embed attributes
          let elements = doc.querySelectorAll(`[r\\:link="${relId}"], [link="${relId}"], [r\\:embed="${relId}"], [embed="${relId}"]`);
          
          // 2. If not found, search all elements and check their attributes manually
          if (elements.length === 0) {
            console.log('No elements with standard attributes, searching manually for', relId);
            const allElements = doc.querySelectorAll('*');
            const matches: Element[] = [];
            for (const el of Array.from(allElements)) {
              for (const attr of Array.from(el.attributes)) {
                if (attr.value === relId) {
                  console.log('Found element with', attr.name, '=', relId, ':', el.tagName);
                  matches.push(el);
                  break;
                }
              }
            }
            elements = matches.length > 0 ? (matches as any) : elements;
          }
          
          // Default position in EMUs (bottom left corner, ~300x60px equivalent on standard slide)
          // Standard PowerPoint slide is 9144000 x 6858000 EMUs (10" x 7.5")
          let position = { x: 914400, y: 5715000, width: 2743200, height: 548640 };
          
          if (elements.length > 0) {
            console.log('Found', elements.length, 'elements referencing', relId);
            const element = elements[0];
            console.log('Element tag name:', element.tagName, 'Element:', element.outerHTML.substring(0, 200));
            
            // Look for the parent shape that contains this audio
            let shape = element.closest('p\\:sp, sp');
            console.log('Found parent shape:', !!shape);
            let xfrm = null;
            
            if (shape) {
              // First try to get position from shape's spPr
              xfrm = shape.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
              console.log('Shape spPr xfrm:', !!xfrm, xfrm ? this.extractPosition(xfrm) : null);
              
              // Also check if there's a pic element (visual representation) in the same shape
              if (!xfrm || this.extractPosition(xfrm).width === 0) {
                const pic = shape.querySelector('p\\:pic, pic');
                console.log('Found pic element in shape:', !!pic);
                if (pic) {
                  xfrm = pic.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
                  console.log('Using pic element position for audio:', xfrm ? this.extractPosition(xfrm) : null);
                }
              }
            } else {
              console.log('No parent shape found, searching for xfrm in element hierarchy');
            }
            
            // Fallback: search in element or parent hierarchy
            if (!xfrm) {
              xfrm = element.querySelector('a\\:xfrm, xfrm, p\\:xfrm');
              console.log('Direct xfrm in element:', !!xfrm);
              if (!xfrm) {
                let parent = element.parentElement;
                let level = 0;
                while (parent && !xfrm && parent !== doc.documentElement && level < 10) {
                  xfrm = parent.querySelector('a\\:xfrm, xfrm, p\\:xfrm, p\\:spPr > a\\:xfrm');
                  if (xfrm) console.log('Found xfrm in parent at level', level, this.extractPosition(xfrm));
                  parent = parent.parentElement;
                  level++;
                }
              }
            }
            
            if (xfrm) {
              const extractedPos = this.extractPosition(xfrm);
              console.log('Final extracted position:', extractedPos);
              // Only use extracted position if it has valid width/height
              if (extractedPos.width > 0 && extractedPos.height > 0) {
                position = extractedPos;
              } else {
                console.log('Extracted position has zero width/height, using default');
              }
            } else {
              console.log('No xfrm found anywhere, using default position');
            }
          } else {
            console.log('No elements found referencing', relId);
          }
          
          console.log('Adding audio from relationship scan:', { filename, position });

          audios.push({
            id: `audio_${audioCounter++}`,
            audioData,
            filename,
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height,
          });
        }
      }
    }

    console.log(`✓ Found ${audios.length} total audio elements`);
    return audios;
  }

  private parseTables(graphicFrames: NodeListOf<Element>): ParsedSlide['textBoxes'] {
    const textBoxes: ParsedSlide['textBoxes'] = [];
    let tableCounter = 1;

    for (const frame of Array.from(graphicFrames)) {
      const table = frame.querySelector('a\\:tbl, tbl');
      if (!table) continue;

      // Get table position from the graphic frame
      const xfrm = frame.querySelector('a\\:xfrm, xfrm');
      const tablePosition = this.extractPosition(xfrm);

      // Parse all table cells and combine into a text representation
      const rows = table.querySelectorAll('a\\:tr, tr');
      let tableText = '';
      
      for (const row of Array.from(rows)) {
        const cells = row.querySelectorAll('a\\:tc, tc');
        const cellTexts: string[] = [];
        
        for (const cell of Array.from(cells)) {
          const paragraphs = cell.querySelectorAll('a\\:p, p');
          let cellText = '';
          
          for (const para of Array.from(paragraphs)) {
            const runs = para.querySelectorAll('a\\:r, r');
            for (const run of Array.from(runs)) {
              const text = run.querySelector('a\\:t, t')?.textContent || '';
              cellText += text;
            }
          }
          
          cellTexts.push(cellText.trim() || '');
        }
        
        if (cellTexts.some(text => text)) {
          tableText += cellTexts.join(' | ') + '\n';
        }
      }

      if (tableText.trim()) {
        // Get first cell's formatting as default
        const firstCell = table.querySelector('a\\:tc, tc');
        const firstRun = firstCell?.querySelector('a\\:rPr, rPr');
        
        let fontSize: number | undefined;
        let fontFamily: string | undefined;
        let color: string | undefined;
        let bold = false;
        let italic = false;
        
        if (firstRun) {
          const sz = firstRun.getAttribute('sz');
          if (sz) fontSize = parseInt(sz) / 100;
          
          const typeface = firstRun.querySelector('a\\:latin, latin')?.getAttribute('typeface');
          if (typeface) fontFamily = typeface;
          
          const solidFill = firstRun.querySelector('a\\:solidFill, solidFill');
          if (solidFill) color = this.extractColor(solidFill);
          
          if (firstRun.getAttribute('b') === '1') bold = true;
          if (firstRun.getAttribute('i') === '1') italic = true;
        }

        textBoxes.push({
          id: `table_${tableCounter++}`,
          content: tableText.trim(),
          x: tablePosition.x,
          y: tablePosition.y,
          width: tablePosition.width,
          height: tablePosition.height,
          fontSize,
          fontFamily,
          color,
          bold,
          italic,
          align: 'left',
        });
      }
    }

    return textBoxes;
  }

  private extractPosition(xfrm: Element | null): { x: number; y: number; width: number; height: number } {
    if (!xfrm) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const off = xfrm.querySelector('a\\:off, off');
    const ext = xfrm.querySelector('a\\:ext, ext');

    // PowerPoint uses EMUs (English Metric Units) for positions and sizes
    // Keep values in EMUs - they will be scaled proportionally by scalePosition()
    // relative to the slide dimensions (which are also in EMUs)
    const x = parseInt(off?.getAttribute('x') || '0');
    const y = parseInt(off?.getAttribute('y') || '0');
    const width = parseInt(ext?.getAttribute('cx') || '0');
    const height = parseInt(ext?.getAttribute('cy') || '0');

    return { x, y, width, height };
  }

  private extractRotation(xfrm: Element | null): number | undefined {
    if (!xfrm) return undefined;
    
    const rot = xfrm.getAttribute('rot');
    if (rot) {
      // PowerPoint rotation is in 60,000ths of a degree
      return parseInt(rot) / 60000;
    }
    
    return undefined;
  }

  private extractColor(element: Element): string | undefined {
    const srgbClr = element.querySelector('a\\:srgbClr, srgbClr');
    if (srgbClr) {
      const val = srgbClr.getAttribute('val');
      if (!val) return undefined;
      
      // Check for luminance modifiers
      const color = this.applyColorModifiers(`#${val}`, srgbClr);
      return color;
    }

    const schemeClr = element.querySelector('a\\:schemeClr, schemeClr');
    if (schemeClr) {
      const scheme = schemeClr.getAttribute('val');
      if (scheme) {
        // Resolve semantic color to actual scheme color using color map
        const actualScheme = this.colorMap.get(scheme) || scheme;
        
        // Try to get theme color first, fallback to defaults
        const baseColor = this.themeColors.get(actualScheme) || this.getDefaultSchemeColor(actualScheme);
        
        // Apply luminance modifiers if present
        const result = this.applyColorModifiers(baseColor, schemeClr);
        
        // Log for debugging (only once per unique combination)
        if (scheme !== actualScheme) {
          console.log(`Color: ${scheme} → ${actualScheme} = ${baseColor} → ${result}`);
        }
        
        return result;
      }
    }

    return undefined;
  }

  private applyColorModifiers(color: string, element: Element): string {
    const lumMod = element.querySelector('a\\:lumMod, lumMod');
    const lumOff = element.querySelector('a\\:lumOff, lumOff');
    
    if (!lumMod && !lumOff) return color;
    
    // Parse hex color to RGB
    const hex = color.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Apply luminance modulation (multiply, value is in percentage * 1000)
    if (lumMod) {
      const modVal = parseInt(lumMod.getAttribute('val') || '100000') / 100000;
      r = Math.round(r * modVal);
      g = Math.round(g * modVal);
      b = Math.round(b * modVal);
    }
    
    // Apply luminance offset (add, value is in percentage * 1000)
    if (lumOff) {
      const offVal = parseInt(lumOff.getAttribute('val') || '0') / 1000;
      const offset = Math.round(255 * offVal / 100);
      r = r + offset;
      g = g + offset;
      b = b + offset;
    }
    
    // Clamp values to 0-255
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    
    // Convert back to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private parseXml(xml: string): Document {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML Parse Error: ${parserError.textContent}`);
    }
    
    return doc;
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const pptxParserService = new PptxParserService();
