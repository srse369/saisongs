# Quick Test Reference Guide

## 🚀 Quick Start

1. **Open Application:** http://localhost:5174/
2. **Trigger Import:** Press `Cmd+Shift+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
3. **Enter Password:** Use the password from `.env.local` (VITE_ADMIN_PASSWORD)
4. **Start Import:** Click "Start Import" button
5. **Monitor Progress:** Watch real-time statistics and progress bar
6. **Verify Results:** Check completion summary and database

---

## 🔑 Key Information

### Keyboard Shortcut
- **Mac:** `Cmd + Shift + I`
- **Windows/Linux:** `Ctrl + Shift + I`

### Test Password
Check `.env.local` file for `VITE_ADMIN_PASSWORD` value

### Application URL
http://localhost:5174/

### Database Connection
Check `.env.local` file for `VITE_NEON_CONNECTION_STRING`

---

## 📋 Essential SQL Queries

### Count Total Songs
```sql
SELECT COUNT(*) FROM songs;
```

### View Recent Songs
```sql
SELECT id, name, sairhythms_url, created_at, updated_at 
FROM songs 
ORDER BY updated_at DESC 
LIMIT 10;
```

### Check for Duplicates by URL
```sql
SELECT sairhythms_url, COUNT(*) as count
FROM songs 
GROUP BY sairhythms_url 
HAVING COUNT(*) > 1;
```

### Check for Duplicates by Name
```sql
SELECT name, COUNT(*) as count
FROM songs 
GROUP BY name 
HAVING COUNT(*) > 1;
```

### Clear All Songs (for testing)
```sql
DELETE FROM songs;
```

### Add Test Song
```sql
INSERT INTO songs (name, sairhythms_url) 
VALUES ('Test Song', 'https://sairhythms.org/song/test-song');
```

---

## ✅ Quick Test Checklist

### Basic Flow Test (5 minutes)
- [ ] Press keyboard shortcut
- [ ] Enter correct password
- [ ] Click "Start Import"
- [ ] Wait for completion
- [ ] Verify success message
- [ ] Check database count increased

### Password Test (3 minutes)
- [ ] Press keyboard shortcut
- [ ] Enter wrong password 3 times
- [ ] Verify error messages
- [ ] Enter correct password
- [ ] Verify success

### Rate Limiting Test (2 minutes)
- [ ] Press keyboard shortcut
- [ ] Enter wrong password 5 times
- [ ] Verify lockout message
- [ ] Verify input disabled

### UI/UX Test (3 minutes)
- [ ] Test Cancel button
- [ ] Test Escape key
- [ ] Test backdrop click
- [ ] Verify focus on password field
- [ ] Test Tab navigation

---

## 🐛 Common Issues and Solutions

### Issue: Keyboard shortcut not working
**Solution:** 
- Check if browser DevTools is open (conflicts with Ctrl+Shift+I)
- Try closing DevTools first
- Refresh the page and try again

### Issue: Password dialog doesn't open
**Solution:**
- Check browser console for errors (F12)
- Verify `useAdminShortcut` hook is working
- Try refreshing the page

### Issue: Import fails immediately
**Solution:**
- Check `.env.local` has correct database connection
- Verify sairhythms.org is accessible
- Check browser console for network errors
- Check for CORS issues (expected in development)

### Issue: Songs not appearing after import
**Solution:**
- Verify import completed successfully
- Refresh the song list page
- Check database directly with SQL
- Verify song context refresh was triggered

### Issue: Rate limiting not resetting
**Solution:**
- Rate limiting resets on page reload (by design)
- Wait 5 minutes for automatic reset
- Or refresh the page to reset immediately

---

## 📊 Expected Results

### Successful Import
- ✅ Progress bar reaches 100%
- ✅ Green success banner appears
- ✅ Statistics show: Processed, Created, Updated counts
- ✅ Database song count increases
- ✅ Song list refreshes automatically

### Failed Import
- ❌ Red error banner appears
- ❌ Error message describes the issue
- ❌ Can close dialog and retry
- ❌ Database remains consistent (no partial data)

### Rate Limiting
- 🔒 After 5 failed attempts
- 🔒 Password field disabled
- 🔒 Submit button disabled
- 🔒 Error shows remaining time
- 🔒 Persists across dialog close/reopen

---

## 🎯 Focus Areas for Testing

### Critical Functionality
1. **Password Authentication** - Must work correctly
2. **Import Process** - Must complete without errors
3. **ID Preservation** - Existing songs must keep their IDs
4. **No Duplicates** - Must not create duplicate songs

### User Experience
1. **Progress Feedback** - Real-time updates
2. **Error Messages** - Clear and helpful
3. **Keyboard Navigation** - Accessible and intuitive
4. **Visual Design** - Professional and polished

### Error Handling
1. **Network Errors** - Graceful retry and failure
2. **Database Errors** - Continue processing other songs
3. **Parse Errors** - Log and continue
4. **Critical Errors** - Stop and inform user

---

## 📝 Quick Notes Template

Use this template to quickly document findings:

```
Test: [Scenario name]
Time: [HH:MM]
Result: PASS / FAIL
Notes: [Brief description]
Issue: [If failed, describe issue]
```

Example:
```
Test: Password Authentication
Time: 14:30
Result: PASS
Notes: Correct password worked on first try
Issue: N/A
```

---

## 🔄 Test Scenarios Priority

### Priority 1 (Must Test)
1. ✅ Complete Happy Path Flow
2. ✅ Password Authentication
3. ✅ Import with Existing Songs (ID Preservation)

### Priority 2 (Should Test)
4. ✅ Rate Limiting
5. ✅ Import with All New Songs
6. ✅ Import with Mixed Scenario

### Priority 3 (Nice to Test)
7. ✅ Cancel and Escape Key
8. ✅ Network Error Handling
9. ✅ Import Prevention During Active Import
10. ✅ Focus Management and Accessibility

---

## 🎬 Testing Tips

1. **Start Simple:** Begin with the happy path before testing edge cases
2. **Document Everything:** Take notes as you test, not after
3. **Use Browser DevTools:** Monitor console and network tabs
4. **Take Screenshots:** Capture success and error states
5. **Test Incrementally:** Complete one scenario before moving to the next
6. **Verify Database:** Always check database state after import
7. **Reset Between Tests:** Clear state between test scenarios
8. **Be Patient:** Large imports may take several minutes

---

## 📞 Need Help?

If you encounter issues during testing:

1. Check browser console for errors (F12)
2. Review the MANUAL_TEST_GUIDE.md for detailed steps
3. Check the Troubleshooting section in MANUAL_TEST_GUIDE.md
4. Verify environment setup with PRE_TEST_CHECKLIST.md
5. Document the issue in TEST_EXECUTION_SUMMARY.md

---

## ✨ Success Criteria

The feature is ready for production when:

- ✅ All Priority 1 scenarios pass
- ✅ At least 80% of all scenarios pass
- ✅ No critical issues found
- ✅ Database integrity maintained
- ✅ User experience is smooth and intuitive
- ✅ Error handling is robust
- ✅ Documentation is complete and accurate

---

**Good luck with testing! 🚀**
