import type { TemplateSlide } from '../../../../types';
import type { CanvasElement } from '../types';
import { updateElementsInSlide, type ElementUpdate } from './elementOperations';

/**
 * Alignment type
 */
export type AlignmentType = 
  | 'left' 
  | 'center' 
  | 'right' 
  | 'top' 
  | 'middle' 
  | 'bottom'
  | 'sameWidth'
  | 'sameHeight';

/**
 * Calculate element updates for alignment operation
 */
function calculateAlignmentUpdates(
  elements: CanvasElement[],
  referenceElement: CanvasElement,
  alignmentType: AlignmentType
): ElementUpdate[] {
  const updates: ElementUpdate[] = [];

  elements.forEach(el => {
    if (el.id === referenceElement.id) return; // Skip the reference element

    const update: ElementUpdate = {
      id: el.id,
      type: el.type,
      updates: {},
    };

    switch (alignmentType) {
      case 'left':
        update.updates.x = referenceElement.x;
        break;
      case 'center':
        update.updates.x = referenceElement.x + (referenceElement.width / 2) - (el.width / 2);
        break;
      case 'right':
        update.updates.x = referenceElement.x + referenceElement.width - el.width;
        break;
      case 'top':
        update.updates.y = referenceElement.y;
        break;
      case 'middle':
        update.updates.y = referenceElement.y + (referenceElement.height / 2) - (el.height / 2);
        break;
      case 'bottom':
        update.updates.y = referenceElement.y + referenceElement.height - el.height;
        break;
      case 'sameWidth':
        update.updates.width = referenceElement.width;
        break;
      case 'sameHeight':
        update.updates.height = referenceElement.height;
        break;
    }

    updates.push(update);
  });

  return updates;
}

/**
 * Apply alignment to selected elements
 */
export function applyAlignment(
  slide: TemplateSlide,
  selectedElements: CanvasElement[],
  referenceElementId: string,
  alignmentType: AlignmentType
): TemplateSlide {
  const referenceElement = selectedElements.find(el => el.id === referenceElementId);
  if (!referenceElement) return slide;

  const updates = calculateAlignmentUpdates(selectedElements, referenceElement, alignmentType);
  return updateElementsInSlide(slide, updates);
}

/**
 * Bring element to front by setting highest z-index
 */
export function bringToFront(
  slide: TemplateSlide,
  elementId: string,
  elementType: 'image' | 'video' | 'audio' | 'text',
  maxZIndex: number
): TemplateSlide {
  return updateElementsInSlide(slide, [{
    id: elementId,
    type: elementType,
    updates: { zIndex: maxZIndex + 1 }
  }]);
}

/**
 * Send element to back by setting lowest z-index
 */
export function sendToBack(
  slide: TemplateSlide,
  elementId: string,
  elementType: 'image' | 'video' | 'audio' | 'text',
  minZIndex: number
): TemplateSlide {
  return updateElementsInSlide(slide, [{
    id: elementId,
    type: elementType,
    updates: { zIndex: minZIndex - 1 }
  }]);
}
