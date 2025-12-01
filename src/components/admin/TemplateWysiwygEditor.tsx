import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import useImage from 'use-image';
import type { PresentationTemplate, ImageElement, TextElement, VideoElement, TemplateSlide, BackgroundElement, AspectRatio, SongContentStyle, Song } from '../../types';
import { ASPECT_RATIO_DIMENSIONS } from '../../types';
import { useSongs } from '../../contexts/SongContext';
import { AVAILABLE_FONTS, getFontFamily, getFontsByCategory, FONT_CATEGORY_NAMES } from '../../utils/fonts';

// Preload Google Fonts for Konva canvas rendering
const preloadFonts = async () => {
  // Wait for document fonts to be ready
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
};

// Call preload on module load
preloadFonts();

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
  fontStyle?: 'normal' | 'italic';
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

// DraggableText component with inline editing support
const DraggableText: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
  stageRef: React.RefObject<Konva.Stage>;
  scale: number;
}> = ({ element, isSelected, onSelect, onChange, stageRef, scale }) => {
  const shapeRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Konva fontStyle combines bold and italic: "normal", "bold", "italic", "bold italic"
  const getFontStyle = () => {
    const isBold = element.fontWeight === 'bold';
    const isItalic = element.fontStyle === 'italic';
    if (isBold && isItalic) return 'bold italic';
    if (isBold) return 'bold';
    if (isItalic) return 'italic';
    return 'normal';
  };

  // Handle double-click to start inline editing
  const handleDblClick = () => {
    const textNode = shapeRef.current;
    const stage = stageRef.current;
    if (!textNode || !stage) return;

    // Hide text node while editing
    textNode.hide();

    // Get stage container position
    const stageBox = stage.container().getBoundingClientRect();
    
    // Use element's x/y position (in slide coordinates) and multiply by scale
    // The stage itself is scaled, so we need to position relative to the stage container
    const areaPosition = {
      x: stageBox.left + element.x * scale,
      y: stageBox.top + element.y * scale,
    };

    // Create textarea for editing
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = element.content || '';
    textarea.style.position = 'fixed';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${(element.width || 200) * scale}px`;
    textarea.style.minHeight = `${(element.fontSize || 24) * scale * 1.2}px`;
    textarea.style.fontSize = `${(element.fontSize || 24) * scale}px`;
    textarea.style.fontFamily = getFontFamily(element.fontFamily);
    textarea.style.fontWeight = element.fontWeight || 'normal';
    textarea.style.fontStyle = element.fontStyle || 'normal';
    textarea.style.textAlign = element.textAlign || 'center';
    textarea.style.color = element.color || '#ffffff';
    textarea.style.background = 'rgba(0, 0, 0, 0.85)';
    textarea.style.border = '2px solid #3b82f6';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = '1';
    textarea.style.transformOrigin = 'left top';
    textarea.style.zIndex = '10000';
    textarea.style.boxSizing = 'border-box';
    
    // Handle rotation
    if (element.rotation) {
      textarea.style.transform = `rotate(${element.rotation}deg)`;
    }

    textarea.focus();
    textarea.select();
    setIsEditing(true);

    // Auto-resize textarea height
    const resizeTextarea = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    textarea.addEventListener('input', resizeTextarea);
    resizeTextarea();

    // Handle blur (finish editing)
    const handleBlur = () => {
      const newContent = textarea.value;
      onChange({ content: newContent });
      document.body.removeChild(textarea);
      textNode.show();
      setIsEditing(false);
    };

    // Handle keydown (Enter without shift to finish, Escape to cancel)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.body.removeChild(textarea);
        textNode.show();
        setIsEditing(false);
      }
      // Allow Enter for newlines (shift+enter or just enter for multiline)
    };

    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', handleKeyDown);
  };

  return (
    <Text
      ref={shapeRef}
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      text={element.content || 'Text'}
      fontSize={element.fontSize || 24}
      fontFamily={getFontFamily(element.fontFamily)}
      fontStyle={getFontStyle()}
      align={element.textAlign || 'center'}
      fill={element.color || '#ffffff'}
      opacity={element.opacity ?? 1}
      rotation={element.rotation || 0}
      draggable={!isEditing}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
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

// Type for history state
type HistoryState = {
  slides: TemplateSlide[];
  selectedSlideIndex: number;
};

export const TemplateWysiwygEditor: React.FC<TemplateWysiwygEditorProps> = ({
  template,
  onTemplateChange,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [slideListHasFocus, setSlideListHasFocus] = useState(true);
  const [canvasHasFocus, setCanvasHasFocus] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideIndex: number } | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  
  // Wait for fonts to load before rendering canvas
  useEffect(() => {
    const loadFonts = async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
        setFontsLoaded(true);
        // Force Konva to redraw after fonts are loaded
        if (stageRef.current) {
          stageRef.current.batchDraw();
        }
      } else {
        // Fallback for browsers without document.fonts
        setFontsLoaded(true);
      }
    };
    loadFonts();
    
    // Also listen for font loading events to handle late-loading fonts
    const handleFontLoaded = () => {
      if (stageRef.current) {
        stageRef.current.batchDraw();
      }
    };
    
    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', handleFontLoaded);
      return () => {
        document.fonts.removeEventListener('loadingdone', handleFontLoaded);
      };
    }
  }, []);
  
  // Force Konva redraw when template changes (e.g., font family updates)
  // Also trigger font load for the specific font being used
  useEffect(() => {
    if (stageRef.current && fontsLoaded) {
      // Small delay to ensure React has updated the Konva nodes
      requestAnimationFrame(() => {
        stageRef.current?.batchDraw();
      });
    }
  }, [template, fontsLoaded]);
  
  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  
  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<{
    type: 'image' | 'text' | 'video';
    data: ImageElement | TextElement | VideoElement;
  } | null>(null);
  
  // Access songs context for song picker
  const { songs, fetchSongs, getSongById, loading: songsLoading } = useSongs();
  const [importingSong, setImportingSong] = useState(false);

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

  // Track history for undo/redo (only when not triggered by undo/redo itself)
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    
    const newState: HistoryState = {
      slides: JSON.parse(JSON.stringify(slides)),
      selectedSlideIndex,
    };
    
    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state, limit history to 50 entries
      const updated = [...newHistory, newState].slice(-50);
      return updated;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(slides)]);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    isUndoRedoAction.current = true;
    const prevState = history[historyIndex - 1];
    setHistoryIndex(historyIndex - 1);
    
    const refSlide = prevState.slides[referenceSlideIndex] || prevState.slides[0];
    onTemplateChange({
      ...template,
      slides: prevState.slides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
  }, [historyIndex, history, referenceSlideIndex, template, onTemplateChange]);

  // Redo handler
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    isUndoRedoAction.current = true;
    const nextState = history[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    
    const refSlide = nextState.slides[referenceSlideIndex] || nextState.slides[0];
    onTemplateChange({
      ...template,
      slides: nextState.slides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
  }, [historyIndex, history, referenceSlideIndex, template, onTemplateChange]);

  // Copy selected element
  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    
    const slide = slides[selectedSlideIndex];
    
    // Find the element in the current slide
    const image = slide.images?.find(img => img.id === selectedId);
    if (image) {
      setClipboard({ type: 'image', data: { ...image } });
      return;
    }
    
    const text = slide.text?.find(txt => txt.id === selectedId);
    if (text) {
      setClipboard({ type: 'text', data: { ...text } });
      return;
    }
    
    const video = slide.videos?.find(vid => vid.id === selectedId);
    if (video) {
      setClipboard({ type: 'video', data: { ...video } });
      return;
    }
  }, [selectedId, slides, selectedSlideIndex]);

  // Paste from clipboard
  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    
    const timestamp = Date.now();
    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };
    
    // Create new element with new ID and slightly offset position
    if (clipboard.type === 'image') {
      const original = clipboard.data as ImageElement;
      const newImage: ImageElement = {
        ...original,
        id: `image-${timestamp}`,
        x: typeof original.x === 'string' 
          ? `${parseInt(original.x) + 20}px` 
          : (original.x || 0) + 20,
        y: typeof original.y === 'string' 
          ? `${parseInt(original.y) + 20}px` 
          : (original.y || 0) + 20,
      };
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
    } else if (clipboard.type === 'text') {
      const original = clipboard.data as TextElement;
      const newText: TextElement = {
        ...original,
        id: `text-${timestamp}`,
        x: typeof original.x === 'string' 
          ? `${parseInt(original.x as string) + 20}px` 
          : (original.x || 0) + 20,
        y: typeof original.y === 'string' 
          ? `${parseInt(original.y as string) + 20}px` 
          : (original.y || 0) + 20,
      };
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
    } else if (clipboard.type === 'video') {
      const original = clipboard.data as VideoElement;
      const newVideo: VideoElement = {
        ...original,
        id: `video-${timestamp}`,
        x: typeof original.x === 'number' ? original.x + 20 : original.x,
        y: typeof original.y === 'number' ? original.y + 20 : original.y,
      };
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
    }
  }, [clipboard, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange]);

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
          fontStyle: txt.fontStyle,
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
  
  // Check if a song content element is selected (type only - style resolved later after songTitleStyle etc are defined)
  const selectedSongContentType = selectedId === 'song-title-element' ? 'songTitleStyle' as const :
    selectedId === 'song-lyrics-element' ? 'songLyricsStyle' as const :
    selectedId === 'song-translation-element' ? 'songTranslationStyle' as const : null;

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
          fontFamily: updates.fontFamily ?? texts[txtIndex].fontFamily,
          fontWeight: updates.fontWeight ?? texts[txtIndex].fontWeight,
          fontStyle: updates.fontStyle ?? texts[txtIndex].fontStyle,
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

  // Delete selected element
  const handleDeleteSelected = useCallback(() => {
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
  }, [selectedId, canvasElements, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange]);

  // Keyboard shortcuts for canvas (undo/redo/copy/paste/delete/move)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas/selects
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      // Undo: Ctrl/Cmd + Z (works even without canvas focus)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Copy: Ctrl/Cmd + C (requires canvas focus and selection)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && canvasHasFocus && selectedId) {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Paste: Ctrl/Cmd + V (requires canvas focus)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && canvasHasFocus) {
        e.preventDefault();
        handlePaste();
        return;
      }

      // The following shortcuts require canvas focus and a selected element
      if (!canvasHasFocus || !selectedId) return;

      // Handle Delete/Backspace to delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
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
  }, [canvasHasFocus, selectedId, canvasElements, updateElement, handleDeleteSelected, handleUndo, handleRedo, handleCopy, handlePaste]);

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

  // Import song content as text elements
  const handleImportSong = async (songFromList: Song) => {
    setImportingSong(true);
    
    try {
      // Fetch full song details (including lyrics and meaning CLOBs)
      const song = await getSongById(songFromList.id);
      
      if (!song) {
        console.error('Failed to fetch song details');
        setImportingSong(false);
        return;
      }
      
      const timestamp = Date.now();
      const newTextElements: TextElement[] = [];
      
      // Add song title
      newTextElements.push({
        id: `text-title-${timestamp}`,
        content: song.name || 'Song Title',
        fontSize: '64px',
        color: '#ffffff',
        fontWeight: 'bold',
        x: `${Math.round(SLIDE_WIDTH / 2 - 400)}px`,
        y: '60px',
        width: '800px',
        textAlign: 'center',
        opacity: 1,
        zIndex: 2,
      });
      
      // Add lyrics - always add, use placeholder if not available
      newTextElements.push({
        id: `text-lyrics-${timestamp}`,
        content: song.lyrics || '[Lyrics not available]',
        fontSize: '48px',
        color: '#ffffff',
        x: `${Math.round(SLIDE_WIDTH / 2 - 500)}px`,
        y: '180px',
        width: '1000px',
        textAlign: 'center',
        opacity: 1,
        zIndex: 2,
      });
      
      // Add meaning/translation - always add, use placeholder if not available
      newTextElements.push({
        id: `text-meaning-${timestamp}`,
        content: song.meaning || '[Translation not available]',
        fontSize: '36px',
        color: '#cccccc',
        fontStyle: 'italic',
        x: `${Math.round(SLIDE_WIDTH / 2 - 500)}px`,
        y: `${Math.round(SLIDE_HEIGHT * 0.7)}px`,
        width: '1000px',
        textAlign: 'center',
        opacity: 1,
        zIndex: 2,
      });
      
      // Add all text elements to the current slide
      const newSlides = [...slides];
      const slideToUpdate = { ...newSlides[selectedSlideIndex] };
      slideToUpdate.text = [...(slideToUpdate.text || []), ...newTextElements];
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

      // Select the title element
      if (newTextElements.length > 0) {
        setSelectedId(newTextElements[0].id);
      }
      
      // Close the picker
      setShowSongPicker(false);
      setSongSearchQuery('');
    } finally {
      setImportingSong(false);
    }
  };
  
  // Filter songs based on search query
  const filteredSongs = useMemo(() => {
    if (!songSearchQuery.trim()) return songs.slice(0, 20); // Show first 20 by default
    const query = songSearchQuery.toLowerCase();
    return songs.filter(song => 
      song.name.toLowerCase().includes(query) ||
      song.lyrics?.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [songs, songSearchQuery]);

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
  const handleSongContentStyleChange = useCallback((
    styleType: 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle',
    updates: Partial<SongContentStyle>
  ) => {
    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[referenceSlideIndex] };
    
    // Get current style or use defaults based on slide dimensions
    const getDefaultStyle = (type: string): SongContentStyle => ({
      x: 40,
      y: type === 'songTitleStyle' ? Math.round(SLIDE_HEIGHT * 0.05) : 
         type === 'songLyricsStyle' ? Math.round(SLIDE_HEIGHT * 0.20) : 
         Math.round(SLIDE_HEIGHT * 0.75),
      width: SLIDE_WIDTH - 80,
      fontSize: type === 'songTitleStyle' ? '48px' : type === 'songLyricsStyle' ? '36px' : '24px',
      fontWeight: type === 'songTranslationStyle' ? 'normal' : 'bold',
      textAlign: 'center',
      color: '#ffffff',
    });
    
    const currentStyle = slideToUpdate[styleType] || getDefaultStyle(styleType);
    
    slideToUpdate[styleType] = {
      ...currentStyle,
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
  }, [slides, referenceSlideIndex, SLIDE_WIDTH, SLIDE_HEIGHT, template, onTemplateChange]);

  // Get current song content styles from reference slide
  // Default positions based on slide dimensions
  const referenceSlide = slides[referenceSlideIndex] || slides[0];
  const defaultTitleStyle: SongContentStyle = {
    x: 40,
    y: Math.round(SLIDE_HEIGHT * 0.05),
    width: SLIDE_WIDTH - 80,
    fontSize: '48px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
  };
  const defaultLyricsStyle: SongContentStyle = {
    x: 40,
    y: Math.round(SLIDE_HEIGHT * 0.20),
    width: SLIDE_WIDTH - 80,
    fontSize: '36px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
  };
  const defaultTranslationStyle: SongContentStyle = {
    x: 40,
    y: Math.round(SLIDE_HEIGHT * 0.75),
    width: SLIDE_WIDTH - 80,
    fontSize: '24px',
    fontWeight: 'normal',
    textAlign: 'center',
    color: '#ffffff',
  };
  
  // Merge with saved styles, converting legacy yPosition to y if needed
  // Also ensures all required properties have valid values
  const mergeSongStyle = (saved: Partial<SongContentStyle> | undefined, defaults: SongContentStyle): SongContentStyle => {
    if (!saved) return defaults;
    
    // Calculate y value: prefer saved.y, then convert legacy yPosition, then use default
    const yValue = saved.y ?? (saved.yPosition !== undefined ? Math.round(SLIDE_HEIGHT * (saved.yPosition / 100)) : defaults.y);
    
    // Merge with explicit fallbacks for all required properties
    return {
      x: saved.x ?? defaults.x,
      y: yValue,
      width: saved.width ?? defaults.width,
      height: saved.height,
      fontSize: saved.fontSize ?? defaults.fontSize,
      fontWeight: saved.fontWeight ?? defaults.fontWeight,
      fontStyle: saved.fontStyle,
      fontFamily: saved.fontFamily,
      textAlign: saved.textAlign ?? defaults.textAlign,
      color: saved.color ?? defaults.color,
      yPosition: saved.yPosition,
    };
  };
  
  const songTitleStyle = mergeSongStyle(referenceSlide?.songTitleStyle, defaultTitleStyle);
  const songLyricsStyle = mergeSongStyle(referenceSlide?.songLyricsStyle, defaultLyricsStyle);
  const songTranslationStyle = mergeSongStyle(referenceSlide?.songTranslationStyle, defaultTranslationStyle);
  
  // Debug logging for song content styles
  console.log('🎵 Song content styles:', {
    referenceSlideIndex,
    hasReferenceSlide: !!referenceSlide,
    savedTitleStyle: referenceSlide?.songTitleStyle,
    savedLyricsStyle: referenceSlide?.songLyricsStyle,
    savedTranslationStyle: referenceSlide?.songTranslationStyle,
    computedTitleStyle: songTitleStyle,
    computedLyricsStyle: songLyricsStyle,
    computedTranslationStyle: songTranslationStyle,
  });
  
  // Now we can resolve the selected song content style (after songTitleStyle etc are defined)
  const selectedSongContentStyle = selectedSongContentType ? 
    (selectedSongContentType === 'songTitleStyle' ? songTitleStyle :
     selectedSongContentType === 'songLyricsStyle' ? songLyricsStyle : songTranslationStyle) : null;

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Slide context menu handlers
  const handleInsertSlide = (atIndex: number) => {
    const newSlide: TemplateSlide = {
      background: { type: 'color', value: '#1a1a2e' },
      images: [],
      videos: [],
      text: [],
    };
    const newSlides = [...slides];
    newSlides.splice(atIndex + 1, 0, newSlide);
    
    // Adjust reference slide index if inserting before it
    const newRefIndex = atIndex < referenceSlideIndex ? referenceSlideIndex + 1 : referenceSlideIndex;
    
    const refSlide = newSlides[newRefIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      referenceSlideIndex: newRefIndex,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
    setSelectedSlideIndex(atIndex + 1);
    setContextMenu(null);
  };

  const handleDuplicateSlide = (atIndex: number) => {
    const slideToDuplicate = slides[atIndex];
    const duplicatedSlide: TemplateSlide = JSON.parse(JSON.stringify(slideToDuplicate));
    // Generate new IDs for all elements
    if (duplicatedSlide.images) {
      duplicatedSlide.images = duplicatedSlide.images.map(img => ({ ...img, id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
    }
    if (duplicatedSlide.videos) {
      duplicatedSlide.videos = duplicatedSlide.videos.map(vid => ({ ...vid, id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
    }
    if (duplicatedSlide.text) {
      duplicatedSlide.text = duplicatedSlide.text.map(txt => ({ ...txt, id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
    }
    
    const newSlides = [...slides];
    newSlides.splice(atIndex + 1, 0, duplicatedSlide);
    
    // Adjust reference slide index if duplicating before it
    const newRefIndex = atIndex < referenceSlideIndex ? referenceSlideIndex + 1 : referenceSlideIndex;
    
    const refSlide = newSlides[newRefIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      referenceSlideIndex: newRefIndex,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
    setSelectedSlideIndex(atIndex + 1);
    setContextMenu(null);
  };

  const handleDeleteSlide = (atIndex: number) => {
    if (slides.length <= 1) {
      // Can't delete the last slide
      setContextMenu(null);
      return;
    }
    
    const newSlides = slides.filter((_, i) => i !== atIndex);
    
    // Adjust reference slide index
    let newRefIndex = referenceSlideIndex;
    if (atIndex === referenceSlideIndex) {
      // If deleting the reference slide, set the first slide as reference
      newRefIndex = 0;
    } else if (atIndex < referenceSlideIndex) {
      newRefIndex = referenceSlideIndex - 1;
    }
    
    // Adjust selected slide index
    let newSelectedIndex = selectedSlideIndex;
    if (atIndex <= selectedSlideIndex) {
      newSelectedIndex = Math.max(0, selectedSlideIndex - 1);
    }
    
    const refSlide = newSlides[newRefIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      referenceSlideIndex: newRefIndex,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
    setSelectedSlideIndex(newSelectedIndex);
    setContextMenu(null);
  };

  const handleMoveSlideUp = (atIndex: number) => {
    if (atIndex <= 0) {
      setContextMenu(null);
      return;
    }
    
    const newSlides = [...slides];
    [newSlides[atIndex - 1], newSlides[atIndex]] = [newSlides[atIndex], newSlides[atIndex - 1]];
    
    // Adjust reference slide index
    let newRefIndex = referenceSlideIndex;
    if (atIndex === referenceSlideIndex) {
      newRefIndex = referenceSlideIndex - 1;
    } else if (atIndex - 1 === referenceSlideIndex) {
      newRefIndex = referenceSlideIndex + 1;
    }
    
    const refSlide = newSlides[newRefIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      referenceSlideIndex: newRefIndex,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
    setSelectedSlideIndex(atIndex - 1);
    setContextMenu(null);
  };

  const handleMoveSlideDown = (atIndex: number) => {
    if (atIndex >= slides.length - 1) {
      setContextMenu(null);
      return;
    }
    
    const newSlides = [...slides];
    [newSlides[atIndex], newSlides[atIndex + 1]] = [newSlides[atIndex + 1], newSlides[atIndex]];
    
    // Adjust reference slide index
    let newRefIndex = referenceSlideIndex;
    if (atIndex === referenceSlideIndex) {
      newRefIndex = referenceSlideIndex + 1;
    } else if (atIndex + 1 === referenceSlideIndex) {
      newRefIndex = referenceSlideIndex - 1;
    }
    
    const refSlide = newSlides[newRefIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      referenceSlideIndex: newRefIndex,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
    setSelectedSlideIndex(atIndex + 1);
    setContextMenu(null);
  };

  const handleSetAsReference = (atIndex: number) => {
    const refSlide = slides[atIndex] || slides[0];
    onTemplateChange({
      ...template,
      referenceSlideIndex: atIndex,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
    setContextMenu(null);
  };

  // Drag and drop handlers for slide reordering
  const handleSlideDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSlideIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to show the dragging state
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    });
  };

  const handleSlideDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  };

  const handleSlideDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSlideIndex !== null && draggedSlideIndex !== index) {
      setDragOverSlideIndex(index);
    }
  };

  const handleSlideDragLeave = () => {
    setDragOverSlideIndex(null);
  };

  const handleSlideDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedSlideIndex === null || draggedSlideIndex === dropIndex) {
      setDraggedSlideIndex(null);
      setDragOverSlideIndex(null);
      return;
    }

    const newSlides = [...slides];
    const [draggedSlide] = newSlides.splice(draggedSlideIndex, 1);
    newSlides.splice(dropIndex, 0, draggedSlide);

    // Adjust reference slide index
    let newRefIndex = referenceSlideIndex;
    if (draggedSlideIndex === referenceSlideIndex) {
      // The reference slide was moved
      newRefIndex = dropIndex;
    } else if (draggedSlideIndex < referenceSlideIndex && dropIndex >= referenceSlideIndex) {
      // Dragged from before reference to after reference
      newRefIndex = referenceSlideIndex - 1;
    } else if (draggedSlideIndex > referenceSlideIndex && dropIndex <= referenceSlideIndex) {
      // Dragged from after reference to before reference
      newRefIndex = referenceSlideIndex + 1;
    }

    const refSlide = newSlides[newRefIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      referenceSlideIndex: newRefIndex,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });

    setSelectedSlideIndex(dropIndex);
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
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
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleSlideDragStart(e, idx)}
                onDragEnd={handleSlideDragEnd}
                onDragOver={(e) => handleSlideDragOver(e, idx)}
                onDragLeave={handleSlideDragLeave}
                onDrop={(e) => handleSlideDrop(e, idx)}
                className={`relative transition-all duration-150 ${
                  dragOverSlideIndex === idx && draggedSlideIndex !== idx
                    ? draggedSlideIndex !== null && draggedSlideIndex < idx
                      ? 'pb-8' // Drop indicator below
                      : 'pt-8' // Drop indicator above
                    : ''
                }`}
              >
                {/* Drop indicator line */}
                {dragOverSlideIndex === idx && draggedSlideIndex !== null && draggedSlideIndex !== idx && (
                  <div
                    className={`absolute left-0 right-0 h-1 bg-blue-500 rounded-full ${
                      draggedSlideIndex < idx ? 'bottom-1' : 'top-1'
                    }`}
                  />
                )}
                <button
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, slideIndex: idx });
                    setSelectedSlideIndex(idx);
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
                  className={`w-full mb-2 last:mb-0 rounded-md text-left transition-colors cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? slideListHasFocus
                        ? 'border-2 border-white bg-gray-800'
                        : 'border border-blue-500 bg-gray-800'
                      : 'border border-gray-700 bg-gray-900 hover:bg-gray-800'
                  } ${draggedSlideIndex === idx ? 'opacity-50' : ''}`}
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
              </div>
            );
          })}

          {/* Context Menu */}
          {contextMenu && (
            <div
              className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-[9999] min-w-[180px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleInsertSlide(contextMenu.slideIndex)}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Insert Slide After
              </button>
              <button
                onClick={() => handleDuplicateSlide(contextMenu.slideIndex)}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicate Slide
              </button>
              <div className="border-t border-gray-600 my-1" />
              <button
                onClick={() => handleMoveSlideUp(contextMenu.slideIndex)}
                disabled={contextMenu.slideIndex === 0}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Move Up
              </button>
              <button
                onClick={() => handleMoveSlideDown(contextMenu.slideIndex)}
                disabled={contextMenu.slideIndex === slides.length - 1}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Move Down
              </button>
              <div className="border-t border-gray-600 my-1" />
              {contextMenu.slideIndex !== referenceSlideIndex && (
                <button
                  onClick={() => handleSetAsReference(contextMenu.slideIndex)}
                  className="w-full px-4 py-2 text-left text-sm text-yellow-400 hover:bg-gray-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Set as Reference
                </button>
              )}
              <button
                onClick={() => handleDeleteSlide(contextMenu.slideIndex)}
                disabled={slides.length <= 1}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Slide
              </button>
            </div>
          )}
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
            {/* Undo/Redo buttons */}
            <div className="flex items-center gap-1 mr-2 pr-2 border-r border-gray-300 dark:border-gray-600">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Shift+Z)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>
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
            <button
              onClick={() => {
                setShowSongPicker(true);
                fetchSongs();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Import Song
            </button>
            <button
              onClick={handleCopy}
              disabled={!selectedId}
              className="flex items-center justify-center p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title="Copy (Ctrl+C)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={handlePaste}
              disabled={!clipboard}
              className="flex items-center justify-center p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title="Paste (Ctrl+V)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={!selectedId}
              className="flex items-center justify-center p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete (Del)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
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

                {/* Song content elements for reference slide - draggable/stylable but with fixed text */}
                {selectedSlideIndex === referenceSlideIndex && (
                  <Group>
                    {/* Song Title - Editable position/style, fixed text */}
                    <Text
                      id="song-title-element"
                      x={Number.isFinite(songTitleStyle.x) ? songTitleStyle.x : 40}
                      y={Number.isFinite(songTitleStyle.y) ? songTitleStyle.y : Math.round(SLIDE_HEIGHT * 0.05)}
                      width={Number.isFinite(songTitleStyle.width) ? songTitleStyle.width : SLIDE_WIDTH - 80}
                      text="[Song Title]"
                      fontSize={parseInt(songTitleStyle.fontSize) || 48}
                      fontFamily={getFontFamily(songTitleStyle.fontFamily)}
                      fontStyle={[
                        songTitleStyle.fontWeight === 'bold' ? 'bold' : '',
                        songTitleStyle.fontStyle === 'italic' ? 'italic' : ''
                      ].filter(Boolean).join(' ') || 'normal'}
                      fill={songTitleStyle.color || '#ffffff'}
                      align={songTitleStyle.textAlign || 'center'}
                      draggable
                      onClick={() => setSelectedId('song-title-element')}
                      onTap={() => setSelectedId('song-title-element')}
                      onDragEnd={(e) => {
                        handleSongContentStyleChange('songTitleStyle', {
                          x: Math.round(e.target.x()),
                          y: Math.round(e.target.y()),
                        });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Text;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        handleSongContentStyleChange('songTitleStyle', {
                          x: Math.round(node.x()),
                          y: Math.round(node.y()),
                          width: Math.round(Math.max(100, node.width() * scaleX)),
                          fontSize: `${Math.round(Math.max(12, (parseInt(songTitleStyle.fontSize) || 48) * scaleX))}px`,
                        });
                      }}
                    />
                    {/* Song Lyrics - Editable position/style, fixed text */}
                    <Text
                      id="song-lyrics-element"
                      x={songLyricsStyle.x}
                      y={songLyricsStyle.y}
                      width={songLyricsStyle.width}
                      text="[Song Lyrics]\nLine 2\nLine 3"
                      fontSize={parseInt(songLyricsStyle.fontSize) || 36}
                      fontFamily={getFontFamily(songLyricsStyle.fontFamily)}
                      fontStyle={[
                        songLyricsStyle.fontWeight === 'bold' ? 'bold' : '',
                        songLyricsStyle.fontStyle === 'italic' ? 'italic' : ''
                      ].filter(Boolean).join(' ') || 'normal'}
                      fill={songLyricsStyle.color}
                      align={songLyricsStyle.textAlign}
                      draggable
                      onClick={() => setSelectedId('song-lyrics-element')}
                      onTap={() => setSelectedId('song-lyrics-element')}
                      onDragEnd={(e) => {
                        handleSongContentStyleChange('songLyricsStyle', {
                          x: Math.round(e.target.x()),
                          y: Math.round(e.target.y()),
                        });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Text;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        handleSongContentStyleChange('songLyricsStyle', {
                          x: Math.round(node.x()),
                          y: Math.round(node.y()),
                          width: Math.round(Math.max(100, node.width() * scaleX)),
                          fontSize: `${Math.round(Math.max(12, (parseInt(songLyricsStyle.fontSize) || 36) * scaleX))}px`,
                        });
                      }}
                    />
                    {/* Translation - Editable position/style, fixed text */}
                    <Text
                      id="song-translation-element"
                      x={songTranslationStyle.x}
                      y={songTranslationStyle.y}
                      width={songTranslationStyle.width}
                      text="[Translation]"
                      fontSize={parseInt(songTranslationStyle.fontSize) || 24}
                      fontFamily={getFontFamily(songTranslationStyle.fontFamily)}
                      fontStyle={[
                        songTranslationStyle.fontWeight === 'bold' ? 'bold' : '',
                        songTranslationStyle.fontStyle === 'italic' ? 'italic' : ''
                      ].filter(Boolean).join(' ') || 'normal'}
                      fill={songTranslationStyle.color}
                      align={songTranslationStyle.textAlign}
                      draggable
                      onClick={() => setSelectedId('song-translation-element')}
                      onTap={() => setSelectedId('song-translation-element')}
                      onDragEnd={(e) => {
                        handleSongContentStyleChange('songTranslationStyle', {
                          x: Math.round(e.target.x()),
                          y: Math.round(e.target.y()),
                        });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Text;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        handleSongContentStyleChange('songTranslationStyle', {
                          x: Math.round(node.x()),
                          y: Math.round(node.y()),
                          width: Math.round(Math.max(100, node.width() * scaleX)),
                          fontSize: `${Math.round(Math.max(12, (parseInt(songTranslationStyle.fontSize) || 24) * scaleX))}px`,
                        });
                      }}
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
                        stageRef={stageRef}
                        scale={SCALE}
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
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Font Family
                      {!fontsLoaded && (
                        <span className="ml-1 text-yellow-500" title="Fonts are still loading...">⏳</span>
                      )}
                    </label>
                    <select
                      value={selectedElement.fontFamily || 'Arial'}
                      onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {Object.entries(getFontsByCategory()).map(([category, fonts]) => (
                        <optgroup key={category} label={FONT_CATEGORY_NAMES[category]}>
                          {fonts.map((font) => (
                            <option key={font.name} value={font.name} style={{ fontFamily: font.family }}>
                              {font.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
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
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Style</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { 
                          fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' 
                        })}
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center font-bold ${
                          selectedElement.fontWeight === 'bold'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { 
                          fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' 
                        })}
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center italic ${
                          selectedElement.fontStyle === 'italic'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Italic"
                      >
                        I
                      </button>
                    </div>
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
          ) : selectedSongContentType && selectedSongContentStyle ? (
            /* Song Content Element Properties */
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2">
                <span className="text-yellow-500">🎵</span>
                {selectedSongContentType === 'songTitleStyle' ? 'Song Title' :
                 selectedSongContentType === 'songLyricsStyle' ? 'Song Lyrics' : 'Translation'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Style for song content on reference slide. Text content is fixed.
              </p>
              
              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">X Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedSongContentStyle.x)}
                    onChange={(e) => handleSongContentStyleChange(selectedSongContentType, {
                      x: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                    })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedSongContentStyle.y)}
                    onChange={(e) => handleSongContentStyleChange(selectedSongContentType, {
                      y: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                    })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              {/* Width */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Width</label>
                <input
                  type="number"
                  value={Math.round(selectedSongContentStyle.width)}
                  onChange={(e) => handleSongContentStyleChange(selectedSongContentType, {
                    width: Number.isNaN(parseInt(e.target.value, 10)) ? 100 : parseInt(e.target.value, 10),
                  })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              {/* Font Family */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Font Family
                  {!fontsLoaded && (
                    <span className="ml-1 text-yellow-500" title="Fonts are still loading...">⏳</span>
                  )}
                </label>
                <select
                  value={selectedSongContentStyle.fontFamily || 'Arial'}
                  onChange={(e) => handleSongContentStyleChange(selectedSongContentType, { fontFamily: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {Object.entries(getFontsByCategory()).map(([category, fonts]) => (
                    <optgroup key={category} label={FONT_CATEGORY_NAMES[category]}>
                      {fonts.map((font) => (
                        <option key={font.name} value={font.name} style={{ fontFamily: font.family }}>
                          {font.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              
              {/* Font Size */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Size</label>
                <input
                  type="number"
                  value={parseInt(selectedSongContentStyle.fontSize) || 24}
                  onChange={(e) => handleSongContentStyleChange(selectedSongContentType, {
                    fontSize: `${e.target.value}px`,
                  })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              {/* Font Style (Bold/Italic) */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Font Style</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleSongContentStyleChange(selectedSongContentType, {
                      fontWeight: selectedSongContentStyle.fontWeight === 'bold' ? 'normal' : 'bold'
                    })}
                    className={`flex-1 px-2 py-1.5 text-sm border rounded font-bold ${
                      selectedSongContentStyle.fontWeight === 'bold'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSongContentStyleChange(selectedSongContentType, {
                      fontStyle: selectedSongContentStyle.fontStyle === 'italic' ? 'normal' : 'italic'
                    })}
                    className={`flex-1 px-2 py-1.5 text-sm border rounded italic ${
                      selectedSongContentStyle.fontStyle === 'italic'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    title="Italic"
                  >
                    I
                  </button>
                </div>
              </div>
              
              {/* Color */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedSongContentStyle.color}
                    onChange={(e) => handleSongContentStyleChange(selectedSongContentType, { color: e.target.value })}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedSongContentStyle.color}
                    onChange={(e) => handleSongContentStyleChange(selectedSongContentType, { color: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>
              
              {/* Text Align */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Text Align</label>
                <div className="flex gap-1">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => handleSongContentStyleChange(selectedSongContentType, { textAlign: align })}
                      className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center ${
                        selectedSongContentStyle.textAlign === align
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {align === 'left' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                        </svg>
                      )}
                      {align === 'center' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                        </svg>
                      )}
                      {align === 'right' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              <p>Click on an element to edit its properties</p>
              <p className="mt-2 text-xs">Or use the toolbar to add new elements</p>
            </div>
          )}

        </div>
      </div>

      {/* Song Picker Modal */}
      {showSongPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Song Content
              </h3>
              <button
                onClick={() => {
                  setShowSongPicker(false);
                  setSongSearchQuery('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Search Input */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search songs by name or lyrics..."
                value={songSearchQuery}
                onChange={(e) => setSongSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                autoFocus
              />
            </div>
            
            {/* Song List */}
            <div className="flex-1 overflow-y-auto p-2 relative">
              {importingSong && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Importing song...</span>
                  </div>
                </div>
              )}
              {songsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : filteredSongs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {songSearchQuery ? 'No songs found matching your search.' : 'No songs available.'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => handleImportSong(song)}
                      disabled={importingSong}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {song.name}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                          Has Lyrics
                        </span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          Has Translation
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
              Select a song to import its title, lyrics, and translation as text elements on the current slide.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TemplateWysiwygEditor;

