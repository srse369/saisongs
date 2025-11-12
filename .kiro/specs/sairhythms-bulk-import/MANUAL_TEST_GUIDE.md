# Manual Testing Guide - Sairhythms Bulk Import Feature

## Overview

This guide provides step-by-step instructions for manually testing the complete bulk import feature from end to end. The feature allows administrators to import all songs from sairhythms.org into the Song Studio database using a hidden keyboard shortcut and password authentication.

## Prerequisites

Before starting the tests, ensure:

1. **Environment Setup**
   - `.env.local` file exists with `VITE_ADMIN_PASSWORD` configured
   - Database connection string is configured in `.env.local`
   - Development server is running (`npm run dev`)

2. **Database Access**
   - You have access to query the database directly (for verification)
   - Note the current song count before testing

3. **Test Password**
   - Know the admin password set in `.env.local`
   - Have an incorrect password ready for negative testing

## Test Scenarios

### Scenario 1: Complete Happy Path Flow

**Objective:** Test the complete flow from keyboard shortcut to successful import completion.

**Steps:**

1. **Trigger Keyboard Shortcut**
   - Open the application in your browser
   - Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)
   - **Expected:** Password dialog appears with:
     - Title: "Admin Authentication"
     - Password input field
     - Submit and Cancel buttons
     - Dialog is centered and has backdrop blur

2. **Enter Correct Password**
   - Type the correct admin password from `.env.local`
   - Click "Submit" or press Enter
   - **Expected:**
     - Password dialog closes
     - Bulk Import UI modal opens immediately
     - Modal shows "Start Import" button
     - Modal title: "Bulk Import from Sairhythms"

3. **Start Import Process**
   - Click "Start Import" button
   - **Expected:**
     - Button disappears
     - Progress bar appears (initially at 0%)
     - Statistics grid shows: Processed, Created, Updated, Failed (all at 0)
     - "Processing: [song name]" indicator appears
     - Message: "Import in progress... Please do not close this window."

4. **Monitor Progress**
   - Watch the import progress in real-time
   - **Expected:**
     - Progress bar advances smoothly
     - Processed count increases
     - Created/Updated counts increase
     - Current song name updates frequently
     - Statistics update after each song

5. **Verify Completion**
   - Wait for import to complete
   - **Expected:**
     - Progress bar reaches 100%
     - Green success banner appears: "Import Completed"
     - Final statistics displayed
     - Summary message shows counts
     - "Close" button appears
     - "Import in progress" message disappears

6. **Check Error List (if any)**
   - If errors occurred, click "Errors (X)" to expand
   - **Expected:**
     - Collapsible error list shows failed songs
     - Each error shows song name and error message
     - Can toggle error list open/closed

7. **Close Import UI**
   - Click "Close" button
   - **Expected:**
     - Import UI modal closes
     - Returns to normal application view

8. **Verify Database State**
   - Query the database: `SELECT COUNT(*) FROM songs;`
   - Query specific songs: `SELECT * FROM songs ORDER BY created_at DESC LIMIT 10;`
   - **Expected:**
     - Song count matches import statistics
     - New songs have `sairhythms_url` populated
     - `created_at` and `updated_at` timestamps are recent

9. **Verify UI Refresh**
   - Navigate to `/admin/songs`
   - **Expected:**
     - Song list shows newly imported songs
     - Songs are searchable and accessible

---

### Scenario 2: Password Authentication - Incorrect Password

**Objective:** Test password validation and error handling.

**Steps:**

1. **Trigger Keyboard Shortcut**
   - Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac)
   - **Expected:** Password dialog opens

2. **Enter Incorrect Password**
   - Type an incorrect password
   - Click "Submit"
   - **Expected:**
     - Error message appears: "Incorrect password. Please try again."
     - Password field remains visible
     - Dialog stays open
     - Password field is cleared (or remains for retry)

3. **Retry with Correct Password**
   - Enter the correct password
   - Click "Submit"
   - **Expected:**
     - Error message clears
     - Dialog closes
     - Import UI opens

---

### Scenario 3: Rate Limiting

**Objective:** Test rate limiting after multiple failed password attempts.

**Steps:**

1. **Trigger Keyboard Shortcut**
   - Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac)
   - **Expected:** Password dialog opens

2. **Enter Incorrect Password 5 Times**
   - Enter wrong password and submit
   - Repeat 5 times
   - **Expected:**
     - First 4 attempts: Error message "Incorrect password. Please try again."
     - 5th attempt: Error message changes to "Too many failed attempts. Please wait X minute(s) before trying again."
     - Password input field becomes disabled
     - Submit button becomes disabled

3. **Verify Lockout**
   - Try to enter password (should be disabled)
   - Close dialog and reopen with keyboard shortcut
   - **Expected:**
     - Lockout persists across dialog open/close
     - Error message still shows remaining time

4. **Wait for Lockout to Expire**
   - Wait 5 minutes (or adjust for testing)
   - Close and reopen dialog
   - **Expected:**
     - Password field is enabled again
     - Can attempt password entry

---

### Scenario 4: Cancel and Escape Key

**Objective:** Test dialog cancellation and keyboard navigation.

**Steps:**

1. **Trigger Keyboard Shortcut**
   - Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac)
   - **Expected:** Password dialog opens

2. **Test Cancel Button**
   - Click "Cancel" button
   - **Expected:**
     - Dialog closes
     - Password field is cleared
     - No error messages persist

3. **Test Escape Key**
   - Reopen dialog with keyboard shortcut
   - Press `Escape` key
   - **Expected:**
     - Dialog closes
     - Same behavior as Cancel button

4. **Test Backdrop Click**
   - Reopen dialog
   - Click outside the dialog (on the backdrop)
   - **Expected:**
     - Dialog closes
     - Password is cleared

---

### Scenario 5: Import with Existing Songs (Update Scenario)

**Objective:** Test that existing songs are updated without creating duplicates.

**Steps:**

1. **Prepare Test Data**
   - Manually add 2-3 songs to the database with sairhythms URLs
   - Note their IDs and names
   - Example: `INSERT INTO songs (name, sairhythms_url) VALUES ('Test Song', 'https://sairhythms.org/song/test-song');`

2. **Run Import**
   - Trigger keyboard shortcut
   - Enter password
   - Start import
   - **Expected:**
     - Import completes successfully
     - "Updated" count includes the pre-existing songs

3. **Verify Database State**
   - Query the pre-existing songs by ID
   - **Expected:**
     - Song IDs remain unchanged
     - `created_at` timestamp remains unchanged
     - `updated_at` timestamp is updated to recent time
     - Song name and URL may be updated if different on sairhythms.org
     - No duplicate songs created

4. **Check for Duplicates**
   - Query: `SELECT name, COUNT(*) FROM songs GROUP BY name HAVING COUNT(*) > 1;`
   - **Expected:**
     - No duplicate song names (or minimal expected duplicates)

---

### Scenario 6: Import with All New Songs

**Objective:** Test import when database is empty or has no matching songs.

**Steps:**

1. **Prepare Clean Database**
   - Clear all songs: `DELETE FROM songs;`
   - Verify: `SELECT COUNT(*) FROM songs;` returns 0

2. **Run Import**
   - Trigger keyboard shortcut
   - Enter password
   - Start import
   - **Expected:**
     - Import completes successfully
     - "Created" count equals total discovered songs
     - "Updated" count is 0

3. **Verify Database State**
   - Query: `SELECT COUNT(*) FROM songs;`
   - **Expected:**
     - Song count matches "Created" count from import
     - All songs have recent `created_at` timestamps
     - All songs have `sairhythms_url` populated

---

### Scenario 7: Import with Mixed Scenario

**Objective:** Test import with a mix of new and existing songs.

**Steps:**

1. **Prepare Mixed Data**
   - Keep some existing songs in database
   - Ensure some songs on sairhythms.org are not in database
   - Note counts: existing songs, expected new songs

2. **Run Import**
   - Trigger keyboard shortcut
   - Enter password
   - Start import
   - **Expected:**
     - Import completes successfully
     - "Created" count shows new songs added
     - "Updated" count shows existing songs updated
     - Total processed = Created + Updated + Failed

3. **Verify Database State**
   - Check existing song IDs are preserved
   - Check new songs have new IDs
   - Verify no duplicates created

---

### Scenario 8: Network Error Handling

**Objective:** Test error handling when sairhythms.org is unreachable.

**Steps:**

1. **Simulate Network Error**
   - Disconnect from internet, or
   - Use browser DevTools to block network requests to sairhythms.org

2. **Run Import**
   - Trigger keyboard shortcut
   - Enter password
   - Start import
   - **Expected:**
     - Import attempts to fetch sairhythms.org
     - After 3 retry attempts, critical error appears
     - Red error banner shows: "Critical Error"
     - Error message indicates network failure
     - "Close" button appears

3. **Verify Graceful Failure**
   - No partial data imported
   - Database remains in consistent state
   - Can close error dialog and retry later

---

### Scenario 9: Import During Active Import (Prevention)

**Objective:** Verify that import cannot be triggered while already running.

**Steps:**

1. **Start Import**
   - Trigger keyboard shortcut
   - Enter password
   - Start import
   - **Expected:** Import begins

2. **Attempt to Close During Import**
   - Try clicking outside the modal
   - Try pressing Escape
   - Try clicking Close button (should not exist)
   - **Expected:**
     - Modal cannot be closed
     - Message shows: "Import in progress... Please do not close this window."
     - Import continues uninterrupted

3. **Wait for Completion**
   - Let import complete
   - **Expected:**
     - Close button appears only after completion
     - Can now close the modal

---

### Scenario 10: Focus Management and Accessibility

**Objective:** Test keyboard navigation and accessibility features.

**Steps:**

1. **Test Password Dialog Focus**
   - Trigger keyboard shortcut
   - **Expected:**
     - Password input field receives focus automatically
     - Can type immediately without clicking

2. **Test Tab Navigation**
   - Press Tab key
   - **Expected:**
     - Focus moves to Cancel button
     - Press Tab again: Focus moves to Submit button
     - Press Tab again: Focus cycles back to password field

3. **Test Enter Key Submission**
   - Type password
   - Press Enter key (without clicking Submit)
   - **Expected:**
     - Form submits
     - Same behavior as clicking Submit button

4. **Test Screen Reader Labels**
   - Use screen reader (if available)
   - **Expected:**
     - All buttons have proper labels
     - Input field has label "Enter Admin Password"
     - Close button has aria-label "Close dialog"

---

## Verification Checklist

After completing all test scenarios, verify:

- [ ] Keyboard shortcut works on both Windows/Linux (Ctrl+Shift+I) and Mac (Cmd+Shift+I)
- [ ] Password validation works correctly
- [ ] Rate limiting activates after 5 failed attempts
- [ ] Import discovers songs from sairhythms.org
- [ ] Progress updates in real-time during import
- [ ] Existing songs are updated (IDs preserved)
- [ ] New songs are created with new IDs
- [ ] No duplicate songs are created
- [ ] Error handling works for network failures
- [ ] Error list displays failed songs (if any)
- [ ] Song list refreshes after successful import
- [ ] Database state is consistent after import
- [ ] Modal cannot be closed during active import
- [ ] Focus management works correctly
- [ ] Escape key and Cancel button work
- [ ] All UI elements are responsive and styled correctly

---

## Database Verification Queries

Use these SQL queries to verify database state:

```sql
-- Check total song count
SELECT COUNT(*) FROM songs;

-- View recent songs
SELECT id, name, sairhythms_url, created_at, updated_at 
FROM songs 
ORDER BY updated_at DESC 
LIMIT 20;

-- Check for duplicates by URL
SELECT sairhythms_url, COUNT(*) as count
FROM songs 
GROUP BY sairhythms_url 
HAVING COUNT(*) > 1;

-- Check for duplicates by name
SELECT name, COUNT(*) as count
FROM songs 
GROUP BY name 
HAVING COUNT(*) > 1;

-- View songs created vs updated
SELECT 
  COUNT(*) FILTER (WHERE created_at = updated_at) as new_songs,
  COUNT(*) FILTER (WHERE created_at < updated_at) as updated_songs
FROM songs;

-- Check songs without sairhythms_url (should be 0)
SELECT COUNT(*) FROM songs WHERE sairhythms_url IS NULL OR sairhythms_url = '';
```

---

## Known Issues and Limitations

Document any issues found during testing:

1. **CORS Issues**: If testing locally, sairhythms.org may block requests due to CORS policy. This is expected and would require a backend proxy in production.

2. **Rate Limiting Reset**: Rate limiting resets on page reload. This is by design for development but may need persistence in production.

3. **Large Imports**: Very large imports (1000+ songs) may take several minutes. Progress bar should continue updating.

---

## Test Results Template

Use this template to document test results:

```
Test Date: [Date]
Tester: [Name]
Environment: [Development/Staging/Production]
Browser: [Chrome/Firefox/Safari/Edge]
OS: [Windows/Mac/Linux]

Scenario 1: Complete Happy Path Flow
Status: [PASS/FAIL]
Notes: [Any observations]

Scenario 2: Password Authentication
Status: [PASS/FAIL]
Notes: [Any observations]

[Continue for all scenarios...]

Overall Result: [PASS/FAIL]
Critical Issues: [List any blocking issues]
Minor Issues: [List any non-blocking issues]
```

---

## Troubleshooting

### Password Dialog Not Opening
- Check browser console for errors
- Verify keyboard shortcut is not conflicting with browser shortcuts
- Try refreshing the page

### Import Fails Immediately
- Check `.env.local` has correct database connection
- Verify sairhythms.org is accessible
- Check browser console for network errors

### Songs Not Appearing After Import
- Verify import completed successfully (check statistics)
- Refresh the song list page
- Check database directly with SQL queries

### Rate Limiting Not Working
- Rate limiting state is stored in component memory
- Refreshing the page will reset the rate limiter
- This is expected behavior for development

---

## Next Steps

After completing manual testing:

1. Document all test results
2. Report any bugs or issues found
3. Verify all requirements are met
4. Get stakeholder approval for production deployment
5. Plan for production deployment and monitoring
