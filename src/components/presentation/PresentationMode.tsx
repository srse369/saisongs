import React, { useState, useEffect, useCallback } from 'react';
import { PresentationModal } from './PresentationModal';
import TemplateSelector from './TemplateSelector';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generatePresentationSlides } from '../../utils/slideUtils';
import type { Slide, Song, PresentationTemplate } from '../../types';
import apiClient from '../../services/ApiClient';
import templateService from '../../services/TemplateService';
import { useSearchParams } from 'react-router-dom';
import { useSongs } from '../../contexts/SongContext';

interface PresentationModeProps {
  songId: string;
  onExit?: () => void;
  templateId?: string;
}

// Content scale bounds
const MIN_CONTENT_SCALE = 0.5;
const MAX_CONTENT_SCALE = 1.5;
const CONTENT_SCALE_STEP = 0.1;

export const PresentationMode: React.FC<PresentationModeProps> = ({ songId, onExit, templateId }) => {
  const { songs } = useSongs();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [templatePickerExpanded, setTemplatePickerExpanded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<PresentationTemplate | null>(null);
  const [songData, setSongData] = useState<Song | null>(null);
  const [contentScale, setContentScale] = useState(1.0);
  const [searchParams] = useSearchParams();
  const singerName = searchParams.get('singerName') || undefined;
  const pitch = searchParams.get('pitch') || undefined;
  // Read templateId from URL params if not provided as prop
  const urlTemplateId = searchParams.get('templateId') || undefined;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(templateId || urlTemplateId);

  // Update selectedTemplateId when URL param or prop changes
  useEffect(() => {
    const newTemplateId = templateId || urlTemplateId;
    if (newTemplateId && newTemplateId !== selectedTemplateId) {
      setSelectedTemplateId(newTemplateId);
    }
  }, [templateId, urlTemplateId]);

  // Load template and song data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get templateId from prop, URL params, or state (in that order of priority)
        const effectiveTemplateId = templateId || urlTemplateId || selectedTemplateId;
        
        // Load template and song in parallel
        const [template, song] = await Promise.all([
          (async () => {
            try {
              if (effectiveTemplateId) {
                return await templateService.getTemplate(effectiveTemplateId);
              } else {
                return await templateService.getDefaultTemplate();
              }
            } catch (error) {
              console.error('Error loading template:', error);
              return null;
            }
          })(),
          (async () => {
            // Try to get from context cache, but verify it has full details
            const cachedSong = songs.find(s => s.id === songId);
            // Check if cached song has full details (lyrics are loaded)
            if (cachedSong && cachedSong.lyrics !== null && cachedSong.lyrics !== undefined) {
              return cachedSong;
            }
            // Fetch from API to get full details
            return apiClient.getSong(songId) as Promise<Song | null>;
          })()
        ]);

        if (!song) {
          setError('Song not found');
          return;
        }

        setSongData(song);
        if (template) {
          setActiveTemplate(template);
          // Update selectedTemplateId if we loaded a template and it's different
          if (template.id !== selectedTemplateId) {
            setSelectedTemplateId(template.id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load song');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [songId, templateId, urlTemplateId, selectedTemplateId]);

  // Generate slides when song or template changes (after initial load)
  useEffect(() => {
    if (!songData) return;

    // Determine which pitch and singer name to use
    let displayPitch = pitch;
    let displaySingerName = singerName;
    
    // If no singer pitch is provided, use reference pitches from the song
    if (!pitch) {
      // If both reference pitches exist, show both
      if (songData.refGents && songData.refLadies) {
        displaySingerName = 'Gents/Ladies';
        displayPitch = `${songData.refGents} / ${songData.refLadies}`;
      } else if (songData.refGents) {
        displaySingerName = 'Gents';
        displayPitch = songData.refGents;
      } else if (songData.refLadies) {
        displaySingerName = 'Ladies';
        displayPitch = songData.refLadies;
      }
    }

    // Generate slides using multi-slide template support if available
    // For single song preview, skip intro/outro static slides - only show song content
    const generatedSlides = generatePresentationSlides(
      songData,
      activeTemplate,
      displaySingerName,
      displayPitch,
      { skipStaticSlides: true }
    );
    
    setSlides(generatedSlides);
  }, [songData, singerName, pitch, activeTemplate]);

  // Auto-hide overlay after 2 seconds (but not when template picker is open)
  useEffect(() => {
    if (showOverlay && !templatePickerExpanded) {
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showOverlay, templatePickerExpanded]);

  // Handle keyboard navigation and mouse movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show overlay on any key press
      setShowOverlay(true);
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          setCurrentSlideIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ': // Space bar
          e.preventDefault();
          setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
          break;
        case 'Escape':
          e.preventDefault();
          handleExitPresentation();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentSlideIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentSlideIndex(slides.length - 1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullScreen();
          break;
        case '+':
        case '=': // = key (same key as + without shift on most keyboards)
          e.preventDefault();
          setContentScale(prev => Math.min(MAX_CONTENT_SCALE, prev + CONTENT_SCALE_STEP));
          break;
        case '-':
        case '_': // _ key (same key as - with shift)
          e.preventDefault();
          setContentScale(prev => Math.max(MIN_CONTENT_SCALE, prev - CONTENT_SCALE_STEP));
          break;
        case '0':
          // Reset to default scale
          e.preventDefault();
          setContentScale(1.0);
          break;
      }
    };

    const handleMouseMove = () => {
      // Show overlay on mouse movement
      setShowOverlay(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [slides.length]);

  // Handle fullscreen changes (with vendor prefixes for cross-browser support)
  useEffect(() => {
    const handleFullScreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullScreen(isFS);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
    };
  }, []);

  const toggleFullScreen = useCallback(async () => {
    try {
      const elem = document.documentElement as any;
      
      // Check if we're currently in fullscreen
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      if (!isCurrentlyFullscreen) {
        // Try to enter fullscreen with vendor prefixes
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          // Safari/iOS - note: iOS Safari doesn't support fullscreen for non-video elements
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        } else {
          // Fallback: No fullscreen API available (common on iOS)
          alert('Fullscreen is not supported on this device. For the best experience on iOS, add this page to your home screen.');
        }
      } else {
        // Exit fullscreen with vendor prefixes
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
      // On iOS Safari, fullscreen API throws an error
      alert('Fullscreen is not supported on this device. For the best experience, rotate your device to landscape mode.');
    }
  }, []);

  const handleExitPresentation = useCallback(async () => {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    // Call onExit callback if provided
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  const handleZoomIn = useCallback(() => setContentScale(prev => Math.min(MAX_CONTENT_SCALE, prev + CONTENT_SCALE_STEP)), []);
  const handleZoomOut = useCallback(() => setContentScale(prev => Math.max(MIN_CONTENT_SCALE, prev - CONTENT_SCALE_STEP)), []);
  const handleZoomReset = useCallback(() => setContentScale(1.0), []);

  const handleNavigate = (index: number) => {
    setCurrentSlideIndex(index);
    setShowOverlay(true); // Show overlay when clicking navigation buttons
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <p className="text-xl mb-4">{error || 'No slides available'}</p>
        <button
          onClick={handleExitPresentation}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  return (
    <PresentationModal
      isOpen={true}
      onClose={handleExitPresentation}
      title={songData?.name || 'Song Preview'}
      slides={slides}
      currentSlideIndex={currentSlideIndex}
      onSlideChange={handleNavigate}
      template={activeTemplate}
      onFullscreenToggle={toggleFullScreen}
      isFullscreen={isFullScreen}
      disableKeyboardNavigation={true}
      contentScale={contentScale}
      onZoomIn={handleZoomIn}
      onZoomOut={handleZoomOut}
      onZoomReset={handleZoomReset}
      topRightControls={
        <TemplateSelector 
          currentTemplateId={selectedTemplateId}
          onTemplateSelect={(template) => {
            setSelectedTemplateId(template.id);
            setActiveTemplate(template);
          }}
          onExpandedChange={setTemplatePickerExpanded}
        />
      }
      footerContent={
        <div className="flex items-center justify-between">
          {currentSlide.songName && currentSlide.slideType !== 'static' ? (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">Song Details</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {currentSlide.songName}
                {currentSlide.singerName && ` • ${currentSlide.singerName}`}
                {currentSlide.pitch && ` • Pitch: ${currentSlide.pitch}`}
                {currentSlide.songSlideNumber && currentSlide.songSlideCount && 
                  ` • Slide ${currentSlide.songSlideNumber}/${currentSlide.songSlideCount}`}
              </p>
            </div>
          ) : <div />}
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <span>Font: {Math.round(contentScale * 100)}%</span>
            <span className="text-gray-400 dark:text-gray-500">(+/- to adjust, 0 to reset)</span>
          </div>
        </div>
      }
    />
  );
};
