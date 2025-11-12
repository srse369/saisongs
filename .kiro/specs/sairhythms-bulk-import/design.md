# Design Document

## Overview

The Sairhythms Bulk Import feature provides a password-protected administrative interface for importing all songs from sairhythms.org into the Song Studio database. The feature is designed to be hidden from regular users and accessible only through a specific keyboard shortcut. The import process discovers all available songs on sairhythms.org, extracts their names and URLs, and intelligently merges them with existing database records while preserving song IDs.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Admin UI      │
│  (Hidden)       │
└────────┬────────┘
         │ Keyboard Shortcut (Ctrl+Shift+I)
         ▼
┌─────────────────┐
│ Password Dialog │
└────────┬────────┘
         │ Password Validation
         ▼
┌─────────────────┐
│   Import UI     │
│  (Progress)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Import Service  │─────▶│ Sairhythms       │
│                 │      │ Scraper Service  │
└────────┬────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Song Service   │
│  (Database)     │
└─────────────────┘
```

### Component Interaction Flow

1. User presses keyboard shortcut (Ctrl+Shift+I or Cmd+Shift+I on Mac)
2. Password dialog appears
3. User enters password, validated against environment variable
4. On success, Import UI displays with "Start Import" button
5. Import Service fetches and parses sairhythms.org
6. For each discovered song:
   - Check if song exists by name or URL
   - Update existing record or create new record
   - Report progress to UI
7. Display final summary with statistics

## Components and Interfaces

### 1. Environment Configuration

**File:** `.env.local`

```
VITE_ADMIN_PASSWORD=your_secure_password_here
```

The password is stored in environment variables and accessed via `import.meta.env.VITE_ADMIN_PASSWORD`.

### 2. Keyboard Shortcut Handler

**Location:** `src/App.tsx` or dedicated hook `src/hooks/useAdminShortcut.ts`

**Responsibility:** Listen for keyboard shortcut and trigger password dialog

**Interface:**
```typescript
interface AdminShortcutHook {
  isPasswordDialogOpen: boolean;
  openPasswordDialog: () => void;
  closePasswordDialog: () => void;
}
```

**Implementation Details:**
- Listen for `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)
- Prevent default browser behavior
- Only trigger in admin routes or globally if appropriate

### 3. Password Dialog Component

**File:** `src/components/admin/PasswordDialog.tsx`

**Responsibility:** Authenticate administrator before allowing import access

**Props:**
```typescript
interface PasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

**State:**
```typescript
interface PasswordDialogState {
  password: string;
  error: string | null;
  attempts: number;
  isLocked: boolean;
}
```

**Features:**
- Input field for password entry
- Error message display
- Rate limiting: Lock after 5 failed attempts for 5 minutes
- Clear password field on close
- Focus management for accessibility

### 4. Import UI Component

**File:** `src/components/admin/BulkImportUI.tsx`

**Responsibility:** Display import progress and results

**Props:**
```typescript
interface BulkImportUIProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**State:**
```typescript
interface ImportState {
  status: 'idle' | 'discovering' | 'importing' | 'completed' | 'error';
  progress: {
    total: number;
    processed: number;
    created: number;
    updated: number;
    failed: number;
  };
  errors: Array<{
    songName: string;
    error: string;
  }>;
  currentSong: string | null;
}
```

**UI Elements:**
- Start Import button (when idle)
- Progress bar showing percentage
- Real-time statistics (processed, created, updated, failed)
- Current song being processed
- Error list (collapsible)
- Close button (disabled during import)

### 5. Sairhythms Scraper Service

**File:** `src/services/SairhythmsScraperService.ts`

**Responsibility:** Discover and extract all songs from sairhythms.org

**Interface:**
```typescript
interface DiscoveredSong {
  name: string;
  url: string;
}

interface SairhythmsScraperService {
  discoverAllSongs(): Promise<DiscoveredSong[]>;
}
```

**Implementation Strategy:**

Since the actual structure of sairhythms.org is unknown, the implementation will need to:

1. **Fetch the main page or song index page**
   - Use `fetch()` API to retrieve HTML
   - Handle CORS issues (may need a proxy)

2. **Parse HTML to find song links**
   - Use DOMParser to parse HTML
   - Look for common patterns:
     - Links containing `/song/` or `/songs/`
     - List items with song titles
     - Navigation menus or indexes
   - Extract song names from link text or title attributes

3. **Validate and normalize URLs**
   - Ensure all URLs are absolute
   - Filter out non-song pages
   - Remove duplicates

**Error Handling:**
- Network errors: Retry up to 3 times with exponential backoff
- Parse errors: Log and return partial results
- CORS errors: Provide clear error message suggesting proxy setup

**Alternative Approach:**
If direct scraping is not feasible due to CORS or dynamic content:
- Implement a simple backend proxy endpoint
- Use a headless browser approach (Puppeteer/Playwright) if needed
- Check if sairhythms.org provides an API or sitemap.xml

### 6. Import Service

**File:** `src/services/ImportService.ts`

**Responsibility:** Orchestrate the import process and manage database operations

**Interface:**
```typescript
interface ImportProgress {
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  currentSong: string | null;
}

interface ImportResult {
  success: boolean;
  stats: ImportProgress;
  errors: Array<{
    songName: string;
    error: string;
  }>;
}

interface ImportService {
  importAllSongs(
    onProgress: (progress: ImportProgress) => void
  ): Promise<ImportResult>;
}
```

**Implementation Logic:**

```typescript
async importAllSongs(onProgress) {
  // 1. Discover all songs
  const discoveredSongs = await scraperService.discoverAllSongs();
  
  // 2. Fetch existing songs from database
  const existingSongs = await songService.getAllSongs();
  
  // 3. Create lookup maps for efficient matching
  const songsByName = new Map(existingSongs.map(s => [s.name.toLowerCase(), s]));
  const songsByUrl = new Map(existingSongs.map(s => [s.sairhythmsUrl, s]));
  
  // 4. Process each discovered song
  for (const discovered of discoveredSongs) {
    try {
      // Check if song exists by URL (most reliable)
      let existing = songsByUrl.get(discovered.url);
      
      // If not found by URL, check by name
      if (!existing) {
        existing = songsByName.get(discovered.name.toLowerCase());
      }
      
      if (existing) {
        // Update existing song (preserves ID)
        await songService.updateSong(existing.id, {
          name: discovered.name,
          sairhythmsUrl: discovered.url
        });
        stats.updated++;
      } else {
        // Create new song
        await songService.createSong({
          name: discovered.name,
          sairhythmsUrl: discovered.url
        });
        stats.created++;
      }
      
      stats.processed++;
      onProgress({ ...stats, currentSong: discovered.name });
      
    } catch (error) {
      stats.failed++;
      errors.push({
        songName: discovered.name,
        error: error.message
      });
    }
  }
  
  return { success: true, stats, errors };
}
```

**Key Design Decisions:**

1. **Matching Strategy:**
   - Primary: Match by URL (most reliable)
   - Fallback: Match by name (case-insensitive)
   - This ensures we don't create duplicates

2. **ID Preservation:**
   - Use `updateSong()` for existing records
   - Database automatically preserves `id` and `created_at`
   - Only `updated_at` is modified

3. **Error Isolation:**
   - Wrap each song operation in try-catch
   - Continue processing on individual failures
   - Collect all errors for final report

4. **Progress Reporting:**
   - Call `onProgress` callback after each song
   - Allows UI to update in real-time
   - Includes current song name for user feedback

## Data Models

### Existing Models (No Changes Required)

The existing `Song` interface and database schema are sufficient:

```typescript
interface Song {
  id: string;              // UUID, preserved during updates
  name: string;            // Updated from sairhythms.org
  sairhythmsUrl: string;   // Updated from sairhythms.org
  createdAt: Date;         // Preserved for existing songs
  updatedAt: Date;         // Updated automatically
}
```

### New Types

```typescript
// Discovered song from sairhythms.org
interface DiscoveredSong {
  name: string;
  url: string;
}

// Import progress tracking
interface ImportProgress {
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  currentSong: string | null;
}

// Import error tracking
interface ImportError {
  songName: string;
  error: string;
}

// Final import result
interface ImportResult {
  success: boolean;
  stats: ImportProgress;
  errors: ImportError[];
}
```

## Error Handling

### Error Categories

1. **Authentication Errors**
   - Invalid password
   - Too many attempts (rate limiting)
   - Missing environment variable

2. **Network Errors**
   - Failed to fetch sairhythms.org
   - CORS issues
   - Timeout errors

3. **Parse Errors**
   - Invalid HTML structure
   - Missing expected elements
   - Malformed URLs

4. **Database Errors**
   - Connection failures
   - Constraint violations
   - Transaction errors

### Error Handling Strategy

**Password Dialog:**
```typescript
try {
  validatePassword(enteredPassword);
  onSuccess();
} catch (error) {
  if (error instanceof RateLimitError) {
    setError('Too many attempts. Please wait 5 minutes.');
    setIsLocked(true);
  } else {
    setError('Incorrect password');
    setAttempts(prev => prev + 1);
  }
}
```

**Scraper Service:**
```typescript
async discoverAllSongs() {
  let retries = 0;
  while (retries < 3) {
    try {
      const response = await fetch(SAIRHYTHMS_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await this.parseSongs(await response.text());
    } catch (error) {
      retries++;
      if (retries === 3) throw error;
      await this.delay(1000 * Math.pow(2, retries)); // Exponential backoff
    }
  }
}
```

**Import Service:**
```typescript
// Individual song errors don't stop the import
for (const song of discoveredSongs) {
  try {
    await this.processSong(song);
  } catch (error) {
    errors.push({
      songName: song.name,
      error: error.message
    });
    // Continue with next song
  }
}
```

## Testing Strategy

### Unit Tests

1. **Password Validation**
   - Test correct password acceptance
   - Test incorrect password rejection
   - Test rate limiting after 5 attempts
   - Test environment variable handling

2. **Scraper Service**
   - Test HTML parsing with mock data
   - Test URL validation and normalization
   - Test duplicate removal
   - Test error handling for malformed HTML

3. **Import Service**
   - Test song matching by URL
   - Test song matching by name
   - Test ID preservation during updates
   - Test new song creation
   - Test error collection and reporting

### Integration Tests

1. **End-to-End Import Flow**
   - Mock sairhythms.org response
   - Verify database state before and after
   - Verify existing songs are updated, not duplicated
   - Verify new songs are created with new IDs

2. **Error Scenarios**
   - Network failure during discovery
   - Database error during import
   - Partial import completion

### Manual Testing

1. **UI/UX Testing**
   - Keyboard shortcut activation
   - Password dialog interaction
   - Progress display accuracy
   - Error message clarity

2. **Performance Testing**
   - Import time for large song catalogs
   - UI responsiveness during import
   - Memory usage during import

## Security Considerations

1. **Password Storage**
   - Store in `.env.local` (not committed to git)
   - Access via `import.meta.env.VITE_ADMIN_PASSWORD`
   - Never log or expose in error messages

2. **Rate Limiting**
   - Lock password dialog after 5 failed attempts
   - 5-minute lockout period
   - Store attempt count in component state (resets on page reload)

3. **Hidden Access**
   - No visible UI elements for import feature
   - Only accessible via keyboard shortcut
   - Document shortcut in admin documentation only

4. **Input Validation**
   - Validate all URLs from sairhythms.org
   - Sanitize song names before database insertion
   - Use parameterized queries (already implemented in SongService)

5. **CORS and Proxy**
   - If scraping directly from browser, may hit CORS restrictions
   - Consider implementing a backend proxy for production
   - Proxy should validate requests and rate-limit

## Performance Considerations

1. **Batch Processing**
   - Process songs sequentially to avoid overwhelming database
   - Consider batch inserts/updates if performance is an issue
   - Add configurable delay between operations if needed

2. **Progress Updates**
   - Throttle progress callbacks to avoid excessive re-renders
   - Update UI every N songs or every X milliseconds

3. **Memory Management**
   - Don't load all song data into memory at once
   - Stream processing if song count is very large
   - Clear references after processing

4. **Caching**
   - Cache existing songs lookup map
   - Don't re-fetch from database during import
   - Invalidate song list cache after import completes

## Future Enhancements

1. **Incremental Import**
   - Track last import timestamp
   - Only import new/updated songs
   - Detect deleted songs

2. **Dry Run Mode**
   - Preview what would be imported
   - Show conflicts before committing
   - Allow manual conflict resolution

3. **Import History**
   - Log each import operation
   - Track changes over time
   - Rollback capability

4. **Scheduled Imports**
   - Automatic periodic imports
   - Background sync
   - Notification on completion

5. **Advanced Matching**
   - Fuzzy name matching
   - Handle song name variations
   - Manual merge tool for conflicts
