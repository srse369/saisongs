-- ============================================================================
-- SaiSongs Database - Complete Schema Installation
-- Oracle Database Version
-- ============================================================================
-- This script creates a complete fresh database installation
-- Drops existing tables and recreates everything from scratch
-- 
-- Features:
-- - Core tables (songs, users, pitches, etc.)
-- - Multi-tenancy with centers
-- - Email-based OTP authentication
-- - Session management
-- - Analytics and feedback
-- - Presentation templates
--
-- Usage:
--   sqlplus username/password@database @database/schema_full_install.sql
--
-- WARNING: This script DROPS all existing tables. Use with caution!
-- ============================================================================

SET SERVEROUTPUT ON;

PROMPT ============================================================================
PROMPT SaiSongs Database - Full Installation
PROMPT ============================================================================
PROMPT WARNING: This will DROP all existing tables!
PROMPT ============================================================================
PROMPT

-- ============================================================================
-- DROP EXISTING OBJECTS
-- ============================================================================
BEGIN EXECUTE IMMEDIATE 'DROP TABLE song_singer_pitches CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE csv_song_mappings CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE csv_pitch_mappings CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE visitor_analytics CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE feedback CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE song_session_items CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE song_sessions CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE presentation_templates CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE songs CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE centers CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE sessions CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE otp_codes CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE users CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

-- Drop sequences if they exist
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE centers_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE otp_codes_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

PROMPT ✓ Dropped existing objects
PROMPT

-- ============================================================================
-- CREATE SEQUENCES
-- ============================================================================
CREATE SEQUENCE centers_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE otp_codes_seq START WITH 1 INCREMENT BY 1;

PROMPT ✓ Created sequences
PROMPT

-- ============================================================================
-- SONGS TABLE
-- ============================================================================
CREATE TABLE songs (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(500) NOT NULL,
    external_source_url VARCHAR2(1000),
    lyrics CLOB,
    meaning CLOB,
    "LANGUAGE" VARCHAR2(100),
    deity VARCHAR2(200),
    tempo VARCHAR2(50),
    beat VARCHAR2(50),
    raaga VARCHAR2(100),
    "LEVEL" VARCHAR2(50),
    song_tags CLOB,
    audio_link VARCHAR2(500),
    video_link VARCHAR2(500),
    golden_voice NUMBER(1) DEFAULT 0,
    reference_gents_pitch VARCHAR2(50),
    reference_ladies_pitch VARCHAR2(50),
    center_ids CLOB, -- JSON array of center IDs for multi-tenancy
    created_by VARCHAR2(100),
    updated_by VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_songs_center_ids_json CHECK (center_ids IS NULL OR center_ids IS JSON)
);

CREATE INDEX idx_songs_name ON songs(name);
CREATE INDEX idx_songs_language ON songs("LANGUAGE");
CREATE INDEX idx_songs_deity ON songs(deity);
CREATE INDEX idx_songs_tempo ON songs(tempo);
CREATE INDEX idx_songs_beat ON songs(beat);
CREATE INDEX idx_songs_raga ON songs(raaga);
CREATE INDEX idx_songs_level ON songs("LEVEL");
CREATE INDEX idx_songs_created_by ON songs(created_by);
CREATE INDEX idx_songs_updated_by ON songs(updated_by);

CREATE OR REPLACE TRIGGER songs_updated_at_trigger
    BEFORE UPDATE ON songs
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

COMMENT ON TABLE songs IS 'Song catalog with metadata cached from external sources';
COMMENT ON COLUMN songs.center_ids IS 'JSON array of center IDs - null means visible to all';
COMMENT ON COLUMN songs.created_by IS 'User ID of the user who created this song';

PROMPT ✓ Created songs table
PROMPT

-- ============================================================================
-- USERS TABLE (singers with email authentication)
-- ============================================================================
CREATE TABLE users (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(200) NOT NULL,
    gender VARCHAR2(20) CHECK (gender IN ('Male', 'Female', 'Boy', 'Girl', 'Other')),
    email VARCHAR2(255) UNIQUE, -- For OTP authentication
    is_admin NUMBER(1) DEFAULT 0, -- 1 = admin (full access), 0 = not admin
    center_ids CLOB, -- JSON array of center IDs this user has viewer access to
    editor_for CLOB, -- JSON array of center IDs this user is an editor for
    created_by VARCHAR2(100),
    updated_by VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_users_center_ids_json CHECK (center_ids IS NULL OR center_ids IS JSON),
    CONSTRAINT check_users_editor_for_json CHECK (editor_for IS NULL OR editor_for IS JSON),
    CONSTRAINT check_is_admin CHECK (is_admin IN (0, 1))
);

CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_users_created_by ON users(created_by);
CREATE INDEX idx_users_updated_by ON users(updated_by);

CREATE OR REPLACE TRIGGER users_updated_at_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

COMMENT ON TABLE users IS 'Users/singers with optional email for OTP authentication';
COMMENT ON COLUMN users.email IS 'Email for OTP-based login - null means no email auth';
COMMENT ON COLUMN users.is_admin IS 'Admin flag: 1 = full system access, 0 = not admin. Only admins can set this.';
COMMENT ON COLUMN users.center_ids IS 'JSON array of center IDs user has viewer access to: [1, 2, 3]';
COMMENT ON COLUMN users.editor_for IS 'JSON array of center IDs user is an editor for: [1, 3]. Editors can manage resources for these centers.';
COMMENT ON COLUMN users.center_ids IS 'JSON array of center IDs user is tagged to';

PROMPT ✓ Created users table
PROMPT

-- ============================================================================
-- SONG_SINGER_PITCHES TABLE (Junction table)
-- ============================================================================
CREATE TABLE song_singer_pitches (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    song_id RAW(16) NOT NULL,
    singer_id RAW(16) NOT NULL,
    pitch VARCHAR2(50) NOT NULL,
    created_by VARCHAR2(100),
    updated_by VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ssp_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    CONSTRAINT fk_ssp_singer FOREIGN KEY (singer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_song_singer UNIQUE (song_id, singer_id)
);

CREATE INDEX idx_ssp_song ON song_singer_pitches(song_id);
CREATE INDEX idx_ssp_singer ON song_singer_pitches(singer_id);
CREATE INDEX idx_ssp_pitch ON song_singer_pitches(pitch);
CREATE INDEX idx_ssp_created_by ON song_singer_pitches(created_by);
CREATE INDEX idx_ssp_updated_by ON song_singer_pitches(updated_by);

CREATE OR REPLACE TRIGGER song_singer_pitches_updated_at_trigger
    BEFORE UPDATE ON song_singer_pitches
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

COMMENT ON TABLE song_singer_pitches IS 'Links songs to singers with their pitch preferences';
COMMENT ON COLUMN song_singer_pitches.pitch IS 'Pitch value (e.g., C, C#, D, etc.)';

PROMPT ✓ Created song_singer_pitches table
PROMPT

-- ============================================================================
-- CENTERS TABLE (Organizations/Locations)
-- ============================================================================
CREATE TABLE centers (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(255) NOT NULL UNIQUE,
    badge_text_color VARCHAR2(7) DEFAULT '#000000', -- Hex color for badge text
    created_by VARCHAR2(100),
    updated_by VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_centers_created_by ON centers(created_by);
CREATE INDEX idx_centers_updated_by ON centers(updated_by);

CREATE OR REPLACE TRIGGER centers_id_trigger
    BEFORE INSERT ON centers
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        SELECT centers_seq.NEXTVAL INTO :NEW.id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER centers_updated_at_trigger
    BEFORE UPDATE ON centers
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

COMMENT ON TABLE centers IS 'Organizations/locations for multi-tenancy. User access per center is tracked in users.center_ids (viewer) and users.editor_for (editor).';

PROMPT ✓ Created centers table
PROMPT

-- ============================================================================
-- SONG_SESSIONS TABLE
-- ============================================================================
CREATE TABLE song_sessions (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    description CLOB,
    center_ids CLOB, -- JSON array of center IDs
    created_by VARCHAR2(100), -- Email of user who created the session
    updated_by VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_song_sessions_center_ids_json CHECK (center_ids IS NULL OR center_ids IS JSON)
);

CREATE INDEX idx_song_sessions_name ON song_sessions(name);
CREATE INDEX idx_song_sessions_created_by ON song_sessions(created_by);
CREATE INDEX idx_song_sessions_updated_by ON song_sessions(updated_by);

CREATE OR REPLACE TRIGGER song_sessions_updated_at_trigger
    BEFORE UPDATE ON song_sessions
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

COMMENT ON TABLE song_sessions IS 'Saved session configurations';
COMMENT ON COLUMN song_sessions.center_ids IS 'JSON array of center IDs - null means visible to all';
COMMENT ON COLUMN song_sessions.created_by IS 'Email address of user who created the session';

PROMPT ✓ Created song_sessions table
PROMPT

-- ============================================================================
-- PRESENTATION_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE presentation_templates (
    id VARCHAR2(36) PRIMARY KEY,
    name VARCHAR2(255) NOT NULL UNIQUE,
    description CLOB,
    template_json CLOB NOT NULL,
    center_ids CLOB, -- JSON array of center IDs
    is_default NUMBER(1) DEFAULT 0,
    created_by VARCHAR2(100),
    updated_by VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_templates_json CHECK (template_json IS JSON),
    CONSTRAINT check_templates_center_ids_json CHECK (center_ids IS NULL OR center_ids IS JSON)
);

CREATE INDEX idx_templates_name ON presentation_templates(name);
CREATE INDEX idx_templates_default ON presentation_templates(is_default);
CREATE INDEX idx_templates_created_by ON presentation_templates(created_by);
CREATE INDEX idx_templates_updated_by ON presentation_templates(updated_by);

CREATE OR REPLACE TRIGGER templates_updated_at_trigger
    BEFORE UPDATE ON presentation_templates
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

COMMENT ON TABLE presentation_templates IS 'Presentation template configurations';
COMMENT ON COLUMN presentation_templates.center_ids IS 'JSON array of center IDs - null means visible to all';

PROMPT ✓ Created presentation_templates table
PROMPT

-- ============================================================================
-- OTP_CODES TABLE (Email Authentication)
-- ============================================================================
CREATE TABLE otp_codes (
    id NUMBER PRIMARY KEY,
    email VARCHAR2(255) NOT NULL,
    code VARCHAR2(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used NUMBER(1) DEFAULT 0, -- 0 = unused, 1 = used
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_email ON otp_codes(email);
CREATE INDEX idx_otp_code ON otp_codes(code);
CREATE INDEX idx_otp_expires ON otp_codes(expires_at);

CREATE OR REPLACE TRIGGER otp_codes_id_trigger
    BEFORE INSERT ON otp_codes
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        SELECT otp_codes_seq.NEXTVAL INTO :NEW.id FROM DUAL;
    END IF;
END;
/

COMMENT ON TABLE otp_codes IS 'One-time passwords for email-based authentication';

PROMPT ✓ Created otp_codes table
PROMPT

-- ============================================================================
-- SESSIONS TABLE (Express Session Storage)
-- ============================================================================
CREATE TABLE sessions (
    sid VARCHAR2(255) PRIMARY KEY,
    sess CLOB NOT NULL,
    expire TIMESTAMP NOT NULL,
    CONSTRAINT check_sessions_json CHECK (sess IS JSON)
);

CREATE INDEX idx_sessions_expire ON sessions(expire);

COMMENT ON TABLE sessions IS 'Express session storage with JSON data';

PROMPT ✓ Created sessions table
PROMPT

-- ============================================================================
-- VISITOR_ANALYTICS TABLE
-- ============================================================================
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
    url VARCHAR2(1000),
    visit_timestamp TIMESTAMP DEFAULT SYSTIMESTAMP,
    session_duration NUMBER,
    user_role VARCHAR2(20)
);

CREATE INDEX idx_analytics_timestamp ON visitor_analytics(visit_timestamp DESC);
CREATE INDEX idx_analytics_country ON visitor_analytics(country);
CREATE INDEX idx_analytics_ip ON visitor_analytics(ip_address);

COMMENT ON TABLE visitor_analytics IS 'Visitor tracking with geolocation data';

PROMPT ✓ Created visitor_analytics table
PROMPT

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================
CREATE TABLE feedback (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    category VARCHAR2(50) NOT NULL CHECK (category IN ('bug', 'feature', 'improvement', 'question', 'other')),
    feedback CLOB NOT NULL,
    email VARCHAR2(255) NOT NULL,
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    url VARCHAR2(500),
    status VARCHAR2(50) DEFAULT 'new' CHECK (status IN ('new', 'in-progress', 'resolved', 'closed')),
    admin_notes CLOB,
    updated_by VARCHAR2(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_category ON feedback(category);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

CREATE OR REPLACE TRIGGER feedback_updated_at_trigger
    BEFORE UPDATE ON feedback
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

COMMENT ON TABLE feedback IS 'User feedback submissions (bugs, features, etc.)';

PROMPT ✓ Created feedback table
PROMPT

-- ============================================================================
-- CSV IMPORT MAPPING TABLES
-- ============================================================================
CREATE TABLE csv_song_mappings (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    csv_song_name VARCHAR2(500) NOT NULL,
    db_song_id RAW(16) NOT NULL,
    db_song_name VARCHAR2(500) NOT NULL,
    CONSTRAINT fk_csv_song_mapping_song FOREIGN KEY (db_song_id) REFERENCES songs(id) ON DELETE CASCADE,
    CONSTRAINT uk_csv_song_name UNIQUE (csv_song_name)
);

CREATE TABLE csv_pitch_mappings (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    original_format VARCHAR2(50) NOT NULL,
    normalized_format VARCHAR2(50) NOT NULL,
    CONSTRAINT uk_original_format UNIQUE (original_format)
);

COMMENT ON TABLE csv_song_mappings IS 'Maps CSV song names to database songs';
COMMENT ON TABLE csv_pitch_mappings IS 'Maps CSV pitch formats to normalized pitches';

PROMPT ✓ Created CSV mapping tables
PROMPT

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- OTP Cleanup Procedure
CREATE OR REPLACE PROCEDURE cleanup_expired_otp_codes AS
    v_deleted_count NUMBER;
BEGIN
    DELETE FROM otp_codes 
    WHERE expires_at < CURRENT_TIMESTAMP 
    OR used = 1;
    
    v_deleted_count := SQL%ROWCOUNT;
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('Cleaned up ' || v_deleted_count || ' expired/used OTP codes');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END cleanup_expired_otp_codes;
/

-- Session Cleanup Procedure
CREATE OR REPLACE PROCEDURE cleanup_expired_sessions AS
    v_deleted_count NUMBER;
BEGIN
    DELETE FROM sessions WHERE expire < CURRENT_TIMESTAMP;
    v_deleted_count := SQL%ROWCOUNT;
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('Cleaned up ' || v_deleted_count || ' expired sessions');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END cleanup_expired_sessions;
/

PROMPT ✓ Created stored procedures
PROMPT

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Note: Pitches are now stored directly in song_singer_pitches.pitch column as VARCHAR
-- No need for separate pitches table

-- Insert default center
INSERT INTO centers (name, badge_text_color) VALUES ('Default Center', '#000000');

-- Insert default presentation template
INSERT INTO presentation_templates (
    id,
    name, 
    description, 
    template_json, 
    is_default
) VALUES (
    SYS_GUID(),
    'Default Template',
    'Standard presentation template',
    '{"layout":"standard","theme":"light"}',
    1
);

COMMIT;

PROMPT ✓ Inserted initial data (1 center, 1 template)
PROMPT

-- ============================================================================
-- VERIFICATION
-- ============================================================================

PROMPT ============================================================================
PROMPT Verification: Table Record Counts
PROMPT ============================================================================

SELECT 'songs' as table_name, COUNT(*) as record_count FROM songs
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'song_singer_pitches', COUNT(*) FROM song_singer_pitches
UNION ALL
SELECT 'centers', COUNT(*) FROM centers
UNION ALL
SELECT 'song_sessions', COUNT(*) FROM song_sessions
UNION ALL
SELECT 'presentation_templates', COUNT(*) FROM presentation_templates
UNION ALL
SELECT 'otp_codes', COUNT(*) FROM otp_codes
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'feedback', COUNT(*) FROM feedback
UNION ALL
SELECT 'visitor_analytics', COUNT(*) FROM visitor_analytics
UNION ALL
SELECT 'csv_song_mappings', COUNT(*) FROM csv_song_mappings
UNION ALL
SELECT 'csv_pitch_mappings', COUNT(*) FROM csv_pitch_mappings;

PROMPT
PROMPT ============================================================================
PROMPT Database Installation Completed Successfully!
PROMPT ============================================================================
PROMPT
PROMPT Tables Created: 12
PROMPT Initial Data: 
PROMPT   - 1 default center
PROMPT   - 1 default presentation template
PROMPT
PROMPT Note: Pitches are stored as VARCHAR values in song_singer_pitches table
PROMPT
PROMPT Features Enabled:
PROMPT   ✓ Multi-tenancy with centers
PROMPT   ✓ Email-based OTP authentication
PROMPT   ✓ Role-based access (Admin/Editor)
PROMPT   ✓ Session management
PROMPT   ✓ Analytics tracking
PROMPT   ✓ Feedback system
PROMPT
PROMPT Next Steps:
PROMPT   1. Import your songs and users data
PROMPT   2. Configure centers for your organization
PROMPT   3. Assign editors using users.editor_for JSON array
PROMPT   4. Set up cron jobs for cleanup procedures:
PROMPT      - EXEC cleanup_expired_otp_codes (hourly)
PROMPT      - EXEC cleanup_expired_sessions (daily)
PROMPT
PROMPT ============================================================================


