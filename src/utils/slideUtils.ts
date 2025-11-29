import type { Song, Slide, PresentationTemplate, TemplateSlide } from '../types';
import { isMultiSlideTemplate } from './templateUtils';

/**
 * Maximum number of lines per slide before splitting
 */
const MAX_LINES_PER_SLIDE_WITH_TRANSLATION = 6;
const MAX_LINES_PER_SLIDE_WITHOUT_TRANSLATION = 8;

/**
 * Strips HTML tags from a string and decodes HTML entities
 * @param html - String that may contain HTML
 * @returns Plain text without HTML tags
 */
function stripHtml(html: string): string {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Get text content (automatically decodes HTML entities)
  const text = temp.textContent || temp.innerText || '';
  
  // Clean up extra whitespace
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Generates slides from a song's lyrics and translation.
 * Splits lyrics by double line breaks (verses) and creates one slide per verse.
 * If a verse exceeds the max lines threshold, it will be split into multiple slides.
 * Uses 8 lines max when translation exists, 10 lines max when no translation.
 * 
 * @param song - The song object with cached lyrics and meaning
 * @returns Array of Slide objects ready for presentation
 */
export function generateSlides(song: Song): Slide[] {
  const slides: Slide[] = [];
  
  // Check if lyrics are available
  if (!song.lyrics) {
    // Return a single slide with error message
    return [{
      index: 0,
      content: 'Song lyrics not available.\nPlease re-import this song.',
      songName: song.name,
      songSlideNumber: 1,
      songSlideCount: 1,
    }];
  }
  
  // Count total lines in lyrics (ignoring double line breaks)
  const allLines = song.lyrics.split('\n').filter(line => line.trim().length > 0);
  const totalLineCount = allLines.length;
  
  // Check if lyrics have double line breaks (verse structure)
  const hasDoubleLineBreaks = song.lyrics.includes('\n\n');
  
  // Split translation/meaning into verses if it exists
  // Keep HTML tags intact for rendering
  const translationVerses = song.meaning
    ? song.meaning
        .split('\n\n')
        .map(v => v.trim())
        .filter(v => v.length > 0)
    : [];
  
  // If total lines <= 10, ignore verse breaks and show everything in one slide
  if (totalLineCount <= 10) {
    // Get first translation if exists
    let translationText = translationVerses[0] || '';
    
    // Always limit translation to 4 lines maximum
    if (translationText) {
      const translationStripped = stripHtml(translationText);
      const translationLines = translationStripped.split('\n');
      if (translationLines.length > 4) {
        const parts = translationText.split(/(<br\s*\/?>|\n)/i);
        let lineCount = 0;
        let result = '';
        for (const part of parts) {
          if (part.match(/(<br\s*\/?>|\n)/i)) {
            lineCount++;
            if (lineCount >= 4) break;
            result += part;
          } else {
            result += part;
          }
        }
        translationText = result;
      }
    }
    
    // Show all lyrics in one slide
    slides.push({
      index: 0,
      content: allLines.join('\n'),
      translation: translationText || undefined,
      songName: song.name,
    });
  } else if (hasDoubleLineBreaks) {
    // Total lines > 10 and has verse structure - respect the verse breaks
    const verses = song.lyrics
      .split('\n\n')
      .map(v => v.trim())
      .filter(v => v.length > 0);
    
    verses.forEach((verse, verseIndex) => {
      // Get corresponding translation
      let translationText = translationVerses[verseIndex] || '';
      
      // Always limit translation to 4 lines maximum
      if (translationText) {
        const translationStripped = stripHtml(translationText);
        const translationLines = translationStripped.split('\n');
        if (translationLines.length > 4) {
          const parts = translationText.split(/(<br\s*\/?>|\n)/i);
          let lineCount = 0;
          let result = '';
          for (const part of parts) {
            if (part.match(/(<br\s*\/?>|\n)/i)) {
              lineCount++;
              if (lineCount >= 4) break;
              result += part;
            } else {
              result += part;
            }
          }
          translationText = result;
        }
      }
      
      // Create one slide per verse (entire section)
      slides.push({
        index: slides.length,
        content: verse,
        translation: translationText || undefined,
        songName: song.name,
      });
    });
  } else {
    // Total lines > 10 but no verse structure - split into 10 lines per slide
    const maxLinesPerSlide = 10;
    
    // Get first translation if exists
    let translationText = translationVerses[0] || '';
    
    // Always limit translation to 4 lines maximum
    if (translationText) {
      const translationStripped = stripHtml(translationText);
      const translationLines = translationStripped.split('\n');
      if (translationLines.length > 4) {
        const parts = translationText.split(/(<br\s*\/?>|\n)/i);
        let lineCount = 0;
        let result = '';
        for (const part of parts) {
          if (part.match(/(<br\s*\/?>|\n)/i)) {
            lineCount++;
            if (lineCount >= 4) break;
            result += part;
          } else {
            result += part;
          }
        }
        translationText = result;
      }
    }
    
    // Split into chunks of 10 lines
    for (let i = 0; i < allLines.length; i += maxLinesPerSlide) {
      const slideLines = allLines.slice(i, i + maxLinesPerSlide);
      
      slides.push({
        index: slides.length,
        content: slideLines.join('\n'),
        translation: i === 0 ? translationText : undefined, // Only show translation on first slide
        songName: song.name,
      });
    }
  }

  // Annotate slides with per-song slide number and total
  const total = slides.length || 1;
  return slides.map((slide) => ({
    ...slide,
    songSlideNumber: slide.index + 1,
    songSlideCount: total,
  }));
}

/**
 * Generates a complete presentation slide deck from a song and multi-slide template.
 * The deck includes:
 * 1. Intro slides (template slides before referenceSlideIndex) - static, no song content
 * 2. Song content slides (using reference slide as template)
 * 3. Outro slides (template slides after referenceSlideIndex) - static, no song content
 * 
 * @param song - The song object with lyrics
 * @param template - The multi-slide template
 * @param singerName - Optional singer name to display
 * @param pitch - Optional pitch to display
 * @returns Array of slides for the complete presentation
 */
export function generatePresentationSlides(
  song: Song,
  template: PresentationTemplate | null,
  singerName?: string,
  pitch?: string
): Slide[] {
  // Generate base song content slides
  const songSlides = generateSlides(song).map((slide) => ({
    ...slide,
    singerName,
    pitch,
    slideType: 'song' as const,
  }));

  // If no multi-slide template, just return song slides
  if (!template || !isMultiSlideTemplate(template)) {
    return songSlides;
  }

  const slides = template.slides!;
  const refIndex = template.referenceSlideIndex ?? 0;
  const result: Slide[] = [];

  // 1. Add intro slides (before reference slide)
  for (let i = 0; i < refIndex; i++) {
    result.push({
      index: result.length,
      content: '',
      songName: song.name,
      slideType: 'static',
      templateSlide: slides[i],
    });
  }

  // 2. Add song content slides (using reference slide)
  songSlides.forEach((slide) => {
    result.push({
      ...slide,
      index: result.length,
      slideType: 'song',
    });
  });

  // 3. Add outro slides (after reference slide)
  for (let i = refIndex + 1; i < slides.length; i++) {
    result.push({
      index: result.length,
      content: '',
      songName: song.name,
      slideType: 'static',
      templateSlide: slides[i],
    });
  }

  // Re-annotate with next slide info
  return result.map((slide, index) => {
    const next = result[index + 1];
    if (!next) return slide;

    if (next.slideType === 'static') {
      return {
        ...slide,
        nextSongName: undefined,
        nextIsContinuation: false,
      };
    }

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
}

/**
 * Generates slides for a session with multiple songs using a multi-slide template.
 * For each song, it creates the full slide sequence (intro, content, outro).
 * Only shows intro slides for the first song and outro slides for the last song.
 * 
 * @param songs - Array of songs with their metadata
 * @param template - The multi-slide template
 * @returns Array of slides for the complete session presentation
 */
export function generateSessionPresentationSlides(
  songs: Array<{ song: Song; singerName?: string; pitch?: string }>,
  template: PresentationTemplate | null
): Slide[] {
  const result: Slide[] = [];

  // If no multi-slide template, just concatenate song slides
  if (!template || !isMultiSlideTemplate(template)) {
    songs.forEach(({ song, singerName, pitch }, songIndex) => {
      const songSlides = generateSlides(song).map((slide) => ({
        ...slide,
        singerName,
        pitch,
        slideType: 'song' as const,
      }));
      
      songSlides.forEach((slide) => {
        result.push({
          ...slide,
          index: result.length,
          // Add session metadata
          sessionSongIndex: songIndex + 1,
          totalSongs: songs.length,
        } as Slide);
      });
    });
    
    return addNextSlideMetadata(result);
  }

  const templateSlides = template.slides!;
  const refIndex = template.referenceSlideIndex ?? 0;

  songs.forEach(({ song, singerName, pitch }, songIndex) => {
    const isFirstSong = songIndex === 0;
    const isLastSong = songIndex === songs.length - 1;

    // 1. Add intro slides (only for first song)
    if (isFirstSong) {
      for (let i = 0; i < refIndex; i++) {
        result.push({
          index: result.length,
          content: '',
          songName: song.name,
          slideType: 'static',
          templateSlide: templateSlides[i],
        });
      }
    }

    // 2. Add song content slides
    const songSlides = generateSlides(song).map((slide) => ({
      ...slide,
      singerName,
      pitch,
      slideType: 'song' as const,
      // Add session metadata
      sessionSongIndex: songIndex + 1,
      totalSongs: songs.length,
    }));

    songSlides.forEach((slide) => {
      result.push({
        ...slide,
        index: result.length,
      } as Slide);
    });

    // 3. Add outro slides (only for last song)
    if (isLastSong) {
      for (let i = refIndex + 1; i < templateSlides.length; i++) {
        result.push({
          index: result.length,
          content: '',
          songName: song.name,
          slideType: 'static',
          templateSlide: templateSlides[i],
        });
      }
    }
  });

  return addNextSlideMetadata(result);
}

/**
 * Helper to add next slide metadata to a slide array
 */
function addNextSlideMetadata(slides: Slide[]): Slide[] {
  return slides.map((slide, index) => {
    const next = slides[index + 1];
    if (!next) return slide;

    if (next.slideType === 'static') {
      return {
        ...slide,
        nextSongName: undefined,
        nextIsContinuation: false,
      };
    }

    if (next.songName === slide.songName && slide.slideType !== 'static') {
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
}
