// Resolution constants for each aspect ratio
export const ASPECT_RATIO_DIMENSIONS = {
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1600, height: 1200 },
};
// Default song content styles for reference slides
// These are used when a template doesn't have explicit styles defined
export const DEFAULT_SONG_TITLE_STYLE = {
    x: 40,
    y: 54, // ~5% of 1080
    width: 1840,
    height: 100, // auto-size if not specified
    fontSize: '48px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
};
export const DEFAULT_SONG_LYRICS_STYLE = {
    x: 40,
    y: 216, // ~20% of 1080
    width: 1840,
    height: 500, // ~46% of 1080
    fontSize: '36px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
};
export const DEFAULT_SONG_TRANSLATION_STYLE = {
    x: 40,
    y: 810, // ~75% of 1080
    width: 1840,
    height: 200, // ~18% of 1080
    fontSize: '24px',
    fontWeight: 'normal',
    textAlign: 'center',
    color: '#ffffff',
};
/**
 * Ensures a template slide has song content styles, applying defaults if missing
 */
export function ensureSongContentStyles(slide, aspectRatio = '16:9') {
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
        bottomLeftTextStyle: slide.bottomLeftTextStyle,
        bottomRightTextStyle: slide.bottomRightTextStyle,
    };
}
// Error types
export const ErrorCode = {
    DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
    QUERY_ERROR: 'QUERY_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};
export class DatabaseError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.details = details;
    }
}
export class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.code = ErrorCode.VALIDATION_ERROR;
        this.field = field;
    }
}
