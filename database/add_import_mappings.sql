-- Create table for storing CSV song name to database song mappings
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

COMMENT ON TABLE csv_song_mappings IS 'Stores mappings from CSV song names to database songs for auto-matching in imports';
COMMENT ON COLUMN csv_song_mappings.id IS 'Unique identifier for the mapping';
COMMENT ON COLUMN csv_song_mappings.csv_song_name IS 'The song name as it appears in CSV imports';
COMMENT ON COLUMN csv_song_mappings.db_song_id IS 'The ID of the matched song in the database';
COMMENT ON COLUMN csv_song_mappings.db_song_name IS 'The name of the matched song (for display)';
COMMENT ON COLUMN csv_song_mappings.created_at IS 'When this mapping was first created';
COMMENT ON COLUMN csv_song_mappings.updated_at IS 'When this mapping was last updated';

-- Create table for storing CSV pitch format to normalized pitch mappings
CREATE TABLE csv_pitch_mappings (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    original_format VARCHAR2(50) NOT NULL,
    normalized_format VARCHAR2(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_original_format UNIQUE (original_format)
);

COMMENT ON TABLE csv_pitch_mappings IS 'Stores mappings from CSV pitch formats to normalized pitch formats for auto-conversion in imports';
COMMENT ON COLUMN csv_pitch_mappings.id IS 'Unique identifier for the mapping';
COMMENT ON COLUMN csv_pitch_mappings.original_format IS 'The pitch format as it appears in CSV imports';
COMMENT ON COLUMN csv_pitch_mappings.normalized_format IS 'The normalized/standard pitch format';
COMMENT ON COLUMN csv_pitch_mappings.created_at IS 'When this mapping was first created';
COMMENT ON COLUMN csv_pitch_mappings.updated_at IS 'When this mapping was last updated';

-- Create indexes for better query performance
CREATE INDEX idx_csv_song_name ON csv_song_mappings(csv_song_name);
CREATE INDEX idx_original_format ON csv_pitch_mappings(original_format);

