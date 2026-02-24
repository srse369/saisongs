/**
 * Normalizes a UUID string for Oracle RAWTOHEX comparisons.
 * Oracle stores UUIDs as RAW (hex without hyphens) and RAWTOHEX returns uppercase.
 * This ensures the bind parameter matches Oracle's output format.
 */
export function toOracleHexId(id: string): string {
  return id.replace(/-/g, '').toUpperCase();
}
