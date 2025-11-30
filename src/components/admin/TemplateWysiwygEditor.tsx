import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import useImage from 'use-image';
import type { PresentationTemplate, ImageElement, TextElement, TemplateSlide, BackgroundElement, AspectRatio } from '../../types';
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
  type: 'image' | 'text';
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
          rotation: node.rotation(),
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
      align={element.textAlign || 'left'}
      fill={element.color || '#ffffff'}
      opacity={element.opacity ?? 1}
      rotation={element.rotation || 0}
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
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.round(Math.max(20, node.width() * scaleX)),
          fontSize: Math.round(Math.max(8, (element.fontSize || 24) * scaleX)),
          rotation: node.rotation(),
        });
      }}
    />
  );
};

export const TemplateWysiwygEditor: React.FC<TemplateWysiwygEditorProps> = ({
  template,
  onTemplateChange,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

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
      })),
      ...(currentSlide.text || []).map((txt): CanvasElement => ({
        id: txt.id,
        type: 'text',
        x: parsePosition(txt.x, txt.position, 'x', SLIDE_WIDTH, 300, SLIDE_WIDTH, SLIDE_HEIGHT),
        y: parsePosition(txt.y, txt.position, 'y', SLIDE_HEIGHT, 50, SLIDE_WIDTH, SLIDE_HEIGHT),
        width: 600,
        height: 100,
        content: txt.content,
        fontSize: parseFloat(txt.fontSize) || 48,
        fontFamily: txt.fontFamily,
        fontWeight: txt.fontWeight,
        textAlign: txt.textAlign || 'left',
        color: txt.color,
        opacity: txt.opacity,
        zIndex: txt.zIndex || 2,
      })),
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

  // Handle canvas click (deselect)
  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
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
          position: undefined, // Clear predefined position when using x/y
        };
        slideToUpdate.images = images;
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

  // Add new text (using full slide coordinates)
  const handleAddText = () => {
    const newText: TextElement = {
      id: `text-${Date.now()}`,
      content: 'New Text',
      fontSize: '64px',
      color: '#ffffff',
      x: '100px',
      y: '100px',
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

  // Get background color/style
  const bgColor = currentSlide.background?.type === 'color' 
    ? currentSlide.background.value 
    : '#1a1a2e';

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <button
          onClick={handleAddImage}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Add Image
        </button>
        <button
          onClick={handleAddText}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Add Text
        </button>
        {selectedId && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}
        
        <div className="flex-1" />
        
        {/* Slide selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Slide:</span>
          <select
            value={selectedSlideIndex}
            onChange={(e) => {
              setSelectedSlideIndex(parseInt(e.target.value));
              setSelectedId(null);
            }}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {slides.map((_, idx) => (
              <option key={idx} value={idx}>
                {idx + 1} {idx === referenceSlideIndex ? '(Ref)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex gap-4">
        {/* Canvas - Slide Preview */}
        <div className="flex-1 flex flex-col" style={{ maxWidth: CANVAS_WIDTH + 40 }}>
          {/* Slide frame */}
          <div 
            className="relative bg-gray-900 rounded-lg shadow-2xl overflow-hidden mx-auto"
            style={{ 
              width: CANVAS_WIDTH, 
              height: CANVAS_HEIGHT,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)'
            }}
          >
            {/* Slide label */}
            <div className="absolute -top-7 left-0 right-0 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Slide {selectedSlideIndex + 1} of {slides.length} (1920×1080 → {CANVAS_WIDTH}×{CANVAS_HEIGHT})
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

                {/* Sample lyrics preview for reference slide */}
                {selectedSlideIndex === referenceSlideIndex && (
                  <Group listening={false} opacity={0.4}>
                    <Text
                      x={SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT * 0.35}
                      text="॥ Sample Lyrics Line 1 ॥"
                      fontSize={72}
                      fontFamily="Arial"
                      fill="#ffffff"
                      align="center"
                      offsetX={300}
                    />
                    <Text
                      x={SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT * 0.45}
                      text="Sample Lyrics Line 2"
                      fontSize={72}
                      fontFamily="Arial"
                      fill="#ffffff"
                      align="center"
                      offsetX={250}
                    />
                    <Text
                      x={SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT * 0.60}
                      text="(Translation text appears here)"
                      fontSize={48}
                      fontFamily="Arial"
                      fontStyle="italic"
                      fill="#cccccc"
                      align="center"
                      offsetX={280}
                    />
                    <Text
                      x={SLIDE_WIDTH / 2}
                      y={SLIDE_HEIGHT - 80}
                      text="[Sample lyrics preview - not editable]"
                      fontSize={28}
                      fontFamily="Arial"
                      fill="#888888"
                      align="center"
                      offsetX={200}
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
        <div className="w-72 flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4 max-h-[600px] overflow-y-auto">
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
                Selected: {selectedElement.type === 'image' ? 'Image' : 'Text'}
              </h4>
              
              {selectedElement.type === 'image' && (
                <>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Width</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.width)}
                        onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) || 100 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Height</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.height)}
                        onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) || 100 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedElement.type === 'text' && (
                <>
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
                          (selectedElement.textAlign || 'left') === 'left'
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
                          selectedElement.textAlign === 'center'
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

              {/* Common properties */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">X Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.x)}
                    onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.y)}
                    onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

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
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              <p>Click on an element to edit its properties</p>
              <p className="mt-2 text-xs">Or use the toolbar to add new elements</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default TemplateWysiwygEditor;

