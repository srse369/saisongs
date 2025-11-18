import React, { useState, useEffect, useCallback } from 'react';
import { SlideView } from './SlideView';
import { SlideNavigation } from './SlideNavigation';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { generateSlides } from '../../utils/slideUtils';
import type { Slide, Song } from '../../types';
import apiClient from '../../services/ApiClient';
import { useSearchParams } from 'react-router-dom';

interface PresentationModeProps {
  songId: string;
  onExit?: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({ songId, onExit }) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const singerName = searchParams.get('singerName') || undefined;
  const pitch = searchParams.get('pitch') || undefined;

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

        // Generate slides from the song data and attach optional singer/pitch (if provided)
        const baseSlides = generateSlides(song).map((slide) => ({
          ...slide,
          singerName,
          pitch,
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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        <SlideView slide={currentSlide} showTranslation={true} />
      </div>

      {/* Navigation controls - hidden in fullscreen mode */}
      {!isFullScreen && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <SlideNavigation
            currentSlide={currentSlideIndex}
            totalSlides={slides.length}
            onNavigate={handleNavigate}
          />
        </div>
      )}

      {/* Control buttons - top right */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullScreen}
          className="p-3 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg backdrop-blur-sm transition-colors"
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
          className="p-3 bg-red-600/90 hover:bg-red-700 text-white rounded-lg backdrop-blur-sm transition-colors"
          aria-label="Exit presentation"
          title="Exit presentation (Esc)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Keyboard shortcuts hint - bottom left, hidden in fullscreen */}
      {!isFullScreen && (
        <div className="absolute bottom-8 left-8 z-10 text-white/70 text-sm bg-gray-800/70 backdrop-blur-sm px-4 py-2 rounded-lg">
          <p className="font-medium mb-1">Keyboard Shortcuts:</p>
          <p>← → : Navigate slides</p>
          <p>F : Toggle fullscreen</p>
          <p>Esc : Exit presentation</p>
        </div>
      )}
    </div>
  );
};
