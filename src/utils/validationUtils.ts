import { ValidationError } from '../types';

/**
 * Validates that a string is not empty or only whitespace
 * 
 * @param value - The string to validate
 * @param fieldName - Name of the field for error messages
 * @throws ValidationError if the string is empty or only whitespace
 */
export function validateRequired(value: string | undefined | null, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

/**
 * Validates that a string does not exceed a maximum length
 * 
 * @param value - The string to validate
 * @param maxLength - Maximum allowed length
 * @param fieldName - Name of the field for error messages
 * @throws ValidationError if the string exceeds maxLength
 */
export function validateMaxLength(value: string, maxLength: number, fieldName: string): void {
  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not exceed ${maxLength} characters`,
      fieldName
    );
  }
}

/**
 * Validates that a string meets a minimum length requirement
 * 
 * @param value - The string to validate
 * @param minLength - Minimum required length
 * @param fieldName - Name of the field for error messages
 * @throws ValidationError if the string is shorter than minLength
 */
export function validateMinLength(value: string, minLength: number, fieldName: string): void {
  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`,
      fieldName
    );
  }
}

/**
 * Validates song name input
 * 
 * @param name - The song name to validate
 * @throws ValidationError if validation fails
 */
export function validateSongName(name: string | undefined | null): void {
  validateRequired(name, 'Song name');
  if (name) {
    validateMaxLength(name, 255, 'Song name');
  }
}

/**
 * Validates song lyrics input
 * 
 * @param lyrics - The lyrics to validate
 * @throws ValidationError if validation fails
 */
export function validateLyrics(lyrics: string | undefined | null): void {
  validateRequired(lyrics, 'Lyrics');
}

/**
 * Validates singer name input
 * 
 * @param name - The singer name to validate
 * @throws ValidationError if validation fails
 */
export function validateSingerName(name: string | undefined | null): void {
  validateRequired(name, 'Singer name');
  if (name) {
    validateMaxLength(name, 255, 'Singer name');
  }
}

/**
 * Validates pitch value input
 * 
 * @param pitch - The pitch value to validate
 * @throws ValidationError if validation fails
 */
export function validatePitch(pitch: string | undefined | null): void {
  validateRequired(pitch, 'Pitch');
  if (pitch) {
    validateMaxLength(pitch, 50, 'Pitch');
  }
}

/**
 * Sanitizes text input by trimming whitespace and removing potentially harmful characters
 * 
 * @param text - The text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  return text.trim();
}

/**
 * Checks if a string is a valid UUID
 * 
 * @param value - The string to check
 * @returns true if the string is a valid UUID, false otherwise
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}
