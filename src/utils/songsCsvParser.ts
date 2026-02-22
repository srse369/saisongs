/**
 * Parse CSV files with song metadata (song title, song body, translation, deity, keywords).
 * Used for validating which songs exist in the database vs. missing.
 */

export interface SongsCsvRow {
  songTitle: string;
  songBody?: string;
  translation?: string;
  deity?: string;
  keywords?: string;
}

const TITLE_ALIASES = ['song title', 'song_title', 'songtitle', 'title', 'name', 'song name'];
const BODY_ALIASES = ['song body', 'song_body', 'songbody', 'body', 'lyrics'];
const TRANSLATION_ALIASES = ['translation', 'meaning'];
const DEITY_ALIASES = ['deity'];
const KEYWORDS_ALIASES = ['keywords', 'keyword', 'tags', 'songtags'];

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse CSV respecting quoted multi-line fields.
 * A row ends only when we see a newline outside of quotes.
 */
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (inQuotes) {
      currentField += char;
    } else if (char === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\r') {
      if (nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else if (char === '\n') {
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((f) => f.length > 0)) {
    rows.push(currentRow);
  }
  return rows;
}

/**
 * Parse a CSV string with headers. Expects columns: song title, song body, translation, deity, keywords.
 * Column names are matched case-insensitively with common variations.
 * Handles multi-line values in quoted fields (e.g. body, translation).
 */
export function parseSongsCsv(csvText: string): SongsCsvRow[] {
  const allRows = parseCsvRows(csvText);
  if (allRows.length < 2) return [];

  const headers = allRows[0];
  const titleIdx = findColumnIndex(headers, TITLE_ALIASES);
  if (titleIdx < 0) {
    throw new Error(
      `CSV must have a "song title" column. Found headers: ${headers.join(', ')}`
    );
  }

  const bodyIdx = findColumnIndex(headers, BODY_ALIASES);
  const translationIdx = findColumnIndex(headers, TRANSLATION_ALIASES);
  const deityIdx = findColumnIndex(headers, DEITY_ALIASES);
  const keywordsIdx = findColumnIndex(headers, KEYWORDS_ALIASES);

  const rows: SongsCsvRow[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const values = allRows[i];
    const title = values[titleIdx]?.trim();
    if (!title) continue;

    rows.push({
      songTitle: title,
      songBody: bodyIdx >= 0 ? values[bodyIdx]?.trim() : undefined,
      translation: translationIdx >= 0 ? values[translationIdx]?.trim() : undefined,
      deity: deityIdx >= 0 ? values[deityIdx]?.trim() : undefined,
      keywords: keywordsIdx >= 0 ? values[keywordsIdx]?.trim() : undefined,
    });
  }
  return rows;
}
