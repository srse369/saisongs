-- Load Songs Using External Table Approach
-- This method works for large JSON files in Oracle Autonomous Database
-- No string literal size limitations

-- Step 1: Create directory object (if not already created)
-- You may need to ask your DBA to run this, or use the OCI Console
-- CREATE OR REPLACE DIRECTORY JSON_DIR AS '/path/to/database/folder';

-- Step 2: Upload sairhythms_sample_formatted.json to Object Storage
-- Then create a credential and external table pointing to it

-- For Oracle Autonomous Database, use this approach:
-- 1. Upload JSON to Object Storage bucket
-- 2. Create credential for Object Storage
-- 3. Use DBMS_CLOUD to load the data

-- Example for Oracle Autonomous Database with Object Storage:
/*
BEGIN
  DBMS_CLOUD.CREATE_CREDENTIAL(
    credential_name => 'OBJ_STORE_CRED',
    username => 'your-oci-username',
    password => 'your-auth-token'
  );
END;
/
*/

SET SERVEROUTPUT ON SIZE UNLIMITED;

DECLARE
    v_song_count NUMBER := 0;
    v_inserted_count NUMBER := 0;
    v_updated_count NUMBER := 0;
    v_error_count NUMBER := 0;
    v_sairhythms_url VARCHAR2(500);
    v_golden_voice NUMBER;
    v_existing_id RAW(16);
    v_exists NUMBER;
    
BEGIN
    DBMS_OUTPUT.PUT_LINE('=================================================');
    DBMS_OUTPUT.PUT_LINE('Starting Song Data Load from External Source');
    DBMS_OUTPUT.PUT_LINE('=================================================');
    DBMS_OUTPUT.PUT_LINE('');
    
    -- Process songs from external table
    -- Replace 'SONGS_JSON_EXT' with your external table name
    FOR song_rec IN (
        SELECT 
            jt.song_id,
            jt.title,
            jt.title2,
            jt.lyrics,
            jt.meaning,
            jt.language,
            jt.deity,
            jt.raga,
            jt.beat,
            jt.tempo,
            jt.level,
            jt.audio_link,
            jt.video_link,
            jt.golden_voice,
            jt.songtags,
            jt.ulink,
            jt.url
        FROM EXTERNAL (
            (json_document CLOB)
            TYPE ORACLE_LOADER
            DEFAULT DIRECTORY JSON_DIR
            ACCESS PARAMETERS (
                RECORDS DELIMITED BY NEWLINE
                FIELDS TERMINATED BY ','
                MISSING FIELD VALUES ARE NULL
            )
            LOCATION ('sairhythms_sample_formatted.json')
        ) ext,
        JSON_TABLE(
            ext.json_document,
            '$[*]'
            COLUMNS (
                song_id VARCHAR2(50) PATH '$.song_id',
                title VARCHAR2(500) PATH '$.title',
                title2 VARCHAR2(500) PATH '$.title2',
                lyrics CLOB PATH '$.lyrics',
                meaning CLOB PATH '$.meaning',
                language VARCHAR2(100) PATH '$.language',
                deity VARCHAR2(100) PATH '$.deity',
                raga VARCHAR2(100) PATH '$.raga',
                beat VARCHAR2(50) PATH '$.beat',
                tempo VARCHAR2(50) PATH '$.tempo',
                level VARCHAR2(50) PATH '$.level',
                audio_link VARCHAR2(500) PATH '$.audio_link[0]',
                video_link VARCHAR2(500) PATH '$.video_link[0]',
                golden_voice VARCHAR2(10) PATH '$.golden_voice[0]',
                songtags CLOB PATH '$.songtags',
                ulink VARCHAR2(500) PATH '$.ulink',
                url VARCHAR2(500) PATH '$.url'
            )
        ) jt
    ) LOOP
        BEGIN
            v_song_count := v_song_count + 1;
            
            v_sairhythms_url := 'https://sairhythms.sathyasai.org' || song_rec.url;
            
            v_golden_voice := CASE 
                WHEN song_rec.golden_voice IS NOT NULL AND LENGTH(song_rec.golden_voice) > 0 
                THEN 1 
                ELSE 0 
            END;
            
            BEGIN
                SELECT id INTO v_existing_id
                FROM songs
                WHERE sairhythms_url = v_sairhythms_url;
                v_exists := 1;
            EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    v_exists := 0;
            END;
            
            IF v_exists = 1 THEN
                UPDATE songs
                SET 
                    name = COALESCE(song_rec.title, name),
                    title = song_rec.title,
                    title2 = song_rec.title2,
                    lyrics = song_rec.lyrics,
                    meaning = song_rec.meaning,
                    "LANGUAGE" = song_rec.language,
                    deity = song_rec.deity,
                    raga = song_rec.raga,
                    beat = song_rec.beat,
                    tempo = song_rec.tempo,
                    "LEVEL" = song_rec.level,
                    audio_link = song_rec.audio_link,
                    video_link = song_rec.video_link,
                    golden_voice = v_golden_voice,
                    song_tags = song_rec.songtags,
                    ulink = song_rec.ulink,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_existing_id;
                
                v_updated_count := v_updated_count + 1;
            ELSE
                INSERT INTO songs (
                    name, sairhythms_url, title, title2, lyrics, meaning,
                    "LANGUAGE", deity, raga, beat, tempo, "LEVEL",
                    audio_link, video_link, golden_voice, song_tags, ulink
                ) VALUES (
                    song_rec.title, v_sairhythms_url, song_rec.title, song_rec.title2,
                    song_rec.lyrics, song_rec.meaning, song_rec.language, song_rec.deity,
                    song_rec.raga, song_rec.beat, song_rec.tempo, song_rec.level,
                    song_rec.audio_link, song_rec.video_link, v_golden_voice,
                    song_rec.songtags, song_rec.ulink
                );
                
                v_inserted_count := v_inserted_count + 1;
            END IF;
            
            IF MOD(v_song_count, 50) = 0 THEN
                COMMIT;
                DBMS_OUTPUT.PUT_LINE('Processed ' || v_song_count || ' songs...');
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                DBMS_OUTPUT.PUT_LINE('ERROR: ' || SQLERRM);
        END;
    END LOOP;
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('');
    DBMS_OUTPUT.PUT_LINE('=================================================');
    DBMS_OUTPUT.PUT_LINE('Total processed: ' || v_song_count);
    DBMS_OUTPUT.PUT_LINE('Inserted: ' || v_inserted_count);
    DBMS_OUTPUT.PUT_LINE('Updated: ' || v_updated_count);
    DBMS_OUTPUT.PUT_LINE('Errors: ' || v_error_count);
    DBMS_OUTPUT.PUT_LINE('=================================================');
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('FATAL ERROR: ' || SQLERRM);
        RAISE;
END;
/
