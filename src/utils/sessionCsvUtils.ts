/**
 * Export and import session song list as CSV for local backup/restore.
 */

export const SESSION_CSV_HEADERS = ['songId', 'songName', 'singerId', 'singerName', 'pitch'] as const;

export interface SessionCsvRow {
  songId: string;
  songName: string;
  singerId: string;
  singerName: string;
  pitch: string;
}

/** Escape a CSV field (wrap in quotes if needed) */
function escapeCsvField(value: string): string {
  const str = String(value ?? '').trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build CSV content from session items */
export function buildSessionCsv(
  items: Array<{ songId: string; songName: string; singerId?: string; singerName?: string; pitch?: string }>
): string {
  const header = SESSION_CSV_HEADERS.join(',');
  const rows = items.map((item) =>
    SESSION_CSV_HEADERS.map((h) => escapeCsvField(item[h] ?? '')).join(',')
  );
  return [header, ...rows].join('\n');
}

/** Parse a CSV row handling quoted fields */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (inQuotes) {
      current += c;
    } else if (c === ',') {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse CSV content into rows */
export function parseSessionCsv(csvText: string): SessionCsvRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headerCols = parseCsvRow(headerLine);
  const songIdIdx = headerCols.findIndex((c) => c.toLowerCase() === 'songid');
  const songNameIdx = headerCols.findIndex((c) => c.toLowerCase() === 'songname');
  const singerIdIdx = headerCols.findIndex((c) => c.toLowerCase() === 'singerid');
  const singerNameIdx = headerCols.findIndex((c) => c.toLowerCase() === 'singername');
  const pitchIdx = headerCols.findIndex((c) => c.toLowerCase() === 'pitch');

  const rows: SessionCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : '');
    rows.push({
      songId: get(songIdIdx),
      songName: get(songNameIdx),
      singerId: get(singerIdIdx),
      singerName: get(singerNameIdx),
      pitch: get(pitchIdx),
    });
  }
  return rows;
}

/** Trigger browser download of a file */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
