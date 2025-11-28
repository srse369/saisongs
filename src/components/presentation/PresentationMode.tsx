import React, { useState, useEffect, useCallback } from 'react';
import { SlideView } from './SlideView';
import { SlideNavigation } from './SlideNavigation';
import TemplateSelector from './TemplateSelector';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generateSlides } from '../../utils/slideUtils';
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
  const [activeTemplate, setActiveTemplate] = useState<PresentationTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(templateId);

  const [searchParams] = useSearchParams();
  const singerName = searchParams.get('singerName') || undefined;
  const pitch = searchParams.get('pitch') || undefined;

  // Load template on mount or when templateId changes
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        if (selectedTemplateId) {
          const template = await templateService.getTemplate(selectedTemplateId);
          setActiveTemplate(template);
        } else {
          // Try to load default template
          const defaultTemplate = await templateService.getDefaultTemplate();
          if (defaultTemplate) {
            setActiveTemplate(defaultTemplate);
            setSelectedTemplateId(defaultTemplate.id);
          }
        }
      } catch (error) {
        console.error('Error loading template:', error);
        // Continue without template if loading fails
      }
    };

    loadTemplate();
  }, [selectedTemplateId]);

  // Load song and generate slides
  useEffect(() => {
    const loadSong = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch the song directly from the API to avoid interfering with global SongContext state
        const song = (await apiClient.getSong(songId)) as Song | null;
        if (!song) {
          setError('Song not found');
          return;
        }

        // Determine which pitch and singer name to use
        let displayPitch = pitch;
        let displaySingerName = singerName;
        
        // If no singer pitch is provided, use reference pitches from the song
        if (!pitch) {
          // If both reference pitches exist, show both
          if (song.referenceGentsPitch && song.referenceLadiesPitch) {
            displaySingerName = 'Gents/Ladies';
            displayPitch = `${song.referenceGentsPitch} / ${song.referenceLadiesPitch}`;
          } else if (song.referenceGentsPitch) {
            displaySingerName = 'Gents';
            displayPitch = song.referenceGentsPitch;
          } else if (song.referenceLadiesPitch) {
            displaySingerName = 'Ladies';
            displayPitch = song.referenceLadiesPitch;
          }
        }

        // Generate slides from the song data and attach optional singer/pitch (if provided)
        const baseSlides = generateSlides(song).map((slide) => ({
          ...slide,
          singerName: displaySingerName,
          pitch: displayPitch,
        }));

        // Attach "next" metadata for single-song presentation
        const generatedSlides = baseSlides.map((slide, index) => {
          const next = baseSlides[index + 1];
          if (!next) return slide;

          if (next.songName === slide.songName) {
            return {
              ...slide,
              nextSongName: slide.songName,
              nextIsContinuation: true,
            };
          }

          return {
            ...slide,
            nextSongName: next.songName,
            nextSingerName: next.singerName,
            nextPitch: next.pitch,
            nextIsContinuation: false,
          };
        });
        setSlides(generatedSlides);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load song');
      } finally {
        setLoading(false);
      }
    };

    loadSong();
  }, [songId, singerName, pitch]);

  // Auto-hide overlay after 2 seconds
  useEffect(() => {
    if (showOverlay) {
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showOverlay]);

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-900">
      {/* Slide view */}
      <div className="h-full w-full">
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
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {/* Template selector */}
        <TemplateSelector 
          currentTemplateId={selectedTemplateId}
          onTemplateSelect={(template) => {
            setSelectedTemplateId(template.id);
            setActiveTemplate(template);
          }}
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

    </div>
  );
};
