import { useMemo } from 'react';
import type { SongContentStyle, TemplateSlide } from '../../../../types';

interface UseSongContentStylesProps {
  referenceSlide: TemplateSlide | undefined;
  SLIDE_WIDTH: number;
  SLIDE_HEIGHT: number;
}

type StyleType = 'songTitleStyle' | 'songLyricsStyle' | 'songTranslationStyle' | 'bottomLeftTextStyle' | 'bottomRightTextStyle';

/**
 * Custom hook to manage song content styles with defaults
 * Centralizes all the repetitive default style definitions
 */
export function useSongContentStyles({
  referenceSlide,
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
}: UseSongContentStylesProps) {
  
  // Default style configurations
  const defaultStyles = useMemo(() => {
    const defaults: Record<StyleType, SongContentStyle> = {
      songTitleStyle: {
        x: 40,
        y: Math.round(SLIDE_HEIGHT * 0.05),
        width: SLIDE_WIDTH - 80,
        fontSize: '48px',
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#ffffff',
      },
      songLyricsStyle: {
        x: 40,
        y: Math.round(SLIDE_HEIGHT * 0.20),
        width: SLIDE_WIDTH - 80,
        fontSize: '36px',
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#ffffff',
      },
      songTranslationStyle: {
        x: 40,
        y: Math.round(SLIDE_HEIGHT * 0.75),
        width: SLIDE_WIDTH - 80,
        fontSize: '24px',
        fontWeight: 'normal',
        textAlign: 'center',
        color: '#ffffff',
      },
      bottomLeftTextStyle: {
        x: 40,
        y: Math.round(SLIDE_HEIGHT * 0.92),
        width: Math.round((SLIDE_WIDTH - 120) / 2),
        fontSize: '20px',
        fontWeight: 'normal',
        textAlign: 'left',
        color: '#ffffff',
      },
      bottomRightTextStyle: {
        x: Math.round(SLIDE_WIDTH * 0.5),
        y: Math.round(SLIDE_HEIGHT * 0.92),
        width: Math.round((SLIDE_WIDTH - 120) / 2),
        fontSize: '20px',
        fontWeight: 'normal',
        textAlign: 'right',
        color: '#ffffff',
      },
    };
    return defaults;
  }, [SLIDE_WIDTH, SLIDE_HEIGHT]);

  // Merge with saved styles, converting legacy yPosition to y if needed
  const mergeSongStyle = (saved: Partial<SongContentStyle> | undefined, defaults: SongContentStyle): SongContentStyle => {
    if (!saved) return defaults;
    
    // Calculate y value: prefer saved.y, then convert legacy yPosition, then use default
    const yValue = saved.y ?? (saved.yPosition !== undefined ? Math.round(SLIDE_HEIGHT * (saved.yPosition / 100)) : defaults.y);
    
    return {
      x: saved.x ?? defaults.x,
      y: yValue,
      width: saved.width ?? defaults.width,
      height: saved.height,
      fontSize: saved.fontSize ?? defaults.fontSize,
      fontWeight: saved.fontWeight ?? defaults.fontWeight,
      fontStyle: saved.fontStyle,
      fontFamily: saved.fontFamily,
      textAlign: saved.textAlign ?? defaults.textAlign,
      color: saved.color ?? defaults.color,
      yPosition: saved.yPosition,
    };
  };

  // Compute merged styles
  const styles = useMemo(() => ({
    songTitleStyle: mergeSongStyle(referenceSlide?.songTitleStyle, defaultStyles.songTitleStyle),
    songLyricsStyle: mergeSongStyle(referenceSlide?.songLyricsStyle, defaultStyles.songLyricsStyle),
    songTranslationStyle: mergeSongStyle(referenceSlide?.songTranslationStyle, defaultStyles.songTranslationStyle),
    bottomLeftTextStyle: mergeSongStyle(referenceSlide?.bottomLeftTextStyle, defaultStyles.bottomLeftTextStyle),
    bottomRightTextStyle: mergeSongStyle(referenceSlide?.bottomRightTextStyle, defaultStyles.bottomRightTextStyle),
  }), [referenceSlide, defaultStyles]);

  // Helper to get default style for a specific type (used in handleSongContentStyleChange)
  const getDefaultStyle = (type: StyleType): SongContentStyle => {
    return defaultStyles[type];
  };

  return {
    ...styles,
    getDefaultStyle,
    defaultStyles,
  };
}
