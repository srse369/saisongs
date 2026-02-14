import React, { useState, useEffect, useCallback } from 'react';
import { PresentationModal } from './PresentationModal';
import TemplateSelector from './TemplateSelector';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generatePresentationSlides } from '../../utils/slideUtils';
import type { Slide, Song, PresentationTemplate } from '../../types';
import apiClient from '../../services/ApiClient';
import templateService from '../../services/TemplateService';
import songService from '../../services/SongService';
import { normalizePitch } from '../../utils/pitchNormalization';
import { loadTemplateWithRetry } from '../../utils/templateRetry';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSongs } from '../../contexts/SongContext';
import { getSelectedTemplateId, setSelectedTemplateId, clearSelectedTemplateId } from '../../utils/cacheUtils';

interface PresentationModeProps {
  songId: string;
  onExit?: () => void;
}

// Content scale bounds
const MIN_CONTENT_SCALE = 0.5;
const MAX_CONTENT_SCALE = 1.5;
const CONTENT_SCALE_STEP = 0.1;

export const PresentationMode: React.FC<PresentationModeProps> = ({ songId, onExit }) => {
  const { songs } = useSongs();
  const navigate = useNavigate();
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
  
  // Always get templateId from localStorage, or use default if not set
  const persistedTemplateId = getSelectedTemplateId();
  const [selectedTemplateId, setSelectedTemplateIdState] = useState<string | undefined>(persistedTemplateId || undefined);
  
  // Wrapper to update both state and localStorage
  const updateSelectedTemplateId = (id: string | undefined) => {
    setSelectedTemplateIdState(id);
    if (id) {
      setSelectedTemplateId(id); // Save to localStorage utility function
    }
  };

  // Re-read persisted template when songId changes (in case it was updated in another preview)
  useEffect(() => {
    const currentPersisted = getSelectedTemplateId();
    if (currentPersisted && currentPersisted !== selectedTemplateId) {
      setSelectedTemplateIdState(currentPersisted);
    } else if (!currentPersisted && !selectedTemplateId && !activeTemplate) {
      // If no template in localStorage, load default template
      templateService.getDefaultTemplate().then(template => {
        if (template && template.id) {
          setSelectedTemplateIdState(template.id);
          setActiveTemplate(template);
          setSelectedTemplateId(template.id); // Persist default template
        }
      }).catch(err => {
        console.error('Error loading default template:', err);
      });
    }
  }, [songId, selectedTemplateId, activeTemplate]);

  // Load template and song data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Always get templateId from localStorage or state, fallback to default
        const currentPersistedTemplateId = getSelectedTemplateId();
        const effectiveTemplateId = currentPersistedTemplateId || selectedTemplateId;
        
        // Update state if we found a persisted template that's different
        if (currentPersistedTemplateId && currentPersistedTemplateId !== selectedTemplateId) {
          setSelectedTemplateIdState(currentPersistedTemplateId);
        }
        
        // Only skip reloading if we have BOTH template AND song with full data, and they match
        // Don't skip if we only have template but not song, or vice versa
        const hasFullSongData = songData?.id === songId && songData?.lyrics !== null && songData?.lyrics !== undefined;
        const hasMatchingTemplate = activeTemplate && activeTemplate.id === effectiveTemplateId;
        
        if (hasFullSongData && hasMatchingTemplate) {
          setLoading(false);
          return;
        }
        
        // Load template and song in parallel (template has retry for transient 500s)
        const loadTemplate = async (): Promise<PresentationTemplate | null> => {
          try {
            if (effectiveTemplateId) {
              return await templateService.getTemplate(effectiveTemplateId);
            }
            return await templateService.getDefaultTemplate();
          } catch (error) {
            console.error('Error loading template:', error);
            const isNotFoundError = error instanceof Error && (
              error.message.includes('404') ||
              error.message.includes('Not Found') ||
              (error.message.includes('not found') && !error.message.includes('Failed to fetch'))
            );
            if (isNotFoundError && effectiveTemplateId && effectiveTemplateId === currentPersistedTemplateId) {
              clearSelectedTemplateId();
            }
            try {
              return await templateService.getDefaultTemplate();
            } catch (e) {
              console.error('Error loading default template:', e);
              return null;
            }
          }
        };

        const [template, song] = await Promise.all([
          loadTemplateWithRetry(loadTemplate),
          (async () => {
            // Try in-memory context first (same tab)
            const cachedSong = songs.find(s => s.id === songId);
            if (cachedSong && cachedSong.lyrics != null && cachedSong.lyrics !== undefined) {
              return cachedSong;
            }
            // Use SongService (checks localStorage cache, then API)
            return songService.getSongById(songId);
          })()
        ]);

        if (!song) {
          setError('Song not found');
          return;
        }

        setSongData(song);
        if (template) {
          setActiveTemplate(template);
          // Update state to match loaded template
          if (template.id && template.id !== selectedTemplateId) {
            setSelectedTemplateIdState(template.id);
          }
        } else {
          // Template failed after retries - try once more with reset (server may have recovered)
          try {
            apiClient.resetBackoff();
            const defaultTemplate = await templateService.getDefaultTemplate();
            if (defaultTemplate?.id) {
              setActiveTemplate(defaultTemplate);
              setSelectedTemplateIdState(defaultTemplate.id);
              if (!getSelectedTemplateId()) {
                setSelectedTemplateId(defaultTemplate.id);
              }
            }
          } catch (e) {
            console.error('Failed to load default template as fallback:', e);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load song');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [songId, selectedTemplateId]);

  // Set window title to include song name when loaded
  useEffect(() => {
    if (songData?.name) {
      const prev = document.title;
      document.title = `Sai Songs - ${songData.name}`;
      return () => { document.title = prev; };
    }
  }, [songData?.name]);

  // Generate slides when song or template changes (after initial load)
  useEffect(() => {
    if (!songData || !activeTemplate) {
      // Clear slides if we don't have both song and template
      setSlides([]);
      return;
    }

    // Determine which pitch and singer name to use
    let displayPitch = pitch;
    let displaySingerName = singerName;
    
    // If no singer pitch is provided, use reference pitches from the song
    // Normalize first (e.g. "2 Pancham / D" → "D") so SlideView's formatPitch works
    if (!pitch) {
      const gents = songData.refGents ? (normalizePitch(songData.refGents) || songData.refGents) : null;
      const ladies = songData.refLadies ? (normalizePitch(songData.refLadies) || songData.refLadies) : null;
      if (gents && ladies) {
        displaySingerName = 'Gents/Ladies';
        displayPitch = `${gents} / ${ladies}`;
      } else if (gents) {
        displaySingerName = 'Gents';
        displayPitch = gents;
      } else if (ladies) {
        displaySingerName = 'Ladies';
        displayPitch = ladies;
      }
    }

    // Generate slides using multi-slide template support if available
    // For single song preview, skip intro/outro static slides - only show song content
    try {
      const generatedSlides = generatePresentationSlides(
        songData,
        activeTemplate,
        displaySingerName,
        displayPitch,
        { skipStaticSlides: true }
      );
      
      if (generatedSlides.length === 0) {
        console.warn('Generated slides array is empty for song:', songData.name, 'Template:', activeTemplate.name);
      }
      
      setSlides(generatedSlides);
    } catch (error) {
      console.error('Error generating slides:', error, 'Song:', songData.name, 'Template:', activeTemplate.name);
      setSlides([]);
    }
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
            updateSelectedTemplateId(template.id);
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
