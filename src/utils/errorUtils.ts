/**
 * Utility functions for consistent error handling
 */

/**
 * Extract error message from an error object with a fallback
 * @param error - The error object
 * @param fallback - Fallback message if error is not an Error instance
 * @returns The error message or fallback text
 */
export function getErrorMessage(error: unknown, fallback: string = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

/**
 * Check if an error message contains a specific string
 * @param error - The error object
 * @param searchString - String to search for in the error message
 * @returns true if error message contains the search string
 */
export function errorContains(error: unknown, searchString: string): boolean {
  const message = getErrorMessage(error, '');
  return message.includes(searchString);
}

/**
 * Handle error with type-safe message extraction
 * @param error - The error object
 * @returns Object with message and original error
 */
export function parseError(error: unknown) {
  return {
    message: getErrorMessage(error),
    originalError: error,
  };
}
