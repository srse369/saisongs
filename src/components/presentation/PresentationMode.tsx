import React, { useState, useEffect, useCallback } from 'react';
import { SlideView } from './SlideView';
import { SlideNavigation } from './SlideNavigation';
import TemplateSelector from './TemplateSelector';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generateSlides, generatePresentationSlides } from '../../utils/slideUtils';
import type { Slide, Song, PresentationTemplate } from '../../types';
import apiClient from '../../services/ApiClient';
import templateService from '../../services/TemplateService';
import { useSearchParams } from 'react-router-dom';

interface PresentationModeProps {
  songId: string;
  onExit?: () => void;
  templateId?: string;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({ songId, onExit, templateId }) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [templatePickerExpanded, setTemplatePickerExpanded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<PresentationTemplate | null>(null);
  const [songData, setSongData] = useState<Song | null>(null);
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
        // Load template and song in parallel
        const [template, song] = await Promise.all([
          (async () => {
            try {
              if (selectedTemplateId) {
                return await templateService.getTemplate(selectedTemplateId);
              } else {
                return await templateService.getDefaultTemplate();
              }
            } catch (error) {
              console.error('Error loading template:', error);
              return null;
            }
          })(),
          apiClient.getSong(songId) as Promise<Song | null>
        ]);

        if (!song) {
          setError('Song not found');
          return;
        }

        setSongData(song);
        if (template) {
          setActiveTemplate(template);
          if (!selectedTemplateId) {
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
  }, [songId, selectedTemplateId]);

  // Generate slides when song or template changes (after initial load)
  useEffect(() => {
    if (!songData) return;

    // Determine which pitch and singer name to use
    let displayPitch = pitch;
    let displaySingerName = singerName;
    
    // If no singer pitch is provided, use reference pitches from the song
    if (!pitch) {
      // If both reference pitches exist, show both
      if (songData.referenceGentsPitch && songData.referenceLadiesPitch) {
        displaySingerName = 'Gents/Ladies';
        displayPitch = `${songData.referenceGentsPitch} / ${songData.referenceLadiesPitch}`;
      } else if (songData.referenceGentsPitch) {
        displaySingerName = 'Gents';
        displayPitch = songData.referenceGentsPitch;
      } else if (songData.referenceLadiesPitch) {
        displaySingerName = 'Ladies';
        displayPitch = songData.referenceLadiesPitch;
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

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
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

  // Calculate aspect ratio dimensions
  const aspectRatio = activeTemplate?.aspectRatio || '16:9';
  const slideWidth = aspectRatio === '4:3' ? 1600 : 1920;
  const slideHeight = aspectRatio === '4:3' ? 1200 : 1080;
  const aspectRatioValue = slideWidth / slideHeight;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black flex items-center justify-center">
      {/* Slide container with aspect ratio */}
      <div 
        className="relative bg-gray-900"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: `calc(100vh * ${aspectRatioValue})`,
          maxHeight: `calc(100vw / ${aspectRatioValue})`,
          aspectRatio: `${slideWidth} / ${slideHeight}`,
        }}
      >
        <SlideView slide={currentSlide} showTranslation={true} template={activeTemplate} />
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
