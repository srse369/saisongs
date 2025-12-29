import { useState, useEffect, useCallback, useRef } from 'react';
import type { PresentationTemplate, TemplateSlide } from '../../../../types';

interface UseHistoryProps {
  slides: TemplateSlide[];
  selectedSlideIndex: number;
  template: PresentationTemplate;
  referenceSlideIndex: number;
  onTemplateChange: (template: PresentationTemplate) => void;
}

interface HistoryState {
  slides: TemplateSlide[];
  selectedSlideIndex: number;
  template: PresentationTemplate;
  referenceSlideIndex: number;
}

export function useHistory({
  slides,
  selectedSlideIndex,
  template,
  referenceSlideIndex,
  onTemplateChange,
}: UseHistoryProps) {
  const [history, setHistory] = useState<HistoryState[]>([{
    slides,
    selectedSlideIndex,
    template,
    referenceSlideIndex,
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isApplyingHistoryRef = useRef(false);

  // Update history when template changes (but not when applying history)
  useEffect(() => {
    if (isApplyingHistoryRef.current) {
      return;
    }

    const newState: HistoryState = {
      slides,
      selectedSlideIndex,
      template,
      referenceSlideIndex,
    };

    setHistory(prev => {
      // Remove any states after current index (when user made changes after undo)
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      newHistory.push(newState);
      // Limit history size to prevent memory issues (keep last 50 states)
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => {
      const newHistoryLength = prev < prev ? prev + 1 : prev + 1;
      // Limit to last 50 states
      return Math.min(newHistoryLength, 49);
    });
  }, [slides, selectedSlideIndex, template, referenceSlideIndex, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;

    const newIndex = historyIndex - 1;
    const state = history[newIndex];
    
    isApplyingHistoryRef.current = true;
    setHistoryIndex(newIndex);
    onTemplateChange({
      ...state.template,
      slides: state.slides,
      referenceSlideIndex: state.referenceSlideIndex,
    });
    
    // Reset flag after state update
    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, [canUndo, historyIndex, history, onTemplateChange]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;

    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    
    isApplyingHistoryRef.current = true;
    setHistoryIndex(newIndex);
    onTemplateChange({
      ...state.template,
      slides: state.slides,
      referenceSlideIndex: state.referenceSlideIndex,
    });
    
    // Reset flag after state update
    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, [canRedo, historyIndex, history, onTemplateChange]);

  return {
    historyIndex,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    history, // Export history for the disabled check in the UI
  };
}