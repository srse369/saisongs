import React from 'react';
import type { Slide } from '../../types';

interface SlideViewProps {
  slide: Slide;
  showTranslation?: boolean;
}

export const SlideView: React.FC<SlideViewProps> = ({ slide, showTranslation = true }) => {
  return (
    <div className="presentation-slide">
      {/* Song name at top */}
      <div className="w-full max-w-6xl mb-4 sm:mb-6 md:mb-8 lg:mb-10">
        <h1 className="presentation-title">
          {slide.songName}
        </h1>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl px-2 sm:px-4">
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

      {/* Slide indicator at bottom */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 text-blue-200/60 text-sm sm:text-base">
        Slide {slide.index + 1}
      </div>
    </div>
  );
};
