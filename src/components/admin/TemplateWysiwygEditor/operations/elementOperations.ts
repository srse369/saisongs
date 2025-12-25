import type { TemplateSlide, ImageElement, TextElement, VideoElement, AudioElement } from '../../../../types';

/**
 * Type for element updates
 */
export type ElementUpdate = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  updates: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    [key: string]: any;
  };
};

/**
 * Update a single property across multiple elements in a slide
 * Returns a new slide with the updates applied
 */
export function updateElementsInSlide(
  slide: TemplateSlide,
  elementUpdates: ElementUpdate[]
): TemplateSlide {
  const updatedSlide = { ...slide };

  elementUpdates.forEach(({ id, type, updates }) => {
    if (type === 'image') {
      const images = [...(updatedSlide.images || [])];
      const idx = images.findIndex(img => img.id === id);
      if (idx >= 0) {
        images[idx] = {
          ...images[idx],
          ...(updates.x !== undefined && { x: `${Math.round(updates.x)}px`, position: undefined }),
          ...(updates.y !== undefined && { y: `${Math.round(updates.y)}px`, position: undefined }),
          ...(updates.width !== undefined && { width: `${Math.round(updates.width)}px` }),
          ...(updates.height !== undefined && { height: `${Math.round(updates.height)}px` }),
          ...Object.fromEntries(
            Object.entries(updates).filter(([key]) => !['x', 'y', 'width', 'height'].includes(key))
          ),
        };
        updatedSlide.images = images;
      }
    } else if (type === 'video') {
      const videos = [...(updatedSlide.videos || [])];
      const idx = videos.findIndex(vid => vid.id === id);
      if (idx >= 0) {
        videos[idx] = {
          ...videos[idx],
          ...(updates.x !== undefined && { x: `${Math.round(updates.x)}px`, position: undefined }),
          ...(updates.y !== undefined && { y: `${Math.round(updates.y)}px`, position: undefined }),
          ...(updates.width !== undefined && { width: `${Math.round(updates.width)}px` }),
          ...(updates.height !== undefined && { height: `${Math.round(updates.height)}px` }),
          ...Object.fromEntries(
            Object.entries(updates).filter(([key]) => !['x', 'y', 'width', 'height'].includes(key))
          ),
        };
        updatedSlide.videos = videos;
      }
    } else if (type === 'audio') {
      const audios = [...(updatedSlide.audios || [])];
      const idx = audios.findIndex(aud => aud.id === id);
      if (idx >= 0) {
        audios[idx] = {
          ...audios[idx],
          ...(updates.x !== undefined && { x: `${Math.round(updates.x)}px`, position: undefined }),
          ...(updates.y !== undefined && { y: `${Math.round(updates.y)}px`, position: undefined }),
          ...(updates.width !== undefined && { width: `${Math.round(updates.width)}px` }),
          ...(updates.height !== undefined && { height: `${Math.round(updates.height)}px` }),
          ...Object.fromEntries(
            Object.entries(updates).filter(([key]) => !['x', 'y', 'width', 'height'].includes(key))
          ),
        };
        updatedSlide.audios = audios;
      }
    } else if (type === 'text') {
      const texts = [...(updatedSlide.text || [])];
      const idx = texts.findIndex(txt => txt.id === id);
      if (idx >= 0) {
        texts[idx] = {
          ...texts[idx],
          ...(updates.x !== undefined && { x: `${Math.round(updates.x)}px`, position: undefined }),
          ...(updates.y !== undefined && { y: `${Math.round(updates.y)}px`, position: undefined }),
          ...(updates.width !== undefined && { 
            width: `${Math.round(updates.width)}px`,
            maxWidth: `${Math.round(updates.width)}px`
          }),
          ...(updates.height !== undefined && { height: `${Math.round(updates.height)}px` }),
          ...Object.fromEntries(
            Object.entries(updates).filter(([key]) => !['x', 'y', 'width', 'height'].includes(key))
          ),
        };
        updatedSlide.text = texts;
      }
    }
  });

  return updatedSlide;
}

/**
 * Delete elements from a slide by their IDs
 */
export function deleteElementsFromSlide(
  slide: TemplateSlide,
  elementIds: Set<string>,
  canvasElements: Array<{ id: string; type: 'image' | 'video' | 'audio' | 'text' }>
): TemplateSlide {
  const updatedSlide = { ...slide };

  elementIds.forEach(id => {
    const element = canvasElements.find(el => el.id === id);
    if (!element) return;

    if (element.type === 'image') {
      updatedSlide.images = (updatedSlide.images || []).filter(img => img.id !== id);
    } else if (element.type === 'video') {
      updatedSlide.videos = (updatedSlide.videos || []).filter(vid => vid.id !== id);
    } else if (element.type === 'audio') {
      updatedSlide.audios = (updatedSlide.audios || []).filter(aud => aud.id !== id);
    } else if (element.type === 'text') {
      updatedSlide.text = (updatedSlide.text || []).filter(txt => txt.id !== id);
    }
  });

  return updatedSlide;
}
