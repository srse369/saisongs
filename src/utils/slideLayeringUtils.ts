import type { TemplateSlide, TextElement } from '../types';

/**
 * Finds the top-center text element from a template slide
 * "Top-center" means:
 * - Position is 'top-center' OR position is in the top half of the slide (y < height/2)
 * - AND textAlign is 'center'
 * Picks the element with the smallest y value (topmost).
 * Limits the text to at most 2 lines, joined with a space separator.
 * @param templateSlide - The template slide to search
 * @returns The text content of the top-center element (max 2 lines), or undefined
 */
export function getTopCenterText(templateSlide: TemplateSlide | undefined): string | undefined {
  if (!templateSlide || !templateSlide.text || templateSlide.text.length === 0) {
    return undefined;
  }

  // Filter for text elements that are centered and in the top portion
  const topCenterTexts = templateSlide.text.filter((text: TextElement) => {
    // Must be center-aligned
    if (text.textAlign !== 'center') {
      return false;
    }

    // Check position
    if (text.position === 'top-center') {
      return true;
    }

    // If using absolute coordinates, check if in top half
    if (text.y !== undefined) {
      const yValue = typeof text.y === 'string' 
        ? parseInt(text.y) 
        : (text.y as number);
      // Assume standard slide height of 1080 for comparison
      return yValue < 270; // Top 25% of typical slide
    }

    return false;
  });

  if (topCenterTexts.length === 0) {
    return undefined;
  }

  // Find the element with the smallest y value (topmost)
  let topmost = topCenterTexts[0];
  let smallestY = getYValue(topmost.y);

  for (let i = 1; i < topCenterTexts.length; i++) {
    const yValue = getYValue(topCenterTexts[i].y);
    if (yValue < smallestY) {
      smallestY = yValue;
      topmost = topCenterTexts[i];
    }
  }

  // Process the content: limit to 2 lines maximum, joined with space
  if (!topmost.content) {
    return undefined;
  }

  const lines = topmost.content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return undefined;
  }

  // Take first 2 lines and join with space
  const limitedText = lines.slice(0, 2).join(' ');
  return limitedText;
}

/**
 * Helper to extract numeric y value from various formats
 */
function getYValue(y: string | number | undefined): number {
  if (y === undefined) {
    return Infinity; // Elements without y go last
  }
  return typeof y === 'string' ? parseInt(y) : (y as number);
}
