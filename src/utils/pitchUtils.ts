/**
 * Utility functions and constants for musical pitches
 */

// Base pitches (natural notes and sharps)
const BASE_PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Map pitches to numeric notation
const PITCH_TO_NUMBER: Record<string, number> = {
  'C': 1,
  'C#': 1.5,
  'D': 2,
  'D#': 2.5,
  'E': 3,
  'F': 4,
  'F#': 4.5,
  'G': 5,
  'G#': 5.5,
  'A': 6,
  'A#': 6.5,
  'B': 7,
};

// Generate pitch variations (base, major, minor)
const generatePitchVariations = (basePitch: string) => [
  basePitch,
  `${basePitch} major`,
  `${basePitch} minor`,
];

// Madhyam pitches
const MADHYAM_PITCHES = [
  '1 Madhyam',
  '1.5 Madhyam',
  '2 Madhyam',
  '2.5 Madhyam',
  '3 Madhyam',
  '4 Madhyam',
  '4.5 Madhyam',
  '5 Madhyam',
  '5.5 Madhyam',
  '6 Madhyam',
  '6.5 Madhyam',
  '7 Madhyam',
] as const;

// All pitch options with variations (western pitches + Madhyam pitches)
export const ALL_PITCH_OPTIONS = [
  ...BASE_PITCHES.flatMap(generatePitchVariations),
  ...MADHYAM_PITCHES,
];

export type Pitch = typeof ALL_PITCH_OPTIONS[number];

/**
 * Validates if a string is a valid pitch
 */
export function isValidPitch(pitch: string): boolean {
  return ALL_PITCH_OPTIONS.includes(pitch as Pitch);
}

/**
 * Formats a pitch for display using numeric notation
 * Examples:
 * - "C" -> "1"
 * - "C major" -> "1M"
 * - "D# minor" -> "2.5m"
 * - "1 Madhyam" -> "1 Madhyam"
 */
export function formatPitch(pitch: string): string {
  // If it's a Madhyam pitch, return as-is
  if (pitch.includes('Madhyam')) {
    return pitch;
  }
  
  // Check if it's a major or minor variation
  if (pitch.endsWith(' major')) {
    const basePitch = pitch.replace(' major', '');
    const number = PITCH_TO_NUMBER[basePitch];
    return `${number}M`;
  } else if (pitch.endsWith(' minor')) {
    const basePitch = pitch.replace(' minor', '');
    const number = PITCH_TO_NUMBER[basePitch];
    return `${number}m`;
  } else {
    // Base pitch without major/minor
    const number = PITCH_TO_NUMBER[pitch];
    return `${number}`;
  }
}

/**
 * Formats a pitch for display in the dropdown (shows both notation and name)
 * Examples:
 * - "C" -> "1 (C)"
 * - "C major" -> "1M (C major)"
 * - "D# minor" -> "2.5m (D♯ minor)"
 */
export function formatPitchWithName(pitch: string): string {
  const numeric = formatPitch(pitch);
  const displayName = pitch.replace('#', '♯');
  return `${numeric} (${displayName})`;
}

