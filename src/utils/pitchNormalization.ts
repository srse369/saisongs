/**
 * Utility for normalizing pitch formats from Beaverton to our database format
 */

export interface PitchMapping {
  beavertonFormat: string;
  normalizedFormat: string;
}

/**
 * Common pitch mappings from Beaverton format to our format
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

  '1M': 'C major',
  '2M': 'D major',
  '3M': 'E major',
  '4M': 'F major',
  '5M': 'G major',
  '6M': 'A major',
  '7M': 'B major',
  '1.5M': 'C# major',
  '2.5M': 'D# major',
  '3.5M': 'F major',
  '4.5M': 'F# major',
  '5.5M': 'G# major',
  '6.5M': 'A# major',
  '7.5M': 'C major',

  '1m': 'C minor',
  '2m': 'D minor',
  '3m': 'E minor',
  '4m': 'F minor',
  '5m': 'G minor',
  '6m': 'A minor',
  '7m': 'B minor',
  '1.5m': 'C# minor',
  '2.5m': 'D# minor',
  '3.5m': 'F minor',
  '4.5m': 'F# minor',
  '5.5m': 'G# minor',
  '6.5m': 'A# minor',
  '7.5m': 'C minor',

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
  '6.5Madhyam': '6.5 Madhyam'
};

/**
 * Normalize a Beaverton pitch format to our database format
 */
export function normalizePitch(beavertonPitch: string): string | null {
  if (!beavertonPitch) return null;
  
  const trimmed = beavertonPitch.trim();
  
  // Direct mapping
  if (PITCH_MAPPINGS[trimmed]) {
    return PITCH_MAPPINGS[trimmed];
  }
  
  // If already in standard format (C, D, E, F, G, A, B, C#, D#, F#, G#, A#)
  if (/^[A-G](#)?$/.test(trimmed)) {
    return trimmed;
  }
  
  return null;
}

/**
 * Check if a pitch format is recognized
 */
export function isRecognizedPitch(beavertonPitch: string): boolean {
  return normalizePitch(beavertonPitch) !== null;
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
export function addPitchMapping(beavertonFormat: string, normalizedFormat: string): void {
  PITCH_MAPPINGS[beavertonFormat] = normalizedFormat;
}

/**
 * Get all current pitch mappings
 */
export function getPitchMappings(): Record<string, string> {
  return { ...PITCH_MAPPINGS };
}

