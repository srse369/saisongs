# Database Setup Guide

This guide explains how to set up and connect to the Neon PostgreSQL database for the Song Studio application.

## Database Information

- **Provider**: Neon (Serverless PostgreSQL)
- **Project**: dry-smoke-47581568
- **Branch**: br-delicate-mountain-afvp7hqz

## Prerequisites

- Access to the Neon console (https://console.neon.tech)
- PostgreSQL client (psql) or Neon SQL Editor

## Setup Instructions

### Option 1: Using Neon SQL Editor (Recommended)

1. Log in to the Neon console at https://console.neon.tech
2. Navigate to your project: `dry-smoke-47581568`
3. Select the branch: `br-delicate-mountain-afvp7hqz`
4. Click on "SQL Editor" in the left sidebar
5. Copy the contents of `schema.sql` and paste into the SQL Editor
6. Click "Run" to execute the schema
7. Verify that the tables were created successfully

### Option 2: Using psql Command Line

1. Get your connection string from the Neon console:
   - Go to your project dashboard
   - Click "Connection Details"
   - Copy the connection string (it should look like: `postgresql://user:password@host/database`)

2. Execute the schema script:
   ```bash
   psql "YOUR_CONNECTION_STRING" -f database/schema.sql
   ```

3. Verify the tables were created:
   ```bash
   psql "YOUR_CONNECTION_STRING" -c "\dt"
   ```

## Connection Configuration

### For Development

1. Copy the `.env.local.template` file to `.env.local`:
   ```bash
   cp .env.local.template .env.local
   ```

2. Edit `.env.local` and add your Neon connection string:
   ```
   VITE_NEON_CONNECTION_STRING=postgresql://user:password@host/database?sslmode=require
   ```

3. **Important**: Never commit `.env.local` to version control (it's already in `.gitignore`)

### For Production (GitHub Pages)

The connection string needs to be embedded at build time. You have two options:

#### Option A: Build-time Environment Variable
Set the environment variable before building:
```bash
export VITE_NEON_CONNECTION_STRING="your_connection_string"
npm run build
```

#### Option B: GitHub Actions Secret
If using GitHub Actions for deployment:
1. Go to your repository Settings → Secrets and variables → Actions
2. Add a new secret named `VITE_NEON_CONNECTION_STRING`
3. Update your GitHub Actions workflow to use this secret during build

## Database Schema

The schema includes three main tables:

### songs
- `id` (UUID): Primary key
- `name` (VARCHAR): Song name
- `lyrics` (TEXT): Original lyrics
- `translation` (TEXT): Optional English translation
- `created_at`, `updated_at` (TIMESTAMP): Audit fields

### singers
- `id` (UUID): Primary key
- `name` (VARCHAR): Singer name
- `created_at`, `updated_at` (TIMESTAMP): Audit fields

### song_singer_pitches
- `id` (UUID): Primary key
- `song_id` (UUID): Foreign key to songs
- `singer_id` (UUID): Foreign key to singers
- `pitch` (VARCHAR): Musical pitch information
- `created_at`, `updated_at` (TIMESTAMP): Audit fields
- Unique constraint on (song_id, singer_id)

## Performance Indexes

The following indexes are created for optimal query performance:
- `idx_songs_name`: Index on song names for search functionality
- `idx_song_singer_pitches_song_id`: Index for querying pitches by song
- `idx_song_singer_pitches_singer_id`: Index for querying pitches by singer

## Verification

After running the schema, verify the setup:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check indexes
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public';

-- Verify foreign key constraints
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE contype = 'f';
```

## Troubleshooting

### Connection Issues
- Ensure your IP is allowed in Neon's connection settings
- Verify SSL mode is set to `require` in the connection string
- Check that the branch name is correct

### Permission Errors
- Ensure you have the correct database user credentials
- Verify the user has CREATE TABLE permissions

### Schema Already Exists
The schema script includes `DROP TABLE IF EXISTS` statements, so it's safe to run multiple times. However, this will delete all existing data.

## Security Notes

- **Never commit connection strings to version control**
- Use environment variables for sensitive credentials
- Consider using separate database users for development and production
- Enable SSL for all database connections (Neon requires this by default)
- Regularly rotate database passwords

## Sample Data (Optional)

To populate the database with sample songs for testing, you can use the provided seed script. This is useful for:
- Testing the application with realistic data
- Demonstrating features to stakeholders
- Development and debugging

### What's Included

The seed script (`seed.sql`) adds:
- **5 sample singers**: Ravi Kumar, Priya Sharma, Amit Patel, Lakshmi Devi, Suresh Iyer
- **8 devotional songs**: Including popular bhajans like Om Jai Jagdish Hare, Raghupati Raghav Raja Ram, Hare Krishna Hare Rama, and more
- **Complete lyrics and English translations** for all songs
- **14 pitch associations**: Demonstrating how different singers perform songs in different keys

### Method 1: Using the Shell Script (Recommended)

The easiest way to seed the database is using the provided shell script:

```bash
# Navigate to the database directory
cd database

# Run the seed script with your connection string
./seed.sh "postgresql://user:password@host/database?sslmode=require"
```

Or set an environment variable:

```bash
export NEON_CONNECTION_STRING="postgresql://user:password@host/database?sslmode=require"
./seed.sh "$NEON_CONNECTION_STRING"
```

The script will:
- Verify psql is installed
- Connect to your database
- Execute the seed SQL
- Display a summary of inserted data

### Method 2: Using Neon SQL Editor

1. Log in to the Neon console at https://console.neon.tech
2. Navigate to your project and branch
3. Click on "SQL Editor" in the left sidebar
4. Copy the entire contents of `seed.sql`
5. Paste into the SQL Editor
6. Click "Run" to execute

You'll see output showing:
- Number of songs, singers, and pitch associations inserted
- Sample data preview

### Method 3: Using psql Directly

If you prefer to run psql manually:

```bash
psql "YOUR_CONNECTION_STRING" -f database/seed.sql
```

### Verifying the Seed Data

After running the seed script, verify the data was inserted:

```sql
-- Check songs
SELECT name FROM songs;

-- Check singers
SELECT name FROM singers;

-- Check pitch associations
SELECT 
    s.name as song_name,
    si.name as singer_name,
    ssp.pitch
FROM song_singer_pitches ssp
JOIN songs s ON ssp.song_id = s.id
JOIN singers si ON ssp.singer_id = si.id;
```

### Re-seeding the Database

If you want to clear existing data and re-seed:

1. Uncomment the DELETE statements at the top of `seed.sql`:
   ```sql
   DELETE FROM song_singer_pitches;
   DELETE FROM singers;
   DELETE FROM songs;
   ```

2. Run the seed script again

Alternatively, you can drop and recreate the schema first:
```bash
psql "YOUR_CONNECTION_STRING" -f database/schema.sql
psql "YOUR_CONNECTION_STRING" -f database/seed.sql
```

### Sample Songs Included

1. **Om Jai Jagdish Hare** - Classic aarti with multiple verses
2. **Raghupati Raghav Raja Ram** - Gandhi's favorite bhajan
3. **Hare Krishna Hare Rama** - Maha Mantra
4. **Shri Ram Jai Ram** - Victory chant for Lord Rama
5. **Om Namah Shivaya** - Shiva mantra
6. **Gayatri Mantra** - Sacred Vedic chant
7. **Hanuman Chalisa Opening** - First two verses
8. **Achyutam Keshavam** - Popular Krishna bhajan

All songs include both original lyrics and English translations, making them perfect for testing the presentation mode's translation display feature.

## Next Steps

After setting up the database:
1. Verify the connection in your application
2. Test CRUD operations through the admin interface
3. Optionally load sample data using `seed.sql`
4. Monitor database usage in the Neon console

## Support

- Neon Documentation: https://neon.tech/docs
- Neon Community: https://community.neon.tech
- Project Issues: [Your GitHub repository issues page]
