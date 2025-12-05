# Database Scripts

This directory contains SQL scripts for managing the Oracle database schema.

## Files

### `schema_full_install.sql` ⭐
**Complete database installation script for fresh databases**

Creates all tables, sequences, triggers, and initial data:
- Core tables: songs, users (with is_admin flag), pitches, song_singer_pitches
- Multi-tenancy: centers with center_ids and editor_ids  
- Authentication: otp_codes for email-based login
- Session storage: sessions table for Express sessions
- Analytics: visitor_analytics and feedback tables
- CSV import: csv_song_mappings and csv_pitch_mappings
- Templates: presentation_templates and song_sessions

**Initial Data:**
- 12 musical pitches (C through B)
- 1 default center
- 1 default presentation template

**Usage:**
```bash
sqlplus username/password@database @database/schema_full_install.sql
```

⚠️ **WARNING**: This script drops all existing tables! Only use for fresh installations.

### `migration_add_center_roles.sql`
**Migration script to add editor_for column and migrate from editor_ids**

Adds the `editor_for` column to the users table and migrates existing editor assignments from `centers.editor_ids` to the new `users.editor_for` format.

**What it does:**
1. Adds `editor_for` CLOB column to users table with JSON constraint
2. Migrates editor assignments from `centers.editor_ids` to `users.editor_for`
3. Preserves existing editor relationships in the new array format

**Usage:**
```bash
sqlplus username/password@database @database/migration_add_center_roles.sql
```

After migration, you can optionally remove the old `editor_ids` column from centers table (see script comments).

### `migration_add_audit_columns.sql` ⭐
**Migration script to add created_by and updated_by columns to existing tables**

Adds audit tracking columns to tables that need them:
- `songs`: created_by, updated_by
- `users`: created_by, updated_by
- `song_singer_pitches`: created_by, updated_by
- `centers`: created_by, updated_by
- `song_sessions`: created_by, updated_by
- `presentation_templates`: created_by, updated_by
- `feedback`: updated_by

**What it does:**
1. Checks if columns exist before adding (idempotent - safe to run multiple times)
2. Adds VARCHAR2(100) columns for storing user email
3. Creates indexes on audit columns for query performance
4. Provides clear output showing what was added vs. already existed

**Usage:**
```bash
sqlplus username/password@database @database/migration_add_audit_columns.sql
```

**Notes:**
- Safe to run on databases where some columns already exist
- Existing records will have NULL values for audit columns
- New records will automatically populate these fields via application code
- `created_at` and `updated_at` are managed by database triggers (already present)

### `migration_add_is_admin.sql`
**Migration script to add is_admin flag to existing databases**

Adds the `is_admin` column to the users table for explicit admin tracking.
Sets all existing users with email to admin by default (safe migration).

**Usage:**
```bash
sqlplus username/password@database @database/migration_add_is_admin.sql
```

After running, review and update admin flags as needed:
```sql
-- Remove admin from specific users
UPDATE users SET is_admin = 0 WHERE email = 'user@example.com';

-- Grant admin to specific users
UPDATE users SET is_admin = 1 WHERE email = 'admin@example.com';
```

### `sessions_maintenance.sql`
**Maintenance procedures for cleaning up expired data**

Provides two stored procedures:
- `cleanup_expired_otp_codes` - Removes expired/used OTP codes
- `cleanup_expired_sessions` - Removes expired Express sessions

**Usage:**
```sql
-- Manual execution
EXEC cleanup_expired_otp_codes;
EXEC cleanup_expired_sessions;

-- Set up automated cleanup (recommended)
-- Run cleanup_expired_otp_codes hourly
-- Run cleanup_expired_sessions daily
```

## Features

### Multi-Tenancy
- **Centers**: Organizations/locations with customizable badge colors
- **center_ids**: JSON array column on songs, users, templates, sessions for viewer access
- **editor_for**: JSON array on users table listing center IDs they can edit (e.g. `[1, 3]`)
- Resources without center_ids are visible to all users
- Resources with center_ids are filtered based on user access

### Role System (Simplified)
The system uses a simple three-tier role model:

- **Admin**: Users with `is_admin = 1` in users table (requires email). Full system access.
  - Can manage all resources across all centers
  - Can set/remove admin flag for other users
  - Can assign editor_for to users
  
- **Editor**: Users with center IDs in `editor_for` array (requires email)
  - Can manage songs, singers, pitches, and templates for their assigned centers
  - Example: `editor_for = [1, 3]` gives editor access to centers 1 and 3
  
- **Viewer**: All other users with email
  - Read-only access to singers and pitches in centers from `center_ids`
  - Example: `center_ids = [1, 2, 3]` gives viewer access to these centers

**Role determination at login:**
  1. Check if `is_admin = 1` → Admin
  2. Check if `editor_for` is not empty → Editor
  3. Otherwise → Viewer

**Setting roles (admins only):**
```sql
-- Make user an admin
UPDATE users SET is_admin = 1 WHERE email = 'admin@example.com';

-- Assign editor access to centers 1 and 3
UPDATE users SET editor_for = '[1, 3]' WHERE email = 'user@example.com';

-- Assign viewer access to centers 1, 2, 3
UPDATE users SET center_ids = '[1, 2, 3]' WHERE email = 'user@example.com';

-- Remove editor access
UPDATE users SET editor_for = NULL WHERE email = 'user@example.com';
```

### Authentication
- Email-based OTP (one-time password) authentication
- OTP codes expire after configured time
- Session management via Express sessions stored in Oracle

## Schema Overview

| Table | Purpose |
|-------|---------|
| songs | Song catalog with metadata (language, deity, tempo, etc.) |
| users | Users/singers with optional email for OTP auth |
| pitches | Musical pitches (C, C#, D, etc.) |
| song_singer_pitches | Links songs to singers with pitch preferences |
| centers | Organizations for multi-tenancy |
| song_sessions | Saved session configurations |
| presentation_templates | Presentation layout templates |
| otp_codes | One-time passwords for email auth |
| sessions | Express session storage |
| visitor_analytics | Visitor tracking with geolocation |
| feedback | User feedback submissions |
| csv_song_mappings | CSV import song mappings |
| csv_pitch_mappings | CSV import pitch format mappings |

## Quick Start

### 1. Fresh Installation
```bash
sqlplus username/password@database @database/schema_full_install.sql
```

### 2. Import Your Data
- Import songs, users, and pitch assignments
- Configure centers for your organizations
- Assign editor access using users.editor_for

### 3. Set Up Maintenance
Schedule automated cleanup:
```sql
-- Hourly: Clean up OTP codes
EXEC cleanup_expired_otp_codes;

-- Daily: Clean up sessions  
EXEC cleanup_expired_sessions;
```

## Connection Setup

### Oracle Wallet
Place wallet files in `./wallet/`:
- cwallet.sso
- tnsnames.ora
- sqlnet.ora
- ojdbc.properties

### Oracle Instant Client
Set environment variable:
```bash
export ORACLE_INSTANT_CLIENT=/path/to/instantclient
```

## Verification

```sql
-- List all tables
SELECT table_name FROM user_tables ORDER BY table_name;

-- Count records
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'songs', COUNT(*) FROM songs
UNION ALL
SELECT 'centers', COUNT(*) FROM centers;

-- View users table structure
SELECT column_name, data_type 
FROM user_tab_columns 
WHERE table_name = 'USERS' 
ORDER BY column_id;
```

## Support

For issues or questions, ensure:
1. Oracle Instant Client is properly installed
2. Wallet files are in the correct location
3. Database credentials are correct
4. All required tables exist (check verification queries above)
