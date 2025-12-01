import React from 'react';
import type { Slide, PresentationTemplate, TemplateSlide, SongContentStyle } from '../../types';
import { DEFAULT_SONG_TITLE_STYLE, DEFAULT_SONG_LYRICS_STYLE, DEFAULT_SONG_TRANSLATION_STYLE } from '../../types';
import { formatPitch } from '../../utils/pitchUtils';
import { getBackgroundStyles, getSlideBackgroundStyles, getReferenceSlide, TemplateBackground, TemplateImages, TemplateVideos, TemplateText, SlideBackground, SlideImages, SlideVideos, SlideText } from '../../utils/templateUtils';
import { getFontFamily } from '../../utils/fonts';

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
  
  // Get song content styles from reference slide (or use defaults)
  const titleStyle: SongContentStyle = effectiveSlide?.songTitleStyle || DEFAULT_SONG_TITLE_STYLE;
  const lyricsStyle: SongContentStyle = effectiveSlide?.songLyricsStyle || DEFAULT_SONG_LYRICS_STYLE;
  const translationStyle: SongContentStyle = effectiveSlide?.songTranslationStyle || DEFAULT_SONG_TRANSLATION_STYLE;
  
  // Get slide dimensions for percentage calculations (default to 16:9 1920x1080)
  const slideWidth = 1920;
  const slideHeight = 1080;
  
  // Helper to convert pixel position to percentage, with fallback to legacy yPosition
  const getTopPosition = (style: SongContentStyle) => {
    if (style.y !== undefined) {
      return `${(style.y / slideHeight) * 100}%`;
    }
    return `${style.yPosition || 0}%`;
  };
  
  const getLeftPosition = (style: SongContentStyle) => {
    if (style.x !== undefined) {
      return `${(style.x / slideWidth) * 100}%`;
    }
    return '0';
  };
  
  const getWidth = (style: SongContentStyle) => {
    if (style.width !== undefined) {
      return `${(style.width / slideWidth) * 100}%`;
    }
    return '100%';
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

      {/* Song name - positioned using template style */}
      <div 
        className="absolute z-10"
        style={{ 
          top: getTopPosition(titleStyle),
          left: getLeftPosition(titleStyle),
          width: getWidth(titleStyle),
        }}
      >
        <h1 
          className="leading-tight"
          style={{ 
            fontSize: titleStyle.fontSize,
            fontWeight: titleStyle.fontWeight,
            fontStyle: titleStyle.fontStyle || 'normal',
            fontFamily: getFontFamily(titleStyle.fontFamily),
            textAlign: titleStyle.textAlign,
            color: titleStyle.color,
          }}
        >
          {slide.songName}
        </h1>
      </div>

      {/* Song lyrics - positioned using template style */}
      <div 
        className="absolute z-10 overflow-auto"
        style={{ 
          top: getTopPosition(lyricsStyle),
          left: getLeftPosition(lyricsStyle),
          width: getWidth(lyricsStyle),
          maxHeight: '60%',
        }}
      >
        <p 
          className="leading-tight whitespace-pre-wrap"
          style={{ 
            fontSize: lyricsStyle.fontSize,
            fontWeight: lyricsStyle.fontWeight,
            fontStyle: lyricsStyle.fontStyle || 'normal',
            fontFamily: getFontFamily(lyricsStyle.fontFamily),
            textAlign: lyricsStyle.textAlign,
            color: lyricsStyle.color,
          }}
        >
          {slide.content}
        </p>
      </div>

      {/* Translation (if available and showTranslation is true) - positioned using template style */}
      {hasTranslation && slide.translation && (
        <div 
          className="absolute z-10 overflow-auto"
          style={{ 
            top: getTopPosition(translationStyle),
            left: getLeftPosition(translationStyle),
            width: getWidth(translationStyle),
            maxHeight: '25%',
          }}
        >
          <div 
            className="leading-tight"
            style={{ 
              fontSize: translationStyle.fontSize,
              fontWeight: translationStyle.fontWeight,
              fontStyle: translationStyle.fontStyle || 'normal',
              fontFamily: getFontFamily(translationStyle.fontFamily),
              textAlign: translationStyle.textAlign,
              color: translationStyle.color,
            }}
            dangerouslySetInnerHTML={{ __html: slide.translation }}
          />
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
