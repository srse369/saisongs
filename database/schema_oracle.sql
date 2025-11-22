-- Song Studio Database Schema for Oracle Autonomous Database
-- This script creates the necessary tables and indexes for the Song Studio application

-- Drop existing tables if they exist (for clean setup)
BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE session_items CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE named_sessions CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE song_singer_pitches CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE singers CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE songs CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN NULL;
END;
/

-- Songs table
-- Stores song data cached from external sources for fast access and searching
CREATE TABLE songs (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    external_source_url VARCHAR2(500) NOT NULL UNIQUE,
    
    -- Cached data from external sources
    title VARCHAR2(500),
    title2 VARCHAR2(500),
    lyrics CLOB,
    meaning CLOB,
    "LANGUAGE" VARCHAR2(100),
    deity VARCHAR2(100),
    tempo VARCHAR2(50),
    beat VARCHAR2(50),
    raga VARCHAR2(100),
    "LEVEL" VARCHAR2(50),
    song_tags CLOB,
    audio_link VARCHAR2(500),
    video_link VARCHAR2(500),
    ulink VARCHAR2(500),
    golden_voice NUMBER(1) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Singers table
-- Stores singer/vocalist profiles
CREATE TABLE singers (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Song-Singer-Pitch associations table
-- Many-to-many relationship between songs and singers with pitch information
CREATE TABLE song_singer_pitches (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    song_id RAW(16) NOT NULL,
    singer_id RAW(16) NOT NULL,
    pitch VARCHAR2(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ssp_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    CONSTRAINT fk_ssp_singer FOREIGN KEY (singer_id) REFERENCES singers(id) ON DELETE CASCADE,
    CONSTRAINT uk_song_singer UNIQUE (song_id, singer_id)
);

-- Named Sessions table
-- Stores saved session configurations with a name
CREATE TABLE named_sessions (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL UNIQUE,
    description VARCHAR2(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session Items table
-- Stores the ordered sequence of songs in a named session
CREATE TABLE session_items (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    session_id RAW(16) NOT NULL,
    song_id RAW(16) NOT NULL,
    singer_id RAW(16),
    pitch VARCHAR2(50),
    sequence_order NUMBER(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_si_session FOREIGN KEY (session_id) REFERENCES named_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_si_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    CONSTRAINT fk_si_singer FOREIGN KEY (singer_id) REFERENCES singers(id) ON DELETE SET NULL,
    CONSTRAINT uk_session_sequence UNIQUE (session_id, sequence_order)
);

-- Indexes for performance optimization
CREATE INDEX idx_songs_name ON songs(name);
CREATE INDEX idx_songs_title2 ON songs(title2);
CREATE INDEX idx_songs_language ON songs("LANGUAGE");
CREATE INDEX idx_songs_deity ON songs(deity);
CREATE INDEX idx_songs_tempo ON songs(tempo);
CREATE INDEX idx_songs_beat ON songs(beat);
CREATE INDEX idx_songs_raga ON songs(raga);
CREATE INDEX idx_songs_level ON songs("LEVEL");
CREATE INDEX idx_song_singer_pitches_song_id ON song_singer_pitches(song_id);
CREATE INDEX idx_song_singer_pitches_singer_id ON song_singer_pitches(singer_id);
CREATE INDEX idx_named_sessions_name ON named_sessions(name);
CREATE INDEX idx_session_items_session_id ON session_items(session_id);
CREATE INDEX idx_session_items_song_id ON session_items(song_id);
CREATE INDEX idx_session_items_singer_id ON session_items(singer_id);
CREATE INDEX idx_session_items_sequence ON session_items(session_id, sequence_order);

-- Comments for documentation
COMMENT ON TABLE songs IS 'Stores song data cached from external sources for fast searching and presentation';
COMMENT ON TABLE singers IS 'Stores singer/vocalist profiles';
COMMENT ON TABLE song_singer_pitches IS 'Associates songs with singers and their pitch information';
COMMENT ON TABLE named_sessions IS 'Stores saved session configurations with a name for reuse';
COMMENT ON TABLE session_items IS 'Stores the ordered sequence of songs in a named session with optional singer and pitch';

-- Songs table column comments
COMMENT ON COLUMN songs.id IS 'Unique identifier for the song';
COMMENT ON COLUMN songs.name IS 'Song name for display and search purposes';
COMMENT ON COLUMN songs.external_source_url IS 'Reference URL to external source';
COMMENT ON COLUMN songs.title IS 'Title of the song';
COMMENT ON COLUMN songs.title2 IS 'Alternative title of the song';
COMMENT ON COLUMN songs.language IS 'Language of the song';
COMMENT ON COLUMN songs.deity IS 'Deity associated with the song';
COMMENT ON COLUMN songs.tempo IS 'Tempo of the song';
COMMENT ON COLUMN songs.beat IS 'Beat of the song';
COMMENT ON COLUMN songs.raga IS 'Raga of the song';
COMMENT ON COLUMN songs.level IS 'Level of the song';
COMMENT ON COLUMN songs.song_tags IS 'Tags associated with the song';
COMMENT ON COLUMN songs.audio_link IS 'Audio link of the song';
COMMENT ON COLUMN songs.video_link IS 'Video link of the song';
COMMENT ON COLUMN songs.ulink IS 'URL link of the song';
COMMENT ON COLUMN songs.golden_voice IS 'Golden voice associated with the song';
COMMENT ON COLUMN songs.created_at IS 'Timestamp when the song was created';
COMMENT ON COLUMN songs.updated_at IS 'Timestamp when the song was last updated';
COMMENT ON COLUMN songs.lyrics IS 'Cached lyrics text from external source';
COMMENT ON COLUMN songs.meaning IS 'Cached translation/meaning from external source';

-- Singers table column comments
COMMENT ON COLUMN singers.id IS 'Unique identifier for the singer';
COMMENT ON COLUMN singers.name IS 'Singer name for display and search purposes';
COMMENT ON COLUMN singers.created_at IS 'Timestamp when the singer record was created';
COMMENT ON COLUMN singers.updated_at IS 'Timestamp when the singer record was last updated';

-- Song-Singer-Pitch associations table column comments
COMMENT ON COLUMN song_singer_pitches.id IS 'Unique identifier for the song-singer-pitch association';
COMMENT ON COLUMN song_singer_pitches.song_id IS 'Reference to the song in this association';
COMMENT ON COLUMN song_singer_pitches.singer_id IS 'Reference to the singer in this association';
COMMENT ON COLUMN song_singer_pitches.pitch IS 'Musical pitch/key information for the singer-song combination';
COMMENT ON COLUMN song_singer_pitches.created_at IS 'Timestamp when the association was created';
COMMENT ON COLUMN song_singer_pitches.updated_at IS 'Timestamp when the association was last updated';

-- Named Sessions table column comments
COMMENT ON COLUMN named_sessions.id IS 'Unique identifier for the named session';
COMMENT ON COLUMN named_sessions.name IS 'Unique name for the session';
COMMENT ON COLUMN named_sessions.description IS 'Optional description of the session purpose or content';
COMMENT ON COLUMN named_sessions.created_at IS 'Timestamp when the session was created';
COMMENT ON COLUMN named_sessions.updated_at IS 'Timestamp when the session was last updated';

-- Session Items table column comments
COMMENT ON COLUMN session_items.id IS 'Unique identifier for the session item';
COMMENT ON COLUMN session_items.session_id IS 'Reference to the named session this item belongs to';
COMMENT ON COLUMN session_items.song_id IS 'Reference to the song in this session item';
COMMENT ON COLUMN session_items.singer_id IS 'Optional singer for this song in the session';
COMMENT ON COLUMN session_items.pitch IS 'Optional pitch/key for this song in the session';
COMMENT ON COLUMN session_items.sequence_order IS 'Order of the song in the session sequence (1-based)';
COMMENT ON COLUMN session_items.created_at IS 'Timestamp when the session item was created';
COMMENT ON COLUMN session_items.updated_at IS 'Timestamp when the session item was last updated';
