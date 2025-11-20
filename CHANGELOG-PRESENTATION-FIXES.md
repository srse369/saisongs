# Presentation & UI Fixes

## Changes Made

### 1. Song List UI - Remove Duplicate Title Display

**File**: `src/components/admin/SongList.tsx`

**Issue**: Song title was showing twice (name and title2 were often the same)

**Fix**: Only show `title2` if it's different from `name`

```typescript
// BEFORE
{song.title2 && (
  <p>{song.title2}</p>
)}

// AFTER
{song.title2 && song.title2 !== song.name && (
  <p>{song.title2}</p>
)}
```

**Result**: Cleaner UI with no duplicate titles

---

### 2. Session Presentation - Fetch Full Songs with Lyrics

**File**: `src/components/session/SessionPresentationMode.tsx`

**Issue**: Session presentation was using cached songs WITHOUT CLOB fields (lyrics), so slides had no lyrics displayed

**Root Cause**: After implementing selective cache warmup, songs in the list view don't have `lyrics`, `meaning`, or `songTags` loaded (they're `null`). The presentation mode was using these incomplete songs from `SongContext`.

**Fix**: Fetch full song details with CLOBs for all songs in the session before generating slides

```typescript
// BEFORE
entries.forEach((entry, songIndex) => {
  const song = songs.find((s) => s.id === entry.songId); // Cached song without CLOBs
  const songSlides = generateSlides(song); // No lyrics!
});

// AFTER
const songPromises = entries.map(entry => 
  ApiClient.get<Song>(`/songs/${entry.songId}`) // Fetch full song with CLOBs
);
const fullSongs = await Promise.all(songPromises);

entries.forEach((entry, songIndex) => {
  const song = fullSongs[songIndex]; // Full song WITH lyrics
  const songSlides = generateSlides(song); // Has lyrics!
});
```

**Benefits**:
- ✅ Presentation slides now show full lyrics
- ✅ Parallel fetching (all songs at once) for faster loading
- ✅ Songs are cached individually after fetch (subsequent presentations are faster)
- ✅ Loading spinner shows while fetching

**Performance**:
- First time: ~300-500ms per song (fetches from DB with CLOBs)
- Subsequent: ~50ms per song (cached individually)
- Parallel fetching: All songs load simultaneously

---

## User Flow

### Song List View (Admin Tab)
1. User sees song list
2. Each song card shows:
   - ✅ Song name (primary title)
   - ✅ Title2 (only if different from name) - avoids duplication
   - ✅ Raga, beat, language, deity, tempo
   - ❌ No lyrics preview (by design, reduces DB load)

### Presentation Mode (Live Tab)
1. User adds songs to Live session
2. User clicks "Present Session"
3. **NEW**: App fetches all songs with full details (lyrics)
4. Loading spinner shows briefly (~1-2s for multiple songs)
5. Presentation starts with full lyrics on slides ✅

---

## Testing Checklist

### Song List UI
- [ ] Open Songs tab
- [ ] Verify no duplicate titles shown
- [ ] Check that title2 appears only when different from name
- [ ] Confirm raga/beat info shows instead of lyrics

### Session Presentation
- [ ] Add 3-5 songs to Live session
- [ ] Click "Present Session"
- [ ] Verify loading spinner appears briefly
- [ ] Confirm slides display with full lyrics
- [ ] Navigate through all slides - lyrics should be present
- [ ] Exit and re-present same session - should load faster (cached)

### Console Logs
Should see:
```
📥 Fetching full song details for presentation...
✅ Fetched 5 songs with lyrics for presentation
```

---

## Performance Impact

### Database Queries

**Before Fix**:
- Presentation used cached songs (no DB queries)
- But slides had no lyrics ❌

**After Fix**:
- Presentation fetches songs with CLOBs (DB queries with DBMS_LOB.SUBSTR)
- Songs are cached individually for 5 minutes
- Subsequent presentations use cached data

### Recursive SQL Impact

Per 5-song session presentation:
- First time: ~225 recursive queries (45 per song × 5 songs)
- From cache: 0 recursive queries

This is **acceptable** because:
1. Presentations are infrequent (not happening every second)
2. Songs are cached after first fetch
3. Parallel fetching minimizes user wait time
4. Alternative (pre-fetching all songs with CLOBs) would add 13,500+ queries to warmup

---

## Architecture Notes

### Cache Strategy Hierarchy

1. **Warmup Cache** (on server start):
   - All songs WITHOUT CLOBs
   - All singers, pitches, sessions
   - Key: `songs:all`, `singers:all`, etc.
   - TTL: 5 minutes

2. **On-Demand Cache** (when viewing details):
   - Individual songs WITH CLOBs
   - Key: `song:{id}`
   - TTL: 5 minutes

3. **Presentation Cache** (when presenting):
   - Uses on-demand cache (fetches individual songs)
   - Benefits from individual song caching
   - Multiple presentations of same song = cache hit

### Why This Works

The selective warmup strategy loads ~300 songs without CLOBs (fast, low DB load), but presentations need lyrics. By fetching individual songs on-demand:
- ✅ Warmup stays lean (~2k recursive SQL)
- ✅ Presentations get full data (lyrics)
- ✅ Individual song cache reused across:
  - Song detail views
  - Single song presentations
  - Session presentations
  - Multiple users viewing same songs

---

## Related Files

- `src/components/admin/SongList.tsx` - UI fix for duplicate titles
- `src/components/session/SessionPresentationMode.tsx` - Fetch full songs for presentation
- `src/components/presentation/PresentationMode.tsx` - Already fetching full songs (unchanged)
- `server/services/CacheService.ts` - Individual song caching with CLOBs
- `docs/SELECTIVE-CACHE-WARMUP.md` - Overall caching strategy

---

## Deployment Notes

No environment variables or database schema changes required. Changes are purely application-level.

Monitor after deployment:
- Oracle recursive SQL should remain low (~2-3k baseline)
- Small spikes (~200-500 queries) when presentations start = expected
- User-reported missing lyrics in presentations should be resolved ✅

