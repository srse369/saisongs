import type { Song, Slide } from '../types';

/**
 * Maximum number of lines per slide before splitting
 */
const MAX_LINES_PER_SLIDE = 6;

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
 * If a verse exceeds MAX_LINES_PER_SLIDE, it will be split into multiple slides.
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
  
  // Split lyrics into verses by double line breaks
  const verses = song.lyrics
    .split('\n\n')
    .map(v => v.trim())
    .filter(v => v.length > 0);
  
  // Split translation/meaning into verses if it exists
  // Strip HTML tags if present and split by double newlines
  const translationVerses = song.meaning
    ? stripHtml(song.meaning)
        .split('\n\n')
        .map(v => v.trim())
        .filter(v => v.length > 0)
    : [];
  
  verses.forEach((verse, verseIndex) => {
    const lines = verse.split('\n');
    const translationLines = translationVerses[verseIndex]?.split('\n') || [];
    
    // If verse is short enough, create a single slide
    if (lines.length <= MAX_LINES_PER_SLIDE) {
      slides.push({
        index: slides.length,
        content: verse,
        translation: translationVerses[verseIndex],
        songName: song.name,
      });
    } else {
      // Split long verse into multiple slides
      for (let i = 0; i < lines.length; i += MAX_LINES_PER_SLIDE) {
        const slideLines = lines.slice(i, i + MAX_LINES_PER_SLIDE);
        const slideTranslationLines = translationLines.slice(i, i + MAX_LINES_PER_SLIDE);
        
        slides.push({
          index: slides.length,
          content: slideLines.join('\n'),
          translation: slideTranslationLines.length > 0 
            ? slideTranslationLines.join('\n') 
            : undefined,
          songName: song.name,
        });
      }
    }
  });

  // Annotate slides with per-song slide number and total
  const total = slides.length || 1;
  return slides.map((slide) => ({
    ...slide,
    songSlideNumber: slide.index + 1,
    songSlideCount: total,
  }));
}
