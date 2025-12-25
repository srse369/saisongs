import { useState, useCallback, useRef } from 'react';
import type Konva from 'konva';

export interface UseMultiSelectReturn {
  selectedIds: Set<string>;
  firstSelectedId: string | null;
  selectedId: string | null;
  isDraggingMultiSelect: boolean;
  dragStartPositions: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  isElementSelected: (id: string) => boolean;
  selectElement: (id: string | null) => void;
  toggleElementSelection: (id: string) => void;
  addToSelection: (id: string) => void;
  handleElementSelect: (id: string, e?: React.MouseEvent | MouseEvent | TouchEvent | Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  clearSelection: () => void;
  setIsDraggingMultiSelect: (isDragging: boolean) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * Custom hook for managing multi-select state for canvas elements
 * Supports Ctrl/Cmd+click for toggle, Shift+click for add, and regular click for replace
 */
export function useMultiSelect(): UseMultiSelectReturn {
  // Multi-select support: Set of selected element IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Track the first selected element ID for alignment reference
  const [firstSelectedId, setFirstSelectedId] = useState<string | null>(null);
  
  // Store initial positions when drag starts for multi-select
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [isDraggingMultiSelect, setIsDraggingMultiSelect] = useState(false);
  
  // Helper: Get primary selected ID (first one, for properties panel)
  const selectedId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : null;
  
  // Helper: Check if an element is selected
  const isElementSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);
  
  // Helper: Select a single element (replaces selection)
  const selectElement = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedIds(new Set());
      setFirstSelectedId(null);
    } else {
      setSelectedIds(new Set([id]));
      setFirstSelectedId(id);
    }
  }, []);
  
  // Helper: Toggle element in selection (for Ctrl/Cmd+click)
  const toggleElementSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // If we're removing the first selected element, update to the next one
        if (id === firstSelectedId) {
          const remaining = Array.from(next);
          setFirstSelectedId(remaining.length > 0 ? remaining[0] : null);
        }
      } else {
        next.add(id);
        // If this is the first element being added, set it as first selected
        if (prev.size === 0) {
          setFirstSelectedId(id);
        }
      }
      return next;
    });
  }, [firstSelectedId]);
  
  // Helper: Add element to selection (for Shift+click)
  const addToSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set([...prev, id]);
      // If this is the first element, set it as first selected
      if (prev.size === 0) {
        setFirstSelectedId(id);
      }
      return newSet;
    });
  }, []);
  
  // Helper: Handle element click with modifier keys
  const handleElementSelect = useCallback((id: string, e?: React.MouseEvent | MouseEvent | TouchEvent | Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Get the native event for modifier key detection
    const nativeEvent = e && 'evt' in e ? e.evt : e;
    
    // Ignore right-clicks (context menu) - they shouldn't change selection
    if (nativeEvent && 'button' in nativeEvent && nativeEvent.button === 2) {
      return;
    }
    
    const ctrlOrCmd = nativeEvent && ('ctrlKey' in nativeEvent && nativeEvent.ctrlKey || 'metaKey' in nativeEvent && nativeEvent.metaKey);
    const shiftKey = nativeEvent && 'shiftKey' in nativeEvent && nativeEvent.shiftKey;
    
    if (ctrlOrCmd) {
      // Ctrl/Cmd+click: Toggle this element in selection
      toggleElementSelection(id);
    } else if (shiftKey && selectedIds.size > 0) {
      // Shift+click: Add to selection
      addToSelection(id);
    } else {
      // Normal click: Replace selection with this element
      selectElement(id);
    }
  }, [selectedIds.size, toggleElementSelection, addToSelection, selectElement]);
  
  // Helper: Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setFirstSelectedId(null);
  }, []);
  
  return {
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
  };
}
