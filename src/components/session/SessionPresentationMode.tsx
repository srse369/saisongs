import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { PresentationModal, type PresentationModalHandle } from '../presentation/PresentationModal';
import TemplateSelector from '../presentation/TemplateSelector';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generateSessionPresentationSlides } from '../../utils/slideUtils';
import ApiClient from '../../services/ApiClient';
import templateService from '../../services/TemplateService';
import { loadTemplateWithRetry } from '../../utils/templateRetry';
import { getSelectedTemplateId, setSelectedTemplateId, clearSelectedTemplateId } from '../../utils/cacheUtils';
import { openProjectorWindow } from '../../utils/projectorWindow';
import { PROJECTOR_SESSION_KEY } from '../../contexts/SessionContext';
import type { Slide, Song, PresentationTemplate } from '../../types';

interface SessionPresentationModeProps {
  onExit?: () => void;
}

// Content scale bounds
const MIN_CONTENT_SCALE = 0.5;
const MAX_CONTENT_SCALE = 1.5;
const CONTENT_SCALE_STEP = 0.1;

export const SessionPresentationMode: React.FC<SessionPresentationModeProps> = ({ onExit }) => {
  const navigate = useNavigate();
  const { entries } = useSession();
  const { songs } = useSongs();
  const { singers } = useSingers();
  const presentationModalRef = useRef<PresentationModalHandle>(null);
  const projectorWindowRef = useRef<Window | null>(null);

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

  // Close projector window on unmount (e.g. browser back, navigate away)
  useEffect(() => {
    return () => {
      if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
        projectorWindowRef.current.close();
      }
    };
  }, []);

  // Set tab title to "Sai Songs - Live", restore to "Sai Songs" on exit
  useEffect(() => {
    document.title = 'Sai Songs - Live';
    return () => { document.title = 'Sai Songs'; };
  }, []);

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
        // Always get templateId from localStorage, or use default if not set
        const persistedTemplateId = getSelectedTemplateId();
        const templateId = persistedTemplateId;
        
        // Load template and songs in parallel (template has retry for transient 500s)
        const loadTemplate = async () => {
          try {
            if (templateId) {
              const t = await templateService.getTemplate(templateId);
              if (t) {
                setSelectedTemplateId(templateId);
                return t;
              }
            } else {
              const t = await templateService.getDefaultTemplate();
              if (t?.id) {
                setSelectedTemplateId(t.id);
                return t;
              }
            }
          } catch (error) {
            console.error('Error loading template:', error);
            const isNotFoundError = error instanceof Error && (
              error.message.includes('404') ||
              error.message.includes('Not Found') ||
              (error.message.includes('not found') && !error.message.includes('Failed to fetch'))
            );
            if (isNotFoundError && templateId && templateId === persistedTemplateId) {
              clearSelectedTemplateId();
            }
            try {
              const defaultTemplate = await templateService.getDefaultTemplate();
              if (defaultTemplate?.id) {
                setSelectedTemplateId(defaultTemplate.id);
                return defaultTemplate;
              }
            } catch (e) {
              console.error('Error loading default template:', e);
            }
          }
          return null;
        };

        const [template, fullSongs] = await Promise.all([
          loadTemplateWithRetry(loadTemplate),
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
          // Ensure selectedTemplateId is always set to match the active template
          if (template.id && template.id !== selectedTemplateId) {
            setSelectedTemplateId(template.id);
          }
        } else {
          // Template failed after retries - try once more with reset (server may have recovered)
          try {
            ApiClient.resetBackoff();
            const defaultTemplate = await templateService.getDefaultTemplate();
            if (defaultTemplate?.id) {
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
  }, [entries]);

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
        singerGender: singer?.gender,
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
    // If we're the projector window, close the entire window
    const isProjector = new URLSearchParams(window.location.search).get('projector') === '1';
    if (isProjector) {
      window.close();
      return;
    }
    // Close projector window if open
    if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
      projectorWindowRef.current.close();
      projectorWindowRef.current = null;
    }
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  const handleZoomIn = useCallback(() => setContentScale(prev => Math.min(MAX_CONTENT_SCALE, prev + CONTENT_SCALE_STEP)), []);
  const handleZoomOut = useCallback(() => setContentScale(prev => Math.max(MIN_CONTENT_SCALE, prev - CONTENT_SCALE_STEP)), []);
  const handleZoomReset = useCallback(() => setContentScale(1.0), []);

  const handleProjectToSecondDisplay = useCallback(() => {
    try {
      window.localStorage.setItem(PROJECTOR_SESSION_KEY, JSON.stringify(entries));
      openProjectorWindow({ path: '/session/present?projector=1' }).then((win) => {
        projectorWindowRef.current = win ?? null;
        if (!win && typeof window !== 'undefined') {
          window.alert('Please allow popups for this site to open the projector window.');
        }
      });
    } catch (err) {
      console.error('Failed to open projector window:', err);
      window.alert('Failed to open projector window. Please try again.');
    }
  }, [entries]);

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
        <div className="flex gap-4">
          <button
            onClick={handleExitPresentation}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
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
      onProjectToSecondDisplay={handleProjectToSecondDisplay}
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
            // Persist template selection to localStorage for future previews
            if (template.id) {
              setSelectedTemplateId(template.id);
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


