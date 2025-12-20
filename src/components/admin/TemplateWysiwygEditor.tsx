import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import useImage from 'use-image';
import type { PresentationTemplate, ImageElement, TextElement, VideoElement, TemplateSlide, BackgroundElement, AspectRatio, SongContentStyle, Song } from '../../types';
import { ASPECT_RATIO_DIMENSIONS } from '../../types';
import { useSongs } from '../../contexts/SongContext';
import { AVAILABLE_FONTS, getFontFamily, getFontsByCategory, FONT_CATEGORY_NAMES } from '../../utils/fonts';
import { regenerateSlideElementIds } from '../../utils/templateUtils/idGenerator';

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
}

// Get slide dimensions based on aspect ratio
function getSlideDimensions(aspectRatio: AspectRatio = '16:9') {
  return ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS['16:9'];
}

// Canvas display width (height calculated based on aspect ratio)
const CANVAS_WIDTH = 640;

/**
 * Detect video aspect ratio and return appropriate dimensions
 */
const detectVideoAspectRatio = async (url: string): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    // Check if it's a YouTube URL
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('/shorts/');
    
    if (isYouTube) {
      // YouTube videos - determine if it's a Short (vertical) or regular (horizontal)
      if (url.includes('/shorts/')) {
        // Shorts are vertical (9:16)
        resolve({ width: 360, height: 640 });
      } else {
        // Regular YouTube videos are typically 16:9
        resolve({ width: 640, height: 360 });
      }
      return;
    }

    // For regular video URLs, try to load and detect
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const aspectRatio = video.videoWidth / video.videoHeight;
      
      let width: number;
      let height: number;
      
      if (aspectRatio > 1.5) {
        // Wide video (16:9 or wider)
        width = 640;
        height = 360;
      } else if (aspectRatio < 0.7) {
        // Vertical video (9:16 or taller)
        width = 360;
        height = 640;
      } else {
        // Square-ish video (1:1 or close)
        width = 480;
        height = 480;
      }
      
      resolve({ width, height });
      video.remove();
    };
    
    video.onerror = () => {
      // Default to 16:9 if we can't load
      resolve({ width: 640, height: 360 });
      video.remove();
    };
    
    // Set a timeout in case video doesn't load
    setTimeout(() => {
      resolve({ width: 640, height: 360 });
      video.remove();
    }, 3000);
    
    video.src = url;
  });
};

/**
 * Detect image aspect ratio and return appropriate dimensions
 */
const detectImageAspectRatio = async (url: string): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout;
    
    const resolveOnce = (dimensions: { width: number; height: number }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(dimensions);
      }
    };
    
    // Try WITHOUT CORS first (works better for most servers)
    const img = new Image();
    
    img.onload = () => {
      if (resolved) return;
      
      // Check if we can actually read the dimensions
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.warn('⊗ Image loaded but dimensions unavailable (likely CORS blocked)');
        resolveOnce({ width: 400, height: 400 });
        return;
      }
      
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      
      let width: number;
      let height: number;
      
      if (aspectRatio > 1.5) {
        // Wide image (landscape)
        width = 640;
        height = Math.round(640 / aspectRatio);
      } else if (aspectRatio < 0.7) {
        // Tall image (portrait)
        height = 640;
        width = Math.round(640 * aspectRatio);
      } else {
        // Square-ish image
        const size = 480;
        width = size;
        height = Math.round(size / aspectRatio);
      }
      
      console.log(`✓ Image loaded: ${img.naturalWidth}x${img.naturalHeight}, aspect ratio: ${aspectRatio.toFixed(2)}, setting to ${width}x${height}`);
      resolveOnce({ width, height });
    };
    
    img.onerror = (e) => {
      console.warn('✗ Failed to load image:', url);
      // Default to reasonable size
      resolveOnce({ width: 400, height: 400 });
    };
    
    // Set a shorter timeout since we're not trying CORS
    timeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn('✗ Image load timeout for:', url);
        resolveOnce({ width: 400, height: 400 });
      }
    }, 3000);
    
    // Load WITHOUT crossOrigin (better compatibility, but can't always read dimensions)
    img.src = url;
  });
};

// Helper to parse position (using full slide dimensions) - outside component for performance
function parsePosition(
  value: string | number | undefined, 
  position: string | undefined, 
  axis: 'x' | 'y',
  slideSize: number,
  elementSize: number,
  slideWidth: number,
  slideHeight: number
): number {
  if (value !== undefined && value !== null) {
    // Handle numeric values
    if (typeof value === 'number') {
      return value;
    }
    // Handle string values
    if (typeof value === 'string') {
      if (value.endsWith('%')) {
        return (parseFloat(value) / 100) * slideSize;
      }
      return parseFloat(value) || 0;
    }
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
  type: 'image' | 'text' | 'video' | 'audio';
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
  // For video/audio behavior
  autoPlay?: boolean;
  loop?: boolean;
  hideVideo?: boolean;
  hideAudio?: boolean;
  visualHidden?: boolean;
  volume?: number;
  // Multi-slide audio (1-based slide numbers)
  startSlide?: number;
  endSlide?: number;
};

// Hook for detecting long-press on mobile devices (for Konva canvas elements)
const useLongPress = (
  onLongPress: (e: any) => void,
  delay: number = 500
) => {
  const timerRef = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (e: any) => {
    // Get the native event - Konva wraps it in evt property
    const nativeEvent = e.evt;
    const touch = nativeEvent?.touches?.[0];
    
    if (touch) {
      // Prevent default iOS context menu behavior
      if (nativeEvent?.preventDefault) {
        nativeEvent.preventDefault();
      }
      
      longPressTriggered.current = false;
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      
      timerRef.current = window.setTimeout(() => {
        longPressTriggered.current = true;
        onLongPress(e);
      }, delay);
    }
  };

  const handleTouchMove = (e: any) => {
    const nativeEvent = e.evt;
    const touch = nativeEvent?.touches?.[0];
    
    if (touch && touchStartPos.current) {
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Cancel long-press if finger moved more than 10px
      if (distance > 10 && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        longPressTriggered.current = false;
      }
    }
  };

  const handleTouchEnd = (e: any) => {
    // Clean up timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Prevent click event if long-press was triggered
    if (longPressTriggered.current) {
      const nativeEvent = e.evt;
      if (nativeEvent?.preventDefault) {
        nativeEvent.preventDefault();
      }
      if (nativeEvent?.stopPropagation) {
        nativeEvent.stopPropagation();
      }
    }
    
    touchStartPos.current = null;
    longPressTriggered.current = false;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};

// Hook for detecting long-press on DOM elements (for slide thumbnails)
const useLongPressDOM = (
  onLongPress: (e: React.TouchEvent) => void,
  delay: number = 500
) => {
  const timerRef = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches?.[0];
    
    if (touch) {
      // Prevent default iOS context menu behavior
      e.preventDefault();
      
      longPressTriggered.current = false;
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      
      timerRef.current = window.setTimeout(() => {
        longPressTriggered.current = true;
        onLongPress(e);
      }, delay);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches?.[0];
    
    if (touch && touchStartPos.current) {
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Cancel long-press if finger moved more than 10px
      if (distance > 10 && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        longPressTriggered.current = false;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clean up timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Prevent click event if long-press was triggered
    if (longPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    touchStartPos.current = null;
    longPressTriggered.current = false;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};

// BackgroundImage component for slide background
const BackgroundImage: React.FC<{
  url: string;
  width: number;
  height: number;
}> = ({ url, width, height }) => {
  const [image] = useImage(url);

  if (!image) {
    return null;
  }

  return (
    <KonvaImage
      x={0}
      y={0}
      image={image}
      width={width}
      height={height}
      listening={false}
    />
  );
};

// URLImage component for loading images
// Try loading without CORS first, then fall back to anonymous mode
const URLImage: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}> = ({ element, isSelected, onSelect, onChange, onContextMenu }) => {
  // Try loading without CORS mode first (works better with corporate proxies/firewalls)
  const [image, imageStatus] = useImage(element.url || '');
  const shapeRef = useRef<Konva.Image>(null);
  const longPressHandlers = useLongPress(onContextMenu || (() => {}));

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
        onContextMenu={onContextMenu}
        {...longPressHandlers}
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
      onContextMenu={onContextMenu}
      {...longPressHandlers}
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
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onEditingChange?: (isEditing: boolean) => void;
  showFormattedOverlay?: boolean;
}> = ({ element, isSelected, onSelect, onChange, stageRef, scale, onContextMenu, onEditingChange, showFormattedOverlay = true }) => {
  const shapeRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const longPressHandlers = useLongPress(onContextMenu || (() => {}));

  // Create and position HTML overlay for rendered text
  useEffect(() => {
    if (!showFormattedOverlay || isEditing) {
      // Remove overlay when not needed or when editing
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    // Create overlay div
    const overlay = document.createElement('div');
    overlayRef.current = overlay;
    
    // Convert custom tags to HTML
    const htmlContent = (element.content || 'Text')
      .replace(/<c:([0-9a-fA-F]{6})>(.*?)<\/c:[0-9a-fA-F]{6}>/g, '<span style="color:#$1">$2</span>')
      .replace(/<br\s*\/?>/gi, '<br>');
    
    overlay.innerHTML = htmlContent;
    
    // Get stage container position
    const stageBox = stage.container().getBoundingClientRect();
    
    // Position overlay - use fixed positioning relative to viewport
    overlay.style.position = 'fixed';
    overlay.style.left = `${stageBox.left + element.x * scale}px`;
    overlay.style.top = `${stageBox.top + element.y * scale}px`;
    overlay.style.width = `${(element.width || 200) * scale}px`;
    overlay.style.fontSize = `${(element.fontSize || 24) * scale}px`;
    overlay.style.fontFamily = getFontFamily(element.fontFamily);
    overlay.style.fontWeight = element.fontWeight || 'normal';
    overlay.style.fontStyle = element.fontStyle || 'normal';
    overlay.style.textAlign = element.textAlign || 'center';
    overlay.style.color = element.color || '#ffffff';
    overlay.style.lineHeight = '1.4';
    overlay.style.whiteSpace = 'pre-wrap';
    overlay.style.wordWrap = 'break-word';
    overlay.style.pointerEvents = 'none'; // Allow clicks to pass through to Konva
    overlay.style.transformOrigin = 'left top';
    overlay.style.zIndex = '1000';
    overlay.className = 'wysiwyg-text-overlay'; // Add class for easy identification
    
    if (element.rotation) {
      overlay.style.transform = `rotate(${element.rotation}deg)`;
    }
    
    document.body.appendChild(overlay);

    // Function to update overlay position
    const updateOverlayPosition = () => {
      const stage = stageRef.current;
      if (!stage || !overlay.parentElement) return;
      
      const stageBox = stage.container().getBoundingClientRect();
      overlay.style.left = `${stageBox.left + element.x * scale}px`;
      overlay.style.top = `${stageBox.top + element.y * scale}px`;
    };

    // Find the scrollable container (modal body)
    const scrollContainer = stage.container().closest('.overflow-y-auto, .overflow-auto, [style*="overflow"]');
    
    // Add scroll listener to update position
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateOverlayPosition);
    }
    
    // Also listen for window scroll and resize
    window.addEventListener('scroll', updateOverlayPosition, true);
    window.addEventListener('resize', updateOverlayPosition);

    // Watch for PresentationModal opening and hide overlay
    const checkForPresentationModal = () => {
      // Look specifically for PresentationModal which has data-presentation-modal or specific structure
      const hasPresentationModal = document.querySelector('.presentation-modal-backdrop, [data-presentation-modal="true"]') !== null;
      if (hasPresentationModal && overlay.parentElement) {
        overlay.style.display = 'none';
      } else if (overlay.parentElement) {
        overlay.style.display = 'block';
      }
    };

    // Check immediately
    checkForPresentationModal();

    // Set up observer for modal changes
    const observer = new MutationObserver(checkForPresentationModal);
    observer.observe(document.body, { childList: true, subtree: true });

    // Cleanup
    return () => {
      observer.disconnect();
      
      // Remove scroll listeners
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', updateOverlayPosition);
      }
      window.removeEventListener('scroll', updateOverlayPosition, true);
      window.removeEventListener('resize', updateOverlayPosition);
      
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, [element.content, element.x, element.y, element.width, element.fontSize, element.fontFamily, element.fontWeight, element.fontStyle, element.textAlign, element.color, element.rotation, scale, isEditing, showFormattedOverlay, stageRef]);

  // Konva fontStyle combines bold and italic: "normal", "bold", "italic", "bold italic"
  const getFontStyle = () => {
    const isBold = element.fontWeight === 'bold';
    const isItalic = element.fontStyle === 'italic';
    if (isBold && isItalic) return 'bold italic';
    if (isBold) return 'bold';
    if (isItalic) return 'italic';
    return 'normal';
  };

  // Strip HTML tags for plain text display
  const getPlainText = () => {
    return (element.content || 'Text')
      .replace(/<[^>]+>/g, ''); // Remove all HTML tags
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
    const areaPosition = {
      x: stageBox.left + element.x * scale,
      y: stageBox.top + element.y * scale,
    };

    // Create contentEditable div for rich text editing
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    document.body.appendChild(editor);

    // Convert our custom tags to HTML for editing
    const htmlContent = (element.content || '')
      .replace(/<c:([0-9a-fA-F]{6})>(.*?)<\/c:[0-9a-fA-F]{6}>/g, '<span style="color:#$1">$2</span>');
    editor.innerHTML = htmlContent;
    
    editor.style.position = 'fixed';
    editor.style.top = `${areaPosition.y}px`;
    editor.style.left = `${areaPosition.x}px`;
    editor.style.width = `${(element.width || 200) * scale}px`;
    editor.style.minHeight = `${(element.fontSize || 24) * scale * 1.2}px`;
    editor.style.fontSize = `${(element.fontSize || 24) * scale}px`;
    editor.style.fontFamily = getFontFamily(element.fontFamily);
    editor.style.fontWeight = element.fontWeight || 'normal';
    editor.style.fontStyle = element.fontStyle || 'normal';
    editor.style.textAlign = element.textAlign || 'center';
    editor.style.color = element.color || '#ffffff';
    editor.style.background = 'rgba(0, 0, 0, 0.85)';
    editor.style.border = '2px solid #3b82f6';
    editor.style.borderRadius = '4px';
    editor.style.padding = '8px';
    editor.style.margin = '0';
    editor.style.overflow = 'auto';
    editor.style.outline = 'none';
    editor.style.lineHeight = '1.4';
    editor.style.transformOrigin = 'left top';
    editor.style.zIndex = '10000';
    editor.style.boxSizing = 'border-box';
    editor.style.whiteSpace = 'pre-wrap';
    editor.style.wordWrap = 'break-word';
    
    // Handle rotation
    if (element.rotation) {
      editor.style.transform = `rotate(${element.rotation}deg)`;
    }

    // Create toolbar for formatting
    const toolbar = document.createElement('div');
    toolbar.style.position = 'fixed';
    toolbar.style.top = `${areaPosition.y - 40}px`;
    toolbar.style.left = `${areaPosition.x}px`;
    toolbar.style.background = '#1f2937';
    toolbar.style.border = '1px solid #3b82f6';
    toolbar.style.borderRadius = '4px';
    toolbar.style.padding = '4px';
    toolbar.style.display = 'flex';
    toolbar.style.gap = '4px';
    toolbar.style.zIndex = '10001';
    
    const createButton = (label: string, command: string) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.padding = '4px 8px';
      btn.style.background = '#374151';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '3px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '12px';
      btn.onmousedown = (e) => {
        e.preventDefault();
        document.execCommand(command, false);
        editor.focus();
      };
      return btn;
    };

    toolbar.appendChild(createButton('B', 'bold'));
    toolbar.appendChild(createButton('I', 'italic'));
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = element.color || '#ffffff';
    colorInput.style.width = '30px';
    colorInput.style.height = '24px';
    colorInput.style.border = 'none';
    colorInput.style.cursor = 'pointer';
    
    // Track selection info for color picker
    // Store as text content and offsets to survive focus changes
    let savedSelectionInfo: { startOffset: number; endOffset: number; selectedText: string } | null = null;
    let colorSpan: HTMLSpanElement | null = null;
    let colorPickerOpen = false;
    
    // Get text offset within the editor
    const getTextOffset = (node: Node, offset: number): number => {
      let totalOffset = 0;
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let currentNode = walker.nextNode();
      while (currentNode) {
        if (currentNode === node) {
          return totalOffset + offset;
        }
        totalOffset += currentNode.textContent?.length || 0;
        currentNode = walker.nextNode();
      }
      return totalOffset + offset;
    };
    
    // Save selection info before color picker opens
    const saveSelectionInfo = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          const startOffset = getTextOffset(range.startContainer, range.startOffset);
          const endOffset = getTextOffset(range.endContainer, range.endOffset);
          const selectedText = range.toString();
          if (selectedText.length > 0) {
            savedSelectionInfo = { startOffset, endOffset, selectedText };
          }
        }
      }
    };
    
    // Apply color by wrapping selected text in a span
    const applyColorToSelection = (color: string) => {
      if (!savedSelectionInfo || savedSelectionInfo.selectedText.length === 0) return;
      
      // If we already created/found a color span this session, just update its color
      if (colorSpan) {
        colorSpan.style.color = color;
        return;
      }
      
      // Need to find and wrap the selected text
      // Get all text content and find the selected portion
      const fullText = editor.textContent || '';
      const { startOffset, endOffset, selectedText } = savedSelectionInfo;
      
      // Verify the text at these offsets matches
      const textAtOffsets = fullText.substring(startOffset, endOffset);
      if (textAtOffsets !== selectedText) {
        // Text has changed, can't apply color accurately
        return;
      }
      
      // Find the text node(s) containing the selection
      let currentOffset = 0;
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let currentNode = walker.nextNode();
      
      while (currentNode) {
        const nodeLength = currentNode.textContent?.length || 0;
        const nodeEnd = currentOffset + nodeLength;
        
        // Check if selection starts in this node
        if (currentOffset <= startOffset && nodeEnd > startOffset) {
          const textNode = currentNode as Text;
          const relativeStart = startOffset - currentOffset;
          const relativeEnd = Math.min(endOffset - currentOffset, nodeLength);
          
          // Check if this text node is already inside a color span
          // and the entire selection is within that span
          const parentSpan = textNode.parentElement;
          if (parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.style.color) {
            // Check if the span contains exactly the selected text (or the selection is the whole span content)
            const spanText = parentSpan.textContent || '';
            if (spanText === selectedText || (relativeStart === 0 && relativeEnd === nodeLength)) {
              // Just update the existing span's color
              colorSpan = parentSpan as HTMLSpanElement;
              colorSpan.style.color = color;
              return;
            }
          }
          
          // Split the text node and wrap the middle part
          if (relativeStart > 0) {
            textNode.splitText(relativeStart);
            currentNode = walker.nextNode();
          }
          
          if (currentNode && relativeEnd - relativeStart < (currentNode.textContent?.length || 0)) {
            (currentNode as Text).splitText(relativeEnd - relativeStart);
          }
          
          // Check again if parent is a color span (after potential split)
          const parent = currentNode?.parentElement;
          if (parent && parent.tagName === 'SPAN' && parent.style.color) {
            // The text is already in a span, update its color
            colorSpan = parent as HTMLSpanElement;
            colorSpan.style.color = color;
            return;
          }
          
          // Wrap the current node in a new span
          if (currentNode) {
            colorSpan = document.createElement('span');
            colorSpan.style.color = color;
            currentNode.parentNode?.insertBefore(colorSpan, currentNode);
            colorSpan.appendChild(currentNode);
          }
          break;
        }
        
        currentOffset = nodeEnd;
        currentNode = walker.nextNode();
      }
    };
    
    // Track selection while editing
    editor.addEventListener('mouseup', saveSelectionInfo);
    editor.addEventListener('keyup', saveSelectionInfo);
    
    colorInput.onmousedown = () => {
      if (!colorPickerOpen) {
        saveSelectionInfo();
        colorPickerOpen = true;
        colorSpan = null; // Reset for new color operation
      }
    };
    
    colorInput.oninput = () => {
      applyColorToSelection(colorInput.value);
    };
    
    colorInput.onchange = () => {
      applyColorToSelection(colorInput.value);
      editor.focus();
      colorPickerOpen = false;
      colorSpan = null;
      savedSelectionInfo = null;
    };
    
    colorInput.onblur = () => {
      // Small delay to allow onchange to fire first
      setTimeout(() => {
        colorPickerOpen = false;
      }, 100);
    };
    
    toolbar.appendChild(colorInput);
    
    document.body.appendChild(toolbar);

    editor.focus();
    // Select all text
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    setIsEditing(true);
    onEditingChange?.(true);

    // Convert HTML back to our custom format
    const convertToCustomFormat = (html: string): string => {
      let result = html;
      
      // Helper to convert RGB to hex
      const rgbToHex = (r: number, g: number, b: number): string => {
        return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
      };
      
      // Convert <font color="#RRGGBB"> to <c:RRGGBB>
      result = result.replace(/<font color="#([0-9a-fA-F]{6})">(.*?)<\/font>/gi, '<c:$1>$2</c:$1>');
      
      // Convert <span style="color:#RRGGBB"> to <c:RRGGBB> (hex format, with optional semicolon)
      result = result.replace(/<span style="color:\s*#([0-9a-fA-F]{6});?">(.*?)<\/span>/gi, '<c:$1>$2</c:$1>');
      
      // Convert <span style="color: rgb(r, g, b);"> to <c:RRGGBB> (RGB format, with optional semicolon)
      result = result.replace(/<span style="color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\);?">(.*?)<\/span>/gi, 
        (match, r, g, b, content) => {
          const hex = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
          return `<c:${hex}>${content}</c:${hex}>`;
        });
      
      // Convert <font color="rgb(r, g, b)"> to <c:RRGGBB> (RGB format, some browsers use this)
      result = result.replace(/<font color="rgb\((\d+),\s*(\d+),\s*(\d+)\);?">(.*?)<\/font>/gi, 
        (match, r, g, b, content) => {
          const hex = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
          return `<c:${hex}>${content}</c:${hex}>`;
        });
      
      // Remove style attributes from b and i tags
      result = result.replace(/<b\s+[^>]*>/gi, '<b>');
      result = result.replace(/<i\s+[^>]*>/gi, '<i>');
      
      // Keep <b> and <i> tags, remove other formatting
      result = result.replace(/<strong>/gi, '<b>').replace(/<\/strong>/gi, '</b>');
      result = result.replace(/<em>/gi, '<i>').replace(/<\/em>/gi, '</i>');
      
      // Remove <div> and <p> tags, replace with <br>
      result = result.replace(/<div>/gi, '<br>').replace(/<\/div>/gi, '');
      result = result.replace(/<p>/gi, '').replace(/<\/p>/gi, '<br>');
      
      // Clean up extra <br> at the end
      result = result.replace(/(<br>)+$/gi, '');
      
      return result;
    };

    // Handle blur (finish editing)
    const handleBlur = (e: FocusEvent) => {
      // Don't close if clicking on toolbar or color input
      if (e.relatedTarget === toolbar || e.relatedTarget === colorInput || 
          toolbar.contains(e.relatedTarget as Node)) {
        return;
      }
      
      const newContent = convertToCustomFormat(editor.innerHTML);
      onChange({ content: newContent });
      document.body.removeChild(editor);
      document.body.removeChild(toolbar);
      textNode.show();
      setIsEditing(false);
      onEditingChange?.(false);
    };

    // Handle keydown (Escape to cancel)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        document.body.removeChild(editor);
        document.body.removeChild(toolbar);
        textNode.show();
        setIsEditing(false);
        onEditingChange?.(false);
      }
    };

    editor.addEventListener('blur', handleBlur);
    editor.addEventListener('keydown', handleKeyDown);
  };

  return (
    <Text
      ref={shapeRef}
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      text={getPlainText()}
      fontSize={element.fontSize || 24}
      fontFamily={getFontFamily(element.fontFamily)}
      fontStyle={getFontStyle()}
      align={element.textAlign || 'center'}
      fill={element.color || '#ffffff'}
      opacity={showFormattedOverlay && !isEditing ? 0 : (element.opacity ?? 1)}
      rotation={element.rotation || 0}
      draggable={!isEditing}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragEnd={(e) => {
        const node = shapeRef.current;
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
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}> = ({ element, isSelected, onSelect, onChange, onContextMenu }) => {
  const groupRef = useRef<Konva.Group>(null);
  const longPressHandlers = useLongPress(onContextMenu || (() => {}));

  return (
    <Group
      ref={groupRef}
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation || 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={onContextMenu}
      {...longPressHandlers}
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
        x={0}
        y={0}
        width={element.width}
        height={element.height}
        fill="#111827"
        stroke={isSelected ? '#a855f7' : '#4b5563'}
        strokeWidth={2}
        cornerRadius={6}
      />
      <Text
        text={element.hideVideo ? "🎵 Audio" : "▶ Video"}
        fontSize={16}
        fill="#e5e7eb"
        x={8}
        y={8}
      />
    </Group>
  );
};

// AudioPlaceholder component for audio elements
const AudioPlaceholder: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<CanvasElement>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}> = ({ element, isSelected, onSelect, onChange, onContextMenu }) => {
  const groupRef = useRef<Konva.Group>(null);
  const longPressHandlers = useLongPress(onContextMenu || (() => {}));

  return (
    <Group
      ref={groupRef}
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation || 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={onContextMenu}
      {...longPressHandlers}
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
      {/* Background */}
      <Rect
        width={element.width}
        height={element.height}
        fill={element.visualHidden ? 'transparent' : '#7c3aed'}
        stroke={isSelected ? '#3b82f6' : (element.visualHidden ? '#9333ea' : '#6b21a8')}
        strokeWidth={2}
        cornerRadius={4}
        opacity={element.visualHidden ? 0.3 : 1}
      />
      {/* Audio icon - volume high from Font Awesome */}
      <Text
        text="🔊"
        fontSize={Math.min(element.width, element.height) * 0.35}
        fill="#ffffff"
        x={element.width / 2}
        y={element.height / 2 - 20}
        offsetX={Math.min(element.width, element.height) * 0.175}
        align="center"
        opacity={element.visualHidden ? 0.5 : 1}
      />
      {/* Label */}
      <Text
        text={element.url ? (element.visualHidden ? 'Audio (Hidden)' : 'Audio') : 'No URL'}
        fontSize={12}
        fill="#ffffff"
        x={element.width / 2}
        y={element.height / 2 + 10}
        offsetX={element.url ? (element.visualHidden ? 45 : 20) : 22}
        align="center"
        opacity={element.visualHidden ? 0.5 : 1}
      />
      {/* Dimensions */}
      <Text
        text={`${Math.round(element.width)}×${Math.round(element.height)}`}
        fontSize={10}
        fill="#a78bfa"
        x={8}
        y={8}
        opacity={element.visualHidden ? 0.5 : 1}
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
  onEscape,
  onSlideIndexChange,
  onSwitchToYaml,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [slideListHasFocus, setSlideListHasFocus] = useState(true);
  const [canvasHasFocus, setCanvasHasFocus] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideIndex: number } | null>(null);
  const [elementContextMenu, setElementContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  
  // On mount, ensure first slide is selected and canvas has focus
  useEffect(() => {
    setSelectedSlideIndex(0);
    setSelectedId(null);
    setSlideListHasFocus(false);
    setCanvasHasFocus(true);
    
    // Focus the first thumbnail so keyboard shortcuts work immediately
    setTimeout(() => {
      const firstThumbnail = thumbnailRefs.current[0];
      if (firstThumbnail) {
        firstThumbnail.focus();
        setSlideListHasFocus(true);
        setCanvasHasFocus(false);
      }
    }, 100);
  }, []); // Run only once on mount
  
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
  
  const currentSlide = slides[selectedSlideIndex] || slides[0] || {
    images: [],
    videos: [],
    text: [],
  };
  
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
        return {
          id: aud.id,
          type: 'audio',
          x: parsePosition(aud.x as string | undefined, aud.position, 'x', SLIDE_WIDTH, width, SLIDE_WIDTH, SLIDE_HEIGHT),
          y: parsePosition(aud.y as string | undefined, aud.position, 'y', SLIDE_HEIGHT, height, SLIDE_WIDTH, SLIDE_HEIGHT),
          width,
          height,
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
    selectedId === 'song-translation-element' ? 'songTranslationStyle' as const :
    selectedId === 'bottom-left-text-element' ? 'bottomLeftTextStyle' as const :
    selectedId === 'bottom-right-text-element' ? 'bottomRightTextStyle' as const : null;

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    
    if (selectedId) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.forceUpdate();
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, canvasElements]);

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
    
    // Update template
    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    
    // If we're updating the selected slide and it's the reference slide, use the updated slide
    const audiosForTemplate = selectedSlideIndex === referenceSlideIndex ? slideToUpdate.audios : refSlide?.audios;
    
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      audios: audiosForTemplate || [],
      text: refSlide?.text || [],
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
    } else if (element.type === 'audio') {
      slideToUpdate.audios = (slideToUpdate.audios || []).filter(aud => aud.id !== selectedId);
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
      audios: refSlide?.audios || [],
      text: refSlide?.text || [],
    });

    setSelectedId(null);
  }, [selectedId, canvasElements, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange]);

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

  // Keyboard shortcuts for canvas (undo/redo/copy/paste/delete/move)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when text is being edited (Konva text editor is open)
      if (isTextEditing) {
        return;
      }
      
      // Ignore when typing in inputs/textareas/selects
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      // Don't handle shift+arrow if target is a slide thumbnail button - let it handle the event
      if (target && target.hasAttribute('data-slide-thumbnail') && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        return;
      }

      // Escape: Three-tier behavior - exit text edit → deselect element → close dialog
      if (e.key === 'Escape') {
        // Tier 1: If text is being edited, the textarea's handler will exit edit mode
        // (that handler calls e.preventDefault() and e.stopPropagation())
        if (isTextEditing) {
          // Text editing handler will take care of it
          return;
        }
        
        // Tier 2: If an element is selected (but not editing), deselect it
        if (selectedId) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedId(null);
          return;
        }
        
        // Tier 3: If nothing selected, let it propagate to Modal for exit handling
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

      // Bold: Ctrl/Cmd + B (requires canvas focus and selected text element)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && canvasHasFocus && selectedId) {
        const element = canvasElements.find(el => el.id === selectedId);
        if (element && element.type === 'text') {
          e.preventDefault();
          updateElement(selectedId, {
            fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold'
          });
          return;
        }
      }

      // Italic: Ctrl/Cmd + I (requires canvas focus and selected text element)
      if ((e.ctrlKey || e.metaKey) && e.key === 'i' && canvasHasFocus && selectedId) {
        const element = canvasElements.find(el => el.id === selectedId);
        if (element && element.type === 'text') {
          e.preventDefault();
          updateElement(selectedId, {
            fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic'
          });
          return;
        }
      }

      // The following shortcuts require canvas focus and a selected element
      if (!canvasHasFocus || !selectedId) {
        // Allow ArrowUp/ArrowDown to navigate slides when on canvas with no selection
        if (canvasHasFocus && !selectedId && !e.shiftKey) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = Math.max(0, selectedSlideIndex - 1);
            setSelectedSlideIndex(prevIndex);
            return;
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = Math.min(slides.length - 1, selectedSlideIndex + 1);
            setSelectedSlideIndex(nextIndex);
            return;
          }
        }
        // Don't handle shift+arrow when slide list has focus - let the thumbnail handler deal with it
        return;
      }

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

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase to handle before Modal
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isTextEditing, canvasHasFocus, slideListHasFocus, selectedId, canvasElements, updateElement, handleDeleteSelected, handleUndo, handleRedo, handleCopy, handlePaste, selectedSlideIndex, slides.length]);

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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
      audios: refSlide?.audios || [],
      text: refSlide?.text || [],
    });

    setSelectedId(newVideo.id);
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

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      audios: refSlide?.audios || [],
      audios: refSlide?.audios || [],
      text: refSlide?.text || [],
    });

    setSelectedId(newAudio.id);
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
      audios: refSlide?.audios || [],
      text: refSlide?.text || [],
    });

    setSelectedId(newText.id);
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
      
      onTemplateChange({
        ...template,
        slides: newSlides,
      });

      // Select the first imported slide
      setSelectedSlideIndex(selectedSlideIndex + 1);
      setSelectedId(null);
      
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

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      audios: refSlide?.audios || [],
      text: refSlide?.text || [],
    });
  };

  // Update song content style (only for reference slide)
  const handleSongContentStyleChange = useCallback((
    styleType: 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle' | 'bottomLeftTextStyle' | 'bottomRightTextStyle',
    updates: Partial<SongContentStyle>
  ) => {
    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[referenceSlideIndex] };
    
    // Get current style or use defaults based on slide dimensions
    const getDefaultStyle = (type: string): SongContentStyle => ({
      x: type === 'bottomLeftTextStyle' ? 40 : type === 'bottomRightTextStyle' ? Math.round(SLIDE_WIDTH * 0.5) : 40,
      y: type === 'songTitleStyle' ? Math.round(SLIDE_HEIGHT * 0.05) : 
         type === 'songLyricsStyle' ? Math.round(SLIDE_HEIGHT * 0.20) : 
         type === 'bottomLeftTextStyle' || type === 'bottomRightTextStyle' ? Math.round(SLIDE_HEIGHT * 0.92) :
         Math.round(SLIDE_HEIGHT * 0.75),
      width: type === 'bottomLeftTextStyle' || type === 'bottomRightTextStyle' ? Math.round((SLIDE_WIDTH - 120) / 2) : SLIDE_WIDTH - 80,
      fontSize: type === 'songTitleStyle' ? '48px' : type === 'songLyricsStyle' ? '36px' : type === 'bottomLeftTextStyle' || type === 'bottomRightTextStyle' ? '20px' : '24px',
      fontWeight: type === 'songTranslationStyle' || type === 'bottomLeftTextStyle' || type === 'bottomRightTextStyle' ? 'normal' : 'bold',
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
      audios: refSlide?.audios || [],
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
  const defaultBottomLeftStyle: SongContentStyle = {
    x: 40,
    y: Math.round(SLIDE_HEIGHT * 0.92),
    width: Math.round((SLIDE_WIDTH - 120) / 2),
    fontSize: '20px',
    fontWeight: 'normal',
    textAlign: 'left',
    color: '#ffffff',
  };
  const defaultBottomRightStyle: SongContentStyle = {
    x: Math.round(SLIDE_WIDTH * 0.5),
    y: Math.round(SLIDE_HEIGHT * 0.92),
    width: Math.round((SLIDE_WIDTH - 120) / 2),
    fontSize: '20px',
    fontWeight: 'normal',
    textAlign: 'right',
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
  const bottomLeftTextStyle = mergeSongStyle(referenceSlide?.bottomLeftTextStyle, defaultBottomLeftStyle);
  const bottomRightTextStyle = mergeSongStyle(referenceSlide?.bottomRightTextStyle, defaultBottomRightStyle);
  
  // Now we can resolve the selected song content style (after songTitleStyle etc are defined)
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
      audios: refSlide?.audios || [],
      text: refSlide?.text || [],
    });
    setSelectedSlideIndex(atIndex + 1);
    setContextMenu(null);
  };

  const handleDuplicateSlide = (atIndex: number) => {
    const slideToDuplicate = slides[atIndex];
    const duplicatedSlide: TemplateSlide = regenerateSlideElementIds(slideToDuplicate);
    
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
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
      audios: refSlide?.audios || [],
      text: refSlide?.text || [],
    });

    setSelectedSlideIndex(dropIndex);
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  };

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
        
        if (!isFormElement && !isInPropertyPanel) {
          // Clicked outside the stage and not on interactive elements - deselect and return focus to slide list
          setSelectedId(null);
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
                    setSelectedId(null);
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
                        setSelectedId(null);
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
                        setSelectedId(null);
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

          {/* Context Menu */}
          {contextMenu && (() => {
            // Capture these values immediately in case contextMenu becomes null
            const slideIndex = contextMenu.slideIndex;
            const menuX = contextMenu.x;
            const menuY = contextMenu.y;
            
            // Create wrapped handlers that capture slideIndex
            const wrappedInsertSlide = () => {
              handleInsertSlide(slideIndex);
            };
            
            const wrappedDuplicateSlide = () => {
              handleDuplicateSlide(slideIndex);
            };
            
            const wrappedMoveSlideUp = () => {
              handleMoveSlideUp(slideIndex);
            };
            
            const wrappedMoveSlideDown = () => {
              handleMoveSlideDown(slideIndex);
            };
            
            const wrappedSetAsReference = () => {
              handleSetAsReference(slideIndex);
            };
            
            const wrappedDeleteSlide = () => {
              handleDeleteSlide(slideIndex);
            };
            
            return (
              <div
                className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-[9999] min-w-[180px]"
                style={{ left: menuX, top: menuY }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={wrappedInsertSlide}
                  className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                >
                  <i className="fas fa-plus text-base"></i>
                  Insert Slide After
                </button>
                <button
                  onClick={wrappedDuplicateSlide}
                  className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                >
                  <i className="fas fa-copy text-base"></i>
                  Duplicate Slide
              </button>
              <div className="border-t border-gray-600 my-1" />
              <button
                onClick={wrappedMoveSlideUp}
                disabled={slideIndex === 0}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <i className="fas fa-chevron-up text-base"></i>
                Move Up
              </button>
              <button
                onClick={wrappedMoveSlideDown}
                disabled={slideIndex === slides.length - 1}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <i className="fas fa-chevron-down text-base"></i>
                Move Down
              </button>
              <div className="border-t border-gray-600 my-1" />
              {slideIndex !== referenceSlideIndex && (
                <button
                  onClick={wrappedSetAsReference}
                  className="w-full px-4 py-2 text-left text-sm text-yellow-400 hover:bg-gray-700 flex items-center gap-2"
                >
                  <i className="fas fa-star text-base"></i>
                  Set as Reference
                </button>
              )}
              <button
                onClick={wrappedDeleteSlide}
                disabled={slides.length <= 1}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <i className="fas fa-trash text-base"></i>
                Delete Slide
              </button>
            </div>
            );
          })()}
          
          {/* Element context menu */}
          {elementContextMenu && (
            <div
              className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-[9999] min-w-[160px]"
              style={{ left: elementContextMenu.x, top: elementContextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  bringToFront();
                  setElementContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
              >
                <i className="fas fa-arrow-up text-base"></i>
                Bring to Front
              </button>
              <button
                onClick={() => {
                  sendToBack();
                  setElementContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
              >
                <i className="fas fa-arrow-down text-base"></i>
                Send to Back
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
                <i className="fas fa-undo text-base"></i>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Shift+Z)"
              >
                <i className="fas fa-redo text-base"></i>
              </button>
            </div>
            <button
              onClick={handleAddText}
              className="flex items-center justify-center p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm font-bold text-xs"
              title="Add Text"
            >
              T
            </button>
            <button
              onClick={handleAddImage}
              className="flex items-center justify-center p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
              title="Add Image"
            >
              <i className="fas fa-image text-base"></i>
            </button>
            <button
              onClick={handleAddAudio}
              className="flex items-center justify-center p-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 shadow-sm"
              title="Add Audio"
            >
              <i className="fas fa-volume-up text-base"></i>
            </button>
            <button
              onClick={handleAddVideo}
              className="flex items-center justify-center p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-sm"
              title="Add Video"
            >
              <i className="fas fa-video text-base"></i>
            </button>
            <button
              onClick={() => {
                setShowSongPicker(true);
                fetchSongs();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium shadow-sm"
              title="Import Song"
            >
              <i className="fas fa-music text-base"></i>
              Import Song
            </button>
            <button
              onClick={handleCopy}
              disabled={!selectedId}
              className="flex items-center justify-center p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title="Copy (Ctrl+C)"
            >
              <i className="fas fa-copy text-base"></i>
            </button>
            <button
              onClick={handlePaste}
              disabled={!clipboard}
              className="flex items-center justify-center p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title="Paste (Ctrl+V)"
            >
              <i className="fas fa-paste text-base"></i>
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={!selectedId}
              className="flex items-center justify-center p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete (Del)"
            >
              <i className="fas fa-trash text-base"></i>
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
              scaleX={SCALE}
              scaleY={SCALE}
              style={{ backgroundColor: bgColor }}
            >
              <Layer>
                {/* Background - full slide size */}
                {currentSlide.background?.type === 'image' && currentSlide.background.value ? (
                  <BackgroundImage 
                    url={currentSlide.background.value}
                    width={SLIDE_WIDTH}
                    height={SLIDE_HEIGHT}
                  />
                ) : (
                  <Rect
                    x={0}
                    y={0}
                    width={SLIDE_WIDTH}
                    height={SLIDE_HEIGHT}
                    fill={bgColor}
                    listening={false}
                  />
                )}

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
                    {/* Bottom Left Text - Current Song Info */}
                    <Text
                      id="bottom-left-text-element"
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
                      onClick={() => setSelectedId('bottom-left-text-element')}
                      onTap={() => setSelectedId('bottom-left-text-element')}
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
                      onClick={() => setSelectedId('bottom-right-text-element')}
                      onTap={() => setSelectedId('bottom-right-text-element')}
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
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
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
                    return (
                      <DraggableText
                        key={element.id}
                        element={element}
                        isSelected={selectedId === element.id}
                        onSelect={() => setSelectedId(element.id)}
                        onChange={(updates) => updateElement(element.id, updates)}
                        stageRef={stageRef}
                        scale={SCALE}
                        onEditingChange={setIsTextEditing}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
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
                    return (
                      <VideoPlaceholder
                        key={element.id}
                        element={element}
                        isSelected={selectedId === element.id}
                        onSelect={() => setSelectedId(element.id)}
                        onChange={(updates) => updateElement(element.id, updates)}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
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
                    return (
                      <AudioPlaceholder
                        key={element.id}
                        element={element}
                        isSelected={selectedId === element.id}
                        onSelect={() => setSelectedId(element.id)}
                        onChange={(updates) => updateElement(element.id, updates)}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
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
          className="w-72 flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4 overflow-y-auto"
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
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Z-Index (layer order)</label>
                    <input
                      type="number"
                      value={selectedElement.zIndex || 0}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}              {selectedElement.type === 'video' && (
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
                  <div className="flex items-center justify-between mt-1">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
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
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
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
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Z-Index (layer order)</label>
                    <input
                      type="number"
                      value={selectedElement.zIndex || 0}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {selectedElement.type === 'audio' && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Audio URL</label>
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
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
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
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
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
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Volume ({Math.round((selectedElement.volume ?? 1) * 100)}%)</label>
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
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Z-Index (layer order)</label>
                    <input
                      type="number"
                      value={selectedElement.zIndex || 0}
                      onChange={(e) => updateElement(selectedElement.id, { zIndex: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
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
                        <i className="fas fa-align-left text-base"></i>
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
                        <i className="fas fa-align-center text-base"></i>
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
                        <i className="fas fa-align-right text-base"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Z-Index (layer order)</label>
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

