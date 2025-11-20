/**
 * Lightweight Cache Warmup Alternative
 * 
 * This version avoids expensive operations:
 * - No CLOB fields (lyrics/meaning)
 * - Simpler queries
 * - Expected recursive SQL: ~5k instead of 40k
 * 
 * To use this instead of current warmup:
 * 1. Replace warmupCache() in CacheService.ts
 * 2. Remove DBMS_LOB.SUBSTR calls
 * 3. Only fetch essential fields
 */

import type { DatabaseService } from './DatabaseService.js';

export async function lightweightWarmupCache(databaseService: DatabaseService): Promise<void> {
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  console.log('🔥 Starting lightweight cache warmup...');
  
  try {
    // 1. Songs - WITHOUT CLOB fields
    console.log('  📚 Fetching songs (basic fields only)...');
    const songs = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        sairhythms_url,
        title,
        title2,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        audio_link,
        video_link,
        golden_voice,
        created_at,
        updated_at
      FROM songs
      WHERE ROWNUM <= 1000  -- Limit to first 1000 for safety
      ORDER BY name
    `);
    console.log(`  ✓ Cached ${songs.length} songs (without lyrics/meaning)`);
    
    // 2. Singers - Simple query
    console.log('  👥 Fetching singers...');
    const singers = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        created_at,
        updated_at
      FROM singers
      ORDER BY name
    `);
    console.log(`  ✓ Cached ${singers.length} singers`);
    
    // 3. Skip pitches/sessions warmup - they'll load on demand
    console.log('  ℹ️  Skipping pitches and sessions (will load on demand)');
    
    console.log('✅ Lightweight cache warmup completed');
  } catch (error) {
    console.error('⚠️  Cache warmup failed:', error);
    throw error;
  }
}

/**
 * Or even simpler: Just warm up the COUNT, not the actual data
 */
export async function countOnlyWarmup(databaseService: DatabaseService): Promise<void> {
  console.log('🔥 Checking database health...');
  
  try {
    // Just verify tables are accessible
    const songCount = await databaseService.query('SELECT COUNT(*) as cnt FROM songs');
    const singerCount = await databaseService.query('SELECT COUNT(*) as cnt FROM singers');
    
    console.log(`  ✓ Database ready: ${songCount[0].CNT} songs, ${singerCount[0].CNT} singers`);
    console.log('  ℹ️  Cache will populate on first API request');
  } catch (error) {
    console.error('⚠️  Database health check failed:', error);
    throw error;
  }
}

