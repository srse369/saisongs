// Core entity interfaces

export interface Song {
  id: string;
  name: string;
  sairhythmsUrl: string;
  
  // Cached data from Sairhythms.org
  title?: string;
  title2?: string;
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
  ulink?: string;
  goldenVoice?: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Singer {
  id: string;
  name: string;
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
  sairhythmsUrl: string;
  title?: string;
  title2?: string;
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
  ulink?: string;
  goldenVoice?: boolean;
}

export interface UpdateSongInput {
  name?: string;
  sairhythmsUrl?: string;
}

export interface CreateSingerInput {
  name: string;
}

export interface UpdateSingerInput {
  name?: string;
}

export interface CreatePitchInput {
  songId: string;
  singerId: string;
  pitch: string;
}

export interface UpdatePitchInput {
  pitch?: string;
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
