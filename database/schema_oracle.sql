-- Song Studio Database Schema for Oracle Autonomous Database
-- This script creates the necessary tables and indexes for the Song Studio application

-- Drop existing tables if they exist (for clean setup)
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
-- Stores song data cached from Sairhythms.org for fast access and searching
CREATE TABLE songs (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    sairhythms_url VARCHAR2(500) NOT NULL UNIQUE,
    
    -- Cached data from Sairhythms.org
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

-- Comments for documentation
COMMENT ON TABLE songs IS 'Stores song data cached from Sairhythms.org for fast searching and presentation';
COMMENT ON TABLE singers IS 'Stores singer/vocalist profiles';
COMMENT ON TABLE song_singer_pitches IS 'Associates songs with singers and their pitch information';
COMMENT ON COLUMN songs.name IS 'Song name for display and search purposes';
COMMENT ON COLUMN songs.sairhythms_url IS 'Reference URL to Sairhythms.org';
COMMENT ON COLUMN songs.lyrics IS 'Cached lyrics text from Sairhythms.org';
COMMENT ON COLUMN songs.meaning IS 'Cached translation/meaning from Sairhythms.org';
COMMENT ON COLUMN song_singer_pitches.pitch IS 'Musical pitch/key information for the singer-song combination';
