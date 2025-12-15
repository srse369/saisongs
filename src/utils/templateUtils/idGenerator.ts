/**
 * Utility functions for generating unique IDs for template slide elements
 */

/**
 * Generate a unique ID for a duplicated slide element
 * Used when duplicating slides to ensure all element IDs are unique
 * @param elementType - Type of element (image, video, text, etc.)
 * @returns A unique ID string combining timestamp and random value
 */
export function generateElementId(elementType: string): string {
  const timestamp = Date.now();
  const randomValue = Math.random().toString(36).substr(2, 9);
  return `${elementType}-${timestamp}-${randomValue}`;
}

/**
 * Generate new IDs for all elements in a duplicated slide
 * Preserves the structure but creates fresh IDs for images, videos, and text
 * @param slide - The TemplateSlide to update with new IDs
 * @returns A copy of the slide with all element IDs regenerated
 */
export function regenerateSlideElementIds(slide: any): any {
  const slideCopy = JSON.parse(JSON.stringify(slide));
  
  if (slideCopy.images) {
    slideCopy.images = slideCopy.images.map((img: any) => ({
      ...img,
      id: generateElementId('image')
    }));
  }
  
  if (slideCopy.videos) {
    slideCopy.videos = slideCopy.videos.map((vid: any) => ({
      ...vid,
      id: generateElementId('video')
    }));
  }
  
  if (slideCopy.text) {
    slideCopy.text = slideCopy.text.map((txt: any) => ({
      ...txt,
      id: generateElementId('text')
    }));
  }
  
  return slideCopy;
}
