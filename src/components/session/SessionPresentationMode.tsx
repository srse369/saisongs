import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { SlideView } from '../presentation/SlideView';
import { SlideNavigation } from '../presentation/SlideNavigation';
import TemplateSelector from '../presentation/TemplateSelector';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generateSlides, generateSessionPresentationSlides } from '../../utils/slideUtils';
import ApiClient from '../../services/ApiClient';
import templateService from '../../services/TemplateService';
import type { Slide, Song, PresentationTemplate } from '../../types';

interface SessionPresentationModeProps {
  onExit?: () => void;
}

export const SessionPresentationMode: React.FC<SessionPresentationModeProps> = ({ onExit }) => {
  const [searchParams] = useSearchParams();
  const { entries } = useSession();
  const { songs } = useSongs();
  const { singers } = useSingers();

  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [templatePickerExpanded, setTemplatePickerExpanded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<PresentationTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [songsData, setSongsData] = useState<Song[]>([]);
  const [presentationScale, setPresentationScale] = useState(1);

  // Load template and songs data on mount (in parallel to avoid flicker)
  useEffect(() => {
    if (entries.length === 0) {
      setError('No songs in session');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const templateId = searchParams.get('templateId');
        
        // Load template and songs in parallel
        const [template, fullSongs] = await Promise.all([
          (async () => {
            try {
              if (templateId) {
                const t = await templateService.getTemplate(templateId);
                setSelectedTemplateId(templateId);
                return t;
              } else {
                const t = await templateService.getDefaultTemplate();
                if (t) {
                  setSelectedTemplateId(t.id);
                }
                return t;
              }
            } catch (error) {
              console.error('Error loading template:', error);
              return null;
            }
          })(),
          (async () => {
        console.log('📥 Fetching full song details for presentation...');
        const songPromises = entries.map(entry => 
          ApiClient.get<Song>(`/songs/${entry.songId}`)
        );
            const songs = await Promise.all(songPromises);
            console.log(`✅ Fetched ${songs.length} songs with lyrics for presentation`);
            return songs;
          })()
        ]);

        setSongsData(fullSongs);
        if (template) {
          setActiveTemplate(template);
        }
      } catch (err) {
        console.error('Error fetching data for presentation:', err);
        setError(err instanceof Error ? err.message : 'Failed to load songs for presentation');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [entries, searchParams]);

  // Generate slides when data changes (after initial load)
  useEffect(() => {
    if (songsData.length === 0) return;

    // Build songs array with metadata for multi-slide template support
    const songsWithMetadata = entries.map((entry, index) => {
      const song = songsData[index];
      const singer = entry.singerId ? singers.find((si) => si.id === entry.singerId) : undefined;
      return {
        song: song!,
        singerName: singer?.name,
        pitch: entry.pitch,
      };
    }).filter(item => item.song); // Filter out any null songs

    // Generate slides using multi-slide template support
    const annotatedSlides = generateSessionPresentationSlides(
      songsWithMetadata,
      activeTemplate
    );

    setSlides(annotatedSlides);
    setCurrentSlideIndex(0);
  }, [songsData, entries, singers, activeTemplate]);

  // Auto-hide overlay after 2 seconds (but not when template picker is open)
  useEffect(() => {
    if (showOverlay && !templatePickerExpanded) {
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showOverlay, templatePickerExpanded]);

  // Handle keyboard navigation and mouse movement across slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show overlay on any key press
      setShowOverlay(true);
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ': // Space bar
          e.preventDefault();
          setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
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
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  const handleNavigate = (index: number) => {
    setCurrentSlideIndex(index);
    setShowOverlay(true); // Show overlay when clicking navigation buttons
  };

  // Calculate scale for the slide to mimic template preview behavior
  useEffect(() => {
    const calculateScale = () => {
      const aspectRatio = activeTemplate?.aspectRatio || '16:9';
      const baseWidth = aspectRatio === '4:3' ? 1600 : 1920;
      const baseHeight = aspectRatio === '4:3' ? 1200 : 1080;

      // Use window size as container, leaving a small padding
      const containerWidth = window.innerWidth - 64;
      const containerHeight = window.innerHeight - 96; // leave space for controls

      if (containerWidth <= 0 || containerHeight <= 0) {
        setPresentationScale(1);
        return;
      }

      const scale = Math.min(
        containerWidth / baseWidth,
        containerHeight / baseHeight,
        1
      );

      setPresentationScale(scale);
    };

    // Run once on mount / template change and on resize
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [activeTemplate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || slides.length === 0 || entries.length === 0) {
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

  // Calculate aspect ratio dimensions
  const aspectRatio = activeTemplate?.aspectRatio || '16:9';
  const slideWidth = aspectRatio === '4:3' ? 1600 : 1920;
  const slideHeight = aspectRatio === '4:3' ? 1200 : 1080;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black flex items-center justify-center">
      {/* Centered slide container using scaled wrapper, similar to template preview */}
      <div
        className="relative bg-black flex items-center justify-center"
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        {/* Wrapper with final scaled dimensions */}
        <div
          className="relative"
          style={{
            width: Math.round(slideWidth * presentationScale),
            height: Math.round(slideHeight * presentationScale),
          }}
        >
          {/* Scaled slide container */}
          <div
            className="absolute top-0 left-0 shadow-2xl"
            style={{
              width: slideWidth,
              height: slideHeight,
              transform: `scale(${presentationScale})`,
              transformOrigin: 'top left',
            }}
          >
        <SlideView slide={currentSlide} showTranslation={true} template={activeTemplate} />
          </div>
        </div>
      </div>

      {/* Navigation controls at bottom center - auto-hide after 2 seconds */}
      {showOverlay && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 transition-opacity duration-300">
          <SlideNavigation
            currentSlide={currentSlideIndex}
            totalSlides={slides.length}
            onNavigate={handleNavigate}
          />
        </div>
      )}

      {/* Control buttons - top right */}
      {showOverlay && (
        <div className="absolute top-4 right-4 z-[1000] flex gap-2 opacity-50 transition-opacity duration-300">
          {/* Template selector */}
          <TemplateSelector 
          currentTemplateId={selectedTemplateId}
          onTemplateSelect={(template) => {
            setSelectedTemplateId(template.id);
            setActiveTemplate(template);
              // Sync template selection to localStorage for the Live tab
              if (template.id) {
                localStorage.setItem('selectedSessionTemplateId', template.id);
              }
          }}
            onExpandedChange={setTemplatePickerExpanded}
        />

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullScreen}
          className="p-3 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg backdrop-blur-xs transition-colors"
          aria-label={isFullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullScreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
        >
          {isFullScreen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>

        {/* Exit button */}
        <button
          onClick={handleExitPresentation}
          className="p-3 bg-red-600/90 hover:bg-red-700 text-white rounded-lg backdrop-blur-xs transition-colors"
          aria-label="Exit presentation"
          title="Exit presentation (Esc)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        </div>
      )}

    </div>
  );
};


