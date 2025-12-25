import { useState, useCallback, useRef, useEffect } from 'react';
import type { PresentationTemplate, TemplateSlide } from '../../../../types';

export interface HistoryState {
  slides: TemplateSlide[];
  selectedSlideIndex: number;
}

export interface UseHistoryReturn {
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  handleUndo: () => void;
  handleRedo: () => void;
}

interface UseHistoryOptions {
  slides: TemplateSlide[];
  selectedSlideIndex: number;
  template: PresentationTemplate;
  referenceSlideIndex: number;
  onTemplateChange: (template: PresentationTemplate) => void;
  maxHistorySize?: number;
}

/**
 * Custom hook for managing undo/redo history for template slides
 * Tracks changes and provides undo/redo functionality with a configurable history size
 */
export function useHistory({
  slides,
  selectedSlideIndex,
  template,
  referenceSlideIndex,
  onTemplateChange,
  maxHistorySize = 50,
}: UseHistoryOptions): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  
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
      // Add new state, limit history to maxHistorySize entries
      const updated = [...newHistory, newState].slice(-maxHistorySize);
      return updated;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
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

  return {
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    handleUndo,
    handleRedo,
  };
}
