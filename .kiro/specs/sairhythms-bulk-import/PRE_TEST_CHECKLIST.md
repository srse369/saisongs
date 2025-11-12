# Pre-Test Checklist

Complete this checklist before starting manual end-to-end testing of the Sairhythms Bulk Import feature.

## Environment Setup

- [ ] **Environment Variables Configured**
  - [ ] `.env.local` file exists in project root
  - [ ] `VITE_ADMIN_PASSWORD` is set to a known test password
  - [ ] `VITE_NEON_CONNECTION_STRING` is configured with valid database connection
  - [ ] Test password is documented for testing (e.g., "test123")

- [ ] **Database Connection Verified**
  - [ ] Can connect to the database
  - [ ] Database has the `songs` table with correct schema
  - [ ] Have access to query the database directly (for verification)
  - [ ] Backup of current database state created (optional but recommended)

- [ ] **Development Server Running**
  - [ ] Run `npm install` to ensure all dependencies are installed
  - [ ] Run `npm run dev` to start the development server
  - [ ] Application loads successfully in browser
  - [ ] No console errors on initial load

## Test Data Preparation

- [ ] **Baseline Database State**
  - [ ] Document current song count: `SELECT COUNT(*) FROM songs;`
  - [ ] Note any existing songs with sairhythms URLs
  - [ ] Create a list of 2-3 test songs to manually add (for update scenario testing)

- [ ] **Test Scenarios Prepared**
  - [ ] Plan for "all new songs" scenario (empty database or clear songs table)
  - [ ] Plan for "all existing songs" scenario (pre-populate with songs from sairhythms)
  - [ ] Plan for "mixed scenario" (some existing, some new)

## Browser and Tools

- [ ] **Browser Setup**
  - [ ] Using a modern browser (Chrome, Firefox, Safari, or Edge)
  - [ ] Browser DevTools accessible (F12)
  - [ ] Network tab available for monitoring requests
  - [ ] Console tab available for error monitoring

- [ ] **Database Query Tool**
  - [ ] Have a way to run SQL queries against the database
  - [ ] Can view query results
  - [ ] Can execute SELECT, INSERT, UPDATE, DELETE statements

## Test Documentation

- [ ] **Test Results Template Ready**
  - [ ] Copy the test results template from MANUAL_TEST_GUIDE.md
  - [ ] Prepare a document to record test results
  - [ ] Note test environment details (browser, OS, date)

- [ ] **Screen Recording (Optional)**
  - [ ] Screen recording software ready (if documenting visually)
  - [ ] Screenshots tool ready for capturing test results

## Verification Tools

- [ ] **SQL Queries Prepared**
  - [ ] Query to count total songs
  - [ ] Query to view recent songs
  - [ ] Query to check for duplicates by URL
  - [ ] Query to check for duplicates by name
  - [ ] Query to verify ID preservation

## Known Limitations

- [ ] **Understand Expected Behaviors**
  - [ ] CORS may block direct requests to sairhythms.org (expected in development)
  - [ ] Rate limiting resets on page reload (by design)
  - [ ] Import may take several minutes for large catalogs
  - [ ] Keyboard shortcut may conflict with browser DevTools (Ctrl+Shift+I)

## Ready to Test

Once all items above are checked, you are ready to begin manual testing following the scenarios in `MANUAL_TEST_GUIDE.md`.

**Start with Scenario 1: Complete Happy Path Flow**

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# In a separate terminal, connect to database (example using psql)
psql $VITE_NEON_CONNECTION_STRING

# Count songs in database
SELECT COUNT(*) FROM songs;

# View recent songs
SELECT id, name, sairhythms_url, created_at, updated_at 
FROM songs 
ORDER BY updated_at DESC 
LIMIT 10;
```

---

## Test Password Setup

For testing purposes, set a simple password in `.env.local`:

```bash
VITE_ADMIN_PASSWORD=test123
```

**Remember:** Use a strong password in production!

---

## Troubleshooting Before Testing

### Development Server Won't Start
- Check for port conflicts (default: 5173)
- Verify `package.json` and dependencies are correct
- Try `npm clean-install` to reinstall dependencies

### Database Connection Fails
- Verify connection string format
- Check network connectivity
- Ensure database exists and is accessible
- Verify SSL mode is correct (`sslmode=require` for Neon)

### Environment Variables Not Loading
- Ensure `.env.local` is in project root (not in subdirectory)
- Restart development server after changing `.env.local`
- Check for typos in variable names (must start with `VITE_`)

---

## Ready to Begin?

If all checklist items are complete, proceed to `MANUAL_TEST_GUIDE.md` and start with **Scenario 1: Complete Happy Path Flow**.
