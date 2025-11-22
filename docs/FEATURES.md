# Features Guide

Comprehensive guide to Song Studio's features and functionality.

## Table of Contents
- [User Roles & Permissions](#user-roles--permissions)
- [Named Sessions](#named-sessions)
- [CSV Import](#csv-import-utility)
- [Presentation Mode](#presentation-mode)
- [Song Management](#song-management)

---

## User Roles & Permissions

Song Studio supports three user roles with different access levels.

### 👁️ Viewer (Default)

**Access:**
- No password required
- Read-only access to all content

**Can do:**
- ✅ View all songs, singers, and pitches
- ✅ Use presentation mode
- ✅ Add songs to live session
- ✅ Search and filter content

**Cannot do:**
- ❌ Create, edit, or delete any content
- ❌ Access admin features

### ✏️ Editor

**Access:**
- Password required (`VITE_EDITOR_PASSWORD`)
- Can create and edit content

**Permissions:**
- All Viewer permissions, plus:
- ✅ Create new songs, singers, pitch associations
- ✅ Edit existing songs, singers, pitches
- ✅ Manage named sessions
- ✅ Import from CSV
- ❌ Cannot delete content (Admin only)

### 🛡️ Admin

**Access:**
- Password required (`VITE_ADMIN_PASSWORD`)
- Full access to all features

**Permissions:**
- All Editor permissions, plus:
- ✅ Delete songs, singers, pitch associations
- ✅ Import from external sources via CSV
- ✅ Access all administrative features

### How to Login

**Keyboard shortcut:**
- Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac) from anywhere in the app

**Via header:**
- Click the role indicator badge in the top-right corner:
  - 👁️ Viewer (gray badge)
  - ✏️ Editor (blue badge)
  - 🛡️ Admin (green badge)

**Session duration:**
- Login sessions last for **24 hours**
- Stored in browser session storage
- Automatically expire after 24 hours

### Configure Passwords

**Set in `.env.local` for development:**
```bash
VITE_ADMIN_PASSWORD=your_admin_password
VITE_EDITOR_PASSWORD=your_editor_password
```

**Default passwords** (change in production!):
- Admin: `AdminPassword`
- Editor: `EditorPassword`

### Permission Matrix

| Feature | Viewer | Editor | Admin |
|---------|:------:|:------:|:-----:|
| View songs/singers/pitches | ✅ | ✅ | ✅ |
| Presentation mode | ✅ | ✅ | ✅ |
| Add to live session | ✅ | ✅ | ✅ |
| Create songs/singers/pitches | ❌ | ✅ | ✅ |
| Edit songs/singers/pitches | ❌ | ✅ | ✅ |
| Delete songs/singers/pitches | ❌ | ❌ | ✅ |
| Import from CSV | ❌ | ✅ | ✅ |
| Named session management | ❌ | ✅ | ✅ |

---

## Named Sessions

Save and reuse session configurations with predefined sequences of songs, singers, and pitches.

### Overview

Named Sessions allow you to:
- Create reusable session templates
- Save song sequences for recurring events
- Quickly set up themed performances
- Duplicate and modify existing sessions

### Access

- **Desktop:** "Sessions" link in top navigation (requires Editor/Admin role)
- **Mobile:** "Manage Sessions" in mobile menu
- **Direct URL:** `/admin/sessions`

### Creating a Named Session

1. Navigate to `/admin/sessions`
2. Click **"Create Session"**
3. Enter session name (required)
4. Enter description (optional)
5. Click **"Save"**

### Adding Songs to a Session

1. Click the **"Manage Songs"** icon (🎵) on a session
2. Click **"+ Add Song"**
3. For each song:
   - Select song from dropdown
   - Select singer (optional)
   - Enter pitch (optional)
4. Use **up/down arrows** to reorder items
5. Click **"Save Songs"**

### Loading a Session

1. Click the **"Load"** icon (→) on a session
2. Session songs load into the active session
3. Navigate to presentation mode to present

### Duplicating a Session

1. Click the **"Duplicate"** icon (📋) on a session
2. Enter a new name for the copy
3. Session and all its items are duplicated

### Managing Sessions

**Edit session:**
- Click the **"Edit"** icon (✏️)
- Update name or description
- Click **"Save"**

**Delete session:**
- Click the **"Delete"** icon (🗑️)
- Confirm deletion
- All session items are also deleted

### Database Schema

**`named_sessions` table:**
- `id` - UUID primary key
- `name` - Unique session name
- `description` - Optional description
- `created_at`, `updated_at` - Timestamps

**`session_items` table:**
- `id` - UUID primary key
- `session_id` - Foreign key to named_sessions
- `song_id` - Foreign key to songs
- `singer_id` - Optional foreign key to singers
- `pitch` - Optional pitch information
- `sequence_order` - Order in sequence (1-based)
- `created_at`, `updated_at` - Timestamps

### API Endpoints

**Sessions:**
- `GET /api/sessions` - Get all sessions
- `GET /api/sessions/:id` - Get session with items
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/duplicate` - Duplicate session

**Session Items:**
- `GET /api/sessions/:sessionId/items` - Get items
- `POST /api/sessions/:sessionId/items` - Add item
- `PUT /api/sessions/items/:id` - Update item
- `DELETE /api/sessions/items/:id` - Delete item
- `PUT /api/sessions/:sessionId/reorder` - Reorder items
- `PUT /api/sessions/:sessionId/items` - Replace all items (bulk update)

---

## CSV Import Utility

Import singer and pitch data from CSV files.

**⚠️ Admin only feature**

### Overview

The CSV Import tool allows you to:
- Import singer records automatically
- Map pitch formats from various notations to standard notation
- Fuzzy match songs (90% similarity threshold)
- Manually override song matches when needed
- Define custom pitch mappings
- Preview before committing data

### Access the Tool

1. Log in as admin (`Ctrl+Shift+I`)
2. Navigate to Home page
3. Click **"Import from CSV"** card (green card)
4. Or go directly to: `/admin/import-csv`

### Import Process

#### Step 1: Preparation
- Click **"Start Import"** button
- Read the instructions carefully

#### Step 2: Data Collection

Prepare your CSV data with 3 columns:

**CSV Format:**
```
Song Title,Singer,Pitch
```

**Example:**
```
Om Namah Shivaya,Shambhavi,G
Raghu Pathey,Ameya,4m
Why fear when I am here,Ameya,5m
```

You can:
- Create the CSV in Excel/Google Sheets and copy-paste
- Import data from any external source
- Format manually with commas separating columns

#### Step 3: Preview

After pasting data:
- Click **"Process Data"** button
- Review the preview table showing:
  - ✅ **Ready**: Items ready to import (song matched, pitch recognized)
  - ⚠️ **Song**: Items needing manual song matching
  - ⚠️ **Pitch**: Items needing pitch format mapping

#### Step 4: Resolve Issues

**For unmatched songs:**
1. Click **"Set Song"** button
2. Enter the EXACT song name from your database
3. Click ✓ to confirm

**For unrecognized pitches:**
1. Click **"Map Pitch"** button
2. Enter the normalized pitch (C, D, E, F, G, A, B, C#, D#, F#, G#, A#)
3. Click ✓ to confirm
4. Mapping is saved for future imports

#### Step 5: Import

- Review the counts:
  - Ready to Import
  - Need Song Match
  - Need Pitch Mapping
- Click **"Import X Items"** button
- Wait for completion

#### Step 6: Results

View statistics:
- Singers Created
- Pitches Created
- Pitches Updated
- Any errors encountered

Click **"Import More Data"** to start another import session

### Pitch Format Mappings

The utility automatically recognizes and converts:

| Input Format | Normalized | Notes |
|-----------------|------------|-------|
| 1, 1M, 1Madhyam, 1m | C | Basic C |
| 2, 2M, 2Madhyam, 2m | D | Basic D |
| 3, 3M, 3Madhyam, 3m | E | Basic E |
| 4, 4M, 4Madhyam, 4m | F | Basic F |
| 5, 5M, 5Madhyam, 5m | G | Basic G |
| 6, 6M, 6Madhyam, 6m | A | Basic A |
| 7, 7M, 7Madhyam, 7m | B | Basic B |
| 1.5m, 1.5M, 1.5Madhyam | C# | C Sharp |
| 2.5m, 2.5M, 2.5Madhyam | D# | D Sharp |
| 4.5m, 4.5M, 4.5Madhyam | F# | F Sharp |
| 5.5m, 5.5M, 5.5Madhyam | G# | G Sharp |
| 6.5m, 6.5M, 6.5Madhyam | A# | A Sharp |

**Custom mappings:**
- System prompts for unrecognized formats
- Enter standard notation
- Mapping saved for all future imports

### Song Matching

**Automatic matching:**
- Uses 90% similarity threshold
- Ignores case and common prefixes (Sri, Shri, Jai, Jaya, Om, Hey, He)
- Removes special characters for better matching

**Match types:**
- **Exact (100%)**: Perfect match (green indicator)
- **Fuzzy (90-99%)**: Close match with similarity % (yellow indicator)
- **Manual**: User-provided match (with "(Manual)" label)
- **None**: No match found, requires manual input

### Database Operations

**New singer records:**
- Created automatically for singers not in database
- Uses exact name from CSV

**New pitch records:**
- Links: Singer ID + Song ID + Pitch value
- Includes note: "Imported from CSV (Original Song Name)"

**Updated pitch records:**
- If singer already has pitch for a song, it gets updated
- Previous pitch value replaced with new one

### Tips & Best Practices

1. **Start small**: Test with a few rows first to verify the process
2. **Check song names**: Have your Songs list open for reference
3. **Batch processing**: Process data in smaller batches for large datasets
4. **Review before import**: Always check the preview table
5. **Note original names**: Original CSV song name stored in pitch notes
6. **Incremental updates**: Run import multiple times; existing pitches update

---

## Presentation Mode

Display songs and lyrics in a clean, distraction-free presentation view.

### Features

- Full-screen presentation view
- Large, readable text
- Slide-based navigation
- Keyboard shortcuts
- Mobile-friendly
- Live session support

### Navigation

**Keyboard shortcuts:**
- `←` Previous slide
- `→` Next slide
- `Home` First slide
- `End` Last slide
- `Esc` Exit presentation mode

**On-screen controls:**
- Navigation arrows
- Slide counter
- Exit button

### Accessing Presentation Mode

1. Add songs to the live session
2. Click **"Presentation Mode"** button
3. Navigate through slides
4. Press `Esc` to exit

---

## Song Management

### Adding Songs

1. Log in as Editor or Admin
2. Navigate to Songs page
3. Click **"Add Song"**
4. Fill in:
   - Song name (required)
   - Deity (optional)
   - Language (optional)
   - Category (optional)
   - Lyrics (optional)
5. Click **"Save"**

### Editing Songs

1. Navigate to Songs page
2. Click **"Edit"** icon (✏️) on a song
3. Update fields
4. Click **"Save"**

### Deleting Songs

1. Log in as Admin
2. Navigate to Songs page
3. Click **"Delete"** icon (🗑️) on a song
4. Confirm deletion

**⚠️ Note:** Deleting a song cascades to remove it from all sessions and pitch associations.

### Singer Management

**Add singer:**
1. Navigate to Singers page
2. Click **"Add Singer"**
3. Enter name
4. Click **"Save"**

**Edit/Delete:**
- Same process as songs
- Deleting a singer sets singer_id to NULL in pitch associations

### Pitch Management

Pitch associations link singers to songs with specific pitch information.

**Add pitch:**
1. Navigate to Pitches page
2. Click **"Add Pitch"**
3. Select singer
4. Select song
5. Enter pitch (e.g., C, D, E, F#, G#)
6. Add notes (optional)
7. Click **"Save"**

**View pitches:**
- Filter by singer or song
- Search by any field
- Sort by date or alphabetically

---

## Search & Filter

### Global Search

Available on Songs, Singers, and Pitches pages:
- Real-time search as you type
- Searches across all fields
- Case-insensitive
- Instant results

### Filters

**Songs page:**
- Filter by deity
- Filter by language
- Filter by category

**Pitches page:**
- Filter by singer
- Filter by song
- Filter by pitch

---

## Import/Export

### CSV Import

1. Log in as Editor or Admin
2. Navigate to Songs/Singers/Pitches page
3. Click **"Import CSV"**
4. Select CSV file
5. Map columns to fields
6. Preview import
7. Confirm import

### Bulk Operations

**Bulk edit:**
- Select multiple items
- Click **"Bulk Edit"**
- Update fields
- Apply to all selected

**Bulk delete:**
- Admin only
- Select multiple items
- Click **"Bulk Delete"**
- Confirm deletion

---

## Live Session

The live session is the current working set of songs for presentation.

### Features

- Add songs from any page
- Reorder songs (drag & drop)
- Remove songs
- Clear entire session
- Save as named session
- Load from named session

### Adding to Session

1. Find a song (Songs page, search, etc.)
2. Click **"Add to Session"** button
3. Song appears in live session sidebar

### Managing Session

**Reorder:**
- Drag and drop songs in the sidebar

**Remove:**
- Click **"Remove"** icon (×) on a song

**Clear all:**
- Click **"Clear Session"** button
- Confirm clearing

**Save as named session:**
1. Click **"Save Session"**
2. Enter name and description
3. Session saved for future use

---

## Mobile Experience

Song Studio is fully responsive and works on mobile devices.

### Mobile Features

- Touch-friendly interface
- Swipe gestures in presentation mode
- Responsive navigation menu
- Mobile-optimized forms
- Offline-capable (with service worker)

### Mobile Menu

Access via hamburger menu (≡) in top-left:
- Home
- Songs
- Singers
- Pitches
- Sessions
- Presentation Mode
- Admin features (if logged in)

---

## Support

For technical information:
- Deployment: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

