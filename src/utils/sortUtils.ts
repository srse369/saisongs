/**
 * Normalizes a string for sorting by removing special characters, leading numbers, and converting to lowercase
 * @param str - The string to normalize
 * @returns Normalized string suitable for comparison
 */
export function normalizeForSort(str: string): string {
  if (!str) return '';
  // Remove special characters, keep only alphanumeric and spaces
  let normalized = str.replace(/[^a-zA-Z0-9\s]/g, '');
  // Remove leading numbers and spaces
  normalized = normalized.replace(/^[\d\s]+/, '');
  // Convert to lowercase and trim
  return normalized.toLowerCase().trim();
}

/**
 * Compares two strings for sorting, ignoring special characters
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function compareStringsIgnoringSpecialChars(a: string, b: string): number {
  const normalizedA = normalizeForSort(a);
  const normalizedB = normalizeForSort(b);
  return normalizedA.localeCompare(normalizedB);
}
