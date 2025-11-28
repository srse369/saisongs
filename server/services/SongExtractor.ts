import { load } from 'cheerio';

export type ExtractResult = {
  title?: string | null;
  lyrics?: string | null;
  meaning?: string | null;
  audioLink?: string | null;
  videoLink?: string | null;
  deity?: string | null;
  language?: string | null;
  raga?: string | null;
  beat?: string | null;
  level?: string | null;
  tempo?: string | null;
  referenceGentsPitch?: string | null;
  referenceLadiesPitch?: string | null;
  songTags?: string[];
  goldenVoice?: boolean | null;
};

// Column size limits from schema (VARCHAR2)
const COLUMN_LIMITS: Record<string, number> = {
  deity: 100,
  language: 100,
  raga: 100,
  beat: 50,
  level: 50,
  tempo: 50,
  reference_gents_pitch: 50,
  reference_ladies_pitch: 50,
  audio_link: 500,
  video_link: 500,
};

function cleanText(s: string | undefined | null) {
  if (!s) return null;
  return s
    .replace(/\u00A0/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateField(fieldName: string, value: string | null): string | null {
  if (!value) return value;
  const limit = COLUMN_LIMITS[fieldName];
  if (limit && value.length > limit) {
    return value.substring(0, limit);
  }
  return value;
}

export function extractFromHtml(html: string, origin = ''): ExtractResult {
  const $ = load(html);

  const result: ExtractResult = {};

  // Title
  const h2 = $('h2.page-header').first().text();
  result.title = cleanText(h2) || null;

  // Lyrics: common container .lyrics-set
  const lyricsNodes = $('.lyrics-set');
  if (lyricsNodes.length) {
    // Collect song-first-line and song-line
    const lines: string[] = [];
    lyricsNodes.find('.song-first-line, .song-line').each((i, el) => {
      const t = $(el).text();
      if (t && t.trim()) lines.push(cleanText(t) as string);
    });
    if (lines.length) result.lyrics = lines.join('\n');
  }

  // Meaning
  const meaning = $('.devotional-song-meaning').first().text();
  result.meaning = cleanText(meaning) || null;

  // Audio - prefer <audio> source then link
  const audioSrc = $('audio source').attr('src') || $('.devotional-song-audio-link a').attr('href');
  result.audioLink = truncateField('audio_link', audioSrc ? (audioSrc.startsWith('http') ? audioSrc : origin + audioSrc) : null);

  // Video: look for iframe or links to youtube/vimeo
  const iframeSrc = $('iframe').attr('src');
  if (iframeSrc) result.videoLink = truncateField('video_link', iframeSrc.startsWith('http') ? iframeSrc : origin + iframeSrc);
  else {
    const vidLink = $('a[href*="youtube.com"], a[href*="youtu.be"], a[href*="vimeo.com"]').first().attr('href');
    if (vidLink) result.videoLink = truncateField('video_link', vidLink.startsWith('http') ? vidLink : origin + vidLink);
  }

  // Meta-based fallbacks
  if (!result.meaning) {
    const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
    if (ogDesc) result.meaning = cleanText(ogDesc);
  }

  // Structured metadata - each row has a specific class like deity-row, language-row, etc.
  // Structure: <div class="row devotional-song-meta-data-grid XYZ-row">
  //              <div class="col strong">Label</div>
  //              <div class="col">Value</div>
  //            </div>
  
  // Helper to extract value from a specific row class
  function extractFromRow(rowClass: string): string | null {
    const row = $(`.devotional-song-meta-data-grid.${rowClass}`);
    if (!row.length) return null;
    
    // For raga, extract from .raga-title span if present
    if (rowClass === 'raga-row') {
      const ragaTitle = row.find('.raga-title').first().text();
      if (ragaTitle) return cleanText(ragaTitle);
    }
    
    // Find the col that contains the value (the one after the .strong label)
    // The value col is the one that doesn't have .strong class
    const cols = row.find('.col');
    for (let i = 0; i < cols.length; i++) {
      const col = $(cols[i]);
      if (!col.find('.strong').length && !col.hasClass('strong')) {
        return cleanText(col.text());
      }
    }
    return null;
  }

  result.deity = truncateField('deity', extractFromRow('deity-row'));
  result.language = truncateField('language', extractFromRow('language-row'));
  result.raga = truncateField('raga', extractFromRow('raga-row'));
  result.beat = truncateField('beat', extractFromRow('beat-row'));
  result.level = truncateField('level', extractFromRow('level-row'));
  result.tempo = truncateField('tempo', extractFromRow('tempo-row'));

  // Pitches: pitch-row class contains both gents and ladies
  $('.devotional-song-meta-data-grid.pitch-row').each((i, el) => {
    const row = $(el);
    const cols = row.find('.col');
    
    let label = '';
    let value = '';
    
    for (let j = 0; j < cols.length; j++) {
      const col = $(cols[j]);
      if (col.find('.strong').length || col.hasClass('strong')) {
        label = cleanText(col.text()).toLowerCase();
      } else {
        value = cleanText(col.text());
      }
    }
    
    if (label.includes('gents')) {
      result.referenceGentsPitch = truncateField('reference_gents_pitch', value);
    } else if (label.includes('ladies')) {
      result.referenceLadiesPitch = truncateField('reference_ladies_pitch', value);
    }
  });

  // Tags: look for tag links in the song-tags-row
  const tagEls: string[] = [];
  $('.devotional-song-meta-data-grid.song-tags-row .tags-links a').each((i, el) => {
    const t = $(el).text();
    if (t) tagEls.push(cleanText(t) as string);
  });
  result.songTags = tagEls.map(s => s.replace(/:\s*\d+$/, '').trim()).filter(Boolean);

  // Golden voice: heuristic - presence of link to /song/tags/golden-voice or similar
  result.goldenVoice = !!($('a[href*="golden-voice"]').length);

  return result;
}

export default { extractFromHtml };
