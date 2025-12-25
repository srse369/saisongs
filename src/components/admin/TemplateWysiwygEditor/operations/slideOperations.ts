import type { PresentationTemplate, TemplateSlide } from '../../../../types';
import { regenerateSlideElementIds } from '../../../../utils/templateUtils/idGenerator';

/**
 * Insert a new blank slide at the specified index
 */
export function insertSlide(
  template: PresentationTemplate,
  atIndex: number,
  referenceSlideIndex: number
): { updatedTemplate: PresentationTemplate; newSlideIndex: number } {
  const slides = template.slides || [];
  const refSlide = slides[referenceSlideIndex] || slides[0];

  // Create a blank slide with reference slide's background
  const newSlide: TemplateSlide = {
    background: refSlide?.background ? { ...refSlide.background } : undefined,
    images: [],
    videos: [],
    audios: [],
    text: [],
  };

  const newSlides = [
    ...slides.slice(0, atIndex + 1),
    newSlide,
    ...slides.slice(atIndex + 1),
  ];

  // Adjust reference slide index if needed
  const newReferenceIndex = atIndex < referenceSlideIndex 
    ? referenceSlideIndex + 1 
    : referenceSlideIndex;

  const newRefSlide = newSlides[newReferenceIndex] || newSlides[0];

  return {
    updatedTemplate: {
      ...template,
      slides: newSlides,
      referenceSlideIndex: newReferenceIndex,
      background: newRefSlide?.background,
      images: newRefSlide?.images || [],
      videos: newRefSlide?.videos || [],
      audios: newRefSlide?.audios || [],
      text: newRefSlide?.text || [],
    },
    newSlideIndex: atIndex + 1,
  };
}

/**
 * Duplicate a slide at the specified index
 */
export function duplicateSlide(
  template: PresentationTemplate,
  atIndex: number,
  referenceSlideIndex: number
): { updatedTemplate: PresentationTemplate; newSlideIndex: number } {
  const slides = template.slides || [];
  const slideToDuplicate = slides[atIndex];

  if (!slideToDuplicate) {
    return { updatedTemplate: template, newSlideIndex: atIndex };
  }

  // Deep clone and regenerate IDs for all elements
  const duplicatedSlide = regenerateSlideElementIds(slideToDuplicate);

  const newSlides = [
    ...slides.slice(0, atIndex + 1),
    duplicatedSlide,
    ...slides.slice(atIndex + 1),
  ];

  // Adjust reference slide index if needed
  const newReferenceIndex = atIndex < referenceSlideIndex 
    ? referenceSlideIndex + 1 
    : referenceSlideIndex;

  const newRefSlide = newSlides[newReferenceIndex] || newSlides[0];

  return {
    updatedTemplate: {
      ...template,
      slides: newSlides,
      referenceSlideIndex: newReferenceIndex,
      background: newRefSlide?.background,
      images: newRefSlide?.images || [],
      videos: newRefSlide?.videos || [],
      audios: newRefSlide?.audios || [],
      text: newRefSlide?.text || [],
    },
    newSlideIndex: atIndex + 1,
  };
}

/**
 * Delete a slide at the specified index
 */
export function deleteSlide(
  template: PresentationTemplate,
  atIndex: number,
  referenceSlideIndex: number
): { updatedTemplate: PresentationTemplate; newSlideIndex: number } {
  const slides = template.slides || [];

  if (slides.length <= 1) {
    return { updatedTemplate: template, newSlideIndex: 0 };
  }

  const newSlides = slides.filter((_, idx) => idx !== atIndex);

  // Adjust reference slide index
  let newReferenceIndex = referenceSlideIndex;
  if (atIndex === referenceSlideIndex) {
    newReferenceIndex = 0;
  } else if (atIndex < referenceSlideIndex) {
    newReferenceIndex = referenceSlideIndex - 1;
  }

  const newRefSlide = newSlides[newReferenceIndex] || newSlides[0];

  return {
    updatedTemplate: {
      ...template,
      slides: newSlides,
      referenceSlideIndex: newReferenceIndex,
      background: newRefSlide?.background,
      images: newRefSlide?.images || [],
      videos: newRefSlide?.videos || [],
      audios: newRefSlide?.audios || [],
      text: newRefSlide?.text || [],
    },
    newSlideIndex: Math.min(atIndex, newSlides.length - 1),
  };
}

/**
 * Move a slide up in the list
 */
export function moveSlideUp(
  template: PresentationTemplate,
  atIndex: number,
  referenceSlideIndex: number
): { updatedTemplate: PresentationTemplate; newSlideIndex: number } {
  const slides = template.slides || [];

  if (atIndex === 0) {
    return { updatedTemplate: template, newSlideIndex: atIndex };
  }

  const newSlides = [...slides];
  [newSlides[atIndex - 1], newSlides[atIndex]] = [newSlides[atIndex], newSlides[atIndex - 1]];

  // Adjust reference slide index
  let newReferenceIndex = referenceSlideIndex;
  if (atIndex === referenceSlideIndex) {
    newReferenceIndex = atIndex - 1;
  } else if (atIndex - 1 === referenceSlideIndex) {
    newReferenceIndex = atIndex;
  }

  const newRefSlide = newSlides[newReferenceIndex] || newSlides[0];

  return {
    updatedTemplate: {
      ...template,
      slides: newSlides,
      referenceSlideIndex: newReferenceIndex,
      background: newRefSlide?.background,
      images: newRefSlide?.images || [],
      videos: newRefSlide?.videos || [],
      audios: newRefSlide?.audios || [],
      text: newRefSlide?.text || [],
    },
    newSlideIndex: atIndex - 1,
  };
}

/**
 * Move a slide down in the list
 */
export function moveSlideDown(
  template: PresentationTemplate,
  atIndex: number,
  referenceSlideIndex: number
): { updatedTemplate: PresentationTemplate; newSlideIndex: number } {
  const slides = template.slides || [];

  if (atIndex >= slides.length - 1) {
    return { updatedTemplate: template, newSlideIndex: atIndex };
  }

  const newSlides = [...slides];
  [newSlides[atIndex], newSlides[atIndex + 1]] = [newSlides[atIndex + 1], newSlides[atIndex]];

  // Adjust reference slide index
  let newReferenceIndex = referenceSlideIndex;
  if (atIndex === referenceSlideIndex) {
    newReferenceIndex = atIndex + 1;
  } else if (atIndex + 1 === referenceSlideIndex) {
    newReferenceIndex = atIndex;
  }

  const newRefSlide = newSlides[newReferenceIndex] || newSlides[0];

  return {
    updatedTemplate: {
      ...template,
      slides: newSlides,
      referenceSlideIndex: newReferenceIndex,
      background: newRefSlide?.background,
      images: newRefSlide?.images || [],
      videos: newRefSlide?.videos || [],
      audios: newRefSlide?.audios || [],
      text: newRefSlide?.text || [],
    },
    newSlideIndex: atIndex + 1,
  };
}

/**
 * Set a slide as the reference slide
 */
export function setAsReferenceSlide(
  template: PresentationTemplate,
  atIndex: number
): PresentationTemplate {
  const slides = template.slides || [];
  const newRefSlide = slides[atIndex];

  if (!newRefSlide) {
    return template;
  }

  return {
    ...template,
    referenceSlideIndex: atIndex,
    background: newRefSlide.background,
    images: newRefSlide.images || [],
    videos: newRefSlide.videos || [],
    audios: newRefSlide.audios || [],
    text: newRefSlide.text || [],
  };
}

/**
 * Reorder slides via drag and drop
 */
export function reorderSlides(
  template: PresentationTemplate,
  fromIndex: number,
  toIndex: number,
  referenceSlideIndex: number
): { updatedTemplate: PresentationTemplate; newSlideIndex: number; newReferenceIndex: number } {
  const slides = template.slides || [];

  if (fromIndex === toIndex) {
    return { 
      updatedTemplate: template, 
      newSlideIndex: toIndex,
      newReferenceIndex: referenceSlideIndex 
    };
  }

  const newSlides = [...slides];
  const [movedSlide] = newSlides.splice(fromIndex, 1);
  newSlides.splice(toIndex, 0, movedSlide);

  // Adjust reference slide index
  let newReferenceIndex = referenceSlideIndex;
  if (fromIndex === referenceSlideIndex) {
    newReferenceIndex = toIndex;
  } else if (fromIndex < referenceSlideIndex && toIndex >= referenceSlideIndex) {
    newReferenceIndex = referenceSlideIndex - 1;
  } else if (fromIndex > referenceSlideIndex && toIndex <= referenceSlideIndex) {
    newReferenceIndex = referenceSlideIndex + 1;
  }

  const newRefSlide = newSlides[newReferenceIndex] || newSlides[0];

  return {
    updatedTemplate: {
      ...template,
      slides: newSlides,
      referenceSlideIndex: newReferenceIndex,
      background: newRefSlide?.background,
      images: newRefSlide?.images || [],
      videos: newRefSlide?.videos || [],
      audios: newRefSlide?.audios || [],
      text: newRefSlide?.text || [],
    },
    newSlideIndex: toIndex,
    newReferenceIndex,
  };
}
