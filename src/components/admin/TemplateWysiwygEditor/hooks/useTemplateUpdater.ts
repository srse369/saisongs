import { useCallback } from 'react';
import type { PresentationTemplate, TemplateSlide } from '../../../../types';

interface UseTemplateUpdaterProps {
  template: PresentationTemplate;
  onTemplateChange: (template: PresentationTemplate) => void;
}

/**
 * Custom hook to handle template state updates
 * Provides a helper to update slides while automatically syncing the reference slide
 */
export function useTemplateUpdater({ template, onTemplateChange }: UseTemplateUpdaterProps) {
  /**
   * Update the template with new slides and sync reference slide properties
   * This eliminates the repetitive pattern of syncing background, images, videos, audios, text
   * from the reference slide to the template root
   */
  const updateTemplateWithSlides = useCallback(
    (
      newSlides: TemplateSlide[],
      referenceSlideIndex: number,
      options?: {
        selectedSlideIndex?: number;
        useSelectedSlideAudios?: boolean;
      }
    ) => {
      const refSlide = newSlides[referenceSlideIndex] || newSlides[0];
      
      // Determine which audios to use:
      // - If selectedSlideIndex is the reference slide, use its audios
      // - Otherwise, use reference slide audios
      let audiosForTemplate = refSlide?.audios;
      if (options?.useSelectedSlideAudios && options?.selectedSlideIndex !== undefined) {
        const selectedSlide = newSlides[options.selectedSlideIndex];
        if (selectedSlide && options.selectedSlideIndex === referenceSlideIndex) {
          audiosForTemplate = selectedSlide.audios;
        }
      }

      onTemplateChange({
        ...template,
        slides: newSlides,
        background: refSlide?.background,
        images: refSlide?.images || [],
        videos: refSlide?.videos || [],
        audios: audiosForTemplate || [],
        text: refSlide?.text || [],
      });
    },
    [template, onTemplateChange]
  );

  /**
   * Update a specific slide by index
   */
  const updateSlide = useCallback(
    (
      slideIndex: number,
      updates: Partial<TemplateSlide> | ((slide: TemplateSlide) => TemplateSlide),
      referenceSlideIndex: number
    ) => {
      const slides = template.slides || [];
      const newSlides = [...slides];
      
      if (typeof updates === 'function') {
        newSlides[slideIndex] = updates(newSlides[slideIndex]);
      } else {
        newSlides[slideIndex] = {
          ...newSlides[slideIndex],
          ...updates,
        };
      }

      updateTemplateWithSlides(newSlides, referenceSlideIndex, {
        selectedSlideIndex: slideIndex,
        useSelectedSlideAudios: true,
      });
    },
    [template.slides, updateTemplateWithSlides]
  );

  return {
    updateTemplateWithSlides,
    updateSlide,
  };
}
