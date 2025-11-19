import express from 'express';
import oracledb from 'oracledb';
import { databaseService } from '../services/DatabaseService.js';

const router = express.Router();

// Helper function to safely extract Oracle values (handles CLOBs and circular refs)
function extractValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  // If it's a Lob (CLOB/BLOB), we currently convert it in SQL using DBMS_LOB.SUBSTR,
  // so we should not normally see LOB instances here. As a safety net, return null.
  if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Lob') {
    return null;
  }
  // If it's a Date, convert to ISO string
  if (value instanceof Date) {
    return value.toISOString();
  }
  // Return primitive values as-is
  return value;
}

// Get all songs
router.get('/', async (req, res) => {
  try {
    const songs = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        sairhythms_url,
        title,
        title2,
        DBMS_LOB.SUBSTR(lyrics, 4000, 1) AS lyrics,
        DBMS_LOB.SUBSTR(meaning, 4000, 1) AS meaning,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        DBMS_LOB.SUBSTR(song_tags, 4000, 1) AS song_tags,
        audio_link,
        video_link,
        ulink,
        golden_voice,
        created_at,
        updated_at
      FROM songs
      ORDER BY name
    `);
    // Map only the fields we need to avoid circular references from Oracle metadata
    // and convert to the camelCase shape expected by the frontend `Song` type.
    const mappedSongs = songs.map((song: any) => ({
      id: extractValue(song.ID),
      name: extractValue(song.NAME),
      sairhythmsUrl: extractValue(song.SAIRHYTHMS_URL),
      title: extractValue(song.TITLE),
      title2: extractValue(song.TITLE2),
      lyrics: extractValue(song.LYRICS),
      meaning: extractValue(song.MEANING),
      language: extractValue(song.LANGUAGE),
      deity: extractValue(song.DEITY),
      tempo: extractValue(song.TEMPO),
      beat: extractValue(song.BEAT),
      raga: extractValue(song.RAGA),
      level: extractValue(song.SONG_LEVEL),
      songTags: extractValue(song.SONG_TAGS),
      audioLink: extractValue(song.AUDIO_LINK),
      videoLink: extractValue(song.VIDEO_LINK),
      ulink: extractValue(song.ULINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT)
    }));
    res.json(mappedSongs);
  } catch (error) {
    console.error('Error fetching songs:', error);
    // Return empty array if database not configured or connection failed (for development)
    if (error instanceof Error && (
      error.message.includes('not configured') ||
      error.message.includes('connection request timeout') ||
      error.message.includes('connection failed') ||
      error.message.includes('TLS handshake')
    )) {
      console.log('⚠️  Database not ready, returning empty array');
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Get song by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const songs = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        sairhythms_url,
        title,
        title2,
        DBMS_LOB.SUBSTR(lyrics, 4000, 1) AS lyrics,
        DBMS_LOB.SUBSTR(meaning, 4000, 1) AS meaning,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as song_level,
        DBMS_LOB.SUBSTR(song_tags, 4000, 1) AS song_tags,
        audio_link,
        video_link,
        ulink,
        golden_voice,
        created_at,
        updated_at
      FROM songs
      WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    if (songs.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    // Map only the fields we need to avoid circular references from Oracle metadata
    // and convert to the camelCase shape expected by the frontend `Song` type.
    const song = songs[0];
    const mappedSong = {
      id: extractValue(song.ID),
      name: extractValue(song.NAME),
      sairhythmsUrl: extractValue(song.SAIRHYTHMS_URL),
      title: extractValue(song.TITLE),
      title2: extractValue(song.TITLE2),
      lyrics: extractValue(song.LYRICS),
      meaning: extractValue(song.MEANING),
      language: extractValue(song.LANGUAGE),
      deity: extractValue(song.DEITY),
      tempo: extractValue(song.TEMPO),
      beat: extractValue(song.BEAT),
      raga: extractValue(song.RAGA),
      level: extractValue(song.SONG_LEVEL),
      songTags: extractValue(song.SONG_TAGS),
      audioLink: extractValue(song.AUDIO_LINK),
      videoLink: extractValue(song.VIDEO_LINK),
      ulink: extractValue(song.ULINK),
      goldenVoice: !!extractValue(song.GOLDEN_VOICE),
      createdAt: extractValue(song.CREATED_AT),
      updatedAt: extractValue(song.UPDATED_AT)
    };
    res.json(mappedSong);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Create new song
router.post('/', async (req, res) => {
  try {
    const {
      name,
      sairhythms_url,
      title,
      title2,
      lyrics,
      meaning,
      language,
      deity,
      tempo,
      beat,
      raga,
      level,
      song_tags,
      audio_link,
      video_link,
      ulink,
      golden_voice
    } = req.body;

    // Debug: Log what we received
    console.log('📝 Creating song with data:', {
      name,
      sairhythms_url: sairhythms_url?.substring(0, 50),
      has_lyrics: !!lyrics,
      lyrics_length: lyrics?.length || 0,
      has_meaning: !!meaning,
      meaning_length: meaning?.length || 0
    });

    // Use empty strings for all nullable fields (Oracle treats empty string as NULL for VARCHAR2)
    const params = [
      String(name || ''),
      String(sairhythms_url || ''),
      String(title || ''),
      String(title2 || ''),
      String(lyrics || ''),
      String(meaning || ''),
      String(language || ''),
      String(deity || ''),
      String(tempo || ''),
      String(beat || ''),
      String(raga || ''),
      String(level || ''),
      String(song_tags || ''),
      String(audio_link || ''),
      String(video_link || ''),
      String(ulink || ''),
      Number(golden_voice || 0)
    ];

    await databaseService.query(`
      INSERT INTO songs (
        name, sairhythms_url, title, title2, lyrics, meaning,
        "LANGUAGE", deity, tempo, beat, raga, "LEVEL",
        song_tags, audio_link, video_link, ulink, golden_voice
      ) VALUES (
        :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17
      )
    `, params);

    res.status(201).json({ message: 'Song created successfully' });
  } catch (error) {
    console.error('Error creating song:', error);
    res.status(500).json({ error: 'Failed to create song' });
  }
});

// Update song
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      sairhythms_url,
      title,
      title2,
      lyrics,
      meaning,
      language,
      deity,
      tempo,
      beat,
      raga,
      level,
      song_tags,
      audio_link,
      video_link,
      ulink,
      golden_voice
    } = req.body;

    // Use empty strings for all nullable fields (Oracle treats empty string as NULL for VARCHAR2)
    const params = [
      String(name || ''),
      String(sairhythms_url || ''),
      String(title || ''),
      String(title2 || ''),
      String(lyrics || ''),
      String(meaning || ''),
      String(language || ''),
      String(deity || ''),
      String(tempo || ''),
      String(beat || ''),
      String(raga || ''),
      String(level || ''),
      String(song_tags || ''),
      String(audio_link || ''),
      String(video_link || ''),
      String(ulink || ''),
      Number(golden_voice || 0),
      String(id)
    ];

    await databaseService.query(`
      UPDATE songs SET
        name = :1,
        sairhythms_url = :2,
        title = :3,
        title2 = :4,
        lyrics = :5,
        meaning = :6,
        "LANGUAGE" = :7,
        deity = :8,
        tempo = :9,
        beat = :10,
        raga = :11,
        "LEVEL" = :12,
        song_tags = :13,
        audio_link = :14,
        video_link = :15,
        ulink = :16,
        golden_voice = :17,
        updated_at = CURRENT_TIMESTAMP
      WHERE RAWTOHEX(id) = :18
    `, params);

    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// Delete song
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await databaseService.query(`
      DELETE FROM songs WHERE RAWTOHEX(id) = :1
    `, [id]);
    
    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

export default router;
