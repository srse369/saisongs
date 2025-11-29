import express from 'express';
import { cacheService } from '../services/CacheService.js';
import { databaseService } from '../services/DatabaseService.js';
import { extractFromHtml } from '../services/SongExtractor.js';

const router = express.Router();

// Get all songs
router.get('/', async (req, res) => {
  try {
    const songs = await cacheService.getAllSongs();
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Get song by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const song = await cacheService.getSong(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Create new song
router.post('/', async (req, res) => {
  try {
    const songData = req.body;
    
    if (!songData.name || !songData.name.trim()) {
      return res.status(400).json({ error: 'Song name is required' });
    }
    
    console.log('📝 Creating song:', songData.name);
    const createdSong = await cacheService.createSong(songData);
    
    if (createdSong) {
      console.log('✅ Song created:', createdSong.id);
      res.status(201).json(createdSong);
    } else {
      console.log('⚠️ Song created but not returned');
      res.status(201).json({ message: 'Song created successfully' });
    }
  } catch (error) {
    console.error('Error creating song:', error);
    res.status(500).json({ error: 'Failed to create song' });
  }
});

// Update song
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const songData = req.body;
    
    console.log('📝 Updating song:', id);
    const updatedSong = await cacheService.updateSong(id, songData);
    
    if (updatedSong) {
      console.log('✅ Song updated:', id);
      res.json(updatedSong);
    } else {
      res.json({ message: 'Song updated successfully' });
    }
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// Delete song
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting song:', id);
    await cacheService.deleteSong(id);
    console.log('✅ Song deleted:', id);
    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

// Sync song with external data (extract metadata and update database)
router.post('/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    const { externalUrl } = req.body;

    if (!externalUrl) {
      return res.status(400).json({ error: 'externalUrl is required' });
    }

    console.log(`🔄 Syncing song ${id} from: ${externalUrl}`);

    // Fetch external page
    const response = await fetch(externalUrl);
    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch external URL' });
    }

    const html = await response.text();
    const origin = new URL(externalUrl).origin;

    // Extract metadata using SongExtractor
    const extracted = extractFromHtml(html, origin);

    // Build conditional UPDATE statement for all found fields
    const fieldsToUpdate: { column: string; value: any }[] = [];

    if (extracted.referenceGentsPitch) fieldsToUpdate.push({ column: 'reference_gents_pitch', value: extracted.referenceGentsPitch });
    if (extracted.referenceLadiesPitch) fieldsToUpdate.push({ column: 'reference_ladies_pitch', value: extracted.referenceLadiesPitch });
    if (extracted.lyrics) fieldsToUpdate.push({ column: 'lyrics', value: extracted.lyrics });
    if (extracted.meaning) fieldsToUpdate.push({ column: 'meaning', value: extracted.meaning });
    if (extracted.audioLink) fieldsToUpdate.push({ column: 'audio_link', value: extracted.audioLink });
    if (extracted.videoLink) fieldsToUpdate.push({ column: 'video_link', value: extracted.videoLink });
    if (extracted.deity) fieldsToUpdate.push({ column: 'deity', value: extracted.deity });
    if (extracted.language) fieldsToUpdate.push({ column: 'language', value: extracted.language });
    if (extracted.raga) fieldsToUpdate.push({ column: 'raga', value: extracted.raga });
    if (extracted.beat) fieldsToUpdate.push({ column: 'beat', value: extracted.beat });
    if (extracted.level) fieldsToUpdate.push({ column: 'level', value: extracted.level });
    if (extracted.tempo) fieldsToUpdate.push({ column: 'tempo', value: extracted.tempo });
    if (Array.isArray(extracted.songTags) && extracted.songTags.length) fieldsToUpdate.push({ column: 'song_tags', value: extracted.songTags.join(',') });
    if (typeof extracted.goldenVoice === 'boolean') fieldsToUpdate.push({ column: 'golden_voice', value: extracted.goldenVoice ? 1 : 0 });

    if (fieldsToUpdate.length) {
      // Build conditional UPDATE with proper column quoting for Oracle reserved words
      const setParts: string[] = [];
      const params: any[] = [];
      let idx = 1;

      // Function to quote column names if they are Oracle reserved words
      const quoteColumn = (col: string) => {
        const reserved = ['language', 'level'];
        if (reserved.includes(col.toLowerCase())) {
          return `"${col.toUpperCase()}"`;
        }
        return col;
      };

      for (const f of fieldsToUpdate) {
        setParts.push(`${quoteColumn(f.column)} = :${idx}`);
        params.push(f.value);
        idx++;
      }

      setParts.push('updated_at = CURRENT_TIMESTAMP');
      const updateQuery = `UPDATE songs SET ${setParts.join(', ')} WHERE id = :${idx}`;
      params.push(id);

      await databaseService.query(updateQuery, params);

      // Invalidate cache for song and all songs
      cacheService.invalidate('songs:all');
      cacheService.invalidate(`song:${id}`);

      const updatesSummary: any = {};
      for (const f of fieldsToUpdate) updatesSummary[f.column] = f.value;

      res.json({ message: 'Song synced successfully', updates: updatesSummary });
    } else {
      res.json({ message: 'Song synced but no data found to update', updates: {} });
    }
  } catch (error) {
    console.error('Error syncing song:', error);
    res.status(500).json({ error: 'Failed to sync song' });
  }
});
// Extract reference pitches from external URL (proxy to avoid CORS)
router.post('/extract-pitches', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`📊 Extracting reference pitches from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.log(`❌ Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return res.json({ referenceGentsPitch: null, referenceLadiesPitch: null });
    }

    const html = await response.text();

    // Extract gents pitch
    const gentsPattern = /Reference Gents Pitch<\/div><div[^>]*>\s*(\d+(?:\.\d+)?)\s+(Pancham|Madhyam)\s*\/\s*([A-G][#b]?)/i;
    const gentsMatch = html.match(gentsPattern);
    let gentsPitch: string | null = null;

    if (gentsMatch) {
      const [, number, type, westernNote] = gentsMatch;
      if (type.toLowerCase() === 'madhyam') {
        gentsPitch = `${number} Madhyam`;
      } else {
        gentsPitch = westernNote;
      }
      console.log(`✅ Found Gents pitch: ${gentsPitch}`);
    } else {
      console.log(`⚠️ No Gents pitch found in HTML`);
    }

    // Extract ladies pitch
    const ladiesPattern = /Reference Ladies Pitch<\/div><div[^>]*>\s*(\d+(?:\.\d+)?)\s+(Pancham|Madhyam)\s*\/\s*([A-G][#b]?)/i;
    const ladiesMatch = html.match(ladiesPattern);
    let ladiesPitch: string | null = null;

    if (ladiesMatch) {
      const [, number, type, westernNote] = ladiesMatch;
      if (type.toLowerCase() === 'madhyam') {
        ladiesPitch = `${number} Madhyam`;
      } else {
        ladiesPitch = westernNote;
      }
      console.log(`✅ Found Ladies pitch: ${ladiesPitch}`);
    } else {
      console.log(`⚠️ No Ladies pitch found in HTML`);
    }

    res.json({ referenceGentsPitch: gentsPitch, referenceLadiesPitch: ladiesPitch });
  } catch (error) {
    console.error('Error extracting reference pitches:', error);
    res.status(500).json({ error: 'Failed to extract reference pitches' });
  }
});

export default router;
