import { useState, useCallback } from 'react';
import type { PresentationTemplate } from '../../../../types';
import { reorderSlides as reorderSlidesOp } from '../operations';

interface UseSlideDragAndDropProps {
  template: PresentationTemplate;
  referenceSlideIndex: number;
  onTemplateChange: (template: PresentationTemplate) => void;
  setSelectedSlideIndex: (index: number) => void;
}

/**
 * Custom hook to handle slide drag-and-drop reordering
 * Manages drag state and provides event handlers
 */
export function useSlideDragAndDrop({
  template,
  referenceSlideIndex,
  onTemplateChange,
  setSelectedSlideIndex,
}: UseSlideDragAndDropProps) {
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);

  const handleSlideDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedSlideIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to show the dragging state
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    });
  }, []);

  const handleSlideDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  }, []);

  const handleSlideDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSlideIndex !== null && draggedSlideIndex !== index) {
      setDragOverSlideIndex(index);
    }
  }, [draggedSlideIndex]);

  const handleSlideDragLeave = useCallback(() => {
    setDragOverSlideIndex(null);
  }, []);

  const handleSlideDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedSlideIndex === null || draggedSlideIndex === dropIndex) {
      setDraggedSlideIndex(null);
      setDragOverSlideIndex(null);
      return;
    }

    const { updatedTemplate, newSlideIndex } = reorderSlidesOp(
      template,
      draggedSlideIndex,
      dropIndex,
      referenceSlideIndex
    );

    onTemplateChange(updatedTemplate);
    setSelectedSlideIndex(newSlideIndex);
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  }, [draggedSlideIndex, template, referenceSlideIndex, onTemplateChange, setSelectedSlideIndex]);

  return {
    draggedSlideIndex,
    dragOverSlideIndex,
    handleSlideDragStart,
    handleSlideDragEnd,
    handleSlideDragOver,
    handleSlideDragLeave,
    handleSlideDrop,
  };
}
