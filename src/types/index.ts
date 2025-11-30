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
}

export interface TextElement {
  id: string;
  content: string;
  position?: PositionType;
  x?: number | string;
  y?: number | string;
  fontSize?: string;
  color?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number;
  zIndex?: number;
  maxWidth?: string;
}

// Individual slide within a multi-slide template
export interface TemplateSlide {
  background?: BackgroundElement;
  images?: ImageElement[];
  videos?: VideoElement[];
  text?: TextElement[];
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
  text?: TextElement[];
  
  isDefault?: boolean;
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
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Singer {
  id: string;
  name: string;
  gender?: 'Male' | 'Female' | 'Boy' | 'Girl' | 'Other';
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
}

export interface UpdateSingerInput {
  name?: string;
  gender?: 'Male' | 'Female' | 'Boy' | 'Girl' | 'Other';
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
}

export interface UpdateNamedSessionInput {
  name?: string;
  description?: string;
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
