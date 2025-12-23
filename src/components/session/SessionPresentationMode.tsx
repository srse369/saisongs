import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { PresentationModal, type PresentationModalHandle } from '../presentation/PresentationModal';
import TemplateSelector from '../presentation/TemplateSelector';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generateSessionPresentationSlides } from '../../utils/slideUtils';
import ApiClient from '../../services/ApiClient';
import templateService from '../../services/TemplateService';
import type { Slide, Song, PresentationTemplate } from '../../types';

interface SessionPresentationModeProps {
  onExit?: () => void;
}

// Content scale bounds
const MIN_CONTENT_SCALE = 0.5;
const MAX_CONTENT_SCALE = 1.5;
const CONTENT_SCALE_STEP = 0.1;

export const SessionPresentationMode: React.FC<SessionPresentationModeProps> = ({ onExit }) => {
  const [searchParams] = useSearchParams();
  const { entries } = useSession();
  const { songs } = useSongs();
  const { singers } = useSingers();
  const presentationModalRef = useRef<PresentationModalHandle>(null);

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
  const [contentScale, setContentScale] = useState(1.0);

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
                // Always load default template if no template specified
                const t = await templateService.getDefaultTemplate();
                if (t) {
                  setSelectedTemplateId(t.id);
                }
                return t;
              }
            } catch (error) {
              console.error('Error loading template:', error);
              // If error loading template, try to fall back to default
              try {
                const defaultTemplate = await templateService.getDefaultTemplate();
                if (defaultTemplate) {
                  setSelectedTemplateId(defaultTemplate.id);
                  return defaultTemplate;
                }
              } catch (e) {
                console.error('Error loading default template:', e);
              }
              return null;
            }
          })(),
          (async () => {
            // Get songs from context cache first, but verify they have full details
            const songPromises = entries.map(async (entry) => {
              const cachedSong = songs.find(s => s.id === entry.songId);
              // Check if cached song has full details (lyrics are loaded)
              if (cachedSong && cachedSong.lyrics !== null && cachedSong.lyrics !== undefined) {
                return cachedSong;
              }
              // Fetch from API to get full details (includes CLOB fields)
              return ApiClient.get<Song>(`/songs/${entry.songId}`);
            });
            const songsData = await Promise.all(songPromises);
            return songsData;
          })()
        ]);

        setSongsData(fullSongs);
        // Always ensure we have a template - use default if template is null
        if (template) {
          setActiveTemplate(template);
        } else {
          // If no template loaded, try one more time to get default
          try {
            const defaultTemplate = await templateService.getDefaultTemplate();
            if (defaultTemplate) {
              setActiveTemplate(defaultTemplate);
              setSelectedTemplateId(defaultTemplate.id);
            }
          } catch (e) {
            console.error('Failed to load default template as fallback:', e);
          }
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
          // If chrome is hidden, toggle it back on instead of exiting
          if (presentationModalRef.current?.isChromeHidden) {
            presentationModalRef.current?.exitChromeHideMode();
          } else {
            handleExitPresentation();
          }
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
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  const handleNavigate = (index: number) => {
    setCurrentSlideIndex(index);
  };

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

  return (
    <PresentationModal
      ref={presentationModalRef}
      isOpen={true}
      onClose={handleExitPresentation}
      title="Live Session Presentation"
      slides={slides}
      currentSlideIndex={currentSlideIndex}
      onSlideChange={handleNavigate}
      template={activeTemplate}
      onFullscreenToggle={toggleFullScreen}
      isFullscreen={isFullScreen}
      disableKeyboardNavigation={true}
      contentScale={contentScale}
      topRightControls={
        <TemplateSelector 
          currentTemplateId={selectedTemplateId}
          onTemplateSelect={(template) => {
            setSelectedTemplateId(template.id);
            setActiveTemplate(template);
            // Sync template selection to localStorage for the Live tab
            if (template.id) {
              try {
                localStorage.setItem('selectedSessionTemplateId', template.id);
              } catch (e) {
                // Silently ignore storage errors (e.g., quota exceeded on iOS)
                console.warn('Failed to save template selection to localStorage:', e);
              }
            }
          }}
          onExpandedChange={setTemplatePickerExpanded}
        />
      }
      footerContent={
        <div className="flex items-center justify-between">
          {currentSlide.songName && currentSlide.slideType !== 'static' ? (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">Current Song</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {currentSlide.songName}
                {currentSlide.singerName && ` • ${currentSlide.singerName}`}
                {currentSlide.pitch && ` • Pitch: ${currentSlide.pitch}`}
                {currentSlide.songSlideNumber && currentSlide.songSlideCount && 
                  ` • Slide ${currentSlide.songSlideNumber}/${currentSlide.songSlideCount}`}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                {entries.length} {entries.length === 1 ? 'song' : 'songs'} in session
              </p>
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <span>Font: {Math.round(contentScale * 100)}%</span>
            <span className="text-gray-400 dark:text-gray-500">(+/- to adjust, 0 to reset)</span>
          </div>
        </div>
      }
    />
  );
};


