import React from 'react';
import type { Slide } from '../../types';
import { formatPitch } from '../../utils/pitchUtils';

interface SlideViewProps {
  slide: Slide;
  showTranslation?: boolean;
}

export const SlideView: React.FC<SlideViewProps> = ({ slide, showTranslation = true }) => {
  const sessionSongIndex = (slide as any).sessionSongIndex;
  const totalSongs = (slide as any).totalSongs;
  
  return (
    <div className="presentation-slide">
      {/* Song number and slide position at top-left */}
      {(sessionSongIndex || (slide.songSlideCount && slide.songSlideCount > 1 && slide.songSlideNumber)) && (
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-[1.05rem] sm:text-[1.125rem] text-blue-100/80 bg-gray-800/25 rounded-lg px-3 py-2">
          {sessionSongIndex && totalSongs && (
            <div>Song {sessionSongIndex}/{totalSongs}</div>
          )}
          {slide.songSlideCount && slide.songSlideCount > 1 && slide.songSlideNumber && (
            <div>Slide {slide.songSlideNumber}/{slide.songSlideCount}</div>
          )}
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
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 text-[1.05rem] sm:text-[1.125rem] text-blue-100/70">
          {slide.singerName && (
            <span>
              Singer: {slide.singerName}
            </span>
          )}
          {slide.singerName && slide.pitch && <span className="mx-1">•</span>}
          {slide.pitch && (
            <span>
              Pitch: <span className="font-bold">{formatPitch(slide.pitch)}</span> ({slide.pitch.replace('#', '♯')})
            </span>
          )}
        </div>
      )}

      {/* Next-song hint at bottom-right */}
      {slide.nextSongName && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 text-right">
          <div className="text-[1.05rem] sm:text-[1.125rem] text-blue-100/80">
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
        </div>
      )}
    </div>
  );
};
