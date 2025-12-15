import React from 'react';
import type { Slide, PresentationTemplate, TemplateSlide, SongContentStyle } from '../../types';
import { DEFAULT_SONG_TITLE_STYLE, DEFAULT_SONG_LYRICS_STYLE, DEFAULT_SONG_TRANSLATION_STYLE } from '../../types';
import { formatPitch } from '../../utils/pitchUtils';
import { getBackgroundStyles, getSlideBackgroundStyles, getReferenceSlide, TemplateBackground, TemplateImages, TemplateVideos, TemplateAudios, TemplateText, SlideBackground, SlideImages, SlideVideos, SlideAudios, SlideText, renderStyledText } from '../../utils/templateUtils';
import { getFontFamily } from '../../utils/fonts';

interface SlideViewProps {
  slide: Slide;
  showTranslation?: boolean;
  template?: PresentationTemplate | null;
  /** Scale factor for song content (title, lyrics, translation). Default is 1.0 */
  contentScale?: number;
}

export const SlideView: React.FC<SlideViewProps> = ({ slide, showTranslation = true, template, contentScale = 1.0 }) => {
  const sessionSongIndex = (slide as any).sessionSongIndex;
  const totalSongs = (slide as any).totalSongs;
  
  // Check if this is a static slide (template-only, no song content)
  const isStaticSlide = slide.slideType === 'static';
  
  // For static slides, use the templateSlide directly
  // For song slides, use the reference slide from the template
  const effectiveSlide: TemplateSlide | undefined = isStaticSlide 
    ? slide.templateSlide 
    : (template ? getReferenceSlide(template) : undefined);
  
  // Get song content styles from reference slide (merge with defaults to ensure all properties exist)
  // Only override defaults with defined template values
  const titleStyle: SongContentStyle = { 
    ...DEFAULT_SONG_TITLE_STYLE, 
    ...(effectiveSlide?.songTitleStyle && Object.fromEntries(
      Object.entries(effectiveSlide.songTitleStyle).filter(([_, v]) => v !== undefined)
    ))
  };
  const lyricsStyle: SongContentStyle = { 
    ...DEFAULT_SONG_LYRICS_STYLE, 
    ...(effectiveSlide?.songLyricsStyle && Object.fromEntries(
      Object.entries(effectiveSlide.songLyricsStyle).filter(([_, v]) => v !== undefined)
    ))
  };
  const translationStyle: SongContentStyle = { 
    ...DEFAULT_SONG_TRANSLATION_STYLE, 
    ...(effectiveSlide?.songTranslationStyle && Object.fromEntries(
      Object.entries(effectiveSlide.songTranslationStyle).filter(([_, v]) => v !== undefined)
    ))
  };
  
  // Get slide dimensions based on template aspect ratio
  const slideWidth = template?.aspectRatio === '4:3' ? 1600 : 1920;
  const slideHeight = template?.aspectRatio === '4:3' ? 1200 : 1080;
  
  // Helper to convert pixel position to percentage, with fallback to legacy yPosition
  const getTopPosition = (style: SongContentStyle) => {
    if (style.y !== undefined) {
      return `${(style.y / slideHeight) * 100}%`;
    }
    return `${style.yPosition || 0}%`;
  };
  
  // Helper to get scaled top position for lyrics (moves up as content scales down)
  // This accounts for both title AND lyrics shrinking to maximize available space
  const getScaledLyricsTopPosition = () => {
    const lyricsY = lyricsStyle.y !== undefined ? lyricsStyle.y : (lyricsStyle.yPosition || 20) * slideHeight / 100;
    const titleY = titleStyle.y !== undefined ? titleStyle.y : (titleStyle.yPosition || 5) * slideHeight / 100;
    
    // Parse title font size to get pixel value
    const titleFontMatch = titleStyle.fontSize.match(/^([\d.]+)(px|rem|em)$/);
    const titleFontPx = titleFontMatch 
      ? (titleFontMatch[2] === 'px' ? parseFloat(titleFontMatch[1]) : parseFloat(titleFontMatch[1]) * 16)
      : 48;
    
    // Parse lyrics font size to get pixel value
    const lyricsFontMatch = lyricsStyle.fontSize.match(/^([\d.]+)(px|rem|em)$/);
    const lyricsFontPx = lyricsFontMatch 
      ? (lyricsFontMatch[2] === 'px' ? parseFloat(lyricsFontMatch[1]) : parseFloat(lyricsFontMatch[1]) * 16)
      : 36;
    
    // Calculate space saved by title shrinking
    const titleSpaceSaved = titleFontPx * (1 - contentScale);
    
    // Calculate space saved by lyrics shrinking (estimate ~8 lines of lyrics)
    const estimatedLyricsLines = 8;
    const lyricsSpaceSaved = lyricsFontPx * estimatedLyricsLines * (1 - contentScale);
    
    // Total space saved - use most of it to move lyrics up
    const totalSpaceSaved = titleSpaceSaved + lyricsSpaceSaved * 0.3;
    
    // Move lyrics up by the space saved
    const adjustedLyricsY = lyricsY - totalSpaceSaved * 0.8;
    
    // Don't move lyrics above the title bottom
    const minY = titleY + titleFontPx * contentScale + 20;
    const finalY = Math.max(adjustedLyricsY, minY);
    
    return `${(finalY / slideHeight) * 100}%`;
  };
  
  // Helper to get scaled top position for translation (moves down as content scales down)
  // This spreads lyrics and translation apart to use available space better
  const getScaledTranslationTopPosition = () => {
    const translationY = translationStyle.y !== undefined ? translationStyle.y : (translationStyle.yPosition || 75) * slideHeight / 100;
    
    // Parse translation font size to get pixel value
    const translationFontMatch = translationStyle.fontSize.match(/^([\d.]+)(px|rem|em)$/);
    const translationFontPx = translationFontMatch 
      ? (translationFontMatch[2] === 'px' ? parseFloat(translationFontMatch[1]) : parseFloat(translationFontMatch[1]) * 16)
      : 24;
    
    // Calculate how much space is saved by the translation shrinking
    const spaceSaved = translationFontPx * (1 - contentScale);
    
    // Move translation down by the space saved
    const adjustedTranslationY = translationY + spaceSaved * 1.5;
    
    // Don't move translation below the slide (leave room for singer/pitch info)
    const maxY = slideHeight - translationFontPx * contentScale - 60;
    const finalY = Math.min(adjustedTranslationY, maxY);
    
    return `${(finalY / slideHeight) * 100}%`;
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
  
  const getHeight = (style: SongContentStyle) => {
    if (style.height !== undefined) {
      return `${(style.height / slideHeight) * 100}%`;
    }
    return 'auto';
  };
  
  const hasTranslation = showTranslation && slide.translation;
  
  // Helper to scale font size
  const scaleFontSize = (fontSize: string): string => {
    if (contentScale === 1.0) return fontSize;
    const match = fontSize.match(/^([\d.]+)(px|rem|em|%)$/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2];
      return `${value * contentScale}${unit}`;
    }
    return fontSize;
  };

  // Calculate expanded lyrics area when scaling down (inversely proportional)
  // When scale is 0.7, lyrics area expands from 60% to ~85%
  const lyricsMaxHeight = contentScale < 1.0 
    ? `${Math.min(85, 60 / contentScale)}%` 
    : '60%';
  
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
        <SlideAudios templateSlide={slide.templateSlide} />
        <SlideText templateSlide={slide.templateSlide} />

        {/* Next-song hint at bottom-right */}
        {(() => {
          const shouldRender = slide.nextSongName || slide.nextSlideTopCenterText;
          return shouldRender;
        })() && (
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 text-right z-[1000] opacity-80 bg-gray-900/50 rounded-lg px-2 py-1">
            <div className="text-[1.9rem] sm:text-[2rem] text-blue-50">
              {slide.nextSlideTopCenterText ? (
                // Show static slide's top-center text (prioritized)
                <>Next: {renderStyledText(slide.nextSlideTopCenterText)}</>
              ) : (
                // Show next song info
                <>
                  {slide.nextIsContinuation ? (
                    <>Next: {slide.nextSongName} (contd.)</>
                  ) : (
                    <>
                      Next: {slide.nextSongName}
                      {slide.nextSingerName && <> — {slide.nextSingerName}</>}
                      {slide.nextPitch && <> — {slide.nextPitch}</>}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
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
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 text-[1.9rem] sm:text-[2rem] text-blue-50 bg-gray-900/50 rounded-lg px-2 py-1 z-[1000] opacity-80">
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
          textAlign: (titleStyle.textAlign || 'center') as any,
        }}
      >
        <h1 
          className="leading-tight"
          style={{ 
            fontSize: scaleFontSize(titleStyle.fontSize),
            fontWeight: titleStyle.fontWeight,
            fontStyle: titleStyle.fontStyle || 'normal',
            fontFamily: getFontFamily(titleStyle.fontFamily),
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
          top: contentScale < 1.0 ? getScaledLyricsTopPosition() : getTopPosition(lyricsStyle),
          left: getLeftPosition(lyricsStyle),
          width: getWidth(lyricsStyle),
          height: getHeight(lyricsStyle),
          maxHeight: lyricsStyle.height !== undefined ? getHeight(lyricsStyle) : lyricsMaxHeight,
        }}
      >
        <p 
          className="leading-tight whitespace-pre-wrap"
          style={{ 
            fontSize: scaleFontSize(lyricsStyle.fontSize),
            fontWeight: lyricsStyle.fontWeight,
            fontStyle: lyricsStyle.fontStyle || 'normal',
            fontFamily: getFontFamily(lyricsStyle.fontFamily),
            textAlign: lyricsStyle.textAlign || 'center',
            color: lyricsStyle.color,
          }}
        >
          {renderStyledText(slide.content)}
        </p>
      </div>

      {/* Translation (if available and showTranslation is true) - positioned using template style */}
      {hasTranslation && slide.translation && (
        <div 
          className="absolute z-10 overflow-auto"
          style={{ 
            top: contentScale < 1.0 ? getScaledTranslationTopPosition() : getTopPosition(translationStyle),
            left: getLeftPosition(translationStyle),
            width: getWidth(translationStyle),
            height: getHeight(translationStyle),
            maxHeight: translationStyle.height !== undefined ? getHeight(translationStyle) : '25%',
          }}
        >
          <div 
            className="leading-tight"
            style={{ 
              fontSize: scaleFontSize(translationStyle.fontSize),
              fontWeight: translationStyle.fontWeight,
              fontStyle: translationStyle.fontStyle || 'normal',
              fontFamily: getFontFamily(translationStyle.fontFamily),
              textAlign: translationStyle.textAlign || 'center',
              color: translationStyle.color,
            }}
          >
            {renderStyledText(slide.translation)}
          </div>
        </div>
      )}

      {/* Singer / pitch (when available) at bottom-left */}
      {(slide.singerName || slide.pitch) && (
        <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 text-[1.9rem] sm:text-[2rem] text-blue-50 z-[1000] opacity-80 bg-gray-900/50 rounded-lg px-2 py-1">
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
      {/* Next slide info: either song name or static slide's top-center text */}
      {(slide.nextSongName || slide.nextSlideTopCenterText) && (
        <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 text-right z-[1000] opacity-80 bg-gray-900/50 rounded-lg px-2 py-1">
          <div className="text-[1.9rem] sm:text-[2rem] text-blue-50">
            {slide.nextSlideTopCenterText ? (
              // Show static slide's top-center text (prioritized)
              <>Next: {renderStyledText(slide.nextSlideTopCenterText)}</>
            ) : (
              // Show next song info
              <>
                {slide.nextIsContinuation ? (
                  <>Next: {slide.nextSongName} (contd.)</>
                ) : (
                  <>
                    Next: {slide.nextSongName}
                    {slide.nextSingerName && <> — {slide.nextSingerName}</>}
                    {slide.nextPitch && <> — {slide.nextPitch}</>}
                  </>
                )}
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
          <SlideAudios templateSlide={effectiveSlide} />
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
