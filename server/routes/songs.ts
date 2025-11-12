import express from 'express';
import { databaseService } from '../services/DatabaseService';

const router = express.Router();

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
        lyrics,
        meaning,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as level,
        song_tags,
        audio_link,
        video_link,
        ulink,
        golden_voice,
        created_at,
        updated_at
      FROM songs
      ORDER BY name
    `);
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
    const songs = await databaseService.query(`
      SELECT 
        RAWTOHEX(id) as id,
        name,
        sairhythms_url,
        title,
        title2,
        lyrics,
        meaning,
        "LANGUAGE" as language,
        deity,
        tempo,
        beat,
        raga,
        "LEVEL" as level,
        song_tags,
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
    
    res.json(songs[0]);
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

    const result = await databaseService.query(`
      INSERT INTO songs (
        name, sairhythms_url, title, title2, lyrics, meaning,
        "LANGUAGE", deity, tempo, beat, raga, "LEVEL",
        song_tags, audio_link, video_link, ulink, golden_voice
      ) VALUES (
        :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17
      ) RETURNING RAWTOHEX(id) INTO :18
    `, [
      name, sairhythms_url, title, title2, lyrics, meaning,
      language, deity, tempo, beat, raga, level,
      song_tags, audio_link, video_link, ulink, golden_voice || 0,
      { dir: 3003, type: 2001 } // OUT parameter for ID
    ]);

    res.status(201).json({ message: 'Song created successfully', id: result });
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
    `, [
      name, sairhythms_url, title, title2, lyrics, meaning,
      language, deity, tempo, beat, raga, level,
      song_tags, audio_link, video_link, ulink, golden_voice || 0,
      id
    ]);

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
