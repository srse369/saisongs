import { useCallback, useRef } from 'react';
import type Konva from 'konva';
import type { CanvasElement } from '../types';
import type { PresentationTemplate, TemplateSlide } from '../../../../types';
import { updateElementsInSlide } from '../operations';

interface UseDragHandlersProps {
  selectedIds: Set<string>;
  canvasElements: CanvasElement[];
  slides: TemplateSlide[];
  selectedSlideIndex: number;
  referenceSlideIndex: number;
  template: PresentationTemplate;
  stageRef: React.RefObject<Konva.Stage>;
  onTemplateChange: (template: PresentationTemplate) => void;
  setIsDraggingMultiSelect: (isDragging: boolean) => void;
}

/**
 * Custom hook to handle drag operations for canvas elements
 * Supports multi-select dragging
 */
export function useDragHandlers({
  selectedIds,
  canvasElements,
  slides,
  selectedSlideIndex,
  referenceSlideIndex,
  template,
  stageRef,
  onTemplateChange,
  setIsDraggingMultiSelect,
}: UseDragHandlersProps) {
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Handle drag for multi-selected elements
  const handleMultiSelectDrag = useCallback((draggedElementId: string, newX: number, newY: number) => {
    const draggedElement = canvasElements.find(el => el.id === draggedElementId);
    if (!draggedElement) return;

    // Calculate the delta
    const dx = newX - draggedElement.x;
    const dy = newY - draggedElement.y;

    const newSlides = [...slides];
    const slideToUpdate = { ...newSlides[selectedSlideIndex] };

    // Get elements to move - if multiple selected and dragged element is in selection, move all
    const elementsToMove = (selectedIds.size > 1 && selectedIds.has(draggedElementId))
      ? Array.from(selectedIds)
      : [draggedElementId];

    const updates = elementsToMove.map(id => {
      const element = canvasElements.find(el => el.id === id);
      if (!element) return null;

      const elementNewX = element.x + dx;
      const elementNewY = element.y + dy;

      return {
        id,
        type: element.type,
        updates: {
          x: elementNewX,
          y: elementNewY,
        },
      };
    }).filter(Boolean) as Array<{ id: string; type: 'image' | 'video' | 'audio' | 'text'; updates: any }>;

    const updatedSlide = updateElementsInSlide(slideToUpdate, updates);
    newSlides[selectedSlideIndex] = updatedSlide;

    const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
    const audiosForTemplate = selectedSlideIndex === referenceSlideIndex ? updatedSlide.audios : refSlide?.audios;

    onTemplateChange({
      ...template,
      slides: newSlides,
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      audios: audiosForTemplate || [],
      text: refSlide?.text || [],
    });
    
    // Reset multi-select drag state
    setIsDraggingMultiSelect(false);
  }, [canvasElements, selectedIds, slides, selectedSlideIndex, referenceSlideIndex, template, onTemplateChange, setIsDraggingMultiSelect]);

  // Common drag handlers for multi-select
  const createDragHandlers = useCallback((elementId: string) => ({
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      // Store initial positions of all selected elements
      if (selectedIds.size > 1 && selectedIds.has(elementId)) {
        const positions = new Map<string, { x: number; y: number }>();
        selectedIds.forEach(id => {
          const el = canvasElements.find(e => e.id === id);
          if (el) {
            positions.set(id, { x: el.x, y: el.y });
          }
        });
        dragStartPositions.current = positions;
        setIsDraggingMultiSelect(true);
      }
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      // Update visual position of all other selected elements during drag
      if (selectedIds.size > 1 && selectedIds.has(elementId) && stageRef.current) {
        const draggedNode = e.target;
        const startPos = dragStartPositions.current.get(elementId);
        if (!startPos) return;
        
        const dx = draggedNode.x() - startPos.x;
        const dy = draggedNode.y() - startPos.y;
        
        let needsRedraw = false;
        selectedIds.forEach(id => {
          if (id !== elementId) {
            const node = stageRef.current!.findOne('#' + id);
            const initialPos = dragStartPositions.current.get(id);
            if (node && initialPos) {
              const newX = initialPos.x + dx;
              const newY = initialPos.y + dy;
              node.x(newX);
              node.y(newY);
              needsRedraw = true;
            }
          }
        });
        
        // Force redraw after updating all positions
        if (needsRedraw) {
          const layer = draggedNode.getLayer();
          if (layer) {
            layer.batchDraw();
          }
        }
      }
    }
  }), [selectedIds, canvasElements, stageRef, setIsDraggingMultiSelect]);

  return {
    handleMultiSelectDrag,
    createDragHandlers,
    dragStartPositions,
  };
}
