-- Song Studio - Safe Upgrade
-- Creates missing objects only; ignores "already exists" errors
-- Safe to run multiple times in production.

-- Helper exception for "name is already used by an existing object"
DECLARE
  e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE q'[
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
    )
  ]';
EXCEPTION WHEN e_exists THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX idx_analytics_timestamp ON visitor_analytics(visit_timestamp DESC)'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX idx_analytics_country ON visitor_analytics(country)'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX idx_analytics_ip ON visitor_analytics(ip_address)'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

DECLARE
  e_exists2 EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists2, -955);
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE csv_song_mappings (
      id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      csv_song_name VARCHAR2(500) NOT NULL,
      db_song_id RAW(16) NOT NULL,
      db_song_name VARCHAR2(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_csv_song_mapping_song FOREIGN KEY (db_song_id) REFERENCES songs(id) ON DELETE CASCADE,
      CONSTRAINT uk_csv_song_name UNIQUE (csv_song_name)
    )
  ]';
EXCEPTION WHEN e_exists2 THEN NULL; END;
/
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE csv_pitch_mappings (
      id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      original_format VARCHAR2(50) NOT NULL,
      normalized_format VARCHAR2(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uk_original_format UNIQUE (original_format)
    )
  ]';
EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX idx_csv_song_name ON csv_song_mappings(csv_song_name)'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX idx_original_format ON csv_pitch_mappings(original_format)'; EXCEPTION WHEN OTHERS THEN NULL; END;
/


