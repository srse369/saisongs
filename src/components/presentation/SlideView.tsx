import React from 'react';
import type { Slide, PresentationTemplate, TemplateSlide } from '../../types';
import { formatPitch } from '../../utils/pitchUtils';
import { getBackgroundStyles, getSlideBackgroundStyles, getReferenceSlide, TemplateBackground, TemplateImages, TemplateVideos, TemplateText, SlideBackground, SlideImages, SlideVideos, SlideText } from '../../utils/templateUtils';

interface SlideViewProps {
  slide: Slide;
  showTranslation?: boolean;
  template?: PresentationTemplate | null;
}

export const SlideView: React.FC<SlideViewProps> = ({ slide, showTranslation = true, template }) => {
  const sessionSongIndex = (slide as any).sessionSongIndex;
  const totalSongs = (slide as any).totalSongs;
  
  // Check if this is a static slide (template-only, no song content)
  const isStaticSlide = slide.slideType === 'static';
  
  // For static slides, use the templateSlide directly
  // For song slides, use the reference slide from the template
  const effectiveSlide: TemplateSlide | undefined = isStaticSlide 
    ? slide.templateSlide 
    : (template ? getReferenceSlide(template) : undefined);
  
  // Calculate dynamic font size based on number of lines
  const lyricsLines = slide.content.split('\n').length;
  const getLyricsFontSize = () => {
    if (lyricsLines <= 4) return 'text-3xl sm:text-3xl md:text-4xl lg:text-4xl';
    if (lyricsLines <= 6) return 'text-2xl sm:text-3xl md:text-3xl lg:text-4xl';
    if (lyricsLines <= 8) return 'text-2xl sm:text-2xl md:text-3xl lg:text-3xl';
    if (lyricsLines <= 10) return 'text-xl sm:text-2xl md:text-2xl lg:text-3xl';
    return 'text-lg sm:text-xl md:text-xl lg:text-2xl';
  };
  
  // Calculate translation font size (if translation exists)
  const translationLines = slide.translation ? slide.translation.split(/\n|<br\s*\/?>/i).length : 0;
  const getTranslationFontSize = () => {
    if (translationLines <= 2) return 'text-xl sm:text-xl md:text-2xl lg:text-2xl';
    if (translationLines <= 4) return 'text-lg sm:text-xl md:text-xl lg:text-2xl';
    return 'text-base sm:text-lg md:text-lg lg:text-xl';
  };
  
  const hasTranslation = showTranslation && slide.translation;
  
  // Get background styles - for static slides use templateSlide, for song slides use reference slide
  const backgroundStyles = isStaticSlide && slide.templateSlide 
    ? getSlideBackgroundStyles(slide.templateSlide)
    : getBackgroundStyles(template);
  
  // Static slide - render only template elements, no song content
  if (isStaticSlide && slide.templateSlide) {
    return (
      <div 
        className="presentation-slide relative overflow-hidden" 
        style={{
          ...backgroundStyles,
          width: '100%',
          height: '100%',
        }}
      >
        {/* Static slide background */}
        <SlideBackground templateSlide={slide.templateSlide} />
        
        {/* Static slide overlays */}
        <SlideImages templateSlide={slide.templateSlide} />
        <SlideVideos templateSlide={slide.templateSlide} />
        <SlideText templateSlide={slide.templateSlide} />
      </div>
    );
  }
  
  // Song slide - render song content with template styling
  return (
    <div 
      className="presentation-slide relative overflow-hidden" 
      style={{
        ...backgroundStyles,
        width: '100%',
        height: '100%',
      }}
    >
      {/* Template background elements (from reference slide) */}
      {effectiveSlide ? (
        <SlideBackground templateSlide={effectiveSlide} />
      ) : (
        <TemplateBackground template={template} />
      )}
      
      {/* Song number and slide position at top-left */}
      {(sessionSongIndex || (slide.songSlideCount && slide.songSlideCount > 1 && slide.songSlideNumber)) && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 text-[0.95rem] sm:text-[1rem] text-blue-100/80 bg-gray-800/25 rounded-lg px-2 py-1 z-[1000] opacity-50">
          {sessionSongIndex && totalSongs && (
            <div>Song {sessionSongIndex}/{totalSongs}</div>
          )}
          {slide.songSlideCount && slide.songSlideCount > 1 && slide.songSlideNumber && (
            <div>Slide {slide.songSlideNumber}/{slide.songSlideCount}</div>
          )}
        </div>
      )}

      {/* Song name at top - 15% of screen */}
      <div className="w-full max-w-6xl border-2 border-blue-400/[0.03] rounded-lg p-2 sm:p-3 relative z-5" style={{ height: '15%' }}>
        <div className="h-full flex items-center justify-center">
          <h1 className="presentation-title">
            {slide.songName}
          </h1>
        </div>
      </div>

      {/* Main content area - 60% (with translation) or 80% (without) */}
      <div 
        className="w-full max-w-6xl px-2 sm:px-4 presentation-main overflow-auto relative z-5"
        style={{ height: hasTranslation ? '60%' : '80%' }}
      >
        {/* Original lyrics */}
        <div className="border-2 border-blue-400/[0.03] rounded-lg p-3 sm:p-4 w-full h-full flex items-start justify-center">
          <p className={`text-center font-bold leading-relaxed whitespace-pre-wrap ${getLyricsFontSize()}`} style={{ color: 'inherit' }}>
            {slide.content}
          </p>
        </div>
      </div>

      {/* Translation (if available and showTranslation is true) - 25% of screen */}
      {hasTranslation && slide.translation && (
        <div className="w-full max-w-6xl px-2 sm:px-4 overflow-auto relative z-5" style={{ height: '25%' }}>
          <div className="border-2 border-blue-400/[0.03] rounded-lg p-3 sm:p-4 w-full h-full flex items-start justify-center">
            <div 
              className={`text-center leading-relaxed ${getTranslationFontSize()}`}
              style={{ color: 'inherit' }}
              dangerouslySetInnerHTML={{ __html: slide.translation }}
            />
          </div>
        </div>
      )}

      {/* Singer / pitch (when available) at bottom-left */}
      {(slide.singerName || slide.pitch) && (
        <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 text-[0.95rem] sm:text-[1rem] text-blue-100/70 z-[1000] opacity-50">
          {slide.singerName && (
            <span>
              Singer: {slide.singerName}
            </span>
          )}
          {slide.singerName && slide.pitch && <span className="mx-1">•</span>}
          {slide.pitch && (
            <span>
              Pitch: <span className="font-bold">
                {slide.pitch.includes(' / ') 
                  ? slide.pitch.split(' / ').map(p => formatPitch(p.trim())).join(' / ')
                  : formatPitch(slide.pitch)
                }
              </span> ({slide.pitch.replace('#', '♯')})
            </span>
          )}
        </div>
      )}

      {/* Next-song hint at bottom-right */}
      {slide.nextSongName && (
        <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 text-right z-[1000] opacity-50">
          <div className="text-[0.95rem] sm:text-[1rem] text-blue-100/80">
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

      {/* Template overlays (from reference slide) */}
      {effectiveSlide ? (
        <>
          <SlideImages templateSlide={effectiveSlide} />
          <SlideVideos templateSlide={effectiveSlide} />
          <SlideText templateSlide={effectiveSlide} />
        </>
      ) : (
        <>
          <TemplateImages template={template} />
          <TemplateVideos template={template} />
          <TemplateText template={template} />
        </>
      )}
    </div>
  );
};
