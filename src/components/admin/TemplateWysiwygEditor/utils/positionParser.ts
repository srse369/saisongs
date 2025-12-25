import { ELEMENT_MARGIN } from '../constants';

/**
 * Helper to parse position using full slide dimensions
 * Converts string positions (%, predefined) to numeric pixel values
 */
export function parsePosition(
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
    const positions: Record<string, { x: number; y: number }> = {
      'top-left': { x: ELEMENT_MARGIN, y: ELEMENT_MARGIN },
      'top-center': { x: (slideWidth - elementSize) / 2, y: ELEMENT_MARGIN },
      'top-right': { x: slideWidth - elementSize - ELEMENT_MARGIN, y: ELEMENT_MARGIN },
      'center-left': { x: ELEMENT_MARGIN, y: (slideHeight - elementSize) / 2 },
      'center': { x: (slideWidth - elementSize) / 2, y: (slideHeight - elementSize) / 2 },
      'center-right': { x: slideWidth - elementSize - ELEMENT_MARGIN, y: (slideHeight - elementSize) / 2 },
      'bottom-left': { x: ELEMENT_MARGIN, y: slideHeight - elementSize - ELEMENT_MARGIN },
      'bottom-center': { x: (slideWidth - elementSize) / 2, y: slideHeight - elementSize - ELEMENT_MARGIN },
      'bottom-right': { x: slideWidth - elementSize - ELEMENT_MARGIN, y: slideHeight - elementSize - ELEMENT_MARGIN },
    };
    return positions[position]?.[axis] ?? 0;
  }
  
  return 0;
}
