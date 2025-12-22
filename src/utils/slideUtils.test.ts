import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateSlides, generatePresentationSlides, generateSessionPresentationSlides } from './slideUtils';
import type { Song, PresentationTemplate } from '../types';

describe('slideUtils', () => {
  // Mock document.createElement for stripHtml function
  beforeEach(() => {
    global.document = {
      createElement: vi.fn(() => ({
        innerHTML: '',
        textContent: '',
        innerText: '',
      })),
    } as any;
  });

  describe('generateSlides', () => {
    describe('no lyrics available', () => {
      it('should return error slide when lyrics are null', () => {
        const song = {
          id: '1',
          name: 'Test Song',
          lyrics: null,
        } as unknown as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content).toContain('Song lyrics not available');
        expect(slides[0].songName).toBe('Test Song');
        expect(slides[0].songSlideNumber).toBe(1);
        expect(slides[0].songSlideCount).toBe(1);
      });

      it('should return error slide when lyrics are empty string', () => {
        const song: Song = {
          id: '1',
          name: 'Empty Song',
          lyrics: '',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content).toContain('Song lyrics not available');
      });

      it('should return error slide when lyrics are undefined', () => {
        const song: Song = {
          id: '1',
          name: 'Undefined Song',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content).toContain('Song lyrics not available');
      });
    });

    describe('short lyrics (≤12 lines)', () => {
      it('should create single slide for 5 lines', () => {
        const song: Song = {
          id: '1',
          name: 'Short Song',
          lyrics: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content).toBe('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
        expect(slides[0].songSlideNumber).toBe(1);
        expect(slides[0].songSlideCount).toBe(1);
      });

      it('should create single slide for exactly 12 lines', () => {
        const lyrics = Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`).join('\n');
        const song: Song = {
          id: '1',
          name: 'Ten Lines',
          lyrics,
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content).toBe(lyrics);
      });

      it('should ignore double line breaks when total lines ≤10', () => {
        const song: Song = {
          id: '1',
          name: 'Short with Verses',
          lyrics: 'Line 1\nLine 2\n\nLine 3\nLine 4',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content).toBe('Line 1\nLine 2\nLine 3\nLine 4');
      });

      it('should include translation when available', () => {
        const song: Song = {
          id: '1',
          name: 'With Translation',
          lyrics: 'Line 1\nLine 2\nLine 3',
          meaning: 'Translation line 1\nTranslation line 2',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].translation).toBeDefined();
      });
    });

    describe('long lyrics with verse structure (>12 lines with \\n\\n)', () => {
      it('should create one slide per verse', () => {
        const song: Song = {
          id: '1',
          name: 'Song with Verses',
          lyrics: 'Verse 1 Line 1\nVerse 1 Line 2\nVerse 1 Line 3\nVerse 1 Line 4\nVerse 1 Line 5\nVerse 1 Line 6\nVerse 1 Line 7\n\nVerse 2 Line 1\nVerse 2 Line 2\nVerse 2 Line 3\nVerse 2 Line 4\nVerse 2 Line 5\nVerse 2 Line 6\nVerse 2 Line 7',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(2);
        expect(slides[0].content).toContain('Verse 1');
        expect(slides[1].content).toContain('Verse 2');
        expect(slides[0].songSlideNumber).toBe(1);
        expect(slides[0].songSlideCount).toBe(2);
        expect(slides[1].songSlideNumber).toBe(2);
        expect(slides[1].songSlideCount).toBe(2);
      });

      it('should handle three verses', () => {
        const song: Song = {
          id: '1',
          name: 'Three Verses',
          lyrics: 'V1L1\nV1L2\nV1L3\nV1L4\nV1L5\n\nV2L1\nV2L2\nV2L3\nV2L4\nV2L5\n\nV3L1\nV3L2\nV3L3\nV3L4\nV3L5',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(3);
        expect(slides[0].songSlideCount).toBe(3);
        expect(slides[2].songSlideNumber).toBe(3);
      });

      it('should match translation verses to lyrics verses', () => {
        const song: Song = {
          id: '1',
          name: 'With Verse Translations',
          lyrics: 'V1L1\nV1L2\nV1L3\nV1L4\nV1L5\nV1L6\nV1L7\n\nV2L1\nV2L2\nV2L3\nV2L4\nV2L5\nV2L6\nV2L7',
          meaning: 'Translation V1\n\nTranslation V2',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(2);
        expect(slides[0].translation).toBeDefined();
        expect(slides[1].translation).toBeDefined();
      });

      it('should handle empty verses', () => {
        const song: Song = {
          id: '1',
          name: 'Empty Verses',
          lyrics: 'Verse 1\n\n\n\nVerse 2',
        } as Song;

        const slides = generateSlides(song);

        // Empty verses are filtered out, so only non-empty verses remain
        expect(slides.length).toBeGreaterThan(0);
        expect(slides[0].content).toContain('Verse');
      });
    });

    describe('long lyrics without verse structure (no \\n\\n)', () => {
      it('should put all lines in one slide when no double line breaks', () => {
        const lyrics = Array.from({ length: 25 }, (_, i) => `Line ${i + 1}`).join('\n');
        const song: Song = {
          id: '1',
          name: 'Long Continuous',
          lyrics,
        } as Song;

        const slides = generateSlides(song);

        // All lines in one slide when no verse structure
        expect(slides).toHaveLength(1);
        expect(slides[0].content.split('\n')).toHaveLength(25);
      });

      it('should number single slide correctly', () => {
        const lyrics = Array.from({ length: 22 }, (_, i) => `Line ${i + 1}`).join('\n');
        const song: Song = {
          id: '1',
          name: 'Long',
          lyrics,
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].songSlideNumber).toBe(1);
        expect(slides[0].songSlideCount).toBe(1);
      });

      it('should include translation on the single slide', () => {
        const lyrics = Array.from({ length: 25 }, (_, i) => `Line ${i + 1}`).join('\n');
        const song: Song = {
          id: '1',
          name: 'Long with Translation',
          lyrics,
          meaning: 'Translation text',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].translation).toBeDefined();
      });
    });

    describe('edge cases', () => {
      it('should handle single line', () => {
        const song: Song = {
          id: '1',
          name: 'One Line',
          lyrics: 'Just one line',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content).toBe('Just one line');
      });

      it('should handle exactly 11 lines without verse breaks in one slide', () => {
        const lyrics = Array.from({ length: 11 }, (_, i) => `Line ${i + 1}`).join('\n');
        const song: Song = {
          id: '1',
          name: 'Eleven Lines',
          lyrics,
        } as Song;

        const slides = generateSlides(song);

        // All lines in one slide when no verse structure
        expect(slides).toHaveLength(1);
        expect(slides[0].content.split('\n')).toHaveLength(11);
      });

      it('should handle lyrics with extra whitespace', () => {
        const song: Song = {
          id: '1',
          name: 'Whitespace',
          lyrics: '  Line 1  \n\n  Line 2  ',
        } as Song;

        const slides = generateSlides(song);

        expect(slides).toHaveLength(1);
        expect(slides[0].content.trim()).toBeTruthy();
      });

      it('should handle empty lines in lyrics', () => {
        const song: Song = {
          id: '1',
          name: 'Empty Lines',
          lyrics: 'Line 1\n\nLine 2\n\n\nLine 3',
        } as Song;

        const slides = generateSlides(song);

        expect(slides[0].content).toContain('Line 1');
        expect(slides[0].content).toContain('Line 2');
      });
    });
  });

  describe('generatePresentationSlides', () => {
    const basicSong: Song = {
      id: '1',
      name: 'Test Song',
      lyrics: 'Line 1\nLine 2\nLine 3',
    } as Song;

    it('should return basic song slides when no template', () => {
      const slides = generatePresentationSlides(basicSong, null, 'Singer', 'C#');

      expect(slides).toHaveLength(1);
      expect(slides[0].singerName).toBe('Singer');
      expect(slides[0].pitch).toBe('C#');
      expect(slides[0].slideType).toBe('song');
    });

    it('should return basic song slides for non-multi-slide template', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Legacy Template',
        background: { type: 'color', value: '#fff' },
      } as PresentationTemplate;

      const slides = generatePresentationSlides(basicSong, template);

      expect(slides[0].slideType).toBe('song');
    });

    it('should add intro and outro slides with multi-slide template', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi Slide',
        slides: [
          { background: { type: 'color', value: '#000' } }, // Intro
          { background: { type: 'color', value: '#fff' } }, // Reference
          { background: { type: 'color', value: '#000' } }, // Outro
        ],
        referenceSlideIndex: 1,
      } as PresentationTemplate;

      const slides = generatePresentationSlides(basicSong, template);

      expect(slides.length).toBeGreaterThan(1);
      expect(slides[0].slideType).toBe('static'); // Intro
      expect(slides[1].slideType).toBe('song'); // Content
      expect(slides[slides.length - 1].slideType).toBe('static'); // Outro
    });

    it('should skip static slides when skipStaticSlides is true', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi Slide',
        slides: [
          { background: { type: 'color', value: '#000' } },
          { background: { type: 'color', value: '#fff' } },
          { background: { type: 'color', value: '#000' } },
        ],
        referenceSlideIndex: 1,
      } as PresentationTemplate;

      const slides = generatePresentationSlides(basicSong, template, undefined, undefined, {
        skipStaticSlides: true,
      });

      expect(slides.every(s => s.slideType === 'song')).toBe(true);
    });

    it('should add next slide metadata', () => {
      const song: Song = {
        id: '1',
        name: 'Multi Slide Song',
        lyrics: 'V1\n\nV2',
      } as Song;

      const slides = generatePresentationSlides(song, null);

      expect(slides).toHaveLength(1);
      expect(slides[0].nextSongName).toBeUndefined();
      expect(slides[0].nextIsContinuation).toBeUndefined();
    });

    it('should handle reference slide index at 0', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Template',
        slides: [
          { background: { type: 'color', value: '#fff' } }, // Reference at 0
          { background: { type: 'color', value: '#000' } }, // Outro
        ],
        referenceSlideIndex: 0,
      } as PresentationTemplate;

      const slides = generatePresentationSlides(basicSong, template);

      expect(slides[0].slideType).toBe('song'); // No intro slides
      expect(slides[slides.length - 1].slideType).toBe('static'); // Outro exists
    });
  });

  describe('generateSessionPresentationSlides', () => {
    const song1: Song = {
      id: '1',
      name: 'Song 1',
      lyrics: 'Song 1 lyrics',
    } as Song;

    const song2: Song = {
      id: '2',
      name: 'Song 2',
      lyrics: 'Song 2 lyrics',
    } as Song;

    it('should concatenate multiple songs without template', () => {
      const songs = [
        { song: song1, singerName: 'Singer A', pitch: 'C' },
        { song: song2, singerName: 'Singer B', pitch: 'D' },
      ];

      const slides = generateSessionPresentationSlides(songs, null);

      expect(slides).toHaveLength(2);
      expect(slides[0].songName).toBe('Song 1');
      expect(slides[0].singerName).toBe('Singer A');
      expect(slides[0].pitch).toBe('C');
      expect((slides[0] as any).sessionSongIndex).toBe(1);
      expect((slides[0] as any).totalSongs).toBe(2);
      expect(slides[1].songName).toBe('Song 2');
      expect((slides[1] as any).sessionSongIndex).toBe(2);
    });

    it('should add intro only for first song', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi Slide',
        slides: [
          { background: { type: 'color', value: '#000' } }, // Intro
          { background: { type: 'color', value: '#fff' } }, // Reference
          { background: { type: 'color', value: '#000' } }, // Outro
        ],
        referenceSlideIndex: 1,
      } as PresentationTemplate;

      const songs = [
        { song: song1 },
        { song: song2 },
      ];

      const slides = generateSessionPresentationSlides(songs, template);

      // First slide should be static intro
      expect(slides[0].slideType).toBe('static');
      expect(slides[0].songName).toBe('Song 1');
    });

    it('should add outro only for last song', () => {
      const template: PresentationTemplate = {
        id: '1',
        name: 'Multi Slide',
        slides: [
          { background: { type: 'color', value: '#000' } }, // Intro
          { background: { type: 'color', value: '#fff' } }, // Reference
          { background: { type: 'color', value: '#000' } }, // Outro
        ],
        referenceSlideIndex: 1,
      } as PresentationTemplate;

      const songs = [
        { song: song1 },
        { song: song2 },
      ];

      const slides = generateSessionPresentationSlides(songs, template);

      // Last slide should be static outro
      expect(slides[slides.length - 1].slideType).toBe('static');
      expect(slides[slides.length - 1].songName).toBe('Song 2');
    });

    it('should add next slide metadata for continuations', () => {
      const songs = [{ song: song1 }, { song: song2 }];

      const slides = generateSessionPresentationSlides(songs, null);

      expect(slides[0].nextSongName).toBe('Song 2');
      expect(slides[0].nextIsContinuation).toBe(false);
      expect(slides[1].nextSongName).toBeUndefined();
    });

    it('should handle single song in session', () => {
      const songs = [{ song: song1, singerName: 'Solo', pitch: 'E' }];

      const slides = generateSessionPresentationSlides(songs, null);

      expect(slides).toHaveLength(1);
      expect((slides[0] as any).sessionSongIndex).toBe(1);
      expect((slides[0] as any).totalSongs).toBe(1);
    });

    it('should handle three songs', () => {
      const song3: Song = {
        id: '3',
        name: 'Song 3',
        lyrics: 'Song 3 lyrics',
      } as Song;

      const songs = [
        { song: song1 },
        { song: song2 },
        { song: song3 },
      ];

      const slides = generateSessionPresentationSlides(songs, null);

      expect(slides).toHaveLength(3);
      expect((slides[0] as any).sessionSongIndex).toBe(1);
      expect((slides[1] as any).sessionSongIndex).toBe(2);
      expect((slides[2] as any).sessionSongIndex).toBe(3);
      expect((slides[2] as any).totalSongs).toBe(3);
    });

    it('should preserve slide indices', () => {
      const songs = [{ song: song1 }, { song: song2 }];

      const slides = generateSessionPresentationSlides(songs, null);

      expect(slides[0].index).toBe(0);
      expect(slides[1].index).toBe(1);
    });
  });
});
