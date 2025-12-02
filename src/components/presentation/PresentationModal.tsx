import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SlideView } from './SlideView';
import { getSlideBackgroundStyles, SlideBackground, SlideImages, SlideVideos, SlideAudios, SlideText } from '../../utils/templateUtils';
import type { Slide, TemplateSlide, PresentationTemplate } from '../../types';

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  slides: (Slide | TemplateSlide)[];
  currentSlideIndex: number;
  onSlideChange: (index: number) => void;
  template: PresentationTemplate | null;
  referenceSlideIndex?: number;
  showDescription?: boolean;
  description?: string;
  footerContent?: React.ReactNode;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  topRightControls?: React.ReactNode;
  /** When true, keyboard navigation is handled externally (parent component) */
  disableKeyboardNavigation?: boolean;
  /** Scale factor for song content (title, lyrics, translation). Default is 1.0 */
  contentScale?: number;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  isOpen,
  onClose,
  title,
  slides,
  currentSlideIndex,
  onSlideChange,
  template,
  referenceSlideIndex,
  showDescription = false,
  description,
  footerContent,
  onFullscreenToggle,
  isFullscreen = false,
  topRightControls,
  disableKeyboardNavigation = false,
  contentScale = 1.0,
}) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const aspectRatio = template?.aspectRatio || '16:9';
  const slideWidth = aspectRatio === '4:3' ? 1600 : 1920;
  const slideHeight = aspectRatio === '4:3' ? 1200 : 1080;

  // Calculate scale
  useEffect(() => {
    const calculateScale = () => {
      if (isFullscreen) {
        // In fullscreen, use full window dimensions
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;

        if (containerWidth <= 0 || containerHeight <= 0) {
          setScale(1);
          return;
        }

        const newScale = Math.min(
          containerWidth / slideWidth,
          containerHeight / slideHeight,
          1
        );

        setScale(newScale);
      } else {
        // Not fullscreen, account for UI chrome
        const containerWidth = window.innerWidth - 32;
        const containerHeight = window.innerHeight - 224;

        if (containerWidth <= 0 || containerHeight <= 0) {
          setScale(1);
          return;
        }

        const newScale = Math.min(
          containerWidth / slideWidth,
          containerHeight / slideHeight,
          1
        );

        setScale(newScale);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [slideWidth, slideHeight, isFullscreen]);

  // Keyboard navigation (can be disabled when parent handles it)
  useEffect(() => {
    if (!isOpen || disableKeyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onSlideChange(Math.max(0, currentSlideIndex - 1));
      } else if (e.key === 'ArrowRight') {
        onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1));
      } else if (e.key === 'f' || e.key === 'F') {
        onFullscreenToggle?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, disableKeyboardNavigation, currentSlideIndex, slides.length, onClose, onSlideChange, onFullscreenToggle]);

  const handleFullscreenToggle = useCallback(() => {
    if (onFullscreenToggle) {
      onFullscreenToggle();
    } else {
      const container = fullscreenContainerRef.current;
      if (!container) return;

      if (!document.fullscreenElement) {
        container.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  }, [onFullscreenToggle]);

  const isSlide = (slide: any): slide is Slide => {
    return 'songName' in slide || 'content' in slide;
  };

  const isTemplateSlide = (slide: any): slide is TemplateSlide => {
    return 'background' in slide;
  };

  if (!isOpen) return null;

  const currentSlide = slides[currentSlideIndex];
  const isReference = referenceSlideIndex !== undefined && currentSlideIndex === referenceSlideIndex;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-2">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full h-full max-w-full max-h-screen flex flex-col">
        {/* Header - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {title}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {slides.length > 1 
                    ? `Slide ${currentSlideIndex + 1} of ${slides.length} • Use arrow keys to navigate • Press Esc to close`
                    : 'Press Esc to close'}
                </p>
              </div>
              {/* Aspect ratio and dimensions info */}
              {template && (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                    aspectRatio === '4:3'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  }`}>
                    📐 {aspectRatio}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {slideWidth}×{slideHeight} → {Math.round(slideWidth * scale)}×{Math.round(slideHeight * scale)}px
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {/* Custom top-right controls (e.g., template selector) */}
              {topRightControls}
              
              {/* Fullscreen toggle button */}
              <button
                onClick={handleFullscreenToggle}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isFullscreen && document.fullscreenElement) {
                    document.exitFullscreen();
                  }
                  onClose();
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Preview Content - Shows current slide scaled to fit */}
        <div 
          ref={(el) => {
            (containerRef as any).current = el;
            (fullscreenContainerRef as any).current = el;
          }}
          className={`flex-1 overflow-hidden relative flex items-center justify-center bg-gray-900 ${isFullscreen ? 'p-0' : 'p-4'}`}
        >
          {/* Wrapper that has the final scaled dimensions */}
          <div 
            className="relative"
            style={{
              width: Math.round(slideWidth * scale),
              height: Math.round(slideHeight * scale),
            }}
          >
            {/* Scaled slide container - uses transform for crisp scaling */}
            <div 
              className="absolute top-0 left-0 shadow-2xl"
              style={{
                width: slideWidth,
                height: slideHeight,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {/* Render slide based on type */}
              {isSlide(currentSlide) ? (
                <SlideView 
                  slide={currentSlide as Slide}
                  showTranslation={true}
                  template={template}
                  contentScale={contentScale}
                />
              ) : isTemplateSlide(currentSlide) ? (
                <div 
                  className="presentation-slide relative overflow-hidden"
                  style={{
                    ...getSlideBackgroundStyles(currentSlide as TemplateSlide),
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <SlideBackground templateSlide={currentSlide as TemplateSlide} />
                  <SlideImages templateSlide={currentSlide as TemplateSlide} />
                  <SlideVideos templateSlide={currentSlide as TemplateSlide} />
                  <SlideAudios templateSlide={currentSlide as TemplateSlide} />
                  <SlideText templateSlide={currentSlide as TemplateSlide} />
                </div>
              ) : null}
              
              {/* Reference Slide Indicator Overlay */}
              {isReference && slides.length > 1 && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="bg-yellow-500/90 text-black px-6 py-3 rounded-lg text-2xl font-bold shadow-xl transform rotate-[-5deg] border-4 border-yellow-600">
                    🎯 Reference Slide
                  </div>
                </div>
              )}

              {/* Static Slide Indicator */}
              {referenceSlideIndex !== undefined && !isReference && slides.length > 1 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
                  <div className="bg-gray-700/80 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    {currentSlideIndex < referenceSlideIndex ? 'Intro Slide' : 'Outro Slide'} (Static)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Slide Navigation - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={() => onSlideChange(Math.max(0, currentSlideIndex - 1))}
            disabled={currentSlideIndex === 0}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Slide dots/indicators */}
          <div className="flex gap-2 mx-4">
            {slides.map((slide, idx) => {
              const slideTitle = isSlide(slide) ? (slide as Slide).songName : undefined;
              const isReferenceDot = referenceSlideIndex !== undefined && idx === referenceSlideIndex;
              
              return (
                <button
                  key={idx}
                  onClick={() => onSlideChange(idx)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    idx === currentSlideIndex
                      ? 'bg-blue-500'
                      : isReferenceDot
                        ? 'bg-yellow-400 hover:bg-yellow-500'
                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                  title={isReferenceDot ? `Slide ${idx + 1} (Reference)` : `Slide ${idx + 1}${slideTitle ? ` - ${slideTitle}` : ''}`}
                />
              );
            })}
          </div>
          
          <button
            onClick={() => onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1))}
            disabled={currentSlideIndex === slides.length - 1}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <span className="ml-4 text-sm text-gray-600 dark:text-gray-400">
            Slide {currentSlideIndex + 1} / {slides.length}
            {isReference && (
              <span className="ml-2 text-yellow-500 font-medium">⭐ Reference</span>
            )}
            {isSlide(currentSlide) && (currentSlide as Slide).songName && (
              <span className="ml-2 text-gray-500 dark:text-gray-400">• {(currentSlide as Slide).songName}</span>
            )}
          </span>
        </div>
        )}

        {/* Footer with Details - Hidden in fullscreen */}
        {!isFullscreen && (showDescription || footerContent) && (
          <div className="bg-white dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700 overflow-y-auto max-h-32 flex-shrink-0">
            <div className="grid grid-cols-1 gap-2 text-sm">
              {showDescription && description && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">Description</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {description}
                  </p>
                </div>
              )}
              {footerContent}
            </div>
          </div>
        )}

        {/* Footer with Close Button - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="flex gap-2 justify-end p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isFullscreen && document.fullscreenElement) {
                document.exitFullscreen();
              }
              onClose();
            }}
            className="px-4 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
        )}
      </div>
    </div>
  );
};
