import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { SlideView } from './SlideView';
import { getSlideBackgroundStyles, SlideBackground, SlideImages, SlideVideos, SlideAudios, SlideText } from '../../utils/templateUtils';
import type { Slide, TemplateSlide, PresentationTemplate } from '../../types';
import { Tooltip } from '../common';

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
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
}

export interface PresentationModalHandle {
  isChromeHidden: boolean;
  exitChromeHideMode: () => void;
}

export const PresentationModal = forwardRef<PresentationModalHandle, PresentationModalProps>(({
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
  onZoomIn,
  onZoomOut,
  onZoomReset,
}, ref) => {
  const [scale, setScale] = useState(1);
  const [cssFullscreenMode, setCssFullscreenMode] = useState(false); // Fallback for iOS
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [showNavButtons, setShowNavButtons] = useState(true);
  const navButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Control audio playback based on current slide
  useEffect(() => {
    if (!template?.slides) return;
    
    // Collect all audio elements with their original slide index
    // Use compound key (slideIndex_audioId) to handle duplicate IDs across slides
    const allAudios: Array<{ audio: any; originalSlideIndex: number; uniqueKey: string }> = [];
    template.slides.forEach((slide, slideIndex) => {
      (slide.audios || []).forEach((audio) => {
        const uniqueKey = `${slideIndex}_${audio.id}`;
        allAudios.push({ audio, originalSlideIndex: slideIndex, uniqueKey });
      });
    });
    
    // Current slide as 1-based number for comparison
    const currentSlideNumber = currentSlideIndex + 1;
    
    // Control playback for each audio based on current slide
    allAudios.forEach(({ audio, originalSlideIndex, uniqueKey }) => {
      const audioElement = audioRefs.current.get(uniqueKey);
      if (!audioElement) return;
      
      // If playAcrossAllSlides is true, play on all slides (never stop based on slide index)
      if (audio.playAcrossAllSlides) {
        if (audioElement.paused && audio.autoPlay !== false) {
          audioElement.play().catch(err => console.warn('Audio play failed:', err));
        }
        return; // Don't apply slide range logic
      }
      
      // Use 1-based slide numbers (startSlide/endSlide)
      // Default: start from template slide position, play to end of presentation
      const startSlideNum = audio.startSlide ?? (originalSlideIndex + 1);
      const endSlideNum = audio.endSlide ?? slides.length;
      
      const shouldPlay = currentSlideNumber >= startSlideNum && currentSlideNumber <= endSlideNum;
      
      // Only auto-play if the audio has autoPlay enabled
      if (shouldPlay && audioElement.paused && audio.autoPlay !== false) {
        audioElement.play().catch(err => console.warn('Audio play failed:', err));
      } else if (!shouldPlay && !audioElement.paused) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    });
  }, [currentSlideIndex, template?.slides, slides.length]);

  // Expose the hide UI state to parent component
  useImperativeHandle(ref, () => ({
    isChromeHidden: cssFullscreenMode,
    exitChromeHideMode: () => setCssFullscreenMode(false),
  }), [cssFullscreenMode]);

  // Auto-hide navigation buttons after 2 seconds
  const resetNavButtonTimeout = useCallback(() => {
    setShowNavButtons(true);
    
    if (navButtonTimeoutRef.current) {
      clearTimeout(navButtonTimeoutRef.current);
    }
    
    navButtonTimeoutRef.current = setTimeout(() => {
      setShowNavButtons(false);
    }, 2000);
  }, []);

  // Show nav buttons on mount and clean up timeout
  useEffect(() => {
    resetNavButtonTimeout();
    return () => {
      if (navButtonTimeoutRef.current) {
        clearTimeout(navButtonTimeoutRef.current);
      }
    };
  }, [resetNavButtonTimeout]);

  // Show nav buttons whenever slide changes
  useEffect(() => {
    resetNavButtonTimeout();
  }, [currentSlideIndex, resetNavButtonTimeout]);

  const aspectRatio = template?.aspectRatio || '16:9';
  const slideWidth = aspectRatio === '4:3' ? 1600 : 1920;
  const slideHeight = aspectRatio === '4:3' ? 1200 : 1080;

  // Calculate scale
  useEffect(() => {
    const calculateScale = () => {
      if (isFullscreen || cssFullscreenMode) {
        // In fullscreen or CSS fullscreen mode, use full window dimensions
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
  }, [slideWidth, slideHeight, isFullscreen, cssFullscreenMode]);

  // Keyboard navigation (can be disabled when parent handles it)
  useEffect(() => {
    if (!isOpen || disableKeyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // If in CSS fullscreen mode, exit that first
        if (cssFullscreenMode) {
          setCssFullscreenMode(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        resetNavButtonTimeout(); // Show nav buttons when user navigates
        onSlideChange(Math.max(0, currentSlideIndex - 1));
      } else if (e.key === 'ArrowRight') {
        resetNavButtonTimeout(); // Show nav buttons when user navigates
        onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1));
      } else if (e.key === 'f' || e.key === 'F') {
        onFullscreenToggle?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, disableKeyboardNavigation, currentSlideIndex, slides.length, onClose, onSlideChange, onFullscreenToggle, cssFullscreenMode, resetNavButtonTimeout]);

  // Touch/swipe navigation for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    resetNavButtonTimeout(); // Show nav buttons when user touches screen
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }, [resetNavButtonTimeout]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // Only respond to horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right - go to previous slide
        onSlideChange(Math.max(0, currentSlideIndex - 1));
      } else {
        // Swipe left - go to next slide
        onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1));
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [currentSlideIndex, slides.length, onSlideChange]);

  const handleFullscreenToggle = useCallback(() => {
    if (onFullscreenToggle) {
      onFullscreenToggle();
    } else {
      const container = fullscreenContainerRef.current;
      if (!container) return;

      if (!document.fullscreenElement) {
        // Try standard fullscreen API first
        if (container.requestFullscreen) {
          container.requestFullscreen().catch((err) => {
            console.error('Fullscreen request failed:', err);
          });
        } else if ((container as any).webkitRequestFullscreen) {
          // Safari/iOS webkit prefix
          (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          // Firefox prefix
          (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          // IE/Edge prefix
          (container as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
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
    <div 
      data-presentation-modal="true"
      className={`${cssFullscreenMode ? 'fixed inset-0 z-50' : 'fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-2'}`}
      onClick={(e) => {
        // Only close on backdrop click if not in hide UI mode and click is on backdrop itself
        if (!cssFullscreenMode && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Background audio that plays across all slides */}
      {template?.backgroundAudio && (
        <audio
          key={template.backgroundAudio.id}
          src={template.backgroundAudio.url}
          autoPlay={template.backgroundAudio.autoPlay ?? true}
          loop={template.backgroundAudio.loop ?? true}
          style={{ display: 'none' }}
          ref={(el) => { if (el && template.backgroundAudio) el.volume = template.backgroundAudio.volume ?? 0.5; }}
        />
      )}
      
      <div className={`bg-white dark:bg-gray-900 ${cssFullscreenMode ? 'w-screen h-screen' : 'rounded-lg shadow-2xl w-full h-full max-w-full max-h-screen'} flex flex-col`}>
        {/* Header - Hidden in fullscreen or CSS fullscreen mode */}
        {!isFullscreen && !cssFullscreenMode && (
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 gap-2 min-h-0">
            <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white truncate">
                  {title}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
                  {slides.length > 1 
                    ? `Slide ${currentSlideIndex + 1} of ${slides.length} • Use arrow keys to navigate • Press Esc to close`
                    : 'Press Esc to close'}
                </p>
              </div>
              {/* Aspect ratio and dimensions info - Hide on small screens */}
              {template && (
                <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
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
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              {/* Custom top-right controls (e.g., template selector) */}
              {topRightControls}
              
              {/* Hide Chrome button - Hide all UI elements */}
              <button
                onClick={() => setCssFullscreenMode(!cssFullscreenMode)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
                aria-label={cssFullscreenMode ? "Show Chrome" : "Hide Chrome"}
                title={cssFullscreenMode ? "Show Chrome (slide + controls)" : "Hide Chrome (slide only)"}
              >
                <i className="fas fa-crop text-base md:text-lg"></i>
              </button>
              
              {/* Fullscreen toggle button */}
              <button
                onClick={handleFullscreenToggle}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <i className="fas fa-compress text-base md:text-lg"></i>
                ) : (
                  <i className="fas fa-expand text-base md:text-lg"></i>
                )}
              </button>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (cssFullscreenMode) return; // Don't close if in hide UI mode
                  if (isFullscreen && document.fullscreenElement) {
                    document.exitFullscreen();
                  }
                  onClose();
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl md:text-2xl leading-none flex-shrink-0 p-1"
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
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseMove={resetNavButtonTimeout}
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
                  skipAudio={true}
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
                  <SlideImages templateSlide={currentSlide as TemplateSlide} slideWidth={slideWidth} slideHeight={slideHeight} />
                  <SlideVideos templateSlide={currentSlide as TemplateSlide} slideWidth={slideWidth} slideHeight={slideHeight} />
                  {/* Audio is handled by persistent audio refs at modal level, not here */}
                  <SlideText templateSlide={currentSlide as TemplateSlide} slideWidth={slideWidth} slideHeight={slideHeight} />
                </div>
              ) : null}
              
              {/* Multi-slide audio elements - overlaid on slide */}
              {template?.slides && template.slides.flatMap((slide, slideIndex) => 
                (slide.audios || []).map((audio) => {
                  // Use compound key to handle duplicate IDs across slides
                  const uniqueKey = `${slideIndex}_${audio.id}`;
                  const visualHidden = audio.visualHidden ?? false;
                  
                  // Determine if this audio should be visible on current slide
                  const currentSlideNumber = currentSlideIndex + 1;
                  const startSlideNum = audio.startSlide ?? (slideIndex + 1);
                  const endSlideNum = audio.endSlide ?? slides.length;
                  const isActiveOnCurrentSlide = audio.playAcrossAllSlides || 
                    (currentSlideNumber >= startSlideNum && currentSlideNumber <= endSlideNum);
                  
                  // Only show controls if not visualHidden AND audio is active on current slide
                  const showControls = !visualHidden && isActiveOnCurrentSlide;
                  
                  return (
                    <audio
                      key={uniqueKey}
                      data-audio-source="presentation-modal-multi-slide"
                      data-unique-key={uniqueKey}
                      ref={(el) => {
                        if (el) {
                          audioRefs.current.set(uniqueKey, el);
                        } else {
                          audioRefs.current.delete(uniqueKey);
                        }
                      }}
                      src={audio.url}
                      loop={audio.loop ?? false}
                      controls={showControls}
                      className="absolute"
                      style={{
                        display: showControls ? 'block' : 'none',
                        zIndex: audio.zIndex || 10000,
                        width: audio.width || `${Math.min(400, slideWidth * 0.3)}px`,
                        maxWidth: '90%',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                      }}
                    />
                  );
                })
              )}
              
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

              {/* On-slide Navigation Buttons - Auto-hide after 2 seconds */}
              {slides.length > 1 && (
                <div 
                  className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-[9999] ${
                    showNavButtons ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {/* Previous Button */}
                  {currentSlideIndex > 0 && (
                    <div
                      className="pointer-events-auto absolute left-0 top-0 bottom-0 w-24 md:w-32 flex items-center justify-start pl-4 cursor-pointer"
                      onMouseEnter={resetNavButtonTimeout}
                      onClick={() => {
                        onSlideChange(currentSlideIndex - 1);
                        resetNavButtonTimeout();
                      }}
                    >
                      <div className="bg-black/70 hover:bg-black/80 text-white rounded-full p-8 transition-all hover:scale-110 backdrop-blur-md pointer-events-none">
                        <i className="fas fa-chevron-left text-5xl"></i>
                      </div>
                    </div>
                  )}
                  
                  {/* Next Button */}
                  {currentSlideIndex < slides.length - 1 && (
                    <div
                      className="pointer-events-auto absolute right-0 top-0 bottom-0 w-24 md:w-32 flex items-center justify-end pr-4 cursor-pointer"
                      onMouseEnter={resetNavButtonTimeout}
                      onClick={() => {
                        onSlideChange(currentSlideIndex + 1);
                        resetNavButtonTimeout();
                      }}
                    >
                      <div className="bg-black/70 hover:bg-black/80 text-white rounded-full p-8 transition-all hover:scale-110 backdrop-blur-md pointer-events-none">
                        <i className="fas fa-chevron-right text-5xl"></i>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Close/Exit Button - Always visible like navigation buttons */}
              <div 
                className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-[9999] ${
                  showNavButtons ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div
                  className="pointer-events-auto absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 flex items-start justify-end pt-4 pr-4 cursor-pointer"
                  onMouseEnter={resetNavButtonTimeout}
                  onClick={() => {
                    if (cssFullscreenMode) {
                      setCssFullscreenMode(false);
                    } else if (isFullscreen && document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      onClose();
                    }
                    resetNavButtonTimeout();
                  }}
                >
                  <div className="bg-black/70 hover:bg-black/80 text-white rounded-full p-8 transition-all hover:scale-110 backdrop-blur-md pointer-events-none">
                    <i className="fas fa-times text-5xl"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Slide Navigation - Hidden in fullscreen */}
        {!isFullscreen && !cssFullscreenMode && (
          <div className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={() => onSlideChange(Math.max(0, currentSlideIndex - 1))}
            disabled={currentSlideIndex === 0}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-left text-lg"></i>
          </button>
          
          {/* Slide dots/indicators */}
          <div className="flex gap-2 mx-4">
            {slides.map((slide, idx) => {
              const slideTitle = isSlide(slide) ? (slide as Slide).songName : undefined;
              const isReferenceDot = referenceSlideIndex !== undefined && idx === referenceSlideIndex;
              
              return (
                <Tooltip
                  key={idx}
                  content={isReferenceDot ? `Slide ${idx + 1} (Reference) - Click to jump` : `Slide ${idx + 1}${slideTitle ? ` - ${slideTitle}` : ''} - Click to jump`}
                >
                  <button
                    onClick={() => onSlideChange(idx)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      idx === currentSlideIndex
                        ? 'bg-blue-500'
                        : isReferenceDot
                          ? 'bg-yellow-400 hover:bg-yellow-500'
                          : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                  />
                </Tooltip>
              );
            })}
          </div>
          
          <button
            onClick={() => onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1))}
            disabled={currentSlideIndex === slides.length - 1}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-right text-lg"></i>
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

        {/* Footer with Details - Hidden in fullscreen or CSS fullscreen mode */}
        {!isFullscreen && !cssFullscreenMode && (showDescription || footerContent) && (
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

        {/* Footer with Close Button - Hidden in fullscreen or CSS fullscreen mode */}
        {!isFullscreen && !cssFullscreenMode && (
          <div className="flex gap-2 justify-end items-center p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          {onZoomIn && onZoomOut && onZoomReset && (
            <div className="flex items-center gap-1 md:hidden mr-auto">
              <button onClick={(e) => { e.stopPropagation(); onZoomOut(); }} className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md" aria-label="Zoom out"><i className="fas fa-minus text-sm"></i></button>
              <button onClick={(e) => { e.stopPropagation(); onZoomReset(); }} className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md min-w-[28px] flex items-center justify-center" aria-label="Reset zoom"><span className="text-sm font-semibold">0</span></button>
              <button onClick={(e) => { e.stopPropagation(); onZoomIn(); }} className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md" aria-label="Zoom in"><i className="fas fa-plus text-sm"></i></button>
            </div>
          )}
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
});
