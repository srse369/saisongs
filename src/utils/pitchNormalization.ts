/**
 * Utility for normalizing pitch formats from CSV import to our database format
 */

export interface PitchMapping {
  sourceFormat: string;
  normalizedFormat: string;
}

/**
 * Common pitch mappings from various formats to our standard format
 */
const PITCH_MAPPINGS: Record<string, string> = {
  '1': 'C',
  '2': 'D',
  '3': 'E',
  '4': 'F',
  '5': 'G',
  '6': 'A',
  '7': 'B',
  '1.5': 'C#',
  '2.5': 'D#',
  '3.5': 'F',
  '4.5': 'F#',
  '5.5': 'G#',
  '6.5': 'A#',
  '7.5': 'C',
  'C(B#)': 'C',  // Cleaned format (spaces removed)

  '1M': 'C major',
  '2M': 'D major',
  '3M': 'E major',
  '4M': 'F major',
  '5M': 'G major',
  '6M': 'A major',
  '7M': 'B major',
  'CM': 'C major',
  'DM': 'D major',
  'EM': 'E major',
  'FM': 'F major',
  'GM': 'G major',
  'AM': 'A major',
  'BM': 'B major',
  '1.5M': 'C# major',
  '2.5M': 'D# major',
  '3.5M': 'F major',
  '4.5M': 'F# major',
  '5.5M': 'G# major',
  '6.5M': 'A# major',
  '7.5M': 'C major',
  'C#M': 'C# major',
  'D#M': 'D# major',
  'E#M': 'F major',
  'F#M': 'F# major',
  'G#M': 'G# major',
  'A#M': 'A# major',
  'B#M': 'C major',
  'FM(E#M)': 'F major',  // Cleaned format (spaces removed)

  '1m': 'C minor',
  '2m': 'D minor',
  '3m': 'E minor',
  '4m': 'F minor',
  '5m': 'G minor',
  '6m': 'A minor',
  '7m': 'B minor',
  'Cm': 'C minor',
  'Dm': 'D minor',
  'Em': 'E minor',
  'Fm': 'F minor',
  'Gm': 'G minor',
  'Am': 'A minor',
  'Bm': 'B minor',
  '1.5m': 'C# minor',
  '2.5m': 'D# minor',
  '3.5m': 'F minor',
  '4.5m': 'F# minor',
  '5.5m': 'G# minor',
  '6.5m': 'A# minor',
  '7.5m': 'C minor',
  'C#m': 'C# minor',
  'D#m': 'D# minor',
  'E#m': 'F minor',
  'F#m': 'F# minor',
  'G#m': 'G# minor',
  'A#m': 'A# minor',
  'B#m': 'C minor',

  // Note: Keys use cleaned format (no spaces), values are standardized output format
  '1Madhyam': '1 Madhyam',
  '2Madhyam': '2 Madhyam',
  '3Madhyam': '3 Madhyam',
  '4Madhyam': '4 Madhyam',
  '5Madhyam': '5 Madhyam',
  '6Madhyam': '6 Madhyam',
  '7Madhyam': '7 Madhyam',
  '1.5Madhyam': '1.5 Madhyam',
  '2.5Madhyam': '2.5 Madhyam',
  '3.5Madhyam': '3.5 Madhyam',
  '4.5Madhyam': '4.5 Madhyam',
  '5.5Madhyam': '5.5 Madhyam',
  '6.5Madhyam': '6.5 Madhyam',

  // Pancham format (e.g., "1 Pancham" = "1" = C, "2 Pancham" = "2" = D)
  '1Pancham': 'C',
  '2Pancham': 'D',
  '3Pancham': 'E',
  '4Pancham': 'F',
  '5Pancham': 'G',
  '6Pancham': 'A',
  '7Pancham': 'B',
  '1.5Pancham': 'C#',
  '2.5Pancham': 'D#',
  '3.5Pancham': 'F',
  '4.5Pancham': 'F#',
  '5.5Pancham': 'G#',
  '6.5Pancham': 'A#',
  '7.5Pancham': 'C',

  // Combined Pancham / Western format (e.g., "2 Pancham / D")
  '1Pancham/C': 'C',
  '2Pancham/D': 'D',
  '3Pancham/E': 'E',
  '4Pancham/F': 'F',
  '5Pancham/G': 'G',
  '6Pancham/A': 'A',
  '7Pancham/B': 'B',
  '1.5Pancham/C#': 'C#',
  '2.5Pancham/D#': 'D#',
  '3.5Pancham/F': 'F',
  '4.5Pancham/F#': 'F#',
  '5.5Pancham/G#': 'G#',
  '6.5Pancham/A#': 'A#',
  '7.5Pancham/C': 'C',
  // Also handle without the # symbol in combined format
  '1Pancham/C#': 'C#',
  '2Pancham/D#': 'D#',
  '4Pancham/F#': 'F#',
  '5Pancham/G#': 'G#',
  '6Pancham/A#': 'A#'
};

/**
 * Normalize a pitch format from CSV import to our database format
 * Note: Case is IMPORTANT! M = Major, m = minor
 */
export function normalizePitch(inputPitch: string): string | null {
  if (!inputPitch) return null;
  
  // Clean up: remove extra whitespace, non-breaking spaces, and normalize
  // BUT preserve case since M (major) vs m (minor) matters!
  let cleaned = inputPitch
    .trim()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/\u00A0/g, '') // Remove non-breaking spaces
    .replace(/\u200B/g, ''); // Remove zero-width spaces
  
  // Direct mapping (CASE-SENSITIVE by design: M=major, m=minor)
  if (PITCH_MAPPINGS[cleaned]) {
    return PITCH_MAPPINGS[cleaned];
  }
  
  // If already in standard format (C, D, E, F, G, A, B, C#, D#, F#, G#, A#)
  // Only single letters with optional # are case-insensitive
  if (/^[A-G](#)?$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  
  // Unrecognized pitch format
  return null;
}

/**
 * Check if a pitch format is recognized
 */
export function isRecognizedPitch(inputPitch: string): boolean {
  return normalizePitch(inputPitch) !== null;
}

/**
 * Get all unmapped pitches from a list
 */
export function getUnmappedPitches(pitches: string[]): string[] {
  const unmapped = new Set<string>();
  pitches.forEach(pitch => {
    if (!isRecognizedPitch(pitch)) {
      unmapped.add(pitch);
    }
  });
  return Array.from(unmapped).sort();
}

/**
 * Add a custom pitch mapping
 */
export function addPitchMapping(sourceFormat: string, normalizedFormat: string): void {
  PITCH_MAPPINGS[sourceFormat] = normalizedFormat;
}

/**
 * Remove a pitch mapping
 */
export function removePitchMapping(sourceFormat: string): void {
  delete PITCH_MAPPINGS[sourceFormat];
}

/**
 * Get all current pitch mappings
 */
export function getPitchMappings(): Record<string, string> {
  return { ...PITCH_MAPPINGS };
}

/**
 * Format a pitch for display with normalization
 * Returns format like "2M (D major)" or just "2 Madhyam" for Madhyam pitches (no redundant parenthetical)
 */
export function formatNormalizedPitch(inputPitch: string): string {
  if (!inputPitch) return '';
  
  const normalized = normalizePitch(inputPitch) || inputPitch;
  
  // Convert to numeric format using PITCH_TO_NUMBER logic
  let numericFormat: string;
  if (normalized.includes('Madhyam')) {
    // Madhyam pitches - just show as-is, no parenthetical needed
    return normalized;
  } else if (normalized.endsWith(' major')) {
    const basePitch = normalized.replace(' major', '');
    const number = PITCH_TO_NUMBER[basePitch];
    numericFormat = number ? `${number}M` : normalized;
  } else if (normalized.endsWith(' minor')) {
    const basePitch = normalized.replace(' minor', '');
    const number = PITCH_TO_NUMBER[basePitch];
    numericFormat = number ? `${number}m` : normalized;
  } else {
    const number = PITCH_TO_NUMBER[normalized];
    numericFormat = number || normalized;
  }
  
  // For non-Madhyam pitches, show numeric format with note name in parentheses
  const displayName = normalized.replace('#', '♯');
  return `${numericFormat} (${displayName})`;
}

// Pitch to number mappings for formatNormalizedPitch
const PITCH_TO_NUMBER: Record<string, string> = {
  'C': '1', 'D': '2', 'E': '3', 'F': '4', 'G': '5', 'A': '6', 'B': '7',
  'C#': '1.5', 'D#': '2.5', 'F#': '4.5', 'G#': '5.5', 'A#': '6.5'
};

