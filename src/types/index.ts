// Presentation Template interfaces
export interface BackgroundElement {
  type: 'color' | 'image' | 'video';
  value: string;
  opacity?: number;
}

export type PositionType = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface ImageElement {
  id: string;
  url: string;
  position?: PositionType;
  x?: number | string; // pixels or percentage (e.g., 10, "10px", "50%")
  y?: number | string;
  width?: string;
  height?: string;
  opacity?: number;
  zIndex?: number;
  rotation?: number;
}

export interface VideoElement {
  id: string;
  url: string;
  position?: PositionType;
  x?: number | string;
  y?: number | string;
  width?: string;
  height?: string;
  opacity?: number;
  zIndex?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  rotation?: number;
  audioOnly?: boolean; // DEPRECATED: Use hideVideo instead
  hideVideo?: boolean; // Hide video, show audio controls only
  hideAudio?: boolean; // Mute audio
}

export interface AudioElement {
  id: string;
  url: string;
  position?: PositionType;
  x?: number | string;
  y?: number | string;
  width?: string;
  height?: string;
  opacity?: number;
  zIndex?: number;
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number; // 0 to 1
  visualHidden?: boolean; // Hide visual placeholder, play audio only
}

export interface TextElement {
  id: string;
  content: string;
  position?: PositionType;
  x?: number | string;
  y?: number | string;
  width?: string;
  height?: string;
  fontSize?: string;
  color?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number;
  zIndex?: number;
  maxWidth?: string;
  rotation?: number;
}

// Song content styling for reference slides
export interface SongContentStyle {
  // Position in slide coordinates (pixels)
  x: number;
  y: number;
  width: number;
  height?: number;
  // Font styling
  fontSize: string;         // e.g., "48px", "3rem"
  fontWeight: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign: 'left' | 'center' | 'right';
  color: string;            // e.g., "#ffffff"
  // Legacy: yPosition as percentage (deprecated, use y instead)
  yPosition?: number;
}

// Individual slide within a multi-slide template
export interface TemplateSlide {
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  audios?: AudioElement[];
  text?: TextElement[];
  
  // Song content styling (only used on reference slides)
  songTitleStyle?: SongContentStyle;
  songLyricsStyle?: SongContentStyle;
  songTranslationStyle?: SongContentStyle;
}

// Multi-slide presentation template
// A template contains multiple slides, with one designated as the "reference slide"
// for overlaying song content (lyrics, pitch, singer name, etc.)
// Aspect ratio options for templates
export type AspectRatio = '16:9' | '4:3';

// Resolution constants for each aspect ratio
export const ASPECT_RATIO_DIMENSIONS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1600, height: 1200 },
} as const;

// Default song content styles for reference slides
// These are used when a template doesn't have explicit styles defined
export const DEFAULT_SONG_TITLE_STYLE: SongContentStyle = {
  x: 40,
  y: 54, // ~5% of 1080
  width: 1840,
  fontSize: '48px',
  fontWeight: 'bold',
  textAlign: 'center',
  color: '#ffffff',
};

export const DEFAULT_SONG_LYRICS_STYLE: SongContentStyle = {
  x: 40,
  y: 216, // ~20% of 1080
  width: 1840,
  fontSize: '36px',
  fontWeight: 'bold',
  textAlign: 'center',
  color: '#ffffff',
};

export const DEFAULT_SONG_TRANSLATION_STYLE: SongContentStyle = {
  x: 40,
  y: 810, // ~75% of 1080
  width: 1840,
  fontSize: '24px',
  fontWeight: 'normal',
  textAlign: 'center',
  color: '#ffffff',
};

/**
 * Ensures a template slide has song content styles, applying defaults if missing
 */
export function ensureSongContentStyles(slide: TemplateSlide, aspectRatio: AspectRatio = '16:9'): TemplateSlide {
  const { height } = ASPECT_RATIO_DIMENSIONS[aspectRatio];
  const { width } = ASPECT_RATIO_DIMENSIONS[aspectRatio];
  
  // Scale defaults based on aspect ratio (defaults are for 16:9 1920x1080)
  const scaleY = height / 1080;
  const scaleX = width / 1920;
  
  return {
    ...slide,
    songTitleStyle: slide.songTitleStyle || {
      ...DEFAULT_SONG_TITLE_STYLE,
      x: Math.round(DEFAULT_SONG_TITLE_STYLE.x * scaleX),
      y: Math.round(DEFAULT_SONG_TITLE_STYLE.y * scaleY),
      width: Math.round(DEFAULT_SONG_TITLE_STYLE.width * scaleX),
    },
    songLyricsStyle: slide.songLyricsStyle || {
      ...DEFAULT_SONG_LYRICS_STYLE,
      x: Math.round(DEFAULT_SONG_LYRICS_STYLE.x * scaleX),
      y: Math.round(DEFAULT_SONG_LYRICS_STYLE.y * scaleY),
      width: Math.round(DEFAULT_SONG_LYRICS_STYLE.width * scaleX),
    },
    songTranslationStyle: slide.songTranslationStyle || {
      ...DEFAULT_SONG_TRANSLATION_STYLE,
      x: Math.round(DEFAULT_SONG_TRANSLATION_STYLE.x * scaleX),
      y: Math.round(DEFAULT_SONG_TRANSLATION_STYLE.y * scaleY),
      width: Math.round(DEFAULT_SONG_TRANSLATION_STYLE.width * scaleX),
    },
  };
}

export interface PresentationTemplate {
  id?: string;
  name: string;
  description?: string;
  aspectRatio?: AspectRatio;          // Template aspect ratio: '16:9' (default) or '4:3'
  
  // Multi-slide structure (new format)
  slides?: TemplateSlide[];           // Array of slides in the template
  referenceSlideIndex?: number;       // 0-based index of the slide used for song content overlay
  
  // Legacy single-slide fields (for backward compatibility)
  // These are used when slides array is not present
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  audios?: AudioElement[];
  text?: TextElement[];
  
  isDefault?: boolean;
  center_ids?: number[];              // Centers that have access to this template (empty = all centers)
  createdAt?: Date;
  updatedAt?: Date;
  yaml?: string;
}

export interface TemplateReference {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
}

// Core entity interfaces

export interface Song {
  id: string;
  name: string;
  externalSourceUrl: string;
  
  // Cached data from external source
  lyrics?: string;
  meaning?: string;
  language?: string;
  deity?: string;
  tempo?: string;
  beat?: string;
  raga?: string;
  level?: string;
  songTags?: string;
  audioLink?: string;
  videoLink?: string;
  goldenVoice?: boolean;
  referenceGentsPitch?: string;
  referenceLadiesPitch?: string;
  
  createdBy?: string;                  // User ID who created the song
  createdAt: Date;
  updatedAt: Date;
}

export interface Singer {
  id: string;
  name: string;
  gender?: 'Male' | 'Female' | 'Boy' | 'Girl' | 'Other';
  email?: string;                      // Optional email for singer
  center_ids?: number[];               // Centers that have access to this singer (empty = all centers)
  editor_for?: number[];               // Centers this user can edit (if they have editor permissions)
  is_admin?: boolean;                  // Whether this user is an admin
  createdAt: Date;
  updatedAt: Date;
}

export interface SongSingerPitch {
  id: string;
  songId: string;
  singerId: string;
  pitch: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NamedSession {
  id: string;
  name: string;
  description?: string;
  center_ids?: number[];              // Centers that have access to this session (empty = all centers)
  created_by?: string;                // Email of user who created the session
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionItem {
  id: string;
  sessionId: string;
  songId: string;
  singerId?: string;
  pitch?: string;
  sequenceOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionItemWithDetails extends SessionItem {
  songName: string;
  singerName?: string;
}

export interface NamedSessionWithItems extends NamedSession {
  items: SessionItemWithDetails[];
}

// Presentation interfaces

export interface Slide {
  index: number;
  content: string;
  translation?: string;
  songName: string;
  singerName?: string;
  pitch?: string;
  /** 1-based position of this slide within its song, when the song spans multiple slides */
  songSlideNumber?: number;
  /** Total number of slides for this song, when the song spans multiple slides */
  songSlideCount?: number;
  /** Metadata about the next slide, for UI hints */
  nextSongName?: string;
  nextSingerName?: string;
  nextPitch?: string;
  /** True when the next slide is the same song continued */
  nextIsContinuation?: boolean;
  /** Type of slide: 'song' for song content, 'static' for template-only slides */
  slideType?: 'song' | 'static';
  /** For static slides, the template slide configuration to use */
  templateSlide?: TemplateSlide;
}

export interface SongWithPitches extends Song {
  pitches: Array<{
    singerId: string;
    singerName: string;
    pitch: string;
  }>;
}

// Service method input types

export interface CreateSongInput {
  name: string;
  externalSourceUrl: string;
  lyrics?: string;
  meaning?: string;
  language?: string;
  deity?: string;
  tempo?: string;
  beat?: string;
  raga?: string;
  level?: string;
  songTags?: string;
  audioLink?: string;
  videoLink?: string;
  goldenVoice?: boolean;
  referenceGentsPitch?: string;
  referenceLadiesPitch?: string;
}

export interface UpdateSongInput {
  name?: string;
  externalSourceUrl?: string;
}

export interface CreateSingerInput {
  name: string;
  gender?: 'Male' | 'Female' | 'Boy' | 'Girl' | 'Other';
  email?: string;
  center_ids?: number[];
}

export interface UpdateSingerInput {
  name?: string;
  gender?: 'Male' | 'Female' | 'Boy' | 'Girl' | 'Other';
  email?: string;
  center_ids?: number[];
}

export interface CreatePitchInput {
  songId: string;
  singerId: string;
  pitch: string;
}

export interface UpdatePitchInput {
  pitch?: string;
}

export interface CreateNamedSessionInput {
  name: string;
  description?: string;
  center_ids?: number[];
}

export interface UpdateNamedSessionInput {
  name?: string;
  description?: string;
  center_ids?: number[];
}

export interface CreateSessionItemInput {
  sessionId: string;
  songId: string;
  singerId?: string;
  pitch?: string;
  sequenceOrder: number;
}

export interface UpdateSessionItemInput {
  singerId?: string;
  pitch?: string;
  sequenceOrder?: number;
}

// Service method return types

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: unknown;
}

// Error types

export const ErrorCode = {
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  QUERY_ERROR: 'QUERY_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export class DatabaseError extends Error {
  code: ErrorCode;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends Error {
  code: ErrorCode;
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = ErrorCode.VALIDATION_ERROR;
    this.field = field;
  }
}

// Search and filter types

export interface SearchOptions {
  query?: string;
  singerId?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
