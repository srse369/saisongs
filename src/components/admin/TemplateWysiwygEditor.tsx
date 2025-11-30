import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import useImage from 'use-image';
import type { PresentationTemplate, ImageElement, TextElement, VideoElement, TemplateSlide, BackgroundElement, AspectRatio, SongContentStyle } from '../../types';
import { ASPECT_RATIO_DIMENSIONS } from '../../types';

interface TemplateWysiwygEditorProps {
  template: PresentationTemplate;
  onTemplateChange: (template: PresentationTemplate) => void;
}

// Get slide dimensions based on aspect ratio
function getSlideDimensions(aspectRatio: AspectRatio = '16:9') {
  return ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS['16:9'];
}

// Canvas display width (height calculated based on aspect ratio)
const CANVAS_WIDTH = 640;

// Helper to parse position (using full slide dimensions) - outside component for performance
function parsePosition(
  value: string | undefined, 
  position: string | undefined, 
  axis: 'x' | 'y',
  slideSize: number,
  elementSize: number,
  slideWidth: number,
  slideHeight: number
): number {
  if (value) {
    if (value.endsWith('%')) {
      return (parseFloat(value) / 100) * slideSize;
    }
    return parseFloat(value) || 0;
  }
  
  // Use predefined position (based on full slide dimensions)
  if (position) {
    const margin = 40; // Margin from edges in slide coordinates
    const positions: Record<string, { x: number; y: number }> = {
      'top-left': { x: margin, y: margin },
      'top-center': { x: (slideWidth - elementSize) / 2, y: margin },
      'top-right': { x: slideWidth - elementSize - margin, y: margin },
      'center-left': { x: margin, y: (slideHeight - elementSize) / 2 },
      'center': { x: (slideWidth - elementSize) / 2, y: (slideHeight - elementSize) / 2 },
      'center-right': { x: slideWidth - elementSize - margin, y: (slideHeight - elementSize) / 2 },
      'bottom-left': { x: margin, y: slideHeight - elementSize - margin },
      'bottom-center': { x: (slideWidth - elementSize) / 2, y: slideHeight - elementSize - margin },
      'bottom-right': { x: slideWidth - elementSize - margin, y: slideHeight - elementSize - margin },
    };
    return positions[position]?.[axis] ?? 0;
  }
  
  return 0;
}

// Element types for the canvas
type CanvasElement = {
  id: string;
  type: 'image' | 'text' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // For images
  url?: string;
  // For text
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  // Common
  opacity?: number;
  zIndex?: number;
  // For video behavior
  autoPlay?: boolean;
};

// URLImage component for loading images
// Try loading without CORS first, then fall back to anonymous mode
const URLImage: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
}> = ({ element, isSelected, onSelect, onChange }) => {
  // Try loading without CORS mode first (works better with corporate proxies/firewalls)
  const [image, imageStatus] = useImage(element.url || '');
  const shapeRef = useRef<Konva.Image>(null);

  // Show a placeholder rectangle if image fails to load or is loading
  if (!image || imageStatus === 'loading' || imageStatus === 'failed') {
    return (
      <Group
        id={element.id}
        x={element.x}
        y={element.y}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        }}
      >
        {/* Placeholder background */}
        <Rect
          width={element.width}
          height={element.height}
          fill="#374151"
          stroke={isSelected ? '#3b82f6' : '#6b7280'}
          strokeWidth={2}
          cornerRadius={4}
        />
        {/* Image icon */}
        <Text
          text="🖼️"
          fontSize={Math.min(element.width, element.height) * 0.3}
          x={element.width / 2}
          y={element.height / 2 - 20}
          offsetX={Math.min(element.width, element.height) * 0.15}
          align="center"
        />
        {/* Status text */}
        <Text
          text={imageStatus === 'loading' ? 'Loading...' : (element.url ? 'Failed to load' : 'No URL')}
          fontSize={12}
          fill="#9ca3af"
          x={element.width / 2}
          y={element.height / 2 + 10}
          offsetX={40}
          align="center"
        />
      </Group>
    );
  }

  return (
    <KonvaImage
      ref={shapeRef}
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation || 0}
      image={image}
      opacity={element.opacity ?? 1}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.round(Math.max(20, node.width() * scaleX)),
          height: Math.round(Math.max(20, node.height() * scaleY)),
          rotation: Math.round(node.rotation()),
        });
      }}
    />
  );
};

// DraggableText component
const DraggableText: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
}> = ({ element, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef<Konva.Text>(null);

  return (
    <Text
      ref={shapeRef}
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      text={element.content || 'Text'}
      fontSize={element.fontSize || 24}
      fontFamily={element.fontFamily || 'Arial'}
      fontStyle={element.fontWeight === 'bold' ? 'bold' : 'normal'}
      align={element.textAlign || 'center'}
      fill={element.color || '#ffffff'}
      opacity={element.opacity ?? 1}
      rotation={element.rotation || 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        const node = shapeRef.current;
        // Capture width/height on drag to ensure they're persisted
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
          width: node ? Math.round(node.width()) : undefined,
          height: node ? Math.round(node.height()) : undefined,
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const newWidth = Math.round(Math.max(20, node.width() * scaleX));
        const newHeight = Math.round(Math.max(20, node.height() * scaleY));
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: newWidth,
          height: newHeight,
          fontSize: Math.round(Math.max(8, (element.fontSize || 24) * scaleX)),
          rotation: Math.round(node.rotation()),
        });
      }}
    />
  );
};

// VideoPlaceholder component for video elements
const VideoPlaceholder: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
}> = ({ element, isSelected, onSelect, onChange }) => {
  const groupRef = useRef<Konva.Group>(null);

  return (
    <Group
      ref={groupRef}
      id={element.id}
      x={element.x}
      y={element.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.round(Math.max(40, (element.width || 0) * scaleX)),
          height: Math.round(Math.max(40, (element.height || 0) * scaleY)),
          rotation: Math.round(node.rotation()),
        });
      }}
    >
      <Rect
        width={element.width}
        height={element.height}
        fill="#111827"
        stroke={isSelected ? '#a855f7' : '#4b5563'}
        strokeWidth={2}
        cornerRadius={6}
      />
      <Text
        text="▶ Video"
        fontSize={16}
        fill="#e5e7eb"
        x={8}
        y={8}
      />
    </Group>
  );
};

export const TemplateWysiwygEditor: React.FC<TemplateWysiwygEditorProps> = ({
  template,
  onTemplateChange,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [slideListHasFocus, setSlideListHasFocus] = useState(true);
  const [canvasHasFocus, setCanvasHasFocus] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Calculate slide dimensions based on aspect ratio
  const { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } = getSlideDimensions(template.aspectRatio);
  const SCALE = CANVAS_WIDTH / SLIDE_WIDTH;
  const CANVAS_HEIGHT = CANVAS_WIDTH * (SLIDE_HEIGHT / SLIDE_WIDTH);

  // Get current slide
  const slides = template.slides && template.slides.length > 0 
    ? template.slides 
    : [{
        background: template.background,
        images: template.images || [],
        videos: template.videos || [],
        text: template.text || [],
      }];
  
  const currentSlide = slides[selectedSlideIndex] || slides[0];
  const referenceSlideIndex = template.referenceSlideIndex ?? 0;

  // Convert template elements to canvas elements (using full slide coordinates)
  const canvasElements: CanvasElement[] = useMemo(() => {
    const elements: CanvasElement[] = [
      ...(currentSlide.images || []).map((img): CanvasElement => ({
        id: img.id,
        type: 'image',
        x: parsePosition(img.x, img.position, 'x', SLIDE_WIDTH, parseFloat(img.width) || 100, SLIDE_WIDTH, SLIDE_HEIGHT),
        y: parsePosition(img.y, img.position, 'y', SLIDE_HEIGHT, parseFloat(img.height) || 100, SLIDE_WIDTH, SLIDE_HEIGHT),
        width: parseFloat(img.width) || 100,
        height: parseFloat(img.height) || 100,
        url: img.url,
        opacity: img.opacity,
        zIndex: img.zIndex || 1,
        rotation: img.rotation,
      })),
      ...(currentSlide.videos || []).map((vid): CanvasElement => ({
        id: vid.id,
        type: 'video',
        x: parsePosition(vid.x as string | undefined, vid.position, 'x', SLIDE_WIDTH, parseFloat(vid.width || '160') || 160, SLIDE_WIDTH, SLIDE_HEIGHT),
        y: parsePosition(vid.y as string | undefined, vid.position, 'y', SLIDE_HEIGHT, parseFloat(vid.height || '90') || 90, SLIDE_WIDTH, SLIDE_HEIGHT),
        width: parseFloat(vid.width || '160') || 160,
        height: parseFloat(vid.height || '90') || 90,
        url: vid.url,
        opacity: vid.opacity,
        zIndex: vid.zIndex || 1,
        autoPlay: vid.autoPlay,
        rotation: vid.rotation,
      })),
      ...(currentSlide.text || []).map((txt): CanvasElement => {
        const widthStr = txt.width || txt.maxWidth;
        const width = widthStr ? parseFloat(widthStr) || 600 : 600;
        const height = txt.height ? parseFloat(txt.height) || 100 : 100;
        return {
          id: txt.id,
          type: 'text',
          x: parsePosition(txt.x, txt.position, 'x', SLIDE_WIDTH, width, SLIDE_WIDTH, SLIDE_HEIGHT),
          y: parsePosition(txt.y, txt.position, 'y', SLIDE_HEIGHT, height, SLIDE_WIDTH, SLIDE_HEIGHT),
          width,
          height,
          content: txt.content,
          fontSize: parseFloat(txt.fontSize) || 48,
          fontFamily: txt.fontFamily,
          fontWeight: txt.fontWeight,
          textAlign: txt.textAlign || 'center',
          color: txt.color,
          opacity: txt.opacity,
          zIndex: txt.zIndex || 2,
          rotation: txt.rotation,
        };
      }),
    ];
    return elements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [currentSlide, SLIDE_WIDTH, SLIDE_HEIGHT]);

  // Get selected element
  const selectedElement = canvasElements.find(el => el.id === selectedId);

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    
    if (selectedId) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedId]);

  // Handle canvas click (focus canvas, optionally deselect)
  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    // Any click on the stage should give focus to the canvas editor
    setCanvasHasFocus(true);
    setSlideListHasFocus(false);

    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  // Update element in template
  const updateElement = useCallback((elementId: string, updates: Partial<CanvasElement>) => {
    const element = canvasElements.find(el => el.id === elementId);
    if (!element) return;

    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };

    if (element.type === 'image') {
      const images = [...(slideToUpdate.images || [])];
      const imgIndex = images.findIndex(img => img.id === elementId);
      if (imgIndex >= 0) {
        images[imgIndex] = {
          ...images[imgIndex],
          x: updates.x !== undefined ? `${Math.round(updates.x)}px` : images[imgIndex].x,
          y: updates.y !== undefined ? `${Math.round(updates.y)}px` : images[imgIndex].y,
          width: updates.width !== undefined ? `${Math.round(updates.width)}px` : images[imgIndex].width,
          height: updates.height !== undefined ? `${Math.round(updates.height)}px` : images[imgIndex].height,
          opacity: updates.opacity ?? images[imgIndex].opacity,
          url: updates.url ?? images[imgIndex].url,
          rotation:
            updates.rotation !== undefined
              ? Math.round(updates.rotation)
              : images[imgIndex].rotation,
          position: undefined, // Clear predefined position when using x/y
        };
        slideToUpdate.images = images;
      }
    } else if (element.type === 'video') {
      const videos = [...(slideToUpdate.videos || [])];
      const vidIndex = videos.findIndex(vid => vid.id === elementId);
      if (vidIndex >= 0) {
        videos[vidIndex] = {
          ...videos[vidIndex],
          x: updates.x !== undefined ? `${Math.round(updates.x)}px` : videos[vidIndex].x,
          y: updates.y !== undefined ? `${Math.round(updates.y)}px` : videos[vidIndex].y,
          width: updates.width !== undefined ? `${Math.round(updates.width)}px` : videos[vidIndex].width,
          height: updates.height !== undefined ? `${Math.round(updates.height)}px` : videos[vidIndex].height,
          opacity: updates.opacity ?? videos[vidIndex].opacity,
          url: updates.url ?? videos[vidIndex].url,
          autoPlay: updates.autoPlay ?? videos[vidIndex].autoPlay,
          rotation:
            updates.rotation !== undefined
              ? Math.round(updates.rotation)
              : videos[vidIndex].rotation,
          position: undefined, // Clear predefined position when using x/y
        };
        slideToUpdate.videos = videos;
      }
    } else if (element.type === 'text') {
      const texts = [...(slideToUpdate.text || [])];
      const txtIndex = texts.findIndex(txt => txt.id === elementId);
      if (txtIndex >= 0) {
        texts[txtIndex] = {
          ...texts[txtIndex],
          x: updates.x !== undefined ? `${Math.round(updates.x)}px` : texts[txtIndex].x,
          y: updates.y !== undefined ? `${Math.round(updates.y)}px` : texts[txtIndex].y,
          content: updates.content ?? texts[txtIndex].content,
          fontSize: updates.fontSize !== undefined ? `${Math.round(updates.fontSize)}px` : texts[txtIndex].fontSize,
          color: updates.color ?? texts[txtIndex].color,
          fontWeight: updates.fontWeight ?? texts[txtIndex].fontWeight,
          textAlign: updates.textAlign ?? texts[txtIndex].textAlign,
          opacity: updates.opacity ?? texts[txtIndex].opacity,
          width:
            updates.width !== undefined
              ? `${Math.round(updates.width)}px`
              : texts[txtIndex].width,
          height:
            updates.height !== undefined
              ? `${Math.round(updates.height)}px`
              : texts[txtIndex].height,
          maxWidth:
            updates.width !== undefined
              ? `${Math.round(updates.width)}px`
              : texts[txtIndex].maxWidth,
          rotation:
            updates.rotation !== undefined
              ? Math.round(updates.rotation)
              : texts[txtIndex].rotation,
          position: undefined, // Clear predefined position when using x/y
        };
        slideToUpdate.text = texts;
      }
    }

    newSlides[selectedSlideIndex] = slideToUpdate;
    
    // Update template
    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
  }, [canvasElements, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange]);

  // Keyboard movement for selected elements when canvas has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canvasHasFocus || !selectedId) return;

      // Ignore when typing in inputs/textareas/selects
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      const element = canvasElements.find(el => el.id === selectedId);
      if (!element) return;

      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;

      switch (e.key) {
        case 'ArrowLeft':
          dx = -step;
          break;
        case 'ArrowRight':
          dx = step;
          break;
        case 'ArrowUp':
          dy = -step;
          break;
        case 'ArrowDown':
          dy = step;
          break;
        default:
          return;
      }

      e.preventDefault();
      updateElement(selectedId, {
        x: (element.x || 0) + dx,
        y: (element.y || 0) + dy,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasHasFocus, selectedId, canvasElements, updateElement]);

  // Add new image (using full slide coordinates)
  const handleAddImage = () => {
    const newImage: ImageElement = {
      id: `image-${Date.now()}`,
      url: '',
      width: '200px',
      height: '200px',
      x: '100px',
      y: '100px',
      opacity: 1,
      zIndex: 1,
    };

    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };
    slideToUpdate.images = [...(slideToUpdate.images || []), newImage];
    newSlides[selectedSlideIndex] = slideToUpdate;

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });

    setSelectedId(newImage.id);
  };

  // Add new video (using full slide coordinates)
  const handleAddVideo = () => {
    const newVideo: VideoElement = {
      id: `video-${Date.now()}`,
      url: '',
      width: '320px',
      height: '180px',
      x: '100px',
      y: '100px',
      opacity: 1,
      zIndex: 1,
      autoPlay: true,
      loop: true,
      muted: true,
    };

    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };
    slideToUpdate.videos = [...(slideToUpdate.videos || []), newVideo];
    newSlides[selectedSlideIndex] = slideToUpdate;

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });

    setSelectedId(newVideo.id);
  };

  // Add new text (using full slide coordinates)
  const handleAddText = () => {
    const newText: TextElement = {
      id: `text-${Date.now()}`,
      content: 'New Text',
      fontSize: '64px',
      color: '#ffffff',
      x: '100px',
      y: '100px',
      width: '600px',
      height: '100px',
      textAlign: 'center',
      opacity: 1,
      zIndex: 2,
    };

    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };
    slideToUpdate.text = [...(slideToUpdate.text || []), newText];
    newSlides[selectedSlideIndex] = slideToUpdate;

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });

    setSelectedId(newText.id);
  };

  // Delete selected element
  const handleDeleteSelected = () => {
    if (!selectedId) return;

    const element = canvasElements.find(el => el.id === selectedId);
    if (!element) return;

    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };

    if (element.type === 'image') {
      slideToUpdate.images = (slideToUpdate.images || []).filter(img => img.id !== selectedId);
    } else if (element.type === 'video') {
      slideToUpdate.videos = (slideToUpdate.videos || []).filter(vid => vid.id !== selectedId);
    } else if (element.type === 'text') {
      slideToUpdate.text = (slideToUpdate.text || []).filter(txt => txt.id !== selectedId);
    }

    newSlides[selectedSlideIndex] = slideToUpdate;

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });

    setSelectedId(null);
  };

  // Update background
  const handleBackgroundChange = (updates: Partial<BackgroundElement>) => {
    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };
    slideToUpdate.background = {
      ...slideToUpdate.background,
      ...updates,
    } as BackgroundElement;
    newSlides[selectedSlideIndex] = slideToUpdate;

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
  };

  // Update song content style (only for reference slide)
  const handleSongContentStyleChange = (
    styleType: 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle',
    updates: Partial<SongContentStyle>
  ) => {
    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[referenceSlideIndex] };
    
    // Default values for song content styles
    const defaultStyle: SongContentStyle = {
      yPosition: styleType === 'songTitleStyle' ? 5 : styleType === 'songLyricsStyle' ? 20 : 75,
      fontSize: styleType === 'songTitleStyle' ? '48px' : styleType === 'songLyricsStyle' ? '36px' : '24px',
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#ffffff',
    };
    
    slideToUpdate[styleType] = {
      ...defaultStyle,
      ...slideToUpdate[styleType],
      ...updates,
    };
    newSlides[referenceSlideIndex] = slideToUpdate;

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
  };

  // Get current song content styles from reference slide
  const referenceSlide = slides[referenceSlideIndex] || slides[0];
  const songTitleStyle: SongContentStyle = referenceSlide?.songTitleStyle || {
    yPosition: 5,
    fontSize: '48px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
  };
  const songLyricsStyle: SongContentStyle = referenceSlide?.songLyricsStyle || {
    yPosition: 20,
    fontSize: '36px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
  };
  const songTranslationStyle: SongContentStyle = referenceSlide?.songTranslationStyle || {
    yPosition: 75,
    fontSize: '24px',
    fontWeight: 'normal',
    textAlign: 'center',
    color: '#ffffff',
  };

  // Get background color/style
  const bgColor = currentSlide.background?.type === 'color' 
    ? currentSlide.background.value 
    : '#1a1a2e';

  // Helper for thumbnail background color
  const getSlideBgColor = (slide: TemplateSlide): string => {
    if (slide.background?.type === 'color' && slide.background.value) {
      return slide.background.value;
    }
    return '#111827'; // default dark background
  };

  const slideDimensionsLabel = `${SLIDE_WIDTH}×${SLIDE_HEIGHT} → ${CANVAS_WIDTH}×${Math.round(CANVAS_HEIGHT)}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Main editor area */}
      <div className="flex gap-4">
        {/* Slide thumbnails list (left) */}
        <div
          className="w-44 flex-shrink-0 bg-gray-900/40 dark:bg-gray-900/60 rounded-lg p-2 max-h-[600px] overflow-y-auto"
        >
          {slides.map((slide, idx) => {
            const isSelected = idx === selectedSlideIndex;
            const isReference = idx === referenceSlideIndex;
            const isStatic = slides.length > 1 && idx !== referenceSlideIndex;
            const isIntro = isStatic && idx < referenceSlideIndex;

            return (
              <button
                key={idx}
                type="button"
                ref={(el) => {
                  thumbnailRefs.current[idx] = el;
                }}
                onClick={() => {
                  setSelectedSlideIndex(idx);
                  setSelectedId(null);
                  setSlideListHasFocus(true);
                  setCanvasHasFocus(false);
                }}
                onFocus={() => {
                  setSlideListHasFocus(true);
                  setCanvasHasFocus(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIndex = Math.max(0, idx - 1);
                    setSelectedSlideIndex(prevIndex);
                    setSelectedId(null);
                    const prevBtn = thumbnailRefs.current[prevIndex];
                    if (prevBtn) {
                      prevBtn.focus();
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIndex = Math.min(slides.length - 1, idx + 1);
                    setSelectedSlideIndex(nextIndex);
                    setSelectedId(null);
                    const nextBtn = thumbnailRefs.current[nextIndex];
                    if (nextBtn) {
                      nextBtn.focus();
                    }
                  }
                }}
                className={`w-full mb-2 last:mb-0 rounded-md text-left transition-colors ${
                  isSelected
                    ? slideListHasFocus
                      ? 'border-2 border-white bg-gray-800'
                      : 'border border-blue-500 bg-gray-800'
                    : 'border border-gray-700 bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {/* Thumbnail with aspect ratio and elements */}
                <div className="relative w-full rounded-t-md overflow-hidden bg-gray-800">
                  {/* Aspect-ratio box */}
                  <div
                    className="w-full relative"
                    style={{
                      paddingTop: template.aspectRatio === '4:3' ? '75%' : '56.25%', // 4:3 or 16:9
                      backgroundColor: getSlideBgColor(slide),
                      backgroundImage:
                        slide.background?.type === 'image' && slide.background.value
                          ? `url(${slide.background.value})`
                          : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Inner absolute container for elements */}
                    <div className="absolute inset-0">
                      {/* Image elements */}
                      {(slide.images || []).map((img) => {
                        const imgWidth = parseFloat(img.width) || 100;
                        const imgHeight = parseFloat(img.height) || 100;
                        const x = parsePosition(
                          img.x,
                          img.position,
                          'x',
                          SLIDE_WIDTH,
                          imgWidth,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );
                        const y = parsePosition(
                          img.y,
                          img.position,
                          'y',
                          SLIDE_HEIGHT,
                          imgHeight,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );

                        return (
                          <div
                            key={img.id}
                            className="absolute rounded-[2px] border border-white/40 bg-gray-500/40"
                            style={{
                              left: `${(x / SLIDE_WIDTH) * 100}%`,
                              top: `${(y / SLIDE_HEIGHT) * 100}%`,
                              width: `${(imgWidth / SLIDE_WIDTH) * 100}%`,
                              height: `${(imgHeight / SLIDE_HEIGHT) * 100}%`,
                              backgroundImage: img.url ? `url(${img.url})` : undefined,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                        );
                      })}

                      {/* Video elements */}
                      {(slide.videos || []).map((vid) => {
                        const vidWidth = parseFloat(vid.width || '160') || 160;
                        const vidHeight = parseFloat(vid.height || '90') || 90;
                        const x = parsePosition(
                          vid.x as string | undefined,
                          vid.position,
                          'x',
                          SLIDE_WIDTH,
                          vidWidth,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );
                        const y = parsePosition(
                          vid.y as string | undefined,
                          vid.position,
                          'y',
                          SLIDE_HEIGHT,
                          vidHeight,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );

                        return (
                          <div
                            key={vid.id}
                            className="absolute rounded-[2px] border border-purple-300/70 bg-black/60 flex items-center justify-center"
                            style={{
                              left: `${(x / SLIDE_WIDTH) * 100}%`,
                              top: `${(y / SLIDE_HEIGHT) * 100}%`,
                              width: `${(vidWidth / SLIDE_WIDTH) * 100}%`,
                              height: `${(vidHeight / SLIDE_HEIGHT) * 100}%`,
                            }}
                          >
                            <span className="text-[9px] text-purple-100">▶ Video</span>
                          </div>
                        );
                      })}

                      {/* Text elements */}
                      {(slide.text || []).map((txt) => {
                        const textBlockWidth = 600; // match main editor assumptions
                        const textBlockHeight = 100;
                        const x = parsePosition(
                          txt.x,
                          txt.position,
                          'x',
                          SLIDE_WIDTH,
                          textBlockWidth,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );
                        const y = parsePosition(
                          txt.y,
                          txt.position,
                          'y',
                          SLIDE_HEIGHT,
                          textBlockHeight,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );

                        return (
                          <div
                            key={txt.id}
                            className="absolute text-[8px] leading-[10px] px-0.5 rounded-sm bg-black/50 text-white overflow-hidden whitespace-nowrap text-ellipsis"
                            style={{
                              left: `${(x / SLIDE_WIDTH) * 100}%`,
                              top: `${(y / SLIDE_HEIGHT) * 100}%`,
                              width: `${(textBlockWidth / SLIDE_WIDTH) * 100}%`,
                              textAlign: txt.textAlign || 'left',
                            }}
                          >
                            {txt.content || 'Text'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {isReference && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-400 text-black">
                      Ref
                    </div>
                  )}
                  {isStatic && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-gray-100">
                      {isIntro ? 'Intro' : 'Outro'}
                    </div>
                  )}
                </div>
                {/* Slide meta */}
                <div className="px-2 py-1 flex items-center justify-between text-[11px] text-gray-300">
                  <span>Slide {idx + 1}</span>
                  {isReference && <span className="text-yellow-400 font-medium">Reference</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Canvas - Slide Preview (center) */}
        <div
          className="flex-1 flex flex-col items-center"
          onMouseDown={() => {
            setSlideListHasFocus(false);
            setCanvasHasFocus(true);
          }}
          onFocusCapture={() => {
            setSlideListHasFocus(false);
            setCanvasHasFocus(true);
          }}
        >
          {/* Floating toolbar directly above the slide */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleAddImage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Add Image
            </button>
            <button
              onClick={handleAddText}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Add Text
            </button>
            <button
              onClick={handleAddVideo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16v14H4zM10 9l5 3-5 3V9z" />
              </svg>
              Add Video
            </button>
            {selectedId && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-medium shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>
          {/* Slide frame */}
          <div 
            className={`relative bg-gray-900 rounded-lg shadow-2xl overflow-hidden ${
              canvasHasFocus && !selectedId ? 'border-2 border-white' : 'border border-transparent'
            }`}
            style={{ 
              width: CANVAS_WIDTH, 
              height: CANVAS_HEIGHT,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Slide label */}
            <div className="absolute -top-7 left-0 right-0 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Slide {selectedSlideIndex + 1} of {slides.length} ({slideDimensionsLabel})
              </span>
              {selectedSlideIndex === referenceSlideIndex ? (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500 text-yellow-900 rounded">
                  🎯 Reference Slide (for song lyrics)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-500 text-white rounded">
                  Static Slide
                </span>
              )}
            </div>
            
            <Stage
              ref={stageRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onClick={handleStageClick}
              onTap={handleStageClick}
              scaleX={SCALE}
              scaleY={SCALE}
              style={{ backgroundColor: bgColor }}
            >
              <Layer>
                {/* Background - full slide size */}
                <Rect
                  x={0}
                  y={0}
                  width={SLIDE_WIDTH}
                  height={SLIDE_HEIGHT}
                  fill={bgColor}
                  listening={false}
                />

                {/* Sample lyrics preview for reference slide - uses song content styles */}
                {selectedSlideIndex === referenceSlideIndex && (
                  <Group listening={false} opacity={0.5}>
                    {/* Song Title Preview */}
                    <Text
                      x={songTitleStyle.textAlign === 'left' ? 40 : songTitleStyle.textAlign === 'right' ? SLIDE_WIDTH - 40 : SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT * (songTitleStyle.yPosition / 100)}
                      text="Sample Song Title"
                      fontSize={parseInt(songTitleStyle.fontSize) || 48}
                      fontFamily="Arial"
                      fontStyle={songTitleStyle.fontWeight === 'bold' ? 'bold' : 'normal'}
                      fill={songTitleStyle.color}
                      align={songTitleStyle.textAlign}
                      width={SLIDE_WIDTH - 80}
                      offsetX={songTitleStyle.textAlign === 'left' ? 0 : songTitleStyle.textAlign === 'right' ? SLIDE_WIDTH - 80 : (SLIDE_WIDTH - 80) / 2}
                    />
                    {/* Song Lyrics Preview */}
                    <Text
                      x={songLyricsStyle.textAlign === 'left' ? 40 : songLyricsStyle.textAlign === 'right' ? SLIDE_WIDTH - 40 : SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT * (songLyricsStyle.yPosition / 100)}
                      text="॥ Sample Lyrics Line 1 ॥\nSample Lyrics Line 2\nSample Lyrics Line 3"
                      fontSize={parseInt(songLyricsStyle.fontSize) || 36}
                      fontFamily="Arial"
                      fontStyle={songLyricsStyle.fontWeight === 'bold' ? 'bold' : 'normal'}
                      fill={songLyricsStyle.color}
                      align={songLyricsStyle.textAlign}
                      width={SLIDE_WIDTH - 80}
                      offsetX={songLyricsStyle.textAlign === 'left' ? 0 : songLyricsStyle.textAlign === 'right' ? SLIDE_WIDTH - 80 : (SLIDE_WIDTH - 80) / 2}
                    />
                    {/* Translation Preview */}
                    <Text
                      x={songTranslationStyle.textAlign === 'left' ? 40 : songTranslationStyle.textAlign === 'right' ? SLIDE_WIDTH - 40 : SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT * (songTranslationStyle.yPosition / 100)}
                      text="(Translation text appears here)"
                      fontSize={parseInt(songTranslationStyle.fontSize) || 24}
                      fontFamily="Arial"
                      fontStyle={songTranslationStyle.fontWeight === 'bold' ? 'bold' : 'normal italic'}
                      fill={songTranslationStyle.color}
                      align={songTranslationStyle.textAlign}
                      width={SLIDE_WIDTH - 80}
                      offsetX={songTranslationStyle.textAlign === 'left' ? 0 : songTranslationStyle.textAlign === 'right' ? SLIDE_WIDTH - 80 : (SLIDE_WIDTH - 80) / 2}
                    />
                    {/* Helper label */}
                    <Text
                      x={SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT - 60}
                      text="[Song content preview - adjust in Song Content Styling panel]"
                      fontSize={24}
                      fontFamily="Arial"
                      fill="#666666"
                      align="center"
                      width={SLIDE_WIDTH - 80}
                      offsetX={(SLIDE_WIDTH - 80) / 2}
                    />
                  </Group>
                )}

                {/* Elements - positioned in full slide coordinates */}
                {canvasElements.map((element) => {
                  if (element.type === 'image') {
                    return (
                      <URLImage
                        key={element.id}
                        element={element}
                        isSelected={selectedId === element.id}
                        onSelect={() => setSelectedId(element.id)}
                        onChange={(updates) => updateElement(element.id, updates)}
                      />
                    );
                  } else if (element.type === 'text') {
                    return (
                      <DraggableText
                        key={element.id}
                        element={element}
                        isSelected={selectedId === element.id}
                        onSelect={() => setSelectedId(element.id)}
                        onChange={(updates) => updateElement(element.id, updates)}
                      />
                    );
                  } else if (element.type === 'video') {
                    return (
                      <VideoPlaceholder
                        key={element.id}
                        element={element}
                        isSelected={selectedId === element.id}
                        onSelect={() => setSelectedId(element.id)}
                        onChange={(updates) => updateElement(element.id, updates)}
                      />
                    );
                  }
                  return null;
                })}

                {/* Transformer */}
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Minimum size in slide coordinates
                    if (newBox.width < 40 || newBox.height < 40) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>
          </div>
          
          {/* Canvas instructions */}
          <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 text-center">
            <span className="font-medium">Click</span> to select • <span className="font-medium">Drag</span> to move • <span className="font-medium">Corner handles</span> to resize
          </div>
        </div>

        {/* Properties Panel */}
        <div
          className="w-72 flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4 max-h-[600px] overflow-y-auto"
          onMouseDown={() => {
            setSlideListHasFocus(false);
            setCanvasHasFocus(false);
          }}
          onFocusCapture={() => {
            setSlideListHasFocus(false);
            setCanvasHasFocus(false);
          }}
        >
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Properties</h3>
          
          {/* Background Properties */}
          <div className="space-y-3 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm">Background</h4>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
              <select
                value={currentSlide.background?.type || 'color'}
                onChange={(e) => handleBackgroundChange({ type: e.target.value as 'color' | 'image' | 'video', value: e.target.value === 'color' ? '#1a1a2e' : '' })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="color">Color</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
            {currentSlide.background?.type === 'color' && (
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={currentSlide.background?.value || '#1a1a2e'}
                    onChange={(e) => handleBackgroundChange({ value: e.target.value })}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentSlide.background?.value || '#1a1a2e'}
                    onChange={(e) => handleBackgroundChange({ value: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            )}
            {(currentSlide.background?.type === 'image' || currentSlide.background?.type === 'video') && (
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">URL</label>
                <input
                  type="url"
                  value={currentSlide.background?.value || ''}
                  onChange={(e) => handleBackgroundChange({ value: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Selected Element Properties */}
          {selectedElement ? (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                Selected:{' '}
                {selectedElement.type === 'image'
                  ? 'Image'
                  : selectedElement.type === 'video'
                  ? 'Video'
                  : 'Text'}
              </h4>

              {/* Common properties first: Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">X Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.x)}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        x: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.y)}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        y: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Rotation (°)</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.rotation ?? 0)}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      rotation: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Width & Height */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Width</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.width)}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        width: Number.isNaN(parseInt(e.target.value, 10))
                          ? selectedElement.width
                          : parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Height</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.height)}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        height: Number.isNaN(parseInt(e.target.value, 10))
                          ? selectedElement.height
                          : parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Opacity */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Opacity: {Math.round((selectedElement.opacity ?? 1) * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((selectedElement.opacity ?? 1) * 100)}
                  onChange={(e) => updateElement(selectedElement.id, { opacity: parseInt(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>

              {/* Element-specific properties */}
              {selectedElement.type === 'image' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={selectedElement.url || ''}
                      onChange={(e) => updateElement(selectedElement.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {selectedElement.type === 'video' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Video URL</label>
                    <input
                      type="url"
                      value={selectedElement.url || ''}
                      onChange={(e) => updateElement(selectedElement.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={selectedElement.autoPlay ?? true}
                        onChange={(e) =>
                          updateElement(selectedElement.id, { autoPlay: e.target.checked })
                        }
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Auto play</span>
                    </label>
                  </div>
                </>
              )}

              {selectedElement.type === 'text' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Text Content</label>
                    <textarea
                      value={selectedElement.content || ''}
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Size</label>
                      <input
                        type="number"
                        value={selectedElement.fontSize || 24}
                        onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 24 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color</label>
                      <input
                        type="color"
                        value={selectedElement.color || '#ffffff'}
                        onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Weight</label>
                    <select
                      value={selectedElement.fontWeight || 'normal'}
                      onChange={(e) => updateElement(selectedElement.id, { fontWeight: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Text Align</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { textAlign: 'left' })}
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center ${
                          selectedElement.textAlign === 'left'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Align Left"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { textAlign: 'center' })}
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center ${
                          (selectedElement.textAlign || 'center') === 'center'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Align Center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { textAlign: 'right' })}
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center ${
                          selectedElement.textAlign === 'right'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Align Right"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              <p>Click on an element to edit its properties</p>
              <p className="mt-2 text-xs">Or use the toolbar to add new elements</p>
            </div>
          )}

          {/* Song Content Styling (only on reference slide) */}
          {selectedSlideIndex === referenceSlideIndex && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2">
                <span className="text-yellow-500">🎵</span> Song Content Styling
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure how song title, lyrics, and translation appear on this reference slide.
              </p>

              {/* Song Title Style */}
              <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Song Title</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Y Position (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={songTitleStyle.yPosition}
                      onChange={(e) => handleSongContentStyleChange('songTitleStyle', { yPosition: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={parseInt(songTitleStyle.fontSize) || 48}
                      onChange={(e) => handleSongContentStyleChange('songTitleStyle', { fontSize: `${e.target.value}px` })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Weight</label>
                    <select
                      value={songTitleStyle.fontWeight}
                      onChange={(e) => handleSongContentStyleChange('songTitleStyle', { fontWeight: e.target.value as 'normal' | 'bold' })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color</label>
                    <input
                      type="color"
                      value={songTitleStyle.color}
                      onChange={(e) => handleSongContentStyleChange('songTitleStyle', { color: e.target.value })}
                      className="w-full h-7 rounded cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Alignment</label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => handleSongContentStyleChange('songTitleStyle', { textAlign: align })}
                        className={`flex-1 px-2 py-1 text-xs border rounded ${
                          songTitleStyle.textAlign === align
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Song Lyrics Style */}
              <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Song Lyrics</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Y Position (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={songLyricsStyle.yPosition}
                      onChange={(e) => handleSongContentStyleChange('songLyricsStyle', { yPosition: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={parseInt(songLyricsStyle.fontSize) || 36}
                      onChange={(e) => handleSongContentStyleChange('songLyricsStyle', { fontSize: `${e.target.value}px` })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Weight</label>
                    <select
                      value={songLyricsStyle.fontWeight}
                      onChange={(e) => handleSongContentStyleChange('songLyricsStyle', { fontWeight: e.target.value as 'normal' | 'bold' })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color</label>
                    <input
                      type="color"
                      value={songLyricsStyle.color}
                      onChange={(e) => handleSongContentStyleChange('songLyricsStyle', { color: e.target.value })}
                      className="w-full h-7 rounded cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Alignment</label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => handleSongContentStyleChange('songLyricsStyle', { textAlign: align })}
                        className={`flex-1 px-2 py-1 text-xs border rounded ${
                          songLyricsStyle.textAlign === align
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Song Translation Style */}
              <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Translation</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Y Position (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={songTranslationStyle.yPosition}
                      onChange={(e) => handleSongContentStyleChange('songTranslationStyle', { yPosition: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={parseInt(songTranslationStyle.fontSize) || 24}
                      onChange={(e) => handleSongContentStyleChange('songTranslationStyle', { fontSize: `${e.target.value}px` })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Weight</label>
                    <select
                      value={songTranslationStyle.fontWeight}
                      onChange={(e) => handleSongContentStyleChange('songTranslationStyle', { fontWeight: e.target.value as 'normal' | 'bold' })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color</label>
                    <input
                      type="color"
                      value={songTranslationStyle.color}
                      onChange={(e) => handleSongContentStyleChange('songTranslationStyle', { color: e.target.value })}
                      className="w-full h-7 rounded cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Alignment</label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => handleSongContentStyleChange('songTranslationStyle', { textAlign: align })}
                        className={`flex-1 px-2 py-1 text-xs border rounded ${
                          songTranslationStyle.textAlign === align
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default TemplateWysiwygEditor;

