# Features Guide

Comprehensive guide to Song Studio's features and functionality.

## Table of Contents
- [User Roles & Permissions](#user-roles--permissions)
- [Named Sessions](#named-sessions)
- [CSV Import](#csv-import-utility)
- [Smart Search](#smart-search)
- [AI Search (WebLLM)](#ai-search-webllm)
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

### CSV Format

Prepare your CSV data with 3 columns:

```
Song Title,Singer,Pitch
Om Namah Shivaya,Shambhavi,G
Raghu Pathey,Ameya,4m
Why fear when I am here,Ameya,5m
```

### Pitch Format Mappings

The utility automatically recognizes and converts:

| Input Format | Normalized | Notes |
|--------------|------------|-------|
| 1, 1M, 1m | C | Basic C |
| 2, 2M, 2m | D | Basic D |
| 3, 3M, 3m | E | Basic E |
| 4, 4M, 4m | F | Basic F |
| 5, 5M, 5m | G | Basic G |
| 6, 6M, 6m | A | Basic A |
| 7, 7M, 7m | B | Basic B |
| 1.5m, 1.5M | C# | C Sharp |
| 2.5m, 2.5M | D# | D Sharp |
| 4.5m, 4.5M | F# | F Sharp |
| 5.5m, 5.5M | G# | G Sharp |
| 6.5m, 6.5M | A# | A Sharp |

### Song Matching

**Automatic matching:**
- Uses 90% similarity threshold
- Ignores case and common prefixes (Sri, Shri, Jai, Jaya, Om, Hey, He)
- Removes special characters for better matching

**Match types:**
- **Exact (100%)**: Perfect match (green indicator)
- **Fuzzy (90-99%)**: Close match with similarity % (yellow indicator)
- **Manual**: User-provided match
- **None**: No match found, requires manual input

---

## Smart Search

Natural language search using **fuzzy matching** and **intelligent query parsing**. Works entirely **client-side** with no server requirements.

### Features

#### Natural Language Queries
Type queries as you would speak them:

```
"sai songs in sanskrit"
"fast tempo devi songs"
"C# pitch for singers"
"simple level hamsadhwani"
```

#### Fuzzy Matching (Typo-Tolerant)
Misspell words? No problem!

```
"hamsa" → finds "Hamsadhwani"
"devii" → finds "Devi"
"sanskirt" → finds "Sanskrit"
```

#### Smart Keyword Detection

Automatically recognizes:
- **Deities**: sai, devi, krishna, rama, shiva, ganesh, hanuman, durga, lakshmi, saraswati
- **Languages**: sanskrit, hindi, telugu, tamil, kannada, malayalam, bengali, marathi
- **Tempos**: slow, medium, fast (with synonyms: quick, rapid, slower)
- **Levels**: simple, easy, intermediate, advanced, difficult
- **Pitches**: C, C#, D, D#, E, F, F#, G, G#, A, A#, B

### How It Works

When you type a query, the system:

1. **Extracts keywords** from your query
2. **Applies filters** based on recognized patterns
3. **Performs fuzzy search** on remaining terms
4. **Ranks results** by relevance

**Example: "sai songs fast tempo"**
1. Detects `sai` → filters by deity
2. Detects `fast` → filters by tempo
3. Excludes common words (`songs`)
4. Returns matching results

### Advanced Usage

**Combining Filters:**
```
"C# devi sanskrit"
→ Pitches in C#, for Devi, in Sanskrit

"simple sai slow"
→ Simple level, Sai songs, slow tempo
```

**Synonyms:**
- **Tempo**: fast = quick = rapid
- **Level**: simple = easy = basic = beginner
- **Level**: advanced = difficult = hard = complex

### Search Fields (Songs)

| Field | Weight |
|-------|--------|
| Name | 2.0 |
| Deity | 1.0 |
| Language | 1.0 |
| Raga | 1.0 |
| Tempo | 0.8 |
| Beat | 0.8 |
| Level | 0.8 |

### Performance

- **Fuse.js**: Only ~14KB gzipped
- **Client-side**: No API calls
- **Fast**: Searches 1000+ songs instantly
- **No backend**: Works on smallest instances

---

## AI Search (WebLLM)

**True natural language search** using a local AI model running entirely in your browser. No server or API keys needed!

### Requirements

**Browser Support (WebGPU required):**
- ✅ Chrome/Edge 113+
- ✅ Safari 17+
- ❌ Firefox (WebGPU experimental)

**System Requirements:**
- 4GB RAM minimum (8GB+ recommended)
- ~150MB free disk space
- Modern GPU (integrated or dedicated)
- Stable internet (first download only)

### How to Use

#### 1. Enable AI Search

1. Navigate to the **Songs** or **Pitches** tab
2. Click the **"AI Search OFF"** button
3. Wait for the model to download (~100-150MB, one-time)
4. Progress bar shows download status
5. Button turns to **"AI Search ON"** with green checkmark

#### 2. Natural Language Queries

With AI enabled, type queries naturally:

```
"Show me all sai bhajans in sanskrit with slow tempo"
"I want devi songs that are simple level"
"Find songs in hamsadhwani raga"
"Which singers have C# pitches?"
```

#### 3. Ask AI Button

Click **"Ask AI"** or press **Enter** to:
- Parse your natural language query
- Extract relevant filters automatically
- Apply them to your search

### Example Queries

**Song Searches:**
- `"sai songs in sanskrit"`
- `"fast tempo devi bhajans"`
- `"simple level songs with slow tempo"`
- `"krishna songs in hindi language"`

**Pitch Searches:**
- `"C# pitch for all singers"`
- `"devi songs sung in D#"`
- `"which pitches are available for sai songs"`

### Technical Details

**Model Used:**
- Qwen2-0.5B - quantized to 4-bit
- Size: ~100-150MB (ultra-lightweight)
- Optimized for instruction following and parsing
- Runs locally via WebGPU

**Performance:**
- First load: 10-40 seconds (downloading)
- Subsequent loads: 1-3 seconds (from cache)
- Query processing: 0.3-1.5 seconds

**Privacy:**
- ✅ 100% local processing
- ✅ No data sent to servers
- ✅ No API keys required
- ✅ Works offline after initial download

### AI vs Regular Search

| Feature | AI Search | Regular Search |
|---------|-----------|----------------|
| Natural language | ✅ Yes | ❌ Keywords only |
| Query understanding | ✅ Smart | ❌ Literal |
| Setup required | 100-150MB download | Instant |
| Performance | 0.3-1.5s per query | Instant |
| Works offline | ✅ Yes | ✅ Yes |
| Browser support | Limited | All |

### Troubleshooting

**"WebGPU not available":**
1. Update to Chrome/Edge 113+ or Safari 17+
2. Enable hardware acceleration: `chrome://settings/system`
3. Check WebGPU: https://webgpureport.org/

**"Network error loading model":**
- Check internet connection
- Disable VPN/proxy temporarily
- Try again in a few minutes

**"Insufficient memory":**
- Close other browser tabs
- Close other applications
- Restart browser

**Model loads but doesn't respond:**
- Wait 5-10 seconds (first query is slower)
- Try disabling and re-enabling AI search
- Restart browser

---

## Presentation Mode

Display songs and lyrics in a clean, distraction-free presentation view with customizable templates.

### Features

- Full-screen presentation view
- Large, readable text
- Slide-based navigation
- Keyboard shortcuts
- Mobile-friendly
- Live session support
- **Customizable presentation templates**
- Template selector with live preview
- Support for backgrounds, images, videos, and text overlays

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
- **🎨 Template selector** (top-right) for switching templates during presentation

### Accessing Presentation Mode

1. Add songs to the live session
2. Click **"Presentation Mode"** button
3. Navigate through slides
4. Press `Esc` to exit

---

### Presentation Templates

Customize the appearance of presentations with backgrounds, overlays, images, videos, and text elements.

#### Quick Setup

1. Open Admin panel → **Presentation Templates**
2. Click **➕ New Template**
3. Enter template name and description
4. Configure in YAML format
5. Click **💾 Save**
6. Use **⭐ Set Default** to make it default for all presentations

#### Template Configuration

Templates are defined in YAML format:

```yaml
name: Template Name
description: Optional description
background:
  type: color|image|video
  value: "#hexcolor" | "https://url" | "https://video-url"
  opacity: 0-1
images:
  - id: unique-id
    url: https://example.com/image.png
    position: top-left|top-center|top-right|center-left|center|center-right|bottom-left|bottom-center|bottom-right
    width: "100px"
    height: "100px"
    opacity: 0.8
    zIndex: 1
videos:
  - id: unique-id
    url: https://example.com/video.mp4
    position: center
    width: "80%"
    height: "400px"
    opacity: 0.5
    autoPlay: true
    loop: true
    muted: true
text:
  - id: unique-id
    content: "Text to display"
    position: bottom-center
    fontSize: "24px"
    color: "#ffffff"
    fontWeight: bold
    opacity: 0.9
```

#### Position Values

Elements can be positioned using these predefined locations:

```
top-left        top-center        top-right
center-left     center            center-right
bottom-left     bottom-center     bottom-right
```

#### Using Templates in Presentations

1. Start a presentation
2. Click **🎨** button in the top-right corner
3. Select a template from the dropdown
4. Template applies immediately
5. Switch templates at any time during presentation

#### Template Examples

**Simple Dark Background:**
```yaml
name: Dark Background
background:
  type: color
  value: '#1a1a1a'
images: []
videos: []
text: []
```

**With Logo:**
```yaml
name: Branded
background:
  type: color
  value: '#f5f5f5'
images:
  - id: logo
    url: 'https://example.com/logo.png'
    position: top-right
    width: '120px'
    height: '120px'
    opacity: 0.9
videos: []
text: []
```

**Spiritual Theme:**
```yaml
name: Spiritual
background:
  type: color
  value: '#8b4513'
images:
  - id: corner
    url: 'https://example.com/design.png'
    position: bottom-right
    width: '200px'
    height: '200px'
    opacity: 0.3
text:
  - id: om
    content: 'ॐ'
    position: top-center
    fontSize: '48px'
    color: '#ffd700'
    opacity: 0.6
```

**Video Background:**
```yaml
name: Dynamic Background
background:
  type: color
  value: '#000000'
videos:
  - id: bg
    url: 'https://example.com/background.mp4'
    position: center
    width: '100%'
    height: '100%'
    opacity: 0.3
    autoPlay: true
    loop: true
    muted: true
images: []
text: []
```

#### Best Practices

1. **Opacity Control:** Use opacity to prevent overlays from blocking lyrics
   - Background overlays: 0.3-0.5 (subtle)
   - Logo/elements: 0.7-1.0 (visible)

2. **Layering:** Control with z-index
   - Background video: 0
   - Background images: 1-5
   - Text overlays: 10+

3. **Responsive Sizing:** Use flexible units
   - Percentages for flexibility: `width: "100%"`
   - Fixed sizes for logos: `width: "120px"`

#### Opacity Reference

- `1` = fully opaque (solid)
- `0.5` = 50% transparent
- `0.3` = 70% transparent (subtle)
- `0` = invisible

#### Common Issues

**Q: Template doesn't appear in presentations?**
A: Make sure it's set as default or selected in the template dropdown.

**Q: Images/videos not loading?**
A: Check that the URL is accessible and CORS-enabled.

**Q: Overlays blocking lyrics?**
A: Reduce opacity (try 0.3-0.5) or move away from center.

#### API Access

```bash
# Get default template
curl http://localhost:3001/api/templates/default

# List all templates
curl http://localhost:3001/api/templates

# Create template
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Template",
    "description": "My awesome template",
    "background": {"type": "color", "value": "#ffffff"},
    "images": [],
    "videos": [],
    "text": []
  }'
```

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
