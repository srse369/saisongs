-- Song Studio - Full Install (Fresh)
-- Drops existing objects and recreates core, analytics, and CSV mapping schema
-- Use with caution in production (this will DROP tables).

-- =============================================================================
-- Drop existing tables if they exist
-- =============================================================================
BEGIN EXECUTE IMMEDIATE 'DROP TABLE session_items CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE named_sessions CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE song_singer_pitches CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE singers CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE songs CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE visitor_analytics CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE csv_song_mappings CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE csv_pitch_mappings CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

-- =============================================================================
-- Core schema
-- =============================================================================
CREATE TABLE songs (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    external_source_url VARCHAR2(500) NOT NULL UNIQUE,
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

CREATE TABLE singers (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE named_sessions (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL UNIQUE,
    description VARCHAR2(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- =============================================================================
-- Analytics schema
-- =============================================================================
CREATE TABLE visitor_analytics (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    ip_address VARCHAR2(45) NOT NULL,
    country VARCHAR2(100),
    country_code VARCHAR2(10),
    region VARCHAR2(100),
    city VARCHAR2(100),
    latitude NUMBER(10, 6),
    longitude NUMBER(10, 6),
    user_agent VARCHAR2(500),
    page_path VARCHAR2(500),
    referrer VARCHAR2(500),
    visit_timestamp TIMESTAMP DEFAULT SYSTIMESTAMP,
    session_duration NUMBER,
    user_role VARCHAR2(20)
);

-- =============================================================================
-- Import mapping schema
-- =============================================================================
CREATE TABLE csv_song_mappings (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    csv_song_name VARCHAR2(500) NOT NULL,
    db_song_id RAW(16) NOT NULL,
    db_song_name VARCHAR2(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_csv_song_mapping_song FOREIGN KEY (db_song_id) REFERENCES songs(id) ON DELETE CASCADE,
    CONSTRAINT uk_csv_song_name UNIQUE (csv_song_name)
);

CREATE TABLE csv_pitch_mappings (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    original_format VARCHAR2(50) NOT NULL,
    normalized_format VARCHAR2(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_original_format UNIQUE (original_format)
);

-- =============================================================================
-- Indexes
-- =============================================================================
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

CREATE INDEX idx_analytics_timestamp ON visitor_analytics(visit_timestamp DESC);
CREATE INDEX idx_analytics_country ON visitor_analytics(country);
CREATE INDEX idx_analytics_ip ON visitor_analytics(ip_address);

CREATE INDEX idx_csv_song_name ON csv_song_mappings(csv_song_name);
CREATE INDEX idx_original_format ON csv_pitch_mappings(original_format);

-- =============================================================================
-- Comments (subset for brevity)
-- =============================================================================
COMMENT ON TABLE songs IS 'Stores song data cached from external sources for fast searching and presentation';
COMMENT ON TABLE singers IS 'Stores singer/vocalist profiles';
COMMENT ON TABLE song_singer_pitches IS 'Associates songs with singers and their pitch information';
COMMENT ON TABLE named_sessions IS 'Stores saved session configurations';
COMMENT ON TABLE session_items IS 'Ordered sequence of songs within a session';
COMMENT ON TABLE visitor_analytics IS 'Visitor analytics including geolocation';
COMMENT ON TABLE csv_song_mappings IS 'CSV song name → DB song mapping';
COMMENT ON TABLE csv_pitch_mappings IS 'CSV pitch format → normalized pitch mapping';


