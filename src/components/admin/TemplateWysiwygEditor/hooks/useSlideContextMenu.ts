import { useCallback } from 'react';
import type { PresentationTemplate } from '../../../../types';
import {
  insertSlide as insertSlideOp,
  duplicateSlide as duplicateSlideOp,
  deleteSlide as deleteSlideOp,
  moveSlideUp as moveSlideUpOp,
  moveSlideDown as moveSlideDownOp,
  setAsReferenceSlide,
} from '../operations';

interface UseSlideContextMenuProps {
  template: PresentationTemplate;
  referenceSlideIndex: number;
  slidesLength: number;
  onTemplateChange: (template: PresentationTemplate) => void;
  setSelectedSlideIndex: (index: number) => void;
  setContextMenu: (menu: { x: number; y: number; slideIndex: number } | null) => void;
}

/**
 * Custom hook to handle slide context menu actions
 * Centralizes all the repetitive handler patterns
 */
export function useSlideContextMenu({
  template,
  referenceSlideIndex,
  slidesLength,
  onTemplateChange,
  setSelectedSlideIndex,
  setContextMenu,
}: UseSlideContextMenuProps) {

  const handleInsertSlide = useCallback((atIndex: number) => {
    const { updatedTemplate, newSlideIndex } = insertSlideOp(template, atIndex, referenceSlideIndex);
    onTemplateChange(updatedTemplate);
    setSelectedSlideIndex(newSlideIndex);
    setContextMenu(null);
  }, [template, referenceSlideIndex, onTemplateChange, setSelectedSlideIndex, setContextMenu]);

  const handleDuplicateSlide = useCallback((atIndex: number) => {
    const { updatedTemplate, newSlideIndex } = duplicateSlideOp(template, atIndex, referenceSlideIndex);
    onTemplateChange(updatedTemplate);
    setSelectedSlideIndex(newSlideIndex);
    setContextMenu(null);
  }, [template, referenceSlideIndex, onTemplateChange, setSelectedSlideIndex, setContextMenu]);

  const handleDeleteSlide = useCallback((atIndex: number) => {
    if (slidesLength <= 1) {
      setContextMenu(null);
      return;
    }
    
    const { updatedTemplate, newSlideIndex } = deleteSlideOp(template, atIndex, referenceSlideIndex);
    onTemplateChange(updatedTemplate);
    setSelectedSlideIndex(newSlideIndex);
    setContextMenu(null);
  }, [template, referenceSlideIndex, slidesLength, onTemplateChange, setSelectedSlideIndex, setContextMenu]);

  const handleMoveSlideUp = useCallback((atIndex: number) => {
    if (atIndex <= 0) {
      setContextMenu(null);
      return;
    }
    
    const { updatedTemplate, newSlideIndex } = moveSlideUpOp(template, atIndex, referenceSlideIndex);
    onTemplateChange(updatedTemplate);
    setSelectedSlideIndex(newSlideIndex);
    setContextMenu(null);
  }, [template, referenceSlideIndex, onTemplateChange, setSelectedSlideIndex, setContextMenu]);

  const handleMoveSlideDown = useCallback((atIndex: number) => {
    if (atIndex >= slidesLength - 1) {
      setContextMenu(null);
      return;
    }
    
    const { updatedTemplate, newSlideIndex } = moveSlideDownOp(template, atIndex, referenceSlideIndex);
    onTemplateChange(updatedTemplate);
    setSelectedSlideIndex(newSlideIndex);
    setContextMenu(null);
  }, [template, referenceSlideIndex, slidesLength, onTemplateChange, setSelectedSlideIndex, setContextMenu]);

  const handleSetAsReference = useCallback((atIndex: number) => {
    const updatedTemplate = setAsReferenceSlide(template, atIndex);
    onTemplateChange(updatedTemplate);
    setContextMenu(null);
  }, [template, onTemplateChange, setContextMenu]);

  return {
    handleInsertSlide,
    handleDuplicateSlide,
    handleDeleteSlide,
    handleMoveSlideUp,
    handleMoveSlideDown,
    handleSetAsReference,
  };
}
