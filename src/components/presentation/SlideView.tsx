import React from 'react';
import type { Slide } from '../../types';

interface SlideViewProps {
  slide: Slide;
  showTranslation?: boolean;
}

export const SlideView: React.FC<SlideViewProps> = ({ slide, showTranslation = true }) => {
  return (
    <div className="presentation-slide">
      {/* Per-song slide position (when applicable) at top-left */}
      {slide.songSlideCount && slide.songSlideCount > 1 && slide.songSlideNumber && (
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-[0.7rem] sm:text-xs text-blue-100/80">
          {slide.songSlideNumber} / {slide.songSlideCount}
        </div>
      )}

      {/* Song name at top */}
      <div className="w-full max-w-6xl mb-4 sm:mb-6 md:mb-8 lg:mb-10">
        <h1 className="presentation-title">
          {slide.songName}
        </h1>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl px-2 sm:px-4 presentation-main">
        {/* Original lyrics */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <p className="presentation-content">
            {slide.content}
          </p>
        </div>

        {/* Translation (if available and showTranslation is true) */}
        {showTranslation && slide.translation && (
          <div className="mt-4 sm:mt-6 md:mt-8 pt-4 sm:pt-6 md:pt-8 border-t-2 border-blue-400/30 w-full">
            <p className="presentation-translation">
              {slide.translation}
            </p>
          </div>
        )}
      </div>

      {/* Singer / pitch (when available) at bottom-left */}
      {(slide.singerName || slide.pitch) && (
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 text-[0.7rem] sm:text-xs text-blue-100/70">
          {slide.singerName && (
            <span>
              Singer: {slide.singerName}
            </span>
          )}
          {slide.singerName && slide.pitch && <span className="mx-1">•</span>}
          {slide.pitch && (
            <span>
              Pitch: {slide.pitch}
            </span>
          )}
        </div>
      )}

      {/* Slide indicator and next-song hint at bottom-right */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 text-right space-y-1">
        {slide.nextSongName && (
          <div className="text-[0.7rem] sm:text-xs text-blue-100/80">
            {slide.nextIsContinuation ? (
              <>Next: {slide.nextSongName} (contd.)</>
            ) : (
              <>
                Next: {slide.nextSongName}
                {slide.nextSingerName && <> — {slide.nextSingerName}</>}
                {slide.nextPitch && <> — {slide.nextPitch}</>}
              </>
            )}
          </div>
        )}
        <div className="text-blue-200/60 text-sm sm:text-base">
          Slide {slide.index + 1}
        </div>
      </div>
    </div>
  );
};
