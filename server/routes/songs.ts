import express from 'express';
import { cacheService } from '../services/CacheService.js';
import { databaseService } from '../services/DatabaseService.js';
import { extractFromHtml } from '../services/SongExtractor.js';
import { requireAuth } from '../middleware/simpleAuth.js';

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
    
    // Prevent browser caching to ensure fresh data after updates
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Create new song
router.post('/', requireAuth, async (req, res) => {
  try {
    const songData = req.body;
    const user = req.user;
    
    if (!songData.name || !songData.name.trim()) {
      return res.status(400).json({ error: 'Song name is required' });
    }
    
    if (!songData.language || !songData.language.trim()) {
      return res.status(400).json({ error: 'Language is required' });
    }
    
    if (!songData.deity || !songData.deity.trim()) {
      return res.status(400).json({ error: 'Deity is required' });
    }
    
    if (!songData.lyrics || !songData.lyrics.trim()) {
      return res.status(400).json({ error: 'Lyrics are required' });
    }
    
    // Add creator information (use email as it's unique and human-readable)
    const songWithCreator = {
      ...songData,
      created_by: user.email
    };
    
    console.log('📝 Creating song:', songData.name, 'by user:', user.email);
    const createdSong = await cacheService.createSong(songWithCreator);
    
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
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const songData = req.body;
    const user = req.user;
    
    // Add updater information
    const songWithUpdater = {
      ...songData,
      updated_by: user.email
    };
    
    console.log('📝 Updating song:', id, 'by user:', user.email);
    const updatedSong = await cacheService.updateSong(id, songWithUpdater);
    
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
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    console.log('🗑️ Delete request for song:', id, 'by user:', user.id, 'role:', user.role);
    
    // Get the song to check creator
    const song = await cacheService.getSong(id);
    if (!song) {
      return res.status(404).json({ 
        error: 'Song not found',
        message: 'The song you are trying to delete does not exist'
      });
    }
    
    // Check if song is used in pitches (applies to ALL users including admins)
    const pitchQuery = 'SELECT COUNT(*) as count FROM song_singer_pitches WHERE song_id = HEXTORAW(:1)';
    const pitchResult = await databaseService.query(pitchQuery, [id]);
    const pitchCount = pitchResult[0]?.COUNT || 0;
    
    if (pitchCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete song',
        message: `This song is used in ${pitchCount} pitch(es) and cannot be deleted. Please remove all pitch associations first.`
      });
    }
    
    // Check if song is used in sessions (applies to ALL users including admins)
    const sessionQuery = 'SELECT COUNT(*) as count FROM song_session_items WHERE song_id = HEXTORAW(:1)';
    const sessionResult = await databaseService.query(sessionQuery, [id]);
    const sessionCount = sessionResult[0]?.COUNT || 0;
    
    if (sessionCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete song',
        message: `This song is used in ${sessionCount} session(s) and cannot be deleted. Please remove from sessions first.`
      });
    }
    
    // Permission checks (only after ensuring no orphan data)
    if (user.role !== 'admin') {
      // Editors can only delete songs they created
      if (user.role === 'editor') {
        if (song.createdBy !== user.email) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'You can only delete songs that you created'
          });
        }
      } else {
        // Viewers cannot delete
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have permission to delete songs'
        });
      }
    }
    
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
