# Loading Songs Data into Oracle Database

This guide explains how to load song data from `sairhythms_sample_formatted.json` into your Oracle Autonomous Database.

## ⚠️ Important Note About File Size

The JSON file is too large (76,000+ lines) to paste inline due to Oracle's 32KB string literal limit. Use one of the methods below based on your environment.

## Available Methods

### Method 1: SQL Developer Import (EASIEST - Recommended)

**Best for:** Oracle Autonomous Database users with SQL Developer

**Steps:**
1. Open SQL Developer and connect to your database
2. Create staging table:
   ```sql
   CREATE TABLE songs_staging (json_document CLOB);
   ```
3. Right-click on `songs_staging` table → Import Data
4. Select `sairhythms_sample_formatted.json`
5. Map the entire JSON content to the `json_document` column
6. Import the data
7. Run `load_songs_batch.sql` to process the staged data into the songs table

### Method 2: Object Storage + DBMS_CLOUD (For Oracle Autonomous Database)

**Best for:** Oracle Autonomous Database with OCI Object Storage

**Steps:**
1. Upload `sairhythms_sample_formatted.json` to an OCI Object Storage bucket
2. Create a credential for Object Storage access
3. Use `load_songs_batch.sql` (uncomment the DBMS_CLOUD.COPY_DATA section)
4. Update the file_uri_list with your bucket details
5. Run the script

### Method 3: Directory Object (For Local/On-Premise Oracle)

**Best for:** Local Oracle installations where you have filesystem access

**Steps:**
1. Create directory object:
   ```sql
   CREATE OR REPLACE DIRECTORY JSON_DIR AS '/path/to/database/folder';
   GRANT READ ON DIRECTORY JSON_DIR TO your_username;
   ```
2. Place `sairhythms_sample_formatted.json` in that directory
3. Run `load_songs_from_json.sql`

## What the Scripts Do

Both scripts:
- Parse the JSON array and extract all song fields
- Check if each song already exists (by `sairhythms_url`)
- **Update** existing songs with new data
- **Insert** new songs that don't exist
- Commit every 50-100 records for performance
- Display progress and final summary
- Handle errors gracefully and continue processing

## Expected Output

```
=================================================
Starting Song Data Load from JSON
=================================================

Processing songs from JSON data...

Processed 50 songs... (Inserted: 45, Updated: 5)
Processed 100 songs... (Inserted: 92, Updated: 8)
...

=================================================
Load Complete - Summary
=================================================
Total songs processed: 150
Songs inserted: 140
Songs updated: 10
Errors encountered: 0
=================================================
```

## Troubleshooting

### Error: "JSON data is empty"
- Make sure you pasted the JSON content correctly in `load_songs_simple.sql`
- Verify the JSON file is not empty

### Error: "directory does not exist"
- Check that JSON_DIR directory object is created
- Verify the path points to the correct folder
- Ensure you have READ privilege on the directory

### Error: "ORA-40441: JSON syntax error"
- Verify your JSON file is valid (use a JSON validator)
- Check for trailing commas or other syntax issues

### Error: "ORA-00001: unique constraint violated"
- This shouldn't happen as the script checks for existing URLs
- If it does, check if there are duplicate URLs in your JSON

## Verifying the Load

After running the script, verify your data:

```sql
-- Count total songs
SELECT COUNT(*) FROM songs;

-- Songs by language
SELECT "LANGUAGE", COUNT(*) as song_count 
FROM songs 
GROUP BY "LANGUAGE" 
ORDER BY song_count DESC;

-- Songs by deity
SELECT deity, COUNT(*) as song_count 
FROM songs 
GROUP BY deity 
ORDER BY song_count DESC;

-- Sample songs
SELECT title, "LANGUAGE", deity, tempo 
FROM songs 
WHERE ROWNUM <= 10;
```

## Performance Notes

- The scripts commit every 50-100 records to balance performance and recoverability
- For very large datasets (10,000+ songs), consider increasing the commit interval
- The first run will be slower as it inserts all records
- Subsequent runs will be faster as they mostly update existing records


## Detailed Instructions for Method 1 (SQL Developer Import)

This is the easiest method for most users:

### Step-by-Step:

1. **Create the staging table:**
   ```sql
   CREATE TABLE songs_staging (json_document CLOB);
   ```

2. **Import JSON using SQL Developer:**
   - In SQL Developer, expand your connection
   - Find the `SONGS_STAGING` table
   - Right-click → Data → Import Data
   - Click "Browse" and select `sairhythms_sample_formatted.json`
   - Format: Choose "json"
   - Click "Next"
   - Map columns: The entire JSON should map to `json_document`
   - Click "Next" → "Finish"
   - Wait for import to complete

3. **Process the staged data:**
   - Open `load_songs_batch.sql`
   - Skip Steps 1-3 (credential and DBMS_CLOUD sections)
   - Run from Step 4 onwards
   - This will parse the JSON and insert into the songs table

4. **Verify:**
   ```sql
   SELECT COUNT(*) FROM songs;
   SELECT "LANGUAGE", COUNT(*) FROM songs GROUP BY "LANGUAGE";
   ```

5. **Clean up (optional):**
   ```sql
   DROP TABLE songs_staging;
   ```

## Alternative: Manual Chunking (If all else fails)

If you can't use any of the above methods, you can split the JSON file:

1. Split `sairhythms_sample_formatted.json` into smaller files (e.g., 1000 songs each)
2. For each chunk, use `load_songs_simple.sql` with the smaller JSON
3. Run multiple times until all songs are loaded

**Python script to split JSON:**
```python
import json

with open('sairhythms_sample_formatted.json', 'r') as f:
    songs = json.load(f)

chunk_size = 1000
for i in range(0, len(songs), chunk_size):
    chunk = songs[i:i+chunk_size]
    with open(f'songs_chunk_{i//chunk_size + 1}.json', 'w') as f:
        json.dump(chunk, f)
```
