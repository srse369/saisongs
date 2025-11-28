# Song Studio Database

This folder contains all database schema definitions, migration scripts, and maintenance utilities for the Song Studio application.

## Overview

Song Studio uses **Oracle Autonomous Database** (or Oracle Database 19c+) with the following main components:

- **Songs Management**: Song catalog with cached metadata from external sources
- **Singers Management**: Singer profiles and pitch information
- **Pitch Assignments**: Links songs to singers with specific pitch keys
- **Session Management**: Named sessions for live performances
- **CSV Import Mappings**: User-defined mappings for CSV imports
- **Presentation Templates**: Customizable templates for presentations
- **Analytics**: Visitor tracking with geolocation data

## Database Files

### Schema Files

#### `schema_oracle.sql`
**Main database schema** - Creates all core tables for the application:

- `songs` - Song catalog with cached metadata
- `singers` - Singer profiles  
- `song_singer_pitches` - Links songs to singers with pitch keys
- `named_sessions` - Named session configurations
- `session_items` - Items within each session
- `import_mappings` - User-defined CSV import mappings

**Usage:**
```sql
@schema_oracle.sql
```

**Note:** This script drops existing tables if they exist. Use with caution in production!

---

#### `analytics_schema.sql`
**Analytics tracking schema** - Creates visitor analytics table:

- `visitor_analytics` - Tracks page visits with geolocation, IP address, user role, and timestamps

**Features:**
- IP-based geolocation (country, region, city, lat/lon)
- User role tracking (public, viewer, editor, admin)
- Page path and referrer tracking
- UTC timestamp storage for consistent timezone handling
- Performance indexes on timestamp, country, and IP address

**Usage:**
```sql
@analytics_schema.sql
```

---

#### `add_import_mappings.sql`
**Migration script** - Adds the `import_mappings` table to existing databases.

**When to use:** If you have an existing database without the import mappings table (added after initial release).

**Usage:**
```sql
@add_import_mappings.sql
```

---

### Maintenance Scripts

#### `kill-hung-sessions.sql`
**Emergency maintenance** - Terminates hung database sessions.

**When to use:**
- Database sessions are stuck or blocking operations
- High connection count preventing new connections
- Unresponsive queries need to be terminated

**Usage:**
```sql
@kill-hung-sessions.sql
```

**⚠️ Warning:** This will kill active sessions. Use only when necessary.

---

## Database Setup

### Consolidated Scripts (recommended)

- Fresh install (drops and recreates all app tables):
```sql
@schema_full_install.sql
```

- Safe upgrade (creates only missing objects; idempotent for production):
```sql
@schema_upgrade_safe.sql
```

- Session maintenance (identify/kill hung sessions, verify cleanup):
```sql
@sessions_maintenance.sql
```

These consolidated scripts replace the legacy scripts that previously lived in this folder.

### Initial Setup (Fresh Install)

1. **Connect to your Oracle database:**
   ```bash
   sqlplus admin@your_database
   ```

2. **Run the full install script:**
   ```sql
   @schema_full_install.sql
   ```

4. **Verify tables were created:**
   ```sql
   SELECT table_name FROM user_tables ORDER BY table_name;
   ```

   You should see:
   - `IMPORT_MAPPINGS`
   - `NAMED_SESSIONS`
   - `PRESENTATION_TEMPLATES`
   - `SESSION_ITEMS`
   - `SINGERS`
   - `SONG_SINGER_PITCHES`
   - `SONGS`
   - `VISITOR_ANALYTICS`

---

### Migration (Existing Database)

If you already have a database and need to add new features safely:

```sql
@schema_upgrade_safe.sql
```

---

## Schema Details

### Core Tables

#### songs
Stores song information cached from external sources:
- `id` (RAW(16), PK) - Unique identifier
- `name` (VARCHAR2(255)) - Song name for searching
- `external_source_url` (VARCHAR2(500)) - Original source URL
- `lyrics` (CLOB) - Full song lyrics
- `metadata` (CLOB, JSON) - Additional cached metadata
- `created_at`, `updated_at` - Timestamps

**Indexes:**
- Primary key on `id`
- Unique index on `external_source_url`
- Index on `UPPER(name)` for case-insensitive search

---

#### singers
Stores singer profiles:
- `id` (RAW(16), PK)
- `name` (VARCHAR2(100), unique)
- `base_pitch` (VARCHAR2(10))
- `notes` (VARCHAR2(500))
- `created_at`, `updated_at`

**Indexes:**
- Primary key on `id`
- Unique index on `UPPER(name)`

---

#### song_singer_pitches
Links songs to singers with specific pitch keys:
- `id` (RAW(16), PK)
- `song_id` (FK → songs)
- `singer_id` (FK → singers)
- `pitch` (VARCHAR2(10))
- `is_live` (NUMBER(1)) - Currently in live session
- `notes` (VARCHAR2(500))
- `created_at`, `updated_at`

**Constraints:**
- Unique combination of (song_id, singer_id, pitch)
- Foreign keys with CASCADE DELETE

**Indexes:**
- Primary key on `id`
- Index on `song_id`
- Index on `singer_id`
- Index on `is_live`

---

#### named_sessions
Stores named session configurations:
- `id` (RAW(16), PK)
- `name` (VARCHAR2(200), unique)
- `description` (VARCHAR2(1000))
- `created_at`, `updated_at`

---

#### session_items
Items within each named session:
- `id` (RAW(16), PK)
- `session_id` (FK → named_sessions)
- `pitch_id` (FK → song_singer_pitches)
- `position` (NUMBER) - Order in session
- `notes` (VARCHAR2(500))
- `created_at`

**Constraints:**
- Unique combination of (session_id, pitch_id)
- Foreign keys with CASCADE DELETE

---

#### import_mappings
User-defined mappings for CSV imports:
- `id` (RAW(16), PK)
- `mapping_type` (VARCHAR2(20)) - 'SONG' or 'PITCH'
- `csv_value` (VARCHAR2(500)) - Original CSV value
- `mapped_song_id` (FK → songs) - For song mappings
- `mapped_pitch_value` (VARCHAR2(20)) - For pitch mappings
- `created_at`

**Constraints:**
- Unique combination of (mapping_type, UPPER(csv_value))
- Check constraint: mapping_type IN ('SONG', 'PITCH')

---

#### visitor_analytics
Tracks visitor activity with geolocation:
- `id` (RAW(16), PK)
- `ip_address` (VARCHAR2(45))
- `country`, `country_code`, `region`, `city` - Geolocation
- `latitude`, `longitude` (NUMBER) - Map coordinates
- `user_agent` (VARCHAR2(500))
- `page_path`, `referrer` (VARCHAR2(500))
- `user_role` (VARCHAR2(20)) - public, viewer, editor, admin
- `visit_timestamp` (TIMESTAMP) - UTC timestamps

**Indexes:**
- Primary key on `id`
- Index on `visit_timestamp DESC`
- Index on `country`
- Index on `ip_address`

---

#### presentation_templates
Stores customizable templates for presentations:
- `id` (VARCHAR2(36), PK)
- `name` (VARCHAR2(255), unique) - Template name
- `description` (VARCHAR2(1000)) - Template description
- `template_json` (CLOB) - JSON representation of template elements
- `template_yaml` (CLOB) - Original YAML source
- `is_default` (NUMBER(1)) - Flag for default template
- `created_at`, `updated_at` (TIMESTAMP) - Timestamps
- `created_by`, `updated_by` (VARCHAR2(255)) - Audit fields

**Features:**
- Support for backgrounds (color, image, video)
- Image overlays with positioning and opacity
- Video overlays with autoplay controls
- Text overlays with font styling
- 9 predefined positions for elements
- Opacity and z-index control for layering

**Indexes:**
- Primary key on `id`
- Unique index on `name`
- Index on `is_default`

---

#### feedback
Collects user feedback with categorization:
- `id` (RAW(16), PK)
- `category` (VARCHAR2(50)) - bug, feature, improvement, question, other
- `feedback` (CLOB) - User feedback message
- `email` (VARCHAR2(255)) - Contact email
- `ip_address` (VARCHAR2(45)) - User IP address
- `user_agent` (VARCHAR2(500)) - Browser info
- `url` (VARCHAR2(500)) - Page URL where feedback was submitted
- `status` (VARCHAR2(50)) - new, in-progress, resolved, closed
- `admin_notes` (CLOB) - Internal admin notes
- `created_at`, `updated_at` (TIMESTAMP)

**Constraints:**
- Check: category IN ('bug', 'feature', 'improvement', 'question', 'other')
- Check: status IN ('new', 'in-progress', 'resolved', 'closed')

**Indexes:**
- Primary key on `id`
- Index on `status`
- Index on `category`
- Index on `created_at DESC`

---

## Connection Configuration

The application expects the following environment variables (`.env` file):

```bash
# Oracle Database Connection
ORACLE_USER=admin
ORACLE_PASSWORD=your_password
ORACLE_CONNECTION_STRING=your_connection_string

# Oracle Wallet (for secure connections)
ORACLE_WALLET_DIR=/path/to/wallet
```

### Oracle Autonomous Database

For Oracle Autonomous Database, you'll need:

1. **Wallet files** in the `wallet/` directory:
   - `cwallet.sso`
   - `tnsnames.ora`
   - `sqlnet.ora`
   - `truststore.jks`
   - `keystore.jks`

2. **Connection string** format:
   ```
   (description=(retry_count=3)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=xxx.oraclecloud.com))(connect_data=(service_name=xxx_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
   ```

---

## Backup and Restore

### Exporting Data

**Export all tables:**
```bash
expdp admin/password@database \
  directory=data_pump_dir \
  dumpfile=songstudio_backup.dmp \
  tables=songs,singers,song_singer_pitches,named_sessions,session_items,import_mappings,presentation_templates,visitor_analytics
```

**Export specific table:**
```bash
expdp admin/password@database \
  directory=data_pump_dir \
  dumpfile=songs_backup.dmp \
  tables=songs
```

### Importing Data

**Import all tables:**
```bash
impdp admin/password@database \
  directory=data_pump_dir \
  dumpfile=songstudio_backup.dmp \
  table_exists_action=replace
```

---

## Common Queries

### Check Database Size
```sql
SELECT 
  table_name,
  ROUND(bytes/1024/1024, 2) AS size_mb
FROM user_segments
WHERE segment_type = 'TABLE'
ORDER BY bytes DESC;
```

### Count Records in Each Table
```sql
SELECT 'songs' as table_name, COUNT(*) as count FROM songs
UNION ALL
SELECT 'singers', COUNT(*) FROM singers
UNION ALL
SELECT 'song_singer_pitches', COUNT(*) FROM song_singer_pitches
UNION ALL
SELECT 'named_sessions', COUNT(*) FROM named_sessions
UNION ALL
SELECT 'session_items', COUNT(*) FROM session_items
UNION ALL
SELECT 'import_mappings', COUNT(*) FROM import_mappings
UNION ALL
SELECT 'presentation_templates', COUNT(*) FROM presentation_templates
UNION ALL
SELECT 'visitor_analytics', COUNT(*) FROM visitor_analytics;
```

### Recent Analytics (Last 24 Hours)
```sql
SELECT 
  TO_CHAR(visit_timestamp, 'YYYY-MM-DD HH24:MI:SS') as visit_time,
  ip_address,
  city,
  country,
  page_path,
  user_role
FROM visitor_analytics
WHERE visit_timestamp >= SYSTIMESTAMP - INTERVAL '24' HOUR
ORDER BY visit_timestamp DESC
FETCH FIRST 20 ROWS ONLY;
```

### Top Songs by Pitch Assignments
```sql
SELECT 
  s.name as song_name,
  COUNT(*) as pitch_count
FROM songs s
JOIN song_singer_pitches ssp ON s.id = ssp.song_id
GROUP BY s.name
ORDER BY pitch_count DESC
FETCH FIRST 10 ROWS ONLY;
```

---

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to database
```
Error: ORA-12154: TNS:could not resolve the connect identifier
```

**Solution:**
1. Check `ORACLE_WALLET_DIR` environment variable points to wallet directory
2. Verify wallet files exist and are readable
3. Check `tnsnames.ora` has correct connection string

---

**Problem:** Authentication failure
```
Error: ORA-01017: invalid username/password
```

**Solution:**
1. Verify `ORACLE_USER` and `ORACLE_PASSWORD` in `.env`
2. For Autonomous DB, username is usually `ADMIN`
3. Check password doesn't have special characters that need escaping

---

### Performance Issues

**Problem:** Slow queries

**Solution:**
1. Analyze table statistics:
   ```sql
   EXEC DBMS_STATS.GATHER_SCHEMA_STATS('ADMIN');
   ```

2. Check for missing indexes:
   ```sql
   SELECT table_name, index_name, column_name
   FROM user_ind_columns
   ORDER BY table_name, index_name;
   ```

3. Monitor long-running queries:
   ```sql
   SELECT sql_text, elapsed_time/1000000 as seconds
   FROM v$sql
   WHERE elapsed_time > 1000000
   ORDER BY elapsed_time DESC;
   ```

---

### Space Issues

**Problem:** Running out of tablespace

**Solution:**
1. Check space usage:
   ```sql
   SELECT 
     tablespace_name,
     ROUND(SUM(bytes)/1024/1024/1024, 2) as used_gb
   FROM user_segments
   GROUP BY tablespace_name;
   ```

2. Clean old analytics data:
   ```sql
   DELETE FROM visitor_analytics 
   WHERE visit_timestamp < SYSTIMESTAMP - INTERVAL '90' DAY;
   ```

---

## Security Considerations

1. **Never commit passwords** - Keep `.env` in `.gitignore`
2. **Wallet protection** - Wallet files contain credentials; keep them secure
3. **IP tracking privacy** - Analytics tracks IP addresses; comply with privacy laws
4. **Role-based access** - Use separate passwords for admin/editor/viewer roles
5. **Backup encryption** - Encrypt database exports before storing

---

## Support

For issues or questions:
- Check main project README: `../README.md`
- Review deployment docs: `../docs/DEPLOYMENT.md`
- Database troubleshooting: `../docs/TROUBLESHOOTING.md`

---

## Version History

- **v2.1** - Added presentation_templates table for customizable presentation templates
- **v2.0** - Added analytics schema with geolocation tracking
- **v1.5** - Added import_mappings table for CSV import
- **v1.0** - Initial schema with songs, singers, pitches, sessions

