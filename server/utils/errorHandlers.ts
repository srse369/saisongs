/**
 * Utility functions for consistent error handling in routes
 */

/**
 * Handle common database errors and return appropriate HTTP responses
 * Checks for unique constraint violations and not found errors
 * @param error - The error object
 * @returns Object with status code and error response, or null if no special handling needed
 */
export function handleDatabaseError(error: any): { status: number; json: { error: string } } | null {
  if (error.message && error.message.includes('unique constraint')) {
    return {
      status: 409,
      json: { error: 'Resource name already exists' }
    };
  }
  
  if (error.message && error.message.includes('not found')) {
    return {
      status: 404,
      json: { error: 'Resource not found' }
    };
  }
  
  return null;
}

/**
 * Handle session-specific database errors
 * @param error - The error object
 * @returns Object with status code and error response, or null if no special handling needed
 */
export function handleSessionError(error: any): { status: number; json: { error: string } } | null {
  if (error.message && error.message.includes('unique constraint')) {
    return {
      status: 409,
      json: { error: 'Session name already exists' }
    };
  }
  
  if (error.message && error.message.includes('not found')) {
    return {
      status: 404,
      json: { error: 'Session not found' }
    };
  }
  
  return null;
}
