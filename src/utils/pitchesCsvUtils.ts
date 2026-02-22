/**
 * Parse pitches CSV (Song Name, Singer, Pitch) and return the set of song names
 * that have at least one pitch. Used to filter songs CSV validation.
 */

import { normalizeSongNameForMapping } from './songMatcher';

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField.trim());
  return fields;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h.includes(alias) || alias.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse pitches CSV and return a Set of normalized song names that have at least one pitch.
 * Supports header row (Song Name, Singer, Pitch) for flexible column order.
 */
export function parsePitchesCsvSongNames(csvText: string): Set<string> {
  const names = new Set<string>();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length === 0) return names;

  const firstParts = parseCSVLine(lines[0]);
  const firstLower = firstParts[0]?.toLowerCase() ?? '';
  let songIdx = 0;
  let singerIdx = 1;
  let pitchIdx = 2;
  let dataStartRow = 0;

  if (
    firstLower.includes('song') ||
    firstLower.includes('singer') ||
    firstLower.includes('pitch')
  ) {
    songIdx = findColumnIndex(firstParts, ['song', 'title', 'name']);
    singerIdx = findColumnIndex(firstParts, ['singer']);
    pitchIdx = findColumnIndex(firstParts, ['pitch', 'key']);
    if (songIdx < 0) songIdx = 0;
    if (singerIdx < 0) singerIdx = 1;
    if (pitchIdx < 0) pitchIdx = 2;
    dataStartRow = 1;
  }

  for (let i = dataStartRow; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    const songName = (parts[songIdx] ?? '').replace(/[,.\s]+$/, '').trim();
    const singerName = (parts[singerIdx] ?? '').trim();
    const pitch = (parts[pitchIdx] ?? '').trim();

    if (songName && singerName && pitch) {
      names.add(normalizeSongNameForMapping(songName));
    }
  }

  return names;
}

/**
 * Parse pitches CSV and return a Map of normalized song name -> count of pitches.
 * Each row (song, singer, pitch) counts as one pitch for that song.
 */
export function parsePitchesCsvSongNameCounts(csvText: string): Map<string, number> {
  const counts = new Map<string, number>();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length === 0) return counts;

  const firstParts = parseCSVLine(lines[0]);
  const firstLower = firstParts[0]?.toLowerCase() ?? '';
  let songIdx = 0;
  let singerIdx = 1;
  let pitchIdx = 2;
  let dataStartRow = 0;

  if (
    firstLower.includes('song') ||
    firstLower.includes('singer') ||
    firstLower.includes('pitch')
  ) {
    songIdx = findColumnIndex(firstParts, ['song', 'title', 'name']);
    singerIdx = findColumnIndex(firstParts, ['singer']);
    pitchIdx = findColumnIndex(firstParts, ['pitch', 'key']);
    if (songIdx < 0) songIdx = 0;
    if (singerIdx < 0) singerIdx = 1;
    if (pitchIdx < 0) pitchIdx = 2;
    dataStartRow = 1;
  }

  for (let i = dataStartRow; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    const songName = (parts[songIdx] ?? '').replace(/[,.\s]+$/, '').trim();
    const singerName = (parts[singerIdx] ?? '').trim();
    const pitch = (parts[pitchIdx] ?? '').trim();

    if (songName && singerName && pitch) {
      const key = normalizeSongNameForMapping(songName);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}
