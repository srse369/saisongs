import PizZip from 'pizzip';

interface ParsedSlide {
  background?: {
    type: 'solid' | 'image';
    value: string;
    imageData?: string;
  };
  images: Array<{
    id: string;
    imageData: string;
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
    this.extractMediaFiles();
    
    const slideCount = this.getSlideCount();
    const slides: ParsedSlide[] = [];
    
    for (let i = 1; i <= slideCount; i++) {
      const slide = this.parseSlide(i, dimensions);
      slides.push(slide);
    }
    
    return { slides, dimensions };
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
    
    const shapes = doc.querySelectorAll('p\\:sp, sp');
    const images = this.parseImages(shapes, relationships);
    const textBoxes = this.parseTextBoxes(shapes);
    
    // Also parse tables as text boxes
    const tables = doc.querySelectorAll('p\\:graphicFrame, graphicFrame');
    const tableTextBoxes = this.parseTables(tables);
    textBoxes.push(...tableTextBoxes);
    
    const videos = this.parseVideos(shapes, relationships);

    return {
      background,
      images,
      textBoxes,
      videos,
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
          };
        }
      }
    }

    console.log('No background color or image found, returning undefined');
    return undefined;
  }

  private parseImages(shapes: NodeListOf<Element>, relationships: Map<string, string>): ParsedSlide['images'] {
    const images: ParsedSlide['images'] = [];
    let imageCounter = 1;

    for (const shape of Array.from(shapes)) {
      const blipFill = shape.querySelector('p\\:blipFill, blipFill');
      if (!blipFill) continue;

      const blip = blipFill.querySelector('a\\:blip, blip');
      const embed = blip?.getAttribute('r:embed') || blip?.getAttribute('embed');
      
      if (embed) {
        const filename = relationships.get(embed);
        const imageData = filename ? this.mediaFiles.get(filename) : undefined;
        
        if (imageData) {
          const xfrm = shape.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
          const position = this.extractPosition(xfrm);
          const rotation = this.extractRotation(xfrm);

          images.push({
            id: `image_${imageCounter++}`,
            imageData,
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height,
            rotation,
          });
        }
      }
    }

    return images;
  }

  private parseTextBoxes(shapes: NodeListOf<Element>): ParsedSlide['textBoxes'] {
    const textBoxes: ParsedSlide['textBoxes'] = [];
    let textCounter = 1;

    for (const shape of Array.from(shapes)) {
      const txBody = shape.querySelector('p\\:txBody, txBody');
      if (!txBody) continue;

      const paragraphs = txBody.querySelectorAll('a\\:p, p');
      let content = '';
      let fontSize: number | undefined;
      let fontFamily: string | undefined;
      let color: string | undefined;
      let bold = false;
      let italic = false;
      let align: 'left' | 'center' | 'right' = 'left';

      for (const para of Array.from(paragraphs)) {
        const runs = para.querySelectorAll('a\\:r, r');
        const pPr = para.querySelector('a\\:pPr, pPr');
        
        if (pPr) {
          const algn = pPr.getAttribute('algn');
          if (algn === 'ctr') align = 'center';
          else if (algn === 'r') align = 'right';
        }

        for (const run of Array.from(runs)) {
          const text = run.querySelector('a\\:t, t')?.textContent || '';
          content += text;

          const rPr = run.querySelector('a\\:rPr, rPr');
          if (rPr) {
            const sz = rPr.getAttribute('sz');
            if (sz && !fontSize) fontSize = parseInt(sz) / 100;
            
            const typeface = rPr.querySelector('a\\:latin, latin')?.getAttribute('typeface');
            if (typeface && !fontFamily) fontFamily = typeface;
            
            const solidFill = rPr.querySelector('a\\:solidFill, solidFill');
            if (solidFill && !color) color = this.extractColor(solidFill);
            
            if (rPr.getAttribute('b') === '1') bold = true;
            if (rPr.getAttribute('i') === '1') italic = true;
          }
        }
        
        content += '\n';
      }

      content = content.trim();
      if (content) {
        const xfrm = shape.querySelector('p\\:spPr > a\\:xfrm, spPr > xfrm');
        const position = this.extractPosition(xfrm);
        const rotation = this.extractRotation(xfrm);

        textBoxes.push({
          id: `text_${textCounter++}`,
          content,
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
          fontSize,
          fontFamily,
          color,
          bold,
          italic,
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
      return val ? `#${val}` : undefined;
    }

    const schemeClr = element.querySelector('a\\:schemeClr, schemeClr');
    if (schemeClr) {
      const scheme = schemeClr.getAttribute('val');
      if (scheme) {
        const schemeMap: Record<string, string> = {
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
        };
        return schemeMap[scheme] || '#000000';
      }
    }

    return undefined;
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
