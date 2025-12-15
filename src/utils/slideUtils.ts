import type { Song, Slide, PresentationTemplate, TemplateSlide } from '../types';
import { isMultiSlideTemplate } from './templateUtils';
import { getTopCenterText } from './slideLayeringUtils';

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
 * Prepends song title to the first slide's lyrics if the title differs from the first line
 * @param content - The first slide's lyrics content
 * @param songName - The song's name/title
 * @returns Modified content with title prepended if needed
 */
function prependTitleIfDifferent(content: string, songName: string): string {
  if (!content || !songName) return content;
  
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return content;
  
  // Get plain text version of first line for comparison (ignoring HTML tags)
  const firstLinePlain = stripHtml(lines[0]);
  const titlePlain = stripHtml(songName);
  
  // Compare plain text versions - if different, prepend title
  if (firstLinePlain.toLowerCase().trim() !== titlePlain.toLowerCase().trim()) {
    return `${songName}\n${content}`;
  }
  
  return content;
}

/**
 * Limits translation text to 4 lines maximum, preserving HTML tags
 * @param translationText - The translation/meaning text that may contain HTML tags
 * @returns Translation text truncated to 4 lines max
 */
function limitTranslationTo4Lines(translationText: string): string {
  if (!translationText) return translationText;
  
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
    return result;
  }
  
  return translationText;
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
    let translationText = limitTranslationTo4Lines(translationVerses[0] || '');
    
    // Show all lyrics in one slide
    slides.push({
      index: 0,
      content: prependTitleIfDifferent(allLines.join('\n'), song.name),
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
      let translationText = limitTranslationTo4Lines(translationVerses[verseIndex] || '');
      
      // Create one slide per verse (entire section)
      const verseContent = verseIndex === 0 
        ? prependTitleIfDifferent(verse, song.name)
        : verse;
      
      slides.push({
        index: slides.length,
        content: verseContent,
        translation: translationText || undefined,
        songName: song.name,
      });
    });
  } else {
    // Total lines > 10 but no verse structure - split into 10 lines per slide
    const maxLinesPerSlide = 10;
    
    let translationText = limitTranslationTo4Lines(translationVerses[0] || '');
    
    // Split into chunks of 10 lines
    for (let i = 0; i < allLines.length; i += maxLinesPerSlide) {
      const slideLines = allLines.slice(i, i + maxLinesPerSlide);
      const slideContent = i === 0
        ? prependTitleIfDifferent(slideLines.join('\n'), song.name)
        : slideLines.join('\n');
      
      slides.push({
        index: slides.length,
        content: slideContent,
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
 * @param options - Optional configuration
 * @param options.skipStaticSlides - If true, skip intro/outro static slides (for single song preview)
 * @returns Array of slides for the complete presentation
 */
export function generatePresentationSlides(
  song: Song,
  template: PresentationTemplate | null,
  singerName?: string,
  pitch?: string,
  options?: { skipStaticSlides?: boolean }
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

  // If skipStaticSlides is true, just return song slides (for single song preview)
  if (options?.skipStaticSlides) {
    return songSlides.map((slide, index) => ({
      ...slide,
      index,
    }));
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

  // Use the shared metadata annotation function that handles layering
  return addNextSlideMetadata(result);
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
          // Add session metadata so overlays display on intro slides too
          sessionSongIndex: 1,
          totalSongs: songs.length,
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

    // Helper function to find the next non-static slide
    const findNextSongSlide = (startIndex: number) => {
      for (let i = startIndex; i < slides.length; i++) {
        if (slides[i].slideType !== 'static') {
          return slides[i];
        }
      }
      return null;
    };

    // Helper function to get layering text based on slide types
    const getNextLayeringText = (currentIndex: number, nextSlide: Slide): string | undefined => {
      // If next slide is static, show its top-center text
      if (nextSlide.slideType === 'static') {
        return getTopCenterText(nextSlide.templateSlide);
      }
      // For song slides, don't show top-center text preview
      return undefined;
    };

    // For static slides (intro/outro)
    if (slide.slideType === 'static') {
      return {
        ...slide,
        nextSongName: next.songName,
        nextSingerName: next.singerName,
        nextPitch: next.pitch,
        nextIsContinuation: false,
        nextIsStatic: next.slideType === 'static',
        nextSlideTopCenterText: getNextLayeringText(index, next),
      };
    }

    // For song slides where next slide is a continuation of the same song
    if (next.songName === slide.songName) {
      return {
        ...slide,
        nextSongName: slide.songName,
        nextIsContinuation: true,
        nextIsStatic: next.slideType === 'static',
        nextSlideTopCenterText: undefined, // Don't show preview for same song continuation
      };
    }

    // For song slides where next is a different song or static slide
    if (next.slideType === 'static') {
      return {
        ...slide,
        nextSongName: undefined,
        nextIsContinuation: false,
        nextIsStatic: true,
        nextSlideTopCenterText: getNextLayeringText(index, next),
      };
    }

    // For song slides transitioning to a different song
    return {
      ...slide,
      nextSongName: next.songName,
      nextSingerName: next.singerName,
      nextPitch: next.pitch,
      nextIsContinuation: false,
      nextIsStatic: false,
      nextSlideTopCenterText: undefined, // Show song info instead of preview for new song
    };
  });
}
