import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group, Circle, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import useImage from 'use-image';
import type { PresentationTemplate, ImageElement, TextElement, VideoElement, TemplateSlide, BackgroundElement, AspectRatio, SongContentStyle, Song } from '../../types';
import { ASPECT_RATIO_DIMENSIONS } from '../../types';
import { useSongs } from '../../contexts/SongContext';
import { AVAILABLE_FONTS, getFontFamily, getFontsByCategory, FONT_CATEGORY_NAMES } from '../../utils/fonts';
import { regenerateSlideElementIds } from '../../utils/templateUtils/idGenerator';
import { 
  CANVAS_WIDTH, 
  ELEMENT_MARGIN, 
  OVERLAY_MAX_ATTEMPTS, 
  OVERLAY_ATTEMPT_DELAY, 
  VIDEO_LOAD_TIMEOUT,
  SCALE_INCREMENT,
  MIN_SCALE,
  MAX_SCALE
} from './TemplateWysiwygEditor/constants';
import { type CanvasElement } from './TemplateWysiwygEditor/types';
import { 
  sanitizeHtmlContent, 
  parsePosition, 
  detectVideoAspectRatio, 
  detectImageAspectRatio 
} from './TemplateWysiwygEditor/utils';
import { useLongPress, useLongPressDOM, useMultiSelect, useHistory, useKeyboardShortcuts, useDragHandlers, useTemplateUpdater, useSlideDragAndDrop, useSongContentStyles, useSlideContextMenu } from './TemplateWysiwygEditor/hooks';
import { BackgroundImage, URLImage, DraggableText, VideoPlaceholder, AudioPlaceholder } from './TemplateWysiwygEditor/components';
import { 
  applyAlignment, 
  bringToFront as bringElementToFront, 
  sendToBack as sendElementToBack,
  deleteElementsFromSlide,
  type AlignmentType
} from './TemplateWysiwygEditor/operations';
import {
  insertSlide as insertSlideOp,
  duplicateSlide as duplicateSlideOp,
  deleteSlide as deleteSlideOp,
  moveSlideUp as moveSlideUpOp,
  moveSlideDown as moveSlideDownOp,
  setAsReferenceSlide,
  reorderSlides as reorderSlidesOp,
} from './TemplateWysiwygEditor/operations';

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
  onEscape?: (hasChanges: boolean) => void;
  onSlideIndexChange?: (index: number) => void;
  /** Callback to switch to YAML editor at the current slide */
  onSwitchToYaml?: (slideIndex: number) => void;
  /** Callback to open template preview (e.g. from toolbar) */
  onPreview?: () => void;
}

// Get slide dimensions based on aspect ratio
function getSlideDimensions(aspectRatio: AspectRatio = '16:9') {
  return ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS['16:9'];
}

const SONG_CONTENT_ELEMENT_TO_STYLE: Record<string, 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle' | 'bottomLeftTextStyle' | 'bottomRightTextStyle'> = {
  'song-title-element': 'songTitleStyle',
  'song-lyrics-element': 'songLyricsStyle',
  'song-translation-element': 'songTranslationStyle',
  'bottom-left-text-element': 'bottomLeftTextStyle',
  'bottom-right-text-element': 'bottomRightTextStyle',
};

// BackgroundImage component for slide background
export const TemplateWysiwygEditor: React.FC<TemplateWysiwygEditorProps> = ({
  template,
  onTemplateChange,
  onEscape,
  onSlideIndexChange,
  onSwitchToYaml,
  onPreview,
}) => {
  // Multi-select support
  const {
    selectedIds,
    firstSelectedId,
    selectedId,
    isDraggingMultiSelect,
    dragStartPositions,
    isElementSelected,
    selectElement,
    toggleElementSelection,
    addToSelection,
    handleElementSelect,
    clearSelection,
    setIsDraggingMultiSelect,
    setSelectedIds,
  } = useMultiSelect();
  
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [slideListHasFocus, setSlideListHasFocus] = useState(true);
  const [canvasHasFocus, setCanvasHasFocus] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [overlayRefreshKey, setOverlayRefreshKey] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideIndex: number } | null>(null);
  const [elementContextMenu, setElementContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mouseDownOnStageRef = useRef<boolean>(false);
  const propertiesPanelRef = useRef<HTMLDivElement>(null);

  // Debug mode: no selection; live crosshair shows position; click for point, drag for rect
  const [debugMode, setDebugMode] = useState(false);
  const [debugCursor, setDebugCursor] = useState<{ x: number; y: number } | null>(null);
  const [debugPoint, setDebugPoint] = useState<{ x: number; y: number } | null>(null);
  const [debugRect, setDebugRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const debugDragStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // On mount, ensure first slide is selected and canvas has focus
  useEffect(() => {
    setSelectedSlideIndex(0);
    clearSelection();
    setSlideListHasFocus(false);
    setCanvasHasFocus(true);
  }, [clearSelection]); // Run only once on mount
  
  // Notify parent when selected slide index changes
  useEffect(() => {
    onSlideIndexChange?.(selectedSlideIndex);
  }, [selectedSlideIndex, onSlideIndexChange]);
  
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
  
  // Clipboard for copy/paste (uses localStorage for cross-window support)
  // Supports multi-element clipboard as an array
  const CLIPBOARD_KEY = 'saisongs-template-clipboard-v2';
  
  type ClipboardItem = {
    type: 'image' | 'text' | 'video';
    data: ImageElement | TextElement | VideoElement;
  };
  
  const [clipboard, setClipboard] = useState<ClipboardItem[] | null>(() => {
    // Initialize from localStorage
    try {
      const { getLocalStorageItem } = require('../../utils/cacheUtils');
      const stored = getLocalStorageItem(CLIPBOARD_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  // Sync clipboard with localStorage and listen for changes from other windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CLIPBOARD_KEY) {
        try {
          setClipboard(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setClipboard(null);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
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
  
  const currentSlide = slides[selectedSlideIndex] || slides[0] || {
    images: [],
    videos: [],
    text: [],
  };
  
  const referenceSlideIndex = template.referenceSlideIndex ?? 0;

  // Undo/Redo history
  const { historyIndex, canUndo, canRedo, handleUndo, handleRedo, history } = useHistory({
    slides,
    selectedSlideIndex,
    template,
    referenceSlideIndex,
    onTemplateChange,
  });

  // Template updater helper to reduce onTemplateChange boilerplate
  const { updateTemplateWithSlides } = useTemplateUpdater({
    template,
    onTemplateChange,
  });

  // Copy selected elements (saves to localStorage for cross-window paste)
  // Supports multi-select: copies all selected elements
  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    
    const slide = slides[selectedSlideIndex];
    const clipboardItems: ClipboardItem[] = [];
    
    // Find all selected elements in the current slide
    selectedIds.forEach(id => {
      const image = slide.images?.find(img => img.id === id);
      if (image) {
        clipboardItems.push({ type: 'image', data: { ...image } });
        return;
      }
      
      const text = slide.text?.find(txt => txt.id === id);
      if (text) {
        clipboardItems.push({ type: 'text', data: { ...text } });
        return;
      }
      
      const video = slide.videos?.find(vid => vid.id === id);
      if (video) {
        clipboardItems.push({ type: 'video', data: { ...video } });
        return;
      }
    });
    
    if (clipboardItems.length > 0) {
      // Save to localStorage for cross-window access
      const { setLocalStorageItem } = require('../../utils/cacheUtils');
      setLocalStorageItem(CLIPBOARD_KEY, JSON.stringify(clipboardItems));
      setClipboard(clipboardItems);
    }
  }, [selectedIds, slides, selectedSlideIndex]);

  // Paste from clipboard (reads from localStorage for cross-window support)
  // Supports multi-element paste
  const handlePaste = useCallback(() => {
    // Read fresh from localStorage to ensure we have the latest
    let pasteItems: ClipboardItem[] | null = clipboard;
    try {
      const { getLocalStorageItem } = require('../../utils/cacheUtils');
      const stored = getLocalStorageItem(CLIPBOARD_KEY);
      if (stored) {
        pasteItems = JSON.parse(stored);
      }
    } catch {
      // Fall back to state
    }
    
    if (!pasteItems || pasteItems.length === 0) return;
    
    const timestamp = Date.now();
    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };
    const newSelectedIds: string[] = [];
    
    // Paste all clipboard items with new IDs and offset positions
    pasteItems.forEach((item, index) => {
      const itemTimestamp = timestamp + index; // Ensure unique IDs
      
      if (item.type === 'image') {
        const original = item.data as ImageElement;
        const newImage: ImageElement = {
          ...original,
          id: `image-${itemTimestamp}`,
          x: typeof original.x === 'string' 
            ? `${parseInt(original.x) + 20}px` 
            : (original.x || 0) + 20,
          y: typeof original.y === 'string' 
            ? `${parseInt(original.y) + 20}px` 
            : (original.y || 0) + 20,
        };
        slideToUpdate.images = [...(slideToUpdate.images || []), newImage];
        newSelectedIds.push(newImage.id);
      } else if (item.type === 'text') {
        const original = item.data as TextElement;
        const newText: TextElement = {
          ...original,
          id: `text-${itemTimestamp}`,
          x: typeof original.x === 'string' 
            ? `${parseInt(original.x as string) + 20}px` 
            : (original.x || 0) + 20,
          y: typeof original.y === 'string' 
            ? `${parseInt(original.y as string) + 20}px` 
            : (original.y || 0) + 20,
        };
        slideToUpdate.text = [...(slideToUpdate.text || []), newText];
        newSelectedIds.push(newText.id);
      } else if (item.type === 'video') {
        const original = item.data as VideoElement;
        const newVideo: VideoElement = {
          ...original,
          id: `video-${itemTimestamp}`,
          x: typeof original.x === 'number' ? original.x + 20 : original.x,
          y: typeof original.y === 'number' ? original.y + 20 : original.y,
        };
        slideToUpdate.videos = [...(slideToUpdate.videos || []), newVideo];
        newSelectedIds.push(newVideo.id);
      }
    });
    
    newSlides[selectedSlideIndex] = slideToUpdate;
    
    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });
    
    // Select all pasted elements
    setSelectedIds(new Set(newSelectedIds));
  }, [clipboard, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange]);

  // Convert template elements to canvas elements (using full slide coordinates)
  const canvasElements: CanvasElement[] = useMemo(() => {
    const elements: CanvasElement[] = [
      ...(currentSlide.images || []).map((img): CanvasElement => ({
        id: img.id,
        type: 'image',
        x: parsePosition(img.x, img.position, 'x', SLIDE_WIDTH, parseFloat(img.width || '100') || 100, SLIDE_WIDTH, SLIDE_HEIGHT),
        y: parsePosition(img.y, img.position, 'y', SLIDE_HEIGHT, parseFloat(img.height || '100') || 100, SLIDE_WIDTH, SLIDE_HEIGHT),
        width: parseFloat(img.width || '100') || 100,
        height: parseFloat(img.height || '100') || 100,
        url: img.url,
        opacity: img.opacity,
        zIndex: img.zIndex || 1,
        rotation: img.rotation,
      })),
      ...(currentSlide.videos || []).map((vid): CanvasElement => {
        const width = parseFloat(String(vid.width || '160')) || 160;
        const height = parseFloat(String(vid.height || '90')) || 90;
        return {
          id: vid.id,
          type: 'video',
          x: parsePosition(vid.x as string | undefined, vid.position, 'x', SLIDE_WIDTH, width, SLIDE_WIDTH, SLIDE_HEIGHT),
          y: parsePosition(vid.y as string | undefined, vid.position, 'y', SLIDE_HEIGHT, height, SLIDE_WIDTH, SLIDE_HEIGHT),
          width,
          height,
          url: vid.url,
          opacity: vid.opacity,
          zIndex: vid.zIndex || 1,
          autoPlay: vid.autoPlay,
          hideVideo: vid.hideVideo,
          hideAudio: vid.hideAudio,
          rotation: vid.rotation,
        };
      }),
      ...(currentSlide.audios || []).map((aud): CanvasElement => {
        const width = parseFloat(String(aud.width || '200')) || 200;
        const height = parseFloat(String(aud.height || '100')) || 100;
        // Ensure minimum dimensions for proper transformer interaction
        const finalWidth = Math.max(width, 80);
        const finalHeight = Math.max(height, 80);
        return {
          id: aud.id,
          type: 'audio',
          x: parsePosition(aud.x as string | undefined, aud.position, 'x', SLIDE_WIDTH, finalWidth, SLIDE_WIDTH, SLIDE_HEIGHT),
          y: parsePosition(aud.y as string | undefined, aud.position, 'y', SLIDE_HEIGHT, finalHeight, SLIDE_WIDTH, SLIDE_HEIGHT),
          width: finalWidth,
          height: finalHeight,
          url: aud.url,
          opacity: aud.opacity ?? 1,
          zIndex: aud.zIndex ?? 1,
          autoPlay: aud.autoPlay ?? true,
          visualHidden: aud.visualHidden ?? false,
          volume: aud.volume ?? 1,
          loop: aud.loop ?? false,
          startSlide: aud.startSlide ?? (selectedSlideIndex + 1),  // Default to current slide (1-based)
          endSlide: aud.endSlide ?? (selectedSlideIndex + 1),      // Default to current slide (1-based)
          rotation: aud.rotation,
        };
      }),
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
        fontSize: parseFloat(txt.fontSize || '48') || 48,
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

  // Drag handlers for multi-select support
  const { handleMultiSelectDrag, createDragHandlers } = useDragHandlers({
    selectedIds,
    canvasElements,
    slides,
    selectedSlideIndex,
    referenceSlideIndex,
    template,
    stageRef,
    onTemplateChange,
    setIsDraggingMultiSelect,
  });

  // Slide drag-and-drop handlers
  const {
    draggedSlideIndex,
    dragOverSlideIndex,
    handleSlideDragStart,
    handleSlideDragEnd,
    handleSlideDragOver,
    handleSlideDragLeave,
    handleSlideDrop,
  } = useSlideDragAndDrop({
    template,
    referenceSlideIndex,
    onTemplateChange,
    setSelectedSlideIndex,
  });

  // Slide context menu handlers
  const {
    handleInsertSlide,
    handleDuplicateSlide,
    handleDeleteSlide,
    handleMoveSlideUp,
    handleMoveSlideDown,
    handleSetAsReference,
  } = useSlideContextMenu({
    template,
    referenceSlideIndex,
    slidesLength: slides.length,
    onTemplateChange,
    setSelectedSlideIndex,
    setContextMenu,
  });

  // Get selected element (primary selection for properties panel)
  const selectedElement = canvasElements.find(el => el.id === selectedId);
  
  // Get all selected elements for multi-select operations
  const selectedElements = canvasElements.filter(el => selectedIds.has(el.id));
  const isMultiSelect = selectedIds.size > 1;
  
  // Check if a song content element is selected (type only - style resolved later after songTitleStyle etc are defined)
  const selectedSongContentType = selectedId === 'song-title-element' ? 'songTitleStyle' as const :
    selectedId === 'song-lyrics-element' ? 'songLyricsStyle' as const :
    selectedId === 'song-translation-element' ? 'songTranslationStyle' as const :
    selectedId === 'bottom-left-text-element' ? 'bottomLeftTextStyle' as const :
    selectedId === 'bottom-right-text-element' ? 'bottomRightTextStyle' as const : null;

  // Update transformer when selection changes (supports multi-select)
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    
    if (selectedIds.size > 0) {
      // Use requestAnimationFrame to ensure elements are rendered before attaching transformer
      requestAnimationFrame(() => {
        if (!transformerRef.current || !stageRef.current) return;
        
        // Find all selected nodes
        const nodes: Konva.Node[] = [];
        selectedIds.forEach(id => {
          const node = stageRef.current?.findOne('#' + id);
          if (node) {
            nodes.push(node);
          }
        });
        
        if (nodes.length > 0) {
          transformerRef.current.nodes(nodes);
          transformerRef.current.forceUpdate();
          transformerRef.current.getLayer()?.batchDraw();
        } else {
          transformerRef.current.nodes([]);
        }
      });
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedIds, canvasElements, selectedSlideIndex]);

  // Track mousedown globally to prevent deselection when clicking starts outside canvas
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      // Check if mousedown is on the properties panel
      if (propertiesPanelRef.current && propertiesPanelRef.current.contains(e.target as Node)) {
        mouseDownOnStageRef.current = false;
        return;
      }
      // Check if mousedown is on the canvas
      const canvas = stageRef.current?.container().querySelector('canvas');
      if (canvas && canvas === e.target) {
        mouseDownOnStageRef.current = true;
      } else {
        mouseDownOnStageRef.current = false;
      }
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown);
  }, []);

  // Handle canvas click (focus canvas, optionally deselect)
  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Any click on the stage should give focus to the canvas editor
    setCanvasHasFocus(true);
    setSlideListHasFocus(false);

    // In debug mode, don't deselect; click/drag is handled by debug handlers
    if (debugMode) {
      mouseDownOnStageRef.current = false;
      return;
    }

    // Only deselect if BOTH mousedown and click happened on empty stage area
    const clickedOnStage = e.target === e.target.getStage();
    
    // Check if mousedown originated from properties panel or outside stage
    if (clickedOnStage && mouseDownOnStageRef.current) {
      setSelectedIds(new Set());
    }
    
    // Always reset the flag after handling click
    mouseDownOnStageRef.current = false;
  };

  // Get pointer position in slide coordinates (for debug mode)
  const getPointerSlideCoords = useCallback((): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const scale = stage.scaleX();
    return { x: pos.x / scale, y: pos.y / scale };
  }, []);

  // Debug mode: mousedown on overlay (clears previous, starts point or rect)
  const handleDebugMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    setDebugPoint(null);
    setDebugRect(null);
    const coords = getPointerSlideCoords();
    if (coords) debugDragStartRef.current = coords;
  }, [getPointerSlideCoords]);

  // Debug mode: mousemove always updates live cursor; while dragging also updates rect
  const handleDebugMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const coords = getPointerSlideCoords();
    if (coords) setDebugCursor(coords);
    const start = debugDragStartRef.current;
    if (!start || !coords) return;
    const x = Math.min(start.x, coords.x);
    const y = Math.min(start.y, coords.y);
    const width = Math.abs(coords.x - start.x);
    const height = Math.abs(coords.y - start.y);
    setDebugRect({ x, y, width, height });
  }, [getPointerSlideCoords]);

  // Debug mode: mouseup sets point (click) or keeps rect (drag)
  const handleDebugMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const start = debugDragStartRef.current;
    if (!start) return;
    const coords = getPointerSlideCoords();
    if (coords) {
      const dx = Math.abs(coords.x - start.x);
      const dy = Math.abs(coords.y - start.y);
      if (dx < 4 && dy < 4) {
        setDebugPoint({ x: Math.round(start.x), y: Math.round(start.y) });
        setDebugRect(null);
      } else {
        const x = Math.min(start.x, coords.x);
        const y = Math.min(start.y, coords.y);
        const width = Math.abs(coords.x - start.x);
        const height = Math.abs(coords.y - start.y);
        setDebugRect({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
        setDebugPoint(null);
      }
    }
    debugDragStartRef.current = null;
  }, [getPointerSlideCoords]);

  // Debug mode: mouse leave canvas clears live cursor
  const handleDebugMouseLeave = useCallback(() => {
    setDebugCursor(null);
  }, []);



  // Update element in template
  const updateElement = useCallback(async (elementId: string, updates: Partial<CanvasElement>) => {
    const element = canvasElements.find(el => el.id === elementId);
    if (!element) return;

    // Detect aspect ratio for images when URL changes
    if (element.type === 'image' && updates.url && updates.url !== element.url && updates.url.trim()) {
      console.log('🖼️ Detecting image aspect ratio for:', updates.url);
      try {
        const dimensions = await detectImageAspectRatio(updates.url);
        if (dimensions) {
          // Only update dimensions if they haven't been manually set
          // Check if current dimensions are defaults
          const currentWidth = typeof element.width === 'string' 
            ? parseFloat(element.width) 
            : element.width || 0;
          const currentHeight = typeof element.height === 'string' 
            ? parseFloat(element.height) 
            : element.height || 0;
          
          console.log(`Current dimensions: ${currentWidth}x${currentHeight}`);
          
          // Apply auto-sizing if it's a new image or has default dimensions
          if (currentWidth === 0 || currentHeight === 0 || 
              (currentWidth === 200 && currentHeight === 200) ||
              (currentWidth === 320 && currentHeight === 180) ||
              (currentWidth === 400 && currentHeight === 400)) {
            console.log(`✓ Applying auto-sizing: ${dimensions.width}x${dimensions.height}`);
            updates.width = dimensions.width;
            updates.height = dimensions.height;
          } else {
            console.log('⊗ Skipping auto-sizing - dimensions already customized');
          }
        }
      } catch (error) {
        console.warn('Could not detect image aspect ratio:', error);
      }
    }

    // Detect aspect ratio for videos when URL changes
    if (element.type === 'video' && updates.url && updates.url !== element.url && updates.url.trim()) {
      try {
        const dimensions = await detectVideoAspectRatio(updates.url);
        if (dimensions) {
          // Only update dimensions if they haven't been manually set
          // Check if current dimensions are defaults (e.g., 320x180 or 100%)
          const currentWidth = typeof element.width === 'number' ? element.width : parseFloat(String(element.width || '0'));
          const currentHeight = typeof element.height === 'number' ? element.height : parseFloat(String(element.height || '0'));
          
          if ((currentWidth === 320 && currentHeight === 180) || currentWidth === 0 || currentHeight === 0) {
            updates.width = dimensions.width;
            updates.height = dimensions.height;
          }
        }
      } catch (error) {
        console.warn('Could not detect video aspect ratio:', error);
      }
    }

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
          zIndex: updates.zIndex !== undefined ? updates.zIndex : images[imgIndex].zIndex,
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
          hideVideo: updates.hideVideo ?? videos[vidIndex].hideVideo,
          hideAudio: updates.hideAudio ?? videos[vidIndex].hideAudio,
          visualHidden: updates.visualHidden ?? videos[vidIndex].visualHidden,
          zIndex: updates.zIndex !== undefined ? updates.zIndex : videos[vidIndex].zIndex,
          rotation:
            updates.rotation !== undefined
              ? Math.round(updates.rotation)
              : videos[vidIndex].rotation,
          position: undefined, // Clear predefined position when using x/y
        };
        slideToUpdate.videos = videos;
      }
    } else if (element.type === 'audio') {
      const audios = [...(slideToUpdate.audios || [])];
      const audIndex = audios.findIndex(aud => aud.id === elementId);
      if (audIndex >= 0) {
        const currentSlideNum = selectedSlideIndex + 1; // 1-based default
        audios[audIndex] = {
          ...audios[audIndex],
          x: updates.x !== undefined ? `${Math.round(updates.x)}px` : audios[audIndex].x,
          y: updates.y !== undefined ? `${Math.round(updates.y)}px` : audios[audIndex].y,
          width: updates.width !== undefined ? `${Math.round(updates.width)}px` : audios[audIndex].width,
          height: updates.height !== undefined ? `${Math.round(updates.height)}px` : audios[audIndex].height,
          opacity: updates.opacity ?? audios[audIndex].opacity ?? 1,
          url: updates.url ?? audios[audIndex].url,
          autoPlay: updates.autoPlay ?? audios[audIndex].autoPlay ?? false,
          visualHidden: updates.visualHidden ?? audios[audIndex].visualHidden ?? false,
          volume: updates.volume ?? audios[audIndex].volume ?? 1,
          loop: audios[audIndex].loop ?? false,
          startSlide: updates.startSlide !== undefined ? updates.startSlide : (audios[audIndex].startSlide ?? currentSlideNum),
          endSlide: updates.endSlide !== undefined ? updates.endSlide : (audios[audIndex].endSlide ?? currentSlideNum),
          zIndex: updates.zIndex !== undefined ? updates.zIndex : (audios[audIndex].zIndex ?? 1),
          rotation:
            updates.rotation !== undefined
              ? Math.round(updates.rotation)
              : audios[audIndex].rotation,
          position: undefined, // Clear predefined position when using x/y
        };
        slideToUpdate.audios = audios;
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
          zIndex: updates.zIndex !== undefined ? updates.zIndex : texts[txtIndex].zIndex,
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
    
    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });
    
    // Force transformer update after dimension changes
    if ((updates.width !== undefined || updates.height !== undefined) && selectedId === elementId) {
      setTimeout(() => {
        if (transformerRef.current && stageRef.current) {
          const node = stageRef.current.findOne('#' + elementId);
          if (node) {
            transformerRef.current.nodes([node]);
            transformerRef.current.forceUpdate();
            transformerRef.current.getLayer()?.batchDraw();
          }
        }
      }, 50);
    }
  }, [canvasElements, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange, selectedId]);

  // Delete selected elements (supports multi-select)
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;

    const newSlides = [...slides];
    const slideToUpdate = deleteElementsFromSlide(newSlides[selectedSlideIndex], selectedIds, canvasElements);
    newSlides[selectedSlideIndex] = slideToUpdate;

    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });

    setSelectedIds(new Set());
  }, [selectedIds, canvasElements, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange]);

  const bringToFront = useCallback(() => {
    if (!selectedId) return;
    
    const element = canvasElements.find(el => el.id === selectedId);
    if (!element) return;

    // Find max z-index in current slide
    const maxZIndex = Math.max(0, ...canvasElements.map(el => el.zIndex || 0));
    
    updateElement(selectedId, { zIndex: maxZIndex + 1 });
  }, [selectedId, canvasElements, updateElement]);

  const sendToBack = useCallback(() => {
    if (!selectedId) return;
    
    const element = canvasElements.find(el => el.id === selectedId);
    if (!element) return;

    // Find min z-index in current slide
    const minZIndex = Math.min(0, ...canvasElements.map(el => el.zIndex || 0));
    
    updateElement(selectedId, { zIndex: minZIndex - 1 });
  }, [selectedId, canvasElements, updateElement]);

  // Helper function to apply alignment and update template
  const applyAlignmentAndUpdate = useCallback((alignmentType: AlignmentType) => {
    if (selectedIds.size < 2 || !firstSelectedId) return;
    
    const selectedElements = canvasElements.filter(el => selectedIds.has(el.id));
    
    const newSlides = [...slides];
    const slideToUpdate = applyAlignment(newSlides[selectedSlideIndex], selectedElements, firstSelectedId, alignmentType);
    newSlides[selectedSlideIndex] = slideToUpdate;
    
    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });
  }, [selectedIds, firstSelectedId, canvasElements, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange, updateTemplateWithSlides]);

  // Alignment functions for multi-selection
  const alignLeft = useCallback(() => applyAlignmentAndUpdate('left'), [applyAlignmentAndUpdate]);
  const alignCenter = useCallback(() => applyAlignmentAndUpdate('center'), [applyAlignmentAndUpdate]);
  const alignRight = useCallback(() => applyAlignmentAndUpdate('right'), [applyAlignmentAndUpdate]);
  const alignTop = useCallback(() => applyAlignmentAndUpdate('top'), [applyAlignmentAndUpdate]);
  const alignMiddle = useCallback(() => applyAlignmentAndUpdate('middle'), [applyAlignmentAndUpdate]);
  const alignBottom = useCallback(() => applyAlignmentAndUpdate('bottom'), [applyAlignmentAndUpdate]);
  const makeSameWidth = useCallback(() => applyAlignmentAndUpdate('sameWidth'), [applyAlignmentAndUpdate]);
  const makeSameHeight = useCallback(() => applyAlignmentAndUpdate('sameHeight'), [applyAlignmentAndUpdate]);

  // Keyboard shortcuts for canvas (undo/redo/copy/paste/delete/move)
  useKeyboardShortcuts({
    isTextEditing,
    canvasHasFocus,
    slideListHasFocus,
    selectedId,
    selectedIds,
    canvasElements,
    slides,
    selectedSlideIndex,
    referenceSlideIndex,
    template,
    elementContextMenu,
    contextMenu,
    updateElement,
    handleDeleteSelected,
    handleUndo,
    handleRedo,
    handleCopy,
    handlePaste,
    setSelectedSlideIndex,
    setSelectedIds,
    setElementContextMenu,
    setContextMenu,
    onTemplateChange,
  });

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

    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });

    selectElement(newImage.id);
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

    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });

    selectElement(newVideo.id);
  };

  // Add new audio (using full slide coordinates)
  const handleAddAudio = () => {
    const currentSlideNum = selectedSlideIndex + 1; // 1-based
    const newAudio: AudioElement = {
      id: `audio-${Date.now()}`,
      url: '',
      width: '1200px',
      height: '100px',
      x: '100px',
      y: '100px',
      opacity: 1,
      zIndex: 1,
      autoPlay: false,
      loop: false,
      volume: 1,
      visualHidden: false,
      startSlide: currentSlideNum,  // Default to current slide (1-based)
      endSlide: currentSlideNum,    // Default to current slide (1-based)
    };

    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };
    slideToUpdate.audios = [...(slideToUpdate.audios || []), newAudio];
    newSlides[selectedSlideIndex] = slideToUpdate;

    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });

    selectElement(newAudio.id);
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

    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });

    selectElement(newText.id);
  };

  // Import song content as slides using reference slide styling
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
      
      // Import the slide generation utility
      const { generateSlides } = await import('../../utils/slideUtils');
      
      // Get reference slide to clone its styling
      const refSlide = slides[referenceSlideIndex] || slides[0];
      
      // Generate song slides (handles splitting into multiple slides if needed)
      const generatedSlides = generateSlides(song);
      
      // Create template slides for each generated slide with lyrics as editable text elements
      const newTemplateSlides: TemplateSlide[] = generatedSlides.map((genSlide, index) => {
        // Get reference slide's song styles to use as template
        const refTitleStyle = refSlide.songTitleStyle || {
          x: 40,
          y: 60,
          width: 1840,
          height: 120,
          fontSize: '48px',
          fontWeight: 'bold' as const,
          textAlign: 'center' as const,
          color: '#ffffff',
        };

        const refLyricsStyle = refSlide.songLyricsStyle || {
          x: 40,
          y: 216,
          width: 1840,
          height: 500,
          fontSize: '36px',
          fontWeight: 'bold' as const,
          textAlign: 'center' as const,
          color: '#ffffff',
        };

        // Create text elements for title, lyrics and translation
        const textElements: TextElement[] = [];
        const timestamp = Date.now() + index;

        // Add title as an editable text element (on all slides of multi-slide songs)
        textElements.push({
          id: `imported-title-${timestamp}`,
          content: genSlide.songName || '[Title not available]',
          fontSize: refTitleStyle.fontSize,
          color: refTitleStyle.color,
          fontWeight: refTitleStyle.fontWeight,
          fontStyle: refTitleStyle.fontStyle,
          fontFamily: refTitleStyle.fontFamily,
          x: `${refTitleStyle.x}px`,
          y: `${refTitleStyle.y}px`,
          width: `${refTitleStyle.width}px`,
          height: refTitleStyle.height ? `${refTitleStyle.height}px` : undefined,
          textAlign: refTitleStyle.textAlign,
          opacity: 1,
          zIndex: 2,
        });

        // Add lyrics as an editable text element
        // Store with HTML tags intact - they will be rendered properly in presentation mode
        textElements.push({
          id: `imported-lyrics-${timestamp}`,
          content: genSlide.content || '[Lyrics not available]',
          fontSize: refLyricsStyle.fontSize,
          color: refLyricsStyle.color,
          fontWeight: refLyricsStyle.fontWeight,
          fontStyle: refLyricsStyle.fontStyle,
          fontFamily: refLyricsStyle.fontFamily,
          x: `${refLyricsStyle.x}px`,
          y: `${refLyricsStyle.y}px`,
          width: `${refLyricsStyle.width}px`,
          height: refLyricsStyle.height ? `${refLyricsStyle.height}px` : undefined,
          textAlign: refLyricsStyle.textAlign,
          opacity: 1,
          zIndex: 2,
        });

        // Add translation if available
        if (genSlide.translation) {
          const refTranslationStyle = refSlide.songTranslationStyle || {
            x: 40,
            y: 810,
            width: 1840,
            height: 200,
            fontSize: '24px',
            fontWeight: 'normal' as const,
            textAlign: 'center' as const,
            color: '#ffffff',
          };

          textElements.push({
            id: `imported-translation-${timestamp}`,
            content: genSlide.translation,
            fontSize: refTranslationStyle.fontSize,
            color: refTranslationStyle.color,
            fontWeight: refTranslationStyle.fontWeight,
            fontStyle: refTranslationStyle.fontStyle,
            fontFamily: refTranslationStyle.fontFamily,
            x: `${refTranslationStyle.x}px`,
            y: `${refTranslationStyle.y}px`,
            width: `${refTranslationStyle.width}px`,
            height: refTranslationStyle.height ? `${refTranslationStyle.height}px` : undefined,
            textAlign: refTranslationStyle.textAlign,
            opacity: 1,
            zIndex: 2,
          });
        }

        return {
          background: refSlide.background ? { ...refSlide.background } : undefined,
          images: refSlide.images ? refSlide.images.map(img => ({ ...img })) : undefined,
          videos: refSlide.videos ? refSlide.videos.map(vid => ({ ...vid })) : undefined,
          audios: refSlide.audios ? refSlide.audios.map(aud => ({ ...aud })) : undefined,
          text: [...(refSlide.text ? refSlide.text.map(txt => ({ ...txt })) : []), ...textElements],
          songTitleStyle: refSlide.songTitleStyle ? { ...refSlide.songTitleStyle } : undefined,
          songLyricsStyle: refSlide.songLyricsStyle ? { ...refSlide.songLyricsStyle } : undefined,
          songTranslationStyle: refSlide.songTranslationStyle ? { ...refSlide.songTranslationStyle } : undefined,
          bottomLeftTextStyle: refSlide.bottomLeftTextStyle ? { ...refSlide.bottomLeftTextStyle } : undefined,
          bottomRightTextStyle: refSlide.bottomRightTextStyle ? { ...refSlide.bottomRightTextStyle } : undefined,
        };
      });
      
      // Insert new slides after the selected slide
      const newSlides = [
        ...slides.slice(0, selectedSlideIndex + 1),
        ...newTemplateSlides,
        ...slides.slice(selectedSlideIndex + 1),
      ];
      
      updateTemplateWithSlides(newSlides, referenceSlideIndex);

      // Select the first imported slide
      setSelectedSlideIndex(selectedSlideIndex + 1);
      setSelectedIds(new Set());
      
      // Close the picker
      setShowSongPicker(false);
      setSongSearchQuery('');
      
      console.log(`✅ Imported song "${song.name}" as ${newTemplateSlides.length} slide(s) after selected slide`);
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

    updateTemplateWithSlides(newSlides, referenceSlideIndex, {
      selectedSlideIndex,
      useSelectedSlideAudios: true,
    });
  };

  // Song content styles hook
  const referenceSlide = slides[referenceSlideIndex] || slides[0];
  const {
    songTitleStyle,
    songLyricsStyle,
    songTranslationStyle,
    bottomLeftTextStyle,
    bottomRightTextStyle,
    getDefaultStyle,
  } = useSongContentStyles({
    referenceSlide,
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
  });

  // Reorder all overlay nodes (song content + canvas elements) by logical z-index so draw order
  // and hit-test match on the reference slide. Song title/lyrics/translation etc. can then be
  // clicked when they are on top of images. Run in rAF so it runs after react-konva sync.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const isRefSlide = selectedSlideIndex === referenceSlideIndex;
    const run = () => {
      const l = layerRef.current;
      if (!l) return;
      const children = l.getChildren((node: Konva.Node) => true);
      // Build combined overlay list: song content (ref slide only) + canvas elements, sorted by z-index
      const overlayEntries: { id: string; zIndex: number }[] = [];
      if (isRefSlide) {
        overlayEntries.push({ id: 'song-title-element', zIndex: songTitleStyle?.zIndex ?? 20 });
        overlayEntries.push({ id: 'song-lyrics-element', zIndex: songLyricsStyle?.zIndex ?? 21 });
        overlayEntries.push({ id: 'song-translation-element', zIndex: songTranslationStyle?.zIndex ?? 22 });
        overlayEntries.push({ id: 'bottom-left-text-element', zIndex: bottomLeftTextStyle?.zIndex ?? 23 });
        overlayEntries.push({ id: 'bottom-right-text-element', zIndex: bottomRightTextStyle?.zIndex ?? 24 });
      }
      canvasElements.forEach((el) => overlayEntries.push({ id: el.id, zIndex: el.zIndex ?? 0 }));
      overlayEntries.sort((a, b) => a.zIndex - b.zIndex);

      const findNode = (id: string) =>
        children.find((n) => n.id() === id || (n as Konva.Node & { getAttr?: (n: string) => unknown }).getAttr?.('id') === id);

      overlayEntries.forEach((entry, i) => {
        const node = findNode(entry.id);
        if (node && typeof (node as Konva.Node).setZIndex === 'function') {
          const targetIndex = 1 + i; // 0 = background, 1..N = overlays, N+1 = Transformer
          const current = (node as Konva.Node).getZIndex?.();
          if (current !== targetIndex) {
            (node as Konva.Node).setZIndex(Math.min(targetIndex, children.length - 1));
          }
        }
      });
      l.draw(); // immediate draw so hit canvas is updated and topmost node receives clicks
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [
    selectedSlideIndex,
    referenceSlideIndex,
    canvasElements,
    songTitleStyle?.zIndex,
    songLyricsStyle?.zIndex,
    songTranslationStyle?.zIndex,
    bottomLeftTextStyle?.zIndex,
    bottomRightTextStyle?.zIndex,
  ]);

  // Update song content style (only for reference slide)
  const handleSongContentStyleChange = useCallback((
    styleType: 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle' | 'bottomLeftTextStyle' | 'bottomRightTextStyle',
    updates: Partial<SongContentStyle>
  ) => {
    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[referenceSlideIndex] };
    
    const currentStyle = slideToUpdate[styleType] || getDefaultStyle(styleType);
    
    slideToUpdate[styleType] = {
      ...currentStyle,
      ...updates,
    };
    newSlides[referenceSlideIndex] = slideToUpdate;

    updateTemplateWithSlides(newSlides, referenceSlideIndex);
  }, [slides, referenceSlideIndex, getDefaultStyle, updateTemplateWithSlides]);

  const bringSongContentToFront = useCallback((styleType: 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle' | 'bottomLeftTextStyle' | 'bottomRightTextStyle') => {
    const allZIndices = [
      songTitleStyle.zIndex ?? 20,
      songLyricsStyle.zIndex ?? 21,
      songTranslationStyle.zIndex ?? 22,
      bottomLeftTextStyle.zIndex ?? 23,
      bottomRightTextStyle.zIndex ?? 24,
      ...canvasElements.map(el => el.zIndex || 0),
    ];
    const maxZ = Math.max(0, ...allZIndices);
    handleSongContentStyleChange(styleType, { zIndex: maxZ + 1 });
  }, [songTitleStyle?.zIndex, songLyricsStyle?.zIndex, songTranslationStyle?.zIndex, bottomLeftTextStyle?.zIndex, bottomRightTextStyle?.zIndex, canvasElements, handleSongContentStyleChange]);

  const sendSongContentToBack = useCallback((styleType: 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle' | 'bottomLeftTextStyle' | 'bottomRightTextStyle') => {
    const allZIndices = [
      songTitleStyle.zIndex ?? 20,
      songLyricsStyle.zIndex ?? 21,
      songTranslationStyle.zIndex ?? 22,
      bottomLeftTextStyle.zIndex ?? 23,
      bottomRightTextStyle.zIndex ?? 24,
      ...canvasElements.map(el => el.zIndex || 0),
    ];
    const minZ = Math.min(0, ...allZIndices);
    handleSongContentStyleChange(styleType, { zIndex: minZ - 1 });
  }, [songTitleStyle?.zIndex, songLyricsStyle?.zIndex, songTranslationStyle?.zIndex, bottomLeftTextStyle?.zIndex, bottomRightTextStyle?.zIndex, canvasElements, handleSongContentStyleChange]);

  // Now we can resolve the selected song content style
  const selectedSongContentStyle = selectedSongContentType ? 
    (selectedSongContentType === 'songTitleStyle' ? songTitleStyle :
     selectedSongContentType === 'songLyricsStyle' ? songLyricsStyle :
     selectedSongContentType === 'songTranslationStyle' ? songTranslationStyle :
     selectedSongContentType === 'bottomLeftTextStyle' ? bottomLeftTextStyle :
     selectedSongContentType === 'bottomRightTextStyle' ? bottomRightTextStyle : null) : null;

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleClickOutside = () => setElementContextMenu(null);
    if (elementContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [elementContextMenu]);

  // Render context menus directly to body DOM for proper z-index stacking
  useEffect(() => {
    // Clean up any existing context menus
    const existingMenus = document.querySelectorAll('.wysiwyg-context-menu');
    existingMenus.forEach(menu => menu.remove());

    // Escape key handler for context menus
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (elementContextMenu || contextMenu)) {
        e.preventDefault();
        e.stopPropagation();
        setElementContextMenu(null);
        setContextMenu(null);
      }
    };

    // Render element context menu if active
    if (elementContextMenu) {
      const menu = document.createElement('div');
      menu.className = 'wysiwyg-context-menu fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px]';
      menu.style.left = `${elementContextMenu.x}px`;
      menu.style.top = `${elementContextMenu.y}px`;
      menu.style.zIndex = '99999';
      menu.addEventListener('click', (e) => e.stopPropagation());
      
      // Add escape key listener
      document.addEventListener('keydown', handleEscapeKey, true);

      const songContentStyleType = SONG_CONTENT_ELEMENT_TO_STYLE[elementContextMenu.elementId];
      const isSongContentElement = songContentStyleType != null;

      const buttons = isSongContentElement
        ? [
            { icon: 'fa-arrow-up', text: 'Bring to Front', action: () => { bringSongContentToFront(songContentStyleType); setElementContextMenu(null); } },
            { icon: 'fa-arrow-down', text: 'Send to Back', action: () => { sendSongContentToBack(songContentStyleType); setElementContextMenu(null); } },
          ]
        : [
            { icon: 'fa-arrow-up', text: 'Bring to Front', action: () => { bringToFront(); setElementContextMenu(null); } },
            { icon: 'fa-arrow-down', text: 'Send to Back', action: () => { sendToBack(); setElementContextMenu(null); } },
          ];

      // Add alignment options if multiple elements selected (canvas elements only)
      if (!isSongContentElement && selectedIds.size > 1) {
        buttons.push(
          { divider: true },
          { icon: 'fa-align-left', text: 'Align Left', action: () => { alignLeft(); setElementContextMenu(null); } },
          { icon: 'fa-align-center', text: 'Align Center', action: () => { alignCenter(); setElementContextMenu(null); } },
          { icon: 'fa-align-right', text: 'Align Right', action: () => { alignRight(); setElementContextMenu(null); } },
          { divider: true },
          { icon: 'fa-arrow-up', text: 'Align Top', action: () => { alignTop(); setElementContextMenu(null); } },
          { icon: 'fa-grip-lines', text: 'Align Middle', action: () => { alignMiddle(); setElementContextMenu(null); } },
          { icon: 'fa-arrow-down', text: 'Align Bottom', action: () => { alignBottom(); setElementContextMenu(null); } },
          { divider: true },
          { icon: 'fa-arrows-alt-h', text: 'Make Same Width', action: () => { makeSameWidth(); setElementContextMenu(null); } },
          { icon: 'fa-arrows-alt-v', text: 'Make Same Height', action: () => { makeSameHeight(); setElementContextMenu(null); } }
        );
      }

      buttons.forEach(btn => {
        if (btn.divider) {
          const divider = document.createElement('div');
          divider.className = 'border-t border-gray-600 my-1';
          menu.appendChild(divider);
        } else {
          const button = document.createElement('button');
          button.className = 'w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2';
          button.innerHTML = `<i class="fas ${btn.icon} text-base"></i>${btn.text}`;
          button.onclick = btn.action;
          menu.appendChild(button);
        }
      });

      document.body.appendChild(menu);
    }

    // Render slide context menu if active
    if (contextMenu) {
      const menu = document.createElement('div');
      menu.className = 'wysiwyg-context-menu fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[180px]';
      menu.style.left = `${contextMenu.x}px`;
      menu.style.top = `${contextMenu.y}px`;
      menu.style.zIndex = '99999';
      menu.addEventListener('click', (e) => e.stopPropagation());
      
      // Add escape key listener
      document.addEventListener('keydown', handleEscapeKey, true);

      const slideIndex = contextMenu.slideIndex;
      const buttons = [
        { icon: 'fa-plus', text: 'Insert Slide After', action: () => handleInsertSlide(slideIndex) },
        { icon: 'fa-copy', text: 'Duplicate Slide', action: () => handleDuplicateSlide(slideIndex) },
        { divider: true },
        { icon: 'fa-chevron-up', text: 'Move Up', action: () => handleMoveSlideUp(slideIndex), disabled: slideIndex === 0 },
        { icon: 'fa-chevron-down', text: 'Move Down', action: () => handleMoveSlideDown(slideIndex), disabled: slideIndex === slides.length - 1 },
        { divider: true },
      ];

      if (slideIndex !== referenceSlideIndex) {
        buttons.push({ icon: 'fa-star', text: 'Set as Reference', action: () => handleSetAsReference(slideIndex), color: 'text-yellow-400' });
      }

      buttons.push({ icon: 'fa-trash', text: 'Delete Slide', action: () => handleDeleteSlide(slideIndex), disabled: slides.length <= 1, color: 'text-red-400' });

      buttons.forEach(btn => {
        if (btn.divider) {
          const divider = document.createElement('div');
          divider.className = 'border-t border-gray-600 my-1';
          menu.appendChild(divider);
        } else {
          const button = document.createElement('button');
          const disabledClass = btn.disabled ? ' disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent' : '';
          button.className = `w-full px-4 py-2 text-left text-sm ${btn.color || 'text-gray-200'} hover:bg-gray-700 flex items-center gap-2${disabledClass}`;
          button.disabled = btn.disabled || false;
          button.innerHTML = `<i class="fas ${btn.icon} text-base"></i>${btn.text}`;
          button.onclick = btn.action;
          menu.appendChild(button);
        }
      });

      document.body.appendChild(menu);
    }

    return () => {
      // Cleanup on unmount or when menus change
      const menus = document.querySelectorAll('.wysiwyg-context-menu');
      menus.forEach(menu => menu.remove());
      document.removeEventListener('keydown', handleEscapeKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementContextMenu, contextMenu, selectedIds.size, slides.length, referenceSlideIndex, bringSongContentToFront, sendSongContentToBack]);

  // Get background color/style
  const bgColor = (!currentSlide.background?.type || currentSlide.background?.type === 'color')
    ? (currentSlide.background?.value || '#1a1a2e')
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
    <div 
      className="flex flex-col gap-4"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        
        // Don't shift focus if clicking on the stage
        const stageContainer = target.closest('.template-editor-stage');
        if (stageContainer) {
          return;
        }
        
        // Don't shift focus if clicking on any interactive element or property panels
        const isFormElement = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'LABEL'].includes(target.tagName);
        const isInPropertyPanel = target.closest('.flex-shrink-0') !== null; // Property panel is in a flex-shrink-0 container
        
        // Don't deselect if mousedown started in property panel (even if mouseup is elsewhere)
        const mouseDownWasInPropertyPanel = !mouseDownOnStageRef.current;
        
        if (!isFormElement && !isInPropertyPanel && !mouseDownWasInPropertyPanel) {
          // Clicked outside the stage and not on interactive elements - deselect and return focus to slide list
          setSelectedIds(new Set());
          setSlideListHasFocus(true);
          setCanvasHasFocus(false);
        }
      }}
    >
      {/* Main editor area */}
      <div className="flex gap-4" style={{ height: '580px' }}>
        {/* Slide thumbnails list (left) */}
        <div
          className="w-44 flex-shrink-0 bg-gray-900/40 dark:bg-gray-900/60 rounded-lg p-2 overflow-y-auto flex flex-col"
        >
          {/* Toolbar with YAML button */}
          {onSwitchToYaml && (
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700/50">
              <span className="text-[11px] text-gray-400">{slides.length} slides</span>
              <button
                type="button"
                onClick={() => onSwitchToYaml(selectedSlideIndex)}
                className="px-2 py-1 text-[10px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title={`Edit slide ${selectedSlideIndex + 1} in YAML (Ctrl+Y)`}
              >
                YAML →
              </button>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto">
          {slides.map((slide, idx) => {
            const isSelected = idx === selectedSlideIndex;
            const isReference = idx === referenceSlideIndex;
            const isStatic = slides.length > 1 && idx !== referenceSlideIndex;
            const isIntro = isStatic && idx < referenceSlideIndex;

            // Long-press state for this slide
            let longPressTimer: NodeJS.Timeout | null = null;
            let startX = 0;
            let startY = 0;

            const handleTouchStart = (e: React.TouchEvent) => {
              const touch = e.touches[0];
              startX = touch.clientX;
              startY = touch.clientY;
              
              longPressTimer = setTimeout(() => {
                setContextMenu({ x: touch.clientX, y: touch.clientY, slideIndex: idx });
                setSelectedSlideIndex(idx);
              }, 500);
            };

            const handleTouchMove = (e: React.TouchEvent) => {
              const touch = e.touches[0];
              const deltaX = Math.abs(touch.clientX - startX);
              const deltaY = Math.abs(touch.clientY - startY);
              
              if (deltaX > 10 || deltaY > 10) {
                if (longPressTimer) {
                  clearTimeout(longPressTimer);
                  longPressTimer = null;
                }
              }
            };

            const handleTouchEnd = () => {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
            };

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
                  data-slide-thumbnail="true"
                  ref={(el) => {
                    thumbnailRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    setSelectedSlideIndex(idx);
                    setSelectedIds(new Set());
                    setSlideListHasFocus(true);
                    setCanvasHasFocus(false);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, slideIndex: idx });
                    setSelectedSlideIndex(idx);
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onFocus={() => {
                    setSlideListHasFocus(true);
                    setCanvasHasFocus(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      if (e.shiftKey) {
                        // Move slide up
                        e.preventDefault();
                        e.stopPropagation();
                        if (idx > 0) {
                          handleMoveSlideUp(idx);
                          setTimeout(() => {
                            const prevBtn = thumbnailRefs.current[idx - 1];
                            if (prevBtn) prevBtn.focus();
                          }, 50);
                        }
                      } else {
                        // Navigate to previous slide
                        e.preventDefault();
                        const prevIndex = Math.max(0, idx - 1);
                        setSelectedSlideIndex(prevIndex);
                        setSelectedIds(new Set());
                        const prevBtn = thumbnailRefs.current[prevIndex];
                        if (prevBtn) {
                          prevBtn.focus();
                        }
                      }
                    } else if (e.key === 'ArrowDown') {
                      if (e.shiftKey) {
                        // Move slide down
                        e.preventDefault();
                        e.stopPropagation();
                        if (idx < slides.length - 1) {
                          handleMoveSlideDown(idx);
                          setTimeout(() => {
                            const nextBtn = thumbnailRefs.current[idx + 1];
                            if (nextBtn) nextBtn.focus();
                          }, 50);
                        }
                      } else {
                        // Navigate to next slide
                        e.preventDefault();
                        const nextIndex = Math.min(slides.length - 1, idx + 1);
                        setSelectedSlideIndex(nextIndex);
                        setSelectedIds(new Set());
                        const nextBtn = thumbnailRefs.current[nextIndex];
                        if (nextBtn) {
                          nextBtn.focus();
                        }
                      }
                    }
                  }}
                  className={`w-full mb-2 rounded-md text-left transition-colors cursor-grab active:cursor-grabbing outline-none ${
                    isSelected
                      ? 'border-4 border-white bg-gray-800'
                      : 'border-0 bg-gray-900 hover:bg-gray-800'
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
                        const imgWidth = parseFloat(img.width || '100') || 100;
                        const imgHeight = parseFloat(img.height || '100') || 100;
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

                      {/* Audio elements */}
                      {(slide.audios || []).map((aud) => {
                        const audWidth = parseFloat(aud.width || '80') || 80;
                        const audHeight = parseFloat(aud.height || '80') || 80;
                        const x = parsePosition(
                          aud.x as string | undefined,
                          aud.position,
                          'x',
                          SLIDE_WIDTH,
                          audWidth,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );
                        const y = parsePosition(
                          aud.y as string | undefined,
                          aud.position,
                          'y',
                          SLIDE_HEIGHT,
                          audHeight,
                          SLIDE_WIDTH,
                          SLIDE_HEIGHT
                        );

                        return (
                          <div
                            key={aud.id}
                            className="absolute rounded-full border border-blue-300/70 bg-black/60 flex items-center justify-center"
                            style={{
                              left: `${(x / SLIDE_WIDTH) * 100}%`,
                              top: `${(y / SLIDE_HEIGHT) * 100}%`,
                              width: `${(audWidth / SLIDE_WIDTH) * 100}%`,
                              height: `${(audHeight / SLIDE_HEIGHT) * 100}%`,
                            }}
                          >
                            <span className="text-[9px] text-blue-100">♪</span>
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
                  {/* Slide number overlay (bottom-left) */}
                  <div className="absolute bottom-1 left-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/70 text-white text-[11px] font-bold border border-white/30">
                    {idx + 1}
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
          </div>
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
                title="Undo last change (Ctrl+Z)"
                className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fas fa-undo text-base"></i>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo last undone change (Ctrl+Shift+Z)"
                className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fas fa-redo text-base"></i>
              </button>
            </div>
            <button
              onClick={handleAddText}
              title="Add text element to slide"
              className="flex items-center justify-center p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm font-bold text-xs"
            >
              T
            </button>
            <button
              onClick={handleAddImage}
              title="Add image from URL"
              className="flex items-center justify-center p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
            >
              <i className="fas fa-image text-base"></i>
            </button>
            <button
              onClick={handleAddAudio}
              title="Add audio from URL (background music or narration)"
              className="flex items-center justify-center p-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 shadow-sm"
            >
              <i className="fas fa-volume-up text-base"></i>
            </button>
            <button
              onClick={handleAddVideo}
              title="Add video from URL (background or embedded)"
              className="flex items-center justify-center p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-sm"
            >
              <i className="fas fa-video text-base"></i>
            </button>
            <button
              onClick={() => {
                setShowSongPicker(true);
                fetchSongs();
              }}
              title="Import song title, lyrics, and translation as text elements"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium shadow-sm"
            >
              <i className="fas fa-music text-base"></i>
              Import Song
            </button>
            <button
              onClick={handleCopy}
              disabled={selectedIds.size === 0}
              title={selectedIds.size === 0 ? "Select an element first" : selectedIds.size === 1 ? "Copy selected element (Ctrl+C)" : `Copy ${selectedIds.size} elements (Ctrl+C)`}
              className="flex items-center justify-center p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fas fa-copy text-base"></i>
            </button>
            <button
              onClick={handlePaste}
              disabled={!clipboard}
              title={!clipboard ? "Copy an element first" : "Paste copied element (Ctrl+V)"}
              className="flex items-center justify-center p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fas fa-paste text-base"></i>
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              title={selectedIds.size === 0 ? "Select an element first" : selectedIds.size === 1 ? "Delete selected element (Del key)" : `Delete ${selectedIds.size} elements (Del key)`}
              className="flex items-center justify-center p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fas fa-trash text-base"></i>
            </button>
            {onPreview && (
              <button
                onClick={onPreview}
                title="Preview how this template will look with sample content"
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium shadow-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <i className="fas fa-eye text-base"></i>
                Preview
              </button>
            )}
            <button
              onClick={() => {
                setDebugMode((on) => {
                  if (on) {
                    setDebugCursor(null);
                    setDebugPoint(null);
                    setDebugRect(null);
                    debugDragStartRef.current = null;
                  } else {
                    setSelectedIds(new Set());
                  }
                  return !on;
                });
              }}
              title="Debug: click for x,y (slide coords); drag to draw a rectangle and see width × height"
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium shadow-sm ${
                debugMode
                  ? 'bg-amber-500 text-black ring-2 ring-amber-300'
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
            >
              <i className="fas fa-bug text-base"></i>
              Debug
            </button>
          </div>
          {/* Slide frame */}
          <div 
            className={`template-editor-stage relative bg-gray-900 rounded-lg shadow-2xl overflow-hidden ${
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
              onMouseLeave={debugMode ? handleDebugMouseLeave : undefined}
              scaleX={SCALE}
              scaleY={SCALE}
              style={{ backgroundColor: bgColor, cursor: debugMode ? 'crosshair' : undefined }}
            >
              <Layer ref={layerRef}>
                {/* Background - full slide size */}
                {currentSlide.background?.type === 'image' && currentSlide.background.value ? (
                  <BackgroundImage 
                    url={currentSlide.background.value}
                    width={SLIDE_WIDTH}
                    height={SLIDE_HEIGHT}
                    zIndex={0}
                  />
                ) : (
                  <Rect
                    x={0}
                    y={0}
                    width={SLIDE_WIDTH}
                    height={SLIDE_HEIGHT}
                    fill={bgColor}
                    listening={false}
                    zIndex={0}
                  />
                )}

                {/* Song content elements for reference slide - draggable/stylable but with fixed text */}
                {selectedSlideIndex === referenceSlideIndex && (
                  <>
                    {/* Song Title - Editable position/style, fixed text */}
                    <Text
                      id="song-title-element"
                      zIndex={songTitleStyle.zIndex ?? 20}
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
                      onClick={() => selectElement('song-title-element')}
                      onTap={() => selectElement('song-title-element')}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        selectElement('song-title-element');
                        const stage = e.target.getStage();
                        if (stage) {
                          const pos = stage.getPointerPosition();
                          if (pos) {
                            const rect = stage.container().getBoundingClientRect();
                            setElementContextMenu({ x: pos.x + rect.left, y: pos.y + rect.top, elementId: 'song-title-element' });
                          }
                        }
                      }}
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
                      zIndex={songLyricsStyle.zIndex ?? 21}
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
                      onClick={() => selectElement('song-lyrics-element')}
                      onTap={() => selectElement('song-lyrics-element')}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        selectElement('song-lyrics-element');
                        const stage = e.target.getStage();
                        if (stage) {
                          const pos = stage.getPointerPosition();
                          if (pos) {
                            const rect = stage.container().getBoundingClientRect();
                            setElementContextMenu({ x: pos.x + rect.left, y: pos.y + rect.top, elementId: 'song-lyrics-element' });
                          }
                        }
                      }}
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
                      zIndex={songTranslationStyle.zIndex ?? 22}
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
                      onClick={() => selectElement('song-translation-element')}
                      onTap={() => selectElement('song-translation-element')}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        selectElement('song-translation-element');
                        const stage = e.target.getStage();
                        if (stage) {
                          const pos = stage.getPointerPosition();
                          if (pos) {
                            const rect = stage.container().getBoundingClientRect();
                            setElementContextMenu({ x: pos.x + rect.left, y: pos.y + rect.top, elementId: 'song-translation-element' });
                          }
                        }
                      }}
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
                    {/* Bottom Left Text - Current Song Info */}
                    <Text
                      id="bottom-left-text-element"
                      zIndex={bottomLeftTextStyle.zIndex ?? 23}
                      x={bottomLeftTextStyle.x}
                      y={bottomLeftTextStyle.y}
                      width={bottomLeftTextStyle.width}
                      text="[Current Song]"
                      fontSize={parseInt(bottomLeftTextStyle.fontSize) || 20}
                      fontFamily={getFontFamily(bottomLeftTextStyle.fontFamily)}
                      fontStyle={[
                        bottomLeftTextStyle.fontWeight === 'bold' ? 'bold' : '',
                        bottomLeftTextStyle.fontStyle === 'italic' ? 'italic' : ''
                      ].filter(Boolean).join(' ') || 'normal'}
                      fill={bottomLeftTextStyle.color}
                      align={bottomLeftTextStyle.textAlign}
                      draggable
                      onClick={() => selectElement('bottom-left-text-element')}
                      onTap={() => selectElement('bottom-left-text-element')}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        selectElement('bottom-left-text-element');
                        const stage = e.target.getStage();
                        if (stage) {
                          const pos = stage.getPointerPosition();
                          if (pos) {
                            const rect = stage.container().getBoundingClientRect();
                            setElementContextMenu({ x: pos.x + rect.left, y: pos.y + rect.top, elementId: 'bottom-left-text-element' });
                          }
                        }
                      }}
                      onDragEnd={(e) => {
                        handleSongContentStyleChange('bottomLeftTextStyle', {
                          x: Math.round(e.target.x()),
                          y: Math.round(e.target.y()),
                        });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Text;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        handleSongContentStyleChange('bottomLeftTextStyle', {
                          x: Math.round(node.x()),
                          y: Math.round(node.y()),
                          width: Math.round(Math.max(100, node.width() * scaleX)),
                          fontSize: `${Math.round(Math.max(12, (parseInt(bottomLeftTextStyle.fontSize) || 20) * scaleX))}px`,
                        });
                      }}
                    />
                    {/* Bottom Right Text - Next Song Info */}
                    <Text
                      id="bottom-right-text-element"
                      zIndex={bottomRightTextStyle.zIndex ?? 24}
                      x={bottomRightTextStyle.x}
                      y={bottomRightTextStyle.y}
                      width={bottomRightTextStyle.width}
                      text="[Next Song]"
                      fontSize={parseInt(bottomRightTextStyle.fontSize) || 20}
                      fontFamily={getFontFamily(bottomRightTextStyle.fontFamily)}
                      fontStyle={[
                        bottomRightTextStyle.fontWeight === 'bold' ? 'bold' : '',
                        bottomRightTextStyle.fontStyle === 'italic' ? 'italic' : ''
                      ].filter(Boolean).join(' ') || 'normal'}
                      fill={bottomRightTextStyle.color}
                      align={bottomRightTextStyle.textAlign}
                      draggable
                      onClick={() => selectElement('bottom-right-text-element')}
                      onTap={() => selectElement('bottom-right-text-element')}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        selectElement('bottom-right-text-element');
                        const stage = e.target.getStage();
                        if (stage) {
                          const pos = stage.getPointerPosition();
                          if (pos) {
                            const rect = stage.container().getBoundingClientRect();
                            setElementContextMenu({ x: pos.x + rect.left, y: pos.y + rect.top, elementId: 'bottom-right-text-element' });
                          }
                        }
                      }}
                      onDragEnd={(e) => {
                        handleSongContentStyleChange('bottomRightTextStyle', {
                          x: Math.round(e.target.x()),
                          y: Math.round(e.target.y()),
                        });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Text;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        handleSongContentStyleChange('bottomRightTextStyle', {
                          x: Math.round(node.x()),
                          y: Math.round(node.y()),
                          width: Math.round(Math.max(100, node.width() * scaleX)),
                          fontSize: `${Math.round(Math.max(12, (parseInt(bottomRightTextStyle.fontSize) || 20) * scaleX))}px`,
                        });
                      }}
                    />
                  </>
                )}

                {/* Elements - positioned in full slide coordinates */}
                {canvasElements.map((element) => {
                  if (element.type === 'image') {
                    const dragHandlers = createDragHandlers(element.id);
                    return (
                      <URLImage
                        key={element.id}
                        element={element}
                        isSelected={isElementSelected(element.id)}
                        onSelect={(e) => handleElementSelect(element.id, e)}
                        onChange={(updates) => {
                          // Check if this is a drag operation (only x and y are being updated)
                          const isDrag = updates.x !== undefined && updates.y !== undefined && 
                                        Object.keys(updates).length === 2;
                          if (isDrag && updates.x !== undefined && updates.y !== undefined) {
                            handleMultiSelectDrag(element.id, updates.x, updates.y);
                          } else {
                            updateElement(element.id, updates);
                          }
                        }}
                        onDragStart={dragHandlers.onDragStart}
                        onDragMove={dragHandlers.onDragMove}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          // If element is not in selection, add it to selection (don't clear others)
                          if (!selectedIds.has(element.id)) {
                            addToSelection(element.id);
                          }
                          const stage = e.target.getStage();
                          if (stage) {
                            const pointerPos = stage.getPointerPosition();
                            if (pointerPos) {
                              setElementContextMenu({
                                x: pointerPos.x + stage.container().getBoundingClientRect().left,
                                y: pointerPos.y + stage.container().getBoundingClientRect().top,
                                elementId: element.id
                              });
                            }
                          }
                        }}
                      />
                    );
                  } else if (element.type === 'text') {
                    const dragHandlers = createDragHandlers(element.id);
                    return (
                      <DraggableText
                        key={element.id}
                        element={element}
                        isSelected={isElementSelected(element.id)}
                        onSelect={(e) => handleElementSelect(element.id, e)}
                        onChange={(updates) => {
                          // Check if this is a drag operation (x and y are being updated)
                          const isDrag = updates.x !== undefined && updates.y !== undefined;
                          if (isDrag && selectedIds.size > 1) {
                            handleMultiSelectDrag(element.id, updates.x!, updates.y!);
                          } else {
                            updateElement(element.id, updates);
                          }
                        }}
                        onDragStart={dragHandlers.onDragStart}
                        onDragMove={dragHandlers.onDragMove}
                        isBeingDragged={isDraggingMultiSelect && selectedIds.has(element.id)}
                        stageRef={stageRef}
                        scale={SCALE}
                        onEditingChange={setIsTextEditing}
                        showFormattedOverlay={true}
                        overlayRefreshKey={overlayRefreshKey}
                        contextMenuOpen={!!elementContextMenu}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          // If element is not in selection, add it to selection (don't clear others)
                          if (!selectedIds.has(element.id)) {
                            addToSelection(element.id);
                          }
                          const stage = e.target.getStage();
                          if (stage) {
                            const pointerPos = stage.getPointerPosition();
                            if (pointerPos) {
                              setElementContextMenu({
                                x: pointerPos.x + stage.container().getBoundingClientRect().left,
                                y: pointerPos.y + stage.container().getBoundingClientRect().top,
                                elementId: element.id
                              });
                            }
                          }
                        }}
                      />
                    );
                  } else if (element.type === 'video') {
                    const dragHandlers = createDragHandlers(element.id);
                    return (
                      <VideoPlaceholder
                        key={element.id}
                        element={element}
                        isSelected={isElementSelected(element.id)}
                        onSelect={(e) => handleElementSelect(element.id, e)}
                        onChange={(updates) => {
                          // Check if this is a drag operation (x and y are being updated)
                          const isDrag = updates.x !== undefined && updates.y !== undefined;
                          if (isDrag && selectedIds.size > 1) {
                            handleMultiSelectDrag(element.id, updates.x!, updates.y!);
                          } else {
                            updateElement(element.id, updates);
                          }
                        }}
                        onDragStart={dragHandlers.onDragStart}
                        onDragMove={dragHandlers.onDragMove}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          // If element is not in selection, add it to selection (don't clear others)
                          if (!selectedIds.has(element.id)) {
                            addToSelection(element.id);
                          }
                          const stage = e.target.getStage();
                          if (stage) {
                            const pointerPos = stage.getPointerPosition();
                            if (pointerPos) {
                              setElementContextMenu({
                                x: pointerPos.x + stage.container().getBoundingClientRect().left,
                                y: pointerPos.y + stage.container().getBoundingClientRect().top,
                                elementId: element.id
                              });
                            }
                          }
                        }}
                      />
                    );
                  } else if (element.type === 'audio') {
                    const dragHandlers = createDragHandlers(element.id);
                    return (
                      <AudioPlaceholder
                        key={element.id}
                        element={element}
                        isSelected={isElementSelected(element.id)}
                        onSelect={(e) => handleElementSelect(element.id, e)}
                        onChange={(updates) => {
                          // Check if this is a drag operation (x and y are being updated)
                          const isDrag = updates.x !== undefined && updates.y !== undefined;
                          if (isDrag && selectedIds.size > 1) {
                            handleMultiSelectDrag(element.id, updates.x!, updates.y!);
                          } else {
                            updateElement(element.id, updates);
                          }
                        }}
                        onDragStart={dragHandlers.onDragStart}
                        onDragMove={dragHandlers.onDragMove}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          // If element is not in selection, add it to selection (don't clear others)
                          if (!selectedIds.has(element.id)) {
                            addToSelection(element.id);
                          }
                          const stage = e.target.getStage();
                          if (stage) {
                            const pointerPos = stage.getPointerPosition();
                            if (pointerPos) {
                              setElementContextMenu({
                                x: pointerPos.x + stage.container().getBoundingClientRect().left,
                                y: pointerPos.y + stage.container().getBoundingClientRect().top,
                                elementId: element.id
                              });
                            }
                          }
                        }}
                      />
                    );
                  }
                  return null;
                })}

                {/* Transformer */}
                <Transformer
                  ref={transformerRef}
                  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
                  rotateEnabled={true}
                  keepRatio={false}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Minimum size in slide coordinates
                    if (newBox.width < 40 || newBox.height < 40) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              </Layer>

              {/* Debug overlay: captures all events (no selection), live crosshair, point, rect */}
              {debugMode && (
                <Layer listening={true}>
                  {/* Full-stage transparent rect captures all mouse events so nothing below is selected */}
                  <Rect
                    x={0}
                    y={0}
                    width={SLIDE_WIDTH}
                    height={SLIDE_HEIGHT}
                    fill="transparent"
                    listening={true}
                    onMouseDown={handleDebugMouseDown}
                    onMouseMove={handleDebugMouseMove}
                    onMouseUp={handleDebugMouseUp}
                  />
                  {/* Live crosshair at current pointer position with coordinates inline */}
                  {debugCursor && (
                    <>
                      <Circle x={debugCursor.x} y={debugCursor.y} radius={8} stroke="lime" strokeWidth={2} fill="transparent" listening={false} />
                      <Line points={[debugCursor.x - 16, debugCursor.y, debugCursor.x + 16, debugCursor.y]} stroke="lime" strokeWidth={1} listening={false} />
                      <Line points={[debugCursor.x, debugCursor.y - 16, debugCursor.x, debugCursor.y + 16]} stroke="lime" strokeWidth={1} listening={false} />
                      <Text
                        x={debugCursor.x + 14}
                        y={debugCursor.y + 27}
                        text={`${Math.round(debugCursor.x)}, ${Math.round(debugCursor.y)}`}
                        fontSize={22}
                        fontFamily="monospace"
                        fill="lime"
                        shadowColor="black"
                        shadowBlur={4}
                        shadowOffset={{ x: 1, y: 1 }}
                        listening={false}
                      />
                    </>
                  )}
                  {debugPoint && (
                    <>
                      <Circle x={debugPoint.x} y={debugPoint.y} radius={6} stroke="orange" strokeWidth={2} fill="transparent" listening={false} />
                      <Line points={[debugPoint.x - 12, debugPoint.y, debugPoint.x + 12, debugPoint.y]} stroke="orange" strokeWidth={1} listening={false} />
                      <Line points={[debugPoint.x, debugPoint.y - 12, debugPoint.x, debugPoint.y + 12]} stroke="orange" strokeWidth={1} listening={false} />
                      <Text
                        x={debugPoint.x + 12}
                        y={debugPoint.y + 25}
                        text={`${debugPoint.x}, ${debugPoint.y}`}
                        fontSize={20}
                        fontFamily="monospace"
                        fill="orange"
                        shadowColor="black"
                        shadowBlur={4}
                        shadowOffset={{ x: 1, y: 1 }}
                        listening={false}
                      />
                    </>
                  )}
                  {debugRect && (
                    <>
                      <Rect
                        x={debugRect.x}
                        y={debugRect.y}
                        width={debugRect.width}
                        height={debugRect.height}
                        stroke="cyan"
                        strokeWidth={2}
                        fill="rgba(0,255,255,0.1)"
                        dash={[4, 4]}
                        listening={false}
                      />
                      <Text
                        x={debugRect.x}
                        y={debugRect.y + debugRect.height + 6}
                        text={`x: ${debugRect.x}, y: ${debugRect.y}, w: ${debugRect.width}, h: ${debugRect.height}`}
                        fontSize={22}
                        fontFamily="monospace"
                        fill="cyan"
                        shadowColor="black"
                        shadowBlur={4}
                        shadowOffset={{ x: 1, y: 1 }}
                        listening={false}
                      />
                    </>
                  )}
                </Layer>
              )}
            </Stage>
          </div>

          {/* Canvas instructions */}
          <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 text-center">
            <span className="font-medium">Click</span> to select • <span className="font-medium">Ctrl+Click</span> to multi-select • <span className="font-medium">Drag</span> to move • <span className="font-medium">Corner handles</span> to resize
          </div>
        </div>

        {/* Properties Panel */}
        <div
          ref={propertiesPanelRef}
          className="w-72 flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4 overflow-y-auto"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Properties</h3>
          
          {/* Background Properties */}
          <div className="space-y-3 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm">Background</h4>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Type
                <span 
                  title="Choose between solid color, image, or video background"
                  className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                >
                  <i className="fas fa-info-circle text-xs"></i>
                </span>
              </label>
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
            {(!currentSlide.background?.type || currentSlide.background?.type === 'color') && (
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
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  URL
                  <span 
                    title={currentSlide.background?.type === 'image' ? "Direct URL to background image" : "Direct URL to background video"}
                    className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                  >
                    <i className="fas fa-info-circle text-xs"></i>
                  </span>
                </label>
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

          {/* Selected Element Properties - canvas elements (image, video, text); song content uses the panel below */}
          {selectedIds.size > 0 && !(selectedSongContentType && selectedSongContentStyle) ? (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                {isMultiSelect ? (
                  <>
                    <span className="text-blue-600 dark:text-blue-400">{selectedIds.size} elements</span> selected
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-normal">
                      Ctrl+Click to add/remove • Move together • Del to delete all
                    </div>
                  </>
                ) : (
                  <>
                    Selected:{' '}
                    {selectedElement?.type === 'image'
                      ? 'Image'
                      : selectedElement?.type === 'video'
                      ? 'Video'
                      : selectedElement?.type === 'audio'
                      ? 'Audio'
                      : 'Text'}
                  </>
                )}
              </h4>
              
              {/* Common properties first: Position */}
              <div className="grid grid-cols-2 gap-2">
                  <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    X Position
                    <span 
                      title="Horizontal position from left edge (in pixels)"
                      className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                    >
                      <i className="fas fa-info-circle text-xs"></i>
                    </span>
                  </label>
                    <input
                    type="number"
                    value={isMultiSelect ? '' : Math.round(selectedElement?.x ?? 0)}
                    placeholder={isMultiSelect ? 'Mixed' : ''}
                    disabled={isMultiSelect}
                    onChange={(e) =>
                      selectedElement && updateElement(selectedElement.id, {
                        x: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                      })
                    }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Y Position
                    <span 
                      title="Vertical position from top edge (in pixels)"
                      className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                    >
                      <i className="fas fa-info-circle text-xs"></i>
                    </span>
                  </label>
                  <input
                    type="number"
                    value={isMultiSelect ? '' : Math.round(selectedElement?.y ?? 0)}
                    placeholder={isMultiSelect ? 'Mixed' : ''}
                    disabled={isMultiSelect}
                    onChange={(e) =>
                      selectedElement && updateElement(selectedElement.id, {
                        y: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Rotation (°)
                  <span 
                    title="Rotate element clockwise (0-360 degrees)"
                    className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                  >
                    <i className="fas fa-info-circle text-xs"></i>
                  </span>
                </label>
                <input
                  type="number"
                  value={isMultiSelect ? '' : Math.round(selectedElement?.rotation ?? 0)}
                  placeholder={isMultiSelect ? 'Mixed' : ''}
                  disabled={isMultiSelect}
                  onChange={(e) =>
                    selectedElement && updateElement(selectedElement.id, {
                      rotation: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Width & Height */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Width
                        <span 
                          title="Element width in pixels"
                          className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                        >
                          <i className="fas fa-info-circle text-xs"></i>
                        </span>
                      </label>
                      <input
                        type="number"
                        value={isMultiSelect ? '' : Math.round(selectedElement?.width ?? 0)}
                        placeholder={isMultiSelect ? 'Mixed' : ''}
                        disabled={isMultiSelect}
                    onChange={(e) =>
                      selectedElement && updateElement(selectedElement.id, {
                        width: Number.isNaN(parseInt(e.target.value, 10))
                          ? (selectedElement.width ?? 0)
                          : parseInt(e.target.value, 10),
                      })
                    }
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Height
                        <span 
                          title="Element height in pixels"
                          className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                        >
                          <i className="fas fa-info-circle text-xs"></i>
                        </span>
                      </label>
                      <input
                        type="number"
                        value={isMultiSelect ? '' : Math.round(selectedElement?.height ?? 0)}
                        placeholder={isMultiSelect ? 'Mixed' : ''}
                        disabled={isMultiSelect}
                    onChange={(e) =>
                      selectedElement && updateElement(selectedElement.id, {
                        height: Number.isNaN(parseInt(e.target.value, 10))
                          ? (selectedElement.height ?? 0)
                          : parseInt(e.target.value, 10),
                      })
                    }
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

              {/* Opacity */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Opacity: {isMultiSelect ? 'Mixed' : `${Math.round((selectedElement?.opacity ?? 1) * 100)}%`}
                  <span 
                    title="Transparency level - 0% is fully transparent, 100% is fully opaque"
                    className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                  >
                    <i className="fas fa-info-circle text-xs"></i>
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMultiSelect ? 50 : Math.round((selectedElement?.opacity ?? 1) * 100)}
                  disabled={isMultiSelect}
                  onChange={(e) => selectedElement && updateElement(selectedElement.id, { opacity: parseInt(e.target.value) / 100 })}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Element-specific properties - hide when multiple elements selected */}
              {!isMultiSelect && selectedElement?.type === 'image' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                    <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Image URL
                      <span 
                        title="Direct URL to image file (JPG, PNG, GIF, etc.)"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                      <input
                      type="url"
                      value={selectedElement.url || ''}
                      onChange={(e) => updateElement(selectedElement.id, { url: e.target.value })}
                      placeholder="https://..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Z-Index (layer order)
                      <span 
                        title="Higher numbers appear on top of lower numbers (stacking order)"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <input
                      type="number"
                      value={isMultiSelect ? '' : (selectedElement.zIndex || 0)}
                      placeholder={isMultiSelect ? 'Mixed' : ''}
                      disabled={isMultiSelect}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </>
              )}              {!isMultiSelect && selectedElement?.type === 'video' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                    <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Video URL
                      <span 
                        title="Direct URL to video file or YouTube/Vimeo link"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                      <input
                      type="url"
                      value={selectedElement.url || ''}
                      onChange={(e) => updateElement(selectedElement.id, { url: e.target.value })}
                      placeholder="https://..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                  </div>
                  {selectedElement.url && selectedElement.hideVideo && selectedElement.url.trim() && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Audio Preview</label>
                      <audio
                        key={selectedElement.url}
                        src={selectedElement.url}
                        controls
                        className="w-full"
                        style={{ height: '40px' }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <label 
                      title="Automatically start playing when slide appears"
                      className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                    >
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
                  <div className="flex items-center justify-between mt-1">
                    <label 
                      title="Hide video controls - use as background video"
                      className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                    >
                      <input
                        type="checkbox"
                        checked={selectedElement.hideVideo ?? false}
                        onChange={(e) =>
                          updateElement(selectedElement.id, { hideVideo: e.target.checked })
                        }
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hide Video player</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <label 
                      title="Mute video audio - useful for background videos"
                      className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                    >
                      <input
                        type="checkbox"
                        checked={selectedElement.hideAudio ?? false}
                        onChange={(e) =>
                          updateElement(selectedElement.id, { hideAudio: e.target.checked })
                        }
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hide Audio player</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Z-Index (layer order)
                      <span 
                        title="Higher numbers appear on top of lower numbers (stacking order)"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <input
                      type="number"
                      value={isMultiSelect ? '' : (selectedElement.zIndex || 0)}
                      placeholder={isMultiSelect ? 'Mixed' : ''}
                      disabled={isMultiSelect}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </>
              )}

              {!isMultiSelect && selectedElement?.type === 'audio' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Audio URL
                      <span 
                        title="Direct URL to audio file (MP3, WAV, etc.)"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <input
                      type="url"
                      value={selectedElement.url || ''}
                      onChange={(e) => updateElement(selectedElement.id, { url: e.target.value })}
                      placeholder="https://...audio.mp3"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  {selectedElement.url && selectedElement.url.trim() && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Preview</label>
                      <audio
                        key={selectedElement.url}
                        src={selectedElement.url}
                        controls
                        className="w-full"
                        style={{ height: '40px' }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <label 
                      title="Automatically start playing when slide appears"
                      className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                    >
                      <input
                        type="checkbox"
                        checked={selectedElement.autoPlay ?? false}
                        onChange={(e) =>
                          updateElement(selectedElement.id, { autoPlay: e.target.checked })
                        }
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Auto play</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <label 
                      title="Hide the audio player controls (audio still plays)"
                      className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                    >
                      <input
                        type="checkbox"
                        checked={selectedElement.visualHidden ?? false}
                        onChange={(e) =>
                          updateElement(selectedElement.id, { visualHidden: e.target.checked })
                        }
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hide Audio player</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Volume ({Math.round((selectedElement.volume ?? 1) * 100)}%)
                      <span 
                        title="Audio playback volume level"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={selectedElement.volume ?? 1}
                      onChange={(e) => updateElement(selectedElement.id, { volume: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Multi-slide audio range */}
                  {(template?.slides?.length ?? 0) > 1 && (
                    <>
                      <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Play audio across slides
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Start Slide (1-{template?.slides?.length ?? 1})
                          <span 
                            title="First slide where this audio should start playing"
                            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                          >
                            <i className="fas fa-info-circle text-xs"></i>
                          </span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={template?.slides?.length ?? 1}
                          value={selectedElement.startSlide ?? (selectedSlideIndex + 1)}
                          onChange={(e) => {
                            const slideNum = parseInt(e.target.value);
                            if (slideNum >= 1 && slideNum <= (template?.slides?.length ?? 1)) {
                              updateElement(selectedElement.id, { startSlide: slideNum });
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          End Slide (1-{template?.slides?.length ?? 1})
                          <span 
                            title="Last slide where this audio should play - useful for background music"
                            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                          >
                            <i className="fas fa-info-circle text-xs"></i>
                          </span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={template?.slides?.length ?? 1}
                          value={selectedElement.endSlide ?? (selectedSlideIndex + 1)}
                          onChange={(e) => {
                            const slideNum = parseInt(e.target.value);
                            if (slideNum >= 1 && slideNum <= (template?.slides?.length ?? 1)) {
                              updateElement(selectedElement.id, { endSlide: slideNum });
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Audio will play from slide {selectedElement.startSlide ?? (selectedSlideIndex + 1)} to {selectedElement.endSlide ?? (selectedSlideIndex + 1)}
                        </p>
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Z-Index (layer order)
                      <span 
                        title="Higher numbers appear on top of lower numbers (stacking order)"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <input
                      type="number"
                      value={selectedElement.zIndex || 0}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {!isMultiSelect && selectedElement?.type === 'text' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Text Content
                      <span 
                        title="The actual text to display - supports line breaks"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
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
                      <span 
                        title="Choose from a wide selection of fonts including Indian language support"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                      {!fontsLoaded && (
                        <span className="ml-1 text-yellow-500" title="Fonts are still loading...">⏳</span>
                      )}
                    </label>
                    <select
                      value={selectedElement.fontFamily?.split(',')[0].trim() || 'Arial'}
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
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Font Size
                        <span 
                          title="Text size in pixels"
                          className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                        >
                          <i className="fas fa-info-circle text-xs"></i>
                        </span>
                      </label>
                      <input
                        type="number"
                        value={selectedElement.fontSize || 24}
                        onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 24 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Color
                        <span 
                          title="Text color - click to open color picker"
                          className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                        >
                          <i className="fas fa-info-circle text-xs"></i>
                        </span>
                      </label>
                      <input
                        type="color"
                        value={selectedElement.color || '#ffffff'}
                        onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Font Style
                      <span 
                        title="Make text bold or italic"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { 
                          fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' 
                        })}
                        title="Toggle bold text"
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center font-bold ${
                          selectedElement.fontWeight === 'bold'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { 
                          fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' 
                        })}
                        title="Toggle italic text"
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center italic ${
                          selectedElement.fontStyle === 'italic'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        I
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Text Align
                      <span 
                        title="Horizontal text alignment within the text box"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { textAlign: 'left' })}
                        title="Align text to the left"
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center ${
                          selectedElement.textAlign === 'left'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        <i className="fas fa-align-left text-base"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { textAlign: 'center' })}
                        title="Center align text"
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center ${
                          (selectedElement.textAlign || 'center') === 'center'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        <i className="fas fa-align-center text-base"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { textAlign: 'right' })}
                        title="Align text to the right"
                        className={`flex-1 px-2 py-1.5 text-sm border rounded flex items-center justify-center ${
                          selectedElement.textAlign === 'right'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        <i className="fas fa-align-right text-base"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Z-Index (layer order)
                      <span 
                        title="Higher numbers appear on top of lower numbers (stacking order)"
                        className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
                      >
                        <i className="fas fa-info-circle text-xs"></i>
                      </span>
                    </label>
                    <input
                      type="number"
                      value={selectedElement.zIndex || 0}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
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
                 selectedSongContentType === 'songLyricsStyle' ? 'Song Lyrics' :
                 selectedSongContentType === 'songTranslationStyle' ? 'Translation' :
                 selectedSongContentType === 'bottomLeftTextStyle' ? 'Bottom Left (Current Song)' :
                 'Bottom Right (Next Song)'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedSongContentType === 'bottomLeftTextStyle' || selectedSongContentType === 'bottomRightTextStyle'
                  ? 'Style for song info text on reference slide.'
                  : 'Style for song content on reference slide. Text content is fixed.'}
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
                  value={Math.round(selectedSongContentStyle.width || (SLIDE_WIDTH - 80))}
                  onChange={(e) => handleSongContentStyleChange(selectedSongContentType, {
                    width: Number.isNaN(parseInt(e.target.value, 10)) ? 100 : parseInt(e.target.value, 10),
                  })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              {/* Height */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Height</label>
                <input
                  type="number"
                  value={Math.round(selectedSongContentStyle.height || 200)}
                  onChange={(e) => handleSongContentStyleChange(selectedSongContentType, {
                    height: Number.isNaN(parseInt(e.target.value, 10)) ? 100 : parseInt(e.target.value, 10),
                  })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Z-Index (stacking order; higher = on top of images/other elements) */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Z-Index
                  <span className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" title="Stacking order: higher values appear on top of images and other elements">
                    <i className="fas fa-info-circle text-xs"></i>
                  </span>
                </label>
                <input
                  type="number"
                  value={selectedSongContentStyle.zIndex ?? 20}
                  onChange={(e) => handleSongContentStyleChange(selectedSongContentType, {
                    zIndex: Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
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
                  value={selectedSongContentStyle.fontFamily?.split(',')[0].trim() || 'Arial'}
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
                    title="Toggle bold text"
                    className={`flex-1 px-2 py-1.5 text-sm border rounded font-bold ${
                      selectedSongContentStyle.fontWeight === 'bold'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSongContentStyleChange(selectedSongContentType, {
                      fontStyle: selectedSongContentStyle.fontStyle === 'italic' ? 'normal' : 'italic'
                    })}
                    title="Toggle italic text"
                    className={`flex-1 px-2 py-1.5 text-sm border rounded italic ${
                      selectedSongContentStyle.fontStyle === 'italic'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
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
                        <i className="fas fa-align-left text-base"></i>
                      )}
                      {align === 'center' && (
                        <i className="fas fa-align-center text-base"></i>
                      )}
                      {align === 'right' && (
                        <i className="fas fa-align-right text-base"></i>
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
                <i className="fas fa-times text-lg"></i>
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
                    <i className="fas fa-spinner fa-spin text-3xl text-amber-600"></i>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Importing song...</span>
                  </div>
                </div>
              )}
              {songsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-amber-600"></i>
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

