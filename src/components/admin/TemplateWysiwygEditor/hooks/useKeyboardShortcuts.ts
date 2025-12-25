import { useEffect } from 'react';
import type { CanvasElement } from '../types';
import type { TemplateSlide } from '../../../../types';

interface UseKeyboardShortcutsProps {
  isTextEditing: boolean;
  canvasHasFocus: boolean;
  slideListHasFocus: boolean;
  selectedId: string | null;
  selectedIds: Set<string>;
  canvasElements: CanvasElement[];
  slides: TemplateSlide[];
  selectedSlideIndex: number;
  referenceSlideIndex: number;
  template: any;
  elementContextMenu: any;
  contextMenu: any;
  updateElement: (id: string, updates: any) => void;
  handleDeleteSelected: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  setSelectedSlideIndex: (index: number) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setElementContextMenu: (menu: any) => void;
  setContextMenu: (menu: any) => void;
  onTemplateChange: (template: any) => void;
}

/**
 * Custom hook to handle keyboard shortcuts for the template editor
 */
export function useKeyboardShortcuts({
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
}: UseKeyboardShortcutsProps) {
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

      // Escape: Four-tier behavior - exit text edit → close context menu → deselect element → close dialog
      if (e.key === 'Escape') {
        // Tier 1: If text is being edited, the textarea's handler will exit edit mode
        // (that handler calls e.preventDefault() and e.stopPropagation())
        if (isTextEditing) {
          // Text editing handler will take care of it
          return;
        }
        
        // Tier 2: If context menu is open, close it
        if (elementContextMenu || contextMenu) {
          e.preventDefault();
          e.stopPropagation();
          setElementContextMenu(null);
          setContextMenu(null);
          return;
        }
        
        // Tier 3: If an element is selected (but not editing), deselect it
        if (selectedId) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIds(new Set());
          return;
        }
        
        // Tier 4: If nothing selected, let it propagate to Modal for exit handling
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
      
      // Move all selected elements in a single state update
      const newSlides = [...slides];
      const slideToUpdate = { ...newSlides[selectedSlideIndex] };
      
      selectedIds.forEach(id => {
        const element = canvasElements.find(el => el.id === id);
        if (!element) return;
        
        const newX = (element.x || 0) + dx;
        const newY = (element.y || 0) + dy;
        
        if (element.type === 'image') {
          const images = [...(slideToUpdate.images || [])];
          const imgIndex = images.findIndex(img => img.id === id);
          if (imgIndex >= 0) {
            images[imgIndex] = {
              ...images[imgIndex],
              x: `${Math.round(newX)}px`,
              y: `${Math.round(newY)}px`,
              position: undefined,
            };
            slideToUpdate.images = images;
          }
        } else if (element.type === 'video') {
          const videos = [...(slideToUpdate.videos || [])];
          const vidIndex = videos.findIndex(vid => vid.id === id);
          if (vidIndex >= 0) {
            videos[vidIndex] = {
              ...videos[vidIndex],
              x: `${Math.round(newX)}px`,
              y: `${Math.round(newY)}px`,
              position: undefined,
            };
            slideToUpdate.videos = videos;
          }
        } else if (element.type === 'audio') {
          const audios = [...(slideToUpdate.audios || [])];
          const audIndex = audios.findIndex(aud => aud.id === id);
          if (audIndex >= 0) {
            audios[audIndex] = {
              ...audios[audIndex],
              x: `${Math.round(newX)}px`,
              y: `${Math.round(newY)}px`,
              position: undefined,
            };
            slideToUpdate.audios = audios;
          }
        } else if (element.type === 'text') {
          const texts = [...(slideToUpdate.text || [])];
          const txtIndex = texts.findIndex(txt => txt.id === id);
          if (txtIndex >= 0) {
            texts[txtIndex] = {
              ...texts[txtIndex],
              x: `${Math.round(newX)}px`,
              y: `${Math.round(newY)}px`,
              position: undefined,
            };
            slideToUpdate.text = texts;
          }
        }
      });
      
      newSlides[selectedSlideIndex] = slideToUpdate;
      const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
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
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase to handle before Modal
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
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
  ]);
}
