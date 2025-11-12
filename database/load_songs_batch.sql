-- Batch Load Songs - Works with Oracle Autonomous Database
-- This script uses DBMS_CLOUD.COPY_DATA for Oracle Autonomous Database
-- 
-- PREREQUISITES:
-- 1. Upload sairhythms_sample_formatted.json to Oracle Object Storage
-- 2. Create a credential for Object Storage access
-- 3. Update the object_uri below with your bucket details

-- Step 1: Create credential (run once)
-- Replace with your OCI credentials
/*
BEGIN
  DBMS_CLOUD.CREATE_CREDENTIAL(
    credential_name => 'OBJ_STORE_CRED',
    username => '<your-oci-username>',
    password => '<your-auth-token>'
  );
END;
/
*/

-- Step 2: Create staging table for JSON data
BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE songs_staging';
EXCEPTION
   WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE songs_staging (
    json_document CLOB
);

-- Step 3: Load JSON file into staging table using DBMS_CLOUD
-- Update the object_uri with your Object Storage details
/*
BEGIN
  DBMS_CLOUD.COPY_DATA(
    table_name => 'SONGS_STAGING',
    credential_name => 'OBJ_STORE_CRED',
    file_uri_list => 'https://objectstorage.<region>.oraclecloud.com/n/<namespace>/b/<bucket>/o/sairhythms_sample_formatted.json',
    format => json_object('type' value 'json', 'unpackarrays' value 'TRUE')
  );
END;
/
*/

-- Step 4: Process the staged JSON data
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
    DBMS_OUTPUT.PUT_LINE('Processing Songs from Staging Table');
    DBMS_OUTPUT.PUT_LINE('=================================================');
    DBMS_OUTPUT.PUT_LINE('');
    
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
        FROM songs_staging s,
        JSON_TABLE(
            s.json_document,
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
            
            IF MOD(v_song_count, 100) = 0 THEN
                COMMIT;
                DBMS_OUTPUT.PUT_LINE('Processed ' || v_song_count || ' songs (Inserted: ' || 
                    v_inserted_count || ', Updated: ' || v_updated_count || ')');
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                DBMS_OUTPUT.PUT_LINE('ERROR processing "' || song_rec.title || '": ' || SQLERRM);
        END;
    END LOOP;
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('');
    DBMS_OUTPUT.PUT_LINE('=================================================');
    DBMS_OUTPUT.PUT_LINE('Load Complete - Summary');
    DBMS_OUTPUT.PUT_LINE('=================================================');
    DBMS_OUTPUT.PUT_LINE('Total songs processed: ' || v_song_count);
    DBMS_OUTPUT.PUT_LINE('Songs inserted: ' || v_inserted_count);
    DBMS_OUTPUT.PUT_LINE('Songs updated: ' || v_updated_count);
    DBMS_OUTPUT.PUT_LINE('Errors encountered: ' || v_error_count);
    DBMS_OUTPUT.PUT_LINE('=================================================');
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('FATAL ERROR: ' || SQLERRM);
        RAISE;
END;
/

-- Step 5: Clean up staging table (optional)
-- DROP TABLE songs_staging;

-- Verify the load
SELECT COUNT(*) as total_songs FROM songs;
