#!/usr/bin/env tsx
/**
 * Update Reference Pitches Script
 * 
 * Batch updates existing songs with reference pitch data scraped from external sources.
 * 
 * Usage:
 *   npx tsx scripts/update-reference-pitches.ts
 * 
 * Options:
 *   --dry-run : Preview changes without updating database
 *   --song-id=<id> : Update only a specific song by ID
 *   --limit=<n> : Limit updates to first N songs
 */

import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Pitch scraping logic (inline to avoid import issues in script)
function normalizePitch(inputPitch: string): string | null {
  const PITCH_MAPPINGS: Record<string, string> = {
    '1': 'C', '2': 'D', '3': 'E', '4': 'F', '5': 'G', '6': 'A', '7': 'B',
    '1.5': 'C#', '2.5': 'D#', '3.5': 'F', '4.5': 'F#', '5.5': 'G#', '6.5': 'A#', '7.5': 'C',
    'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'A': 'A', 'B': 'B',
    'C#': 'C#', 'D#': 'D#', 'F#': 'F#', 'G#': 'G#', 'A#': 'A#',
    '1Madhyam': '1 Madhyam', '2Madhyam': '2 Madhyam', '3Madhyam': '3 Madhyam',
    '4Madhyam': '4 Madhyam', '5Madhyam': '5 Madhyam', '6Madhyam': '6 Madhyam', '7Madhyam': '7 Madhyam',
    '1.5Madhyam': '1.5 Madhyam', '2.5Madhyam': '2.5 Madhyam', '3.5Madhyam': '3.5 Madhyam',
    '4.5Madhyam': '4.5 Madhyam', '5.5Madhyam': '5.5 Madhyam', '6.5Madhyam': '6.5 Madhyam'
  };

  if (!inputPitch) return null;
  
  const cleaned = inputPitch.trim().replace(/\s+/g, '');
  if (PITCH_MAPPINGS[cleaned]) {
    return PITCH_MAPPINGS[cleaned];
  }
  
  if (/^[A-G](#)?$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  
  return null;
}

function extractPitchFromHtml(html: string, gender: 'Gents' | 'Ladies'): string | null {
  try {
    // Pattern matches: <div class='col...strong'>Reference Gents Pitch</div><div class='col...'>4 Pancham / F</div>
    const pattern = new RegExp(
      `Reference ${gender} Pitch</div><div[^>]*>\\s*(\\d+(?:\\.\\d+)?)\\s+(Pancham|Madhyam)\\s*/\\s*([A-G][#b]?)`,
      'i'
    );

    const match = html.match(pattern);
    if (!match) return null;

    const [, number, type, westernNote] = match;

    // If Madhyam is specified, use the Indian notation format
    if (type.toLowerCase() === 'madhyam') {
      const madhyamPitch = `${number} Madhyam`;
      return normalizePitch(madhyamPitch);
    }

    // For Pancham, use the Western note
    return normalizePitch(westernNote);
  } catch (error) {
    console.error(`Error parsing ${gender} pitch:`, error);
    return null;
  }
}

function songNameToSlug(songName: string): string {
  return songName
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function scrapePitchesForSong(externalSourceUrl: string): Promise<{ gents: string | null; ladies: string | null }> {
  if (!externalSourceUrl) {
    console.error(`  ⚠️  No external source URL provided`);
    return { gents: null, ladies: null };
  }

  const url = externalSourceUrl;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`  ❌ Failed to fetch ${url}: ${response.status}`);
      return { gents: null, ladies: null };
    }

    const html = await response.text();
    
    const gentsPitch = extractPitchFromHtml(html, 'Gents');
    const ladiesPitch = extractPitchFromHtml(html, 'Ladies');

    return { gents: gentsPitch, ladies: ladiesPitch };
  } catch (error) {
    console.error(`  ❌ Error fetching ${url}:`, error instanceof Error ? error.message : error);
    return { gents: null, ladies: null };
  }
}

interface Song {
  id: string;
  name: string;
  externalSourceUrl: string;
  referenceGentsPitch: string | null;
  referenceLadiesPitch: string | null;
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const songIdArg = args.find(arg => arg.startsWith('--song-id='));
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  
  const specificSongId = songIdArg ? songIdArg.split('=')[1] : null;
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log('🎵 Reference Pitch Updater');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '✍️  LIVE UPDATE'}`);
  if (specificSongId) console.log(`Target: Specific song ID: ${specificSongId}`);
  if (limit) console.log(`Limit: First ${limit} songs`);
  console.log('='.repeat(60));
  console.log('');

  // Database connection
  let connection: oracledb.Connection | null = null;

  try {
    const walletPath = path.join(__dirname, '../wallet');
    
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
      walletLocation: walletPath,
      walletPassword: process.env.ORACLE_WALLET_PASSWORD || ''
    });

    console.log('✅ Connected to Oracle database\n');

    // Fetch songs
    let query = `
      SELECT 
        RAWTOHEX(id) as id,
        name,
        external_source_url,
        reference_gents_pitch,
        reference_ladies_pitch
      FROM songs
      WHERE UPPER(name) LIKE 'Z%'
    `;
    
    const params: any[] = [];
    
    if (specificSongId) {
      query += ' WHERE RAWTOHEX(id) = :1';
      params.push(specificSongId);
    } else {
      query += ' ORDER BY name';
      if (limit) {
        query += ` FETCH FIRST ${limit} ROWS ONLY`;
      }
    }

    const result = await connection.execute<Song>(query, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT
    });

    const songs = result.rows || [];
    console.log(`📋 Found ${songs.length} song(s) to process\n`);

    if (songs.length === 0) {
      console.log('No songs to update.');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const song of songs) {
      const songName = song.NAME as string;
      const songId = song.ID as string;
      const externalSourceUrl = song.EXTERNAL_SOURCE_URL as string;
      const currentGents = song.REFERENCE_GENTS_PITCH as string | null;
      const currentLadies = song.REFERENCE_LADIES_PITCH as string | null;

      console.log(`\n🎼 Processing: ${songName}`);
      console.log(`   ID: ${songId}`);
      console.log(`   External URL: ${externalSourceUrl || 'null'}`);
      console.log(`   Current Gents: ${currentGents || 'null'}`);
      console.log(`   Current Ladies: ${currentLadies || 'null'}`);

      // Skip if no external source URL
      if (!externalSourceUrl) {
        console.log(`   ⏭️  Skipped - no external source URL`);
        skippedCount++;
        continue;
      }

      // Scrape pitch data
      console.log(`   Fetching from external source...`);
      const pitches = await scrapePitchesForSong(externalSourceUrl);

      console.log(`   Scraped Gents: ${pitches.gents || 'null'}`);
      console.log(`   Scraped Ladies: ${pitches.ladies || 'null'}`);

      // Determine if update is needed
      const needsUpdate = pitches.gents !== currentGents || pitches.ladies !== currentLadies;

      if (!needsUpdate) {
        console.log(`   ⏭️  Skipped - no changes needed`);
        skippedCount++;
        continue;
      }

      if (dryRun) {
        console.log(`   🔍 DRY RUN - would update:`);
        console.log(`      Gents: ${currentGents || 'null'} → ${pitches.gents || 'null'}`);
        console.log(`      Ladies: ${currentLadies || 'null'} → ${pitches.ladies || 'null'}`);
        updatedCount++;
      } else {
        try {
          await connection.execute(
            `UPDATE songs 
             SET reference_gents_pitch = :1,
                 reference_ladies_pitch = :2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE RAWTOHEX(id) = :3`,
            [pitches.gents, pitches.ladies, songId],
            { autoCommit: true }
          );

          console.log(`   ✅ Updated successfully`);
          updatedCount++;
        } catch (error) {
          console.error(`   ❌ Error updating:`, error instanceof Error ? error.message : error);
          errorCount++;
        }
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total songs: ${songs.length}`);
    console.log(`   ${dryRun ? 'Would update' : 'Updated'}: ${updatedCount}`);
    console.log(`   Skipped (no changes): ${skippedCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n✅ Database connection closed');
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
  }
}

main();
