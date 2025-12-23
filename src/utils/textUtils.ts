/**
 * Converts a string to title case (first letter of each word capitalized)
 * Handles edge cases like all caps, all lowercase, etc.
 * @param text - The text to convert
 * @returns The text in title case
 */
export function toTitleCase(text: string | undefined | null): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
