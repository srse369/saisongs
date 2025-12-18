/**
 * Font metrics utilities for measuring actual font heights and calculating size adjustments
 */

interface FontMetrics {
  height: number;
  baseline: number;
}

/**
 * Measure the actual rendered height of text in a specific font using Canvas API
 */
function measureFontHeight(fontFamily: string, fontSize: number = 100): FontMetrics {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    return { height: fontSize, baseline: fontSize * 0.8 };
  }

  // Set large size for accurate measurement
  context.font = `${fontSize}px ${fontFamily}`;
  
  // Measure a capital letter for cap-height and a lowercase for x-height
  const text = 'HgjpqyÁ'; // Mix of tall and descending characters
  const metrics = context.measureText(text);
  
  // Calculate actual height using fontBoundingBox (most accurate)
  const actualHeight = (metrics.fontBoundingBoxAscent || 0) + (metrics.fontBoundingBoxDescent || 0);
  const baseline = metrics.fontBoundingBoxAscent || fontSize * 0.8;
  
  return {
    height: actualHeight || fontSize,
    baseline: baseline
  };
}

/**
 * Calculate the size ratio needed to make targetFont appear the same height as baseFont
 * Returns a multiplier to apply to font size
 */
export function calculateFontSizeRatio(targetFont: string, baseFont: string = 'Arial'): number {
  const targetMetrics = measureFontHeight(targetFont);
  const baseMetrics = measureFontHeight(baseFont);
  
  if (targetMetrics.height === 0 || baseMetrics.height === 0) {
    return 1.0;
  }
  
  // Ratio to make target font appear the same visual height as base font
  // If target is taller than base, ratio < 1 (make it smaller)
  // If target is shorter than base, ratio > 1 (make it larger)
  const ratio = baseMetrics.height / targetMetrics.height;
  
  return ratio;
}

/**
 * Get font size adjustment ratio for common fonts
 * Uses dynamic measurement with fallback to cached values
 */
export function getFontSizeAdjustment(fontFamily: string): number {
  // Try dynamic measurement first
  try {
    const ratio = calculateFontSizeRatio(fontFamily, 'Arial');
    
    // Sanity check - ratio should be between 0.7 and 1.3
    if (ratio >= 0.7 && ratio <= 1.3) {
      console.log(`Font size ratio for ${fontFamily}: ${ratio.toFixed(3)}`);
      return ratio;
    }
  } catch (error) {
    console.warn(`Failed to measure font ${fontFamily}, using fallback`);
  }
  
  // Fallback to known values if measurement fails or seems wrong
  const fallbackRatios: Record<string, number> = {
    'Constantia': 0.92,
    'Georgia': 0.95,
    'Palatino Linotype': 0.95,
    'Times New Roman': 1.05,
    'Calibri': 1.0,
    'Verdana': 0.88,
    'Trebuchet MS': 0.95,
  };
  
  return fallbackRatios[fontFamily] || 1.0;
}

/**
 * Detect which font is actually being used by the browser
 * Useful to check if a font loaded or if fallback is being used
 */
export function detectActualFont(fontFamily: string, testText: string = 'mmmmmmmmmmlli'): string {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    return 'unknown';
  }
  
  // Measure with the requested font
  context.font = `72px ${fontFamily}`;
  const requestedWidth = context.measureText(testText).width;
  
  // Measure with common fallback fonts
  const fallbacks = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];
  
  for (const fallback of fallbacks) {
    context.font = `72px ${fallback}`;
    const fallbackWidth = context.measureText(testText).width;
    
    // If widths match closely, the requested font isn't available
    if (Math.abs(requestedWidth - fallbackWidth) < 0.5) {
      console.log(`Font "${fontFamily}" not available, using "${fallback}"`);
      return fallback;
    }
  }
  
  console.log(`Font "${fontFamily}" is available`);
  return fontFamily;
}
