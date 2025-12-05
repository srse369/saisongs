# Multi-Tenancy & Email OTP Authentication Migration Guide

This guide covers the migration from password-based authentication to a multi-tenancy system with email OTP authentication.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Migration Steps](#migration-steps)
4. [Environment Configuration](#environment-configuration)
5. [Database Migration](#database-migration)
6. [Setting Up the First Admin](#setting-up-the-first-admin)
7. [Testing](#testing)
8. [Rollback](#rollback)
9. [Architecture Changes](#architecture-changes)

## Overview

### New Features
- **Multi-Tenancy**: Centers-based organization with color-coded badges
- **Email OTP Authentication**: Secure 6-digit codes sent via Brevo email service
- **Granular Permissions**: Role-based access control per center
  - **Admin**: Full access to all centers and content
  - **Editor**: Edit content in assigned centers, view untagged content
  - **Viewer**: View content in assigned centers and untagged content
- **Session Management**: Secure express-session based authentication
- **Center Tagging**: Templates and sessions can be tagged with multiple centers

### Breaking Changes
- ⚠️ Password-based authentication replaced with email OTP
- ⚠️ `singers` table renamed to `users`
- ⚠️ All users must have emails to log in
- ⚠️ Frontend authentication flow completely changed

## Prerequisites

Before starting the migration:

1. **Brevo Account** (formerly Sendinblue)
   - Sign up at https://www.brevo.com/
   - Free tier: 300 emails/day
   - Get API key from: https://app.brevo.com/settings/keys/api

2. **Backup Database**
   ```sql
   -- Export your entire database before migration
   -- Use Oracle Data Pump or your preferred backup method
   ```

3. **Node.js Dependencies**
   ```bash
   npm install express-session @types/express-session
   ```

4. **Session Secret**
   Generate a secure session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Migration Steps

### Step 1: Environment Configuration

Update your `.env` or `.env.local` file:

```bash
# Remove old password-based auth
# ADMIN_PASSWORD=...
# EDITOR_PASSWORD=...
# VIEWER_PASSWORD=...

# Add Brevo email service
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=Song Studio

# Add session security
SESSION_SECRET=your_generated_session_secret_here

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Other existing config...
```

### Step 2: Run Database Migration

Execute the migration script in your Oracle database:

```bash
# Connect to your Oracle database
sqlplus username/password@connect_string

# Run the migration
SQL> @database/schema_multi_tenancy.sql
```

**What this does:**
- Creates `centers` table with badge color preferences
- Renames `singers` → `users` and adds `email` + `center_roles` columns
- Adds `center_ids` arrays to `templates` and `named_sessions`
- Creates `otp_codes` table for authentication
- Creates helper functions for permission checking
- Sets all existing data to "untagged" (visible to all)

**Verify the migration:**
```sql
-- Check users table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users';

-- Check existing users (should all have empty center_roles)
SELECT id, name, email, center_roles FROM users;

-- Check centers table
SELECT * FROM centers;
```

### Step 3: Add Email to Existing Users

You must add emails to all existing users (singers):

```sql
-- Update your existing users with their emails
-- Example:
UPDATE users SET email = 'john@example.com' WHERE name = 'John Doe';
UPDATE users SET email = 'jane@example.com' WHERE name = 'Jane Smith';

COMMIT;
```

**Important**: Users without emails cannot log in with the new system.

### Step 4: Set Up the First Admin User

The first admin user should have **empty** `center_roles` (which means admin):

```sql
-- Set a user as admin (leave center_roles empty or null)
UPDATE users 
SET email = 'admin@yourdomain.com', 
    center_roles = '[]'::jsonb 
WHERE id = 1;

COMMIT;
```

Verify admin setup:
```sql
-- Should return 'admin'
SELECT get_user_role(center_roles) FROM users WHERE id = 1;
```

### Step 5: Create Initial Centers (Optional)

Create centers through SQL or wait to use the admin UI:

```sql
-- Create some example centers
INSERT INTO centers (name, badge_text_color) VALUES ('Main Center', '#1E40AF');
INSERT INTO centers (name, badge_text_color) VALUES ('Branch Office', '#DC2626');
INSERT INTO centers (name, badge_text_color) VALUES ('Remote Team', '#059669');

COMMIT;
```

### Step 6: Restart Backend Server

```bash
# Build the backend
npm run build:server

# Start the server
npm run dev:server
# or for production:
npm run start:server
```

**Check logs for:**
```
🔐 Environment loaded:
   BREVO_API_KEY: SET
   BREVO_SENDER_EMAIL: SET
   BREVO_SENDER_NAME: SET
   SESSION_SECRET: SET
```

### Step 7: Test Email Service

The server will log emails to console if `BREVO_API_KEY` is not set (development mode). For production, ensure Brevo is configured.

Test email sending:
```bash
curl -X POST http://localhost:3111/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com"}'
```

Check terminal output for email or check your inbox.

### Step 8: Update Frontend

The frontend will need updates to support the new OTP flow (covered in separate todos).

## Environment Configuration

### Development (.env.local)
```bash
NODE_ENV=development
PORT=3111
FRONTEND_URL=http://localhost:5173

# Brevo Email (leave empty to log to console)
BREVO_API_KEY=
BREVO_SENDER_EMAIL=noreply@songstudio.local
BREVO_SENDER_NAME=Song Studio Dev

# Session (use weak secret for dev)
SESSION_SECRET=dev-session-secret-change-in-production

# Oracle DB
ORACLE_USER=your_user
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_connect_string
ORACLE_WALLET_DIR=./wallet
ORACLE_WALLET_PASSWORD=your_wallet_password
```

### Production (.env)
```bash
NODE_ENV=production
PORT=3111
FRONTEND_URL=https://your-domain.com

# Brevo Email (REQUIRED in production)
BREVO_API_KEY=your_real_brevo_api_key
BREVO_SENDER_EMAIL=noreply@your-domain.com
BREVO_SENDER_NAME=Song Studio

# Session (STRONG secret required)
SESSION_SECRET=your_64_char_random_secret_here

# Oracle DB (production credentials)
ORACLE_USER=prod_user
ORACLE_PASSWORD=strong_password
ORACLE_CONNECT_STRING=prod_connection
ORACLE_WALLET_DIR=/var/www/songstudio/wallet
ORACLE_WALLET_PASSWORD=wallet_password
```

## Database Migration

### Helper Functions Created

#### `user_has_center_access(center_roles, content_center_ids, required_role)`
Checks if a user has access to content based on center assignments.

```sql
-- Example: Check if user can edit template
SELECT user_has_center_access(
  '[]'::jsonb,  -- Empty = admin
  ARRAY[1, 2],  -- Template tagged with centers 1 and 2
  'editor'      -- Requires editor role
); -- Returns TRUE (admin has all access)
```

#### `get_user_role(center_roles)`
Determines overall user role from center assignments.

```sql
-- Admin: empty center_roles
SELECT get_user_role('[]'::jsonb);  -- Returns 'admin'

-- Editor: has any editor assignment
SELECT get_user_role('[{"center_id": 1, "role": "editor"}]'::jsonb);  -- Returns 'editor'

-- Viewer: only viewer assignments
SELECT get_user_role('[{"center_id": 1, "role": "viewer"}]'::jsonb);  -- Returns 'viewer'
```

#### `cleanup_expired_otp_codes()`
Removes old/used OTP codes from database.

```sql
-- Run manually or set up as cron job
SELECT cleanup_expired_otp_codes();
```

### View Created

#### `user_permissions`
Helpful view to see all user permissions at a glance:

```sql
SELECT * FROM user_permissions;

-- Shows: id, name, email, role, center_roles (jsonb), assigned_centers (array of names)
```

## Setting Up the First Admin

### Method 1: SQL (Recommended)

```sql
-- Update an existing user to admin
UPDATE users 
SET 
  email = 'your.email@domain.com',
  center_roles = '[]'::jsonb 
WHERE name = 'Your Name';

COMMIT;

-- Verify
SELECT id, name, email, get_user_role(center_roles) as role 
FROM users 
WHERE email = 'your.email@domain.com';
```

### Method 2: Insert New Admin

```sql
INSERT INTO users (name, email, center_roles) 
VALUES ('Admin User', 'admin@domain.com', '[]'::jsonb);

COMMIT;
```

### Testing Admin Access

1. Request OTP: `POST /api/auth/request-otp` with `{"email": "admin@domain.com"}`
2. Check email or console logs for 6-digit code
3. Verify OTP: `POST /api/auth/verify-otp` with `{"email": "admin@domain.com", "code": "123456"}`
4. Should receive `{"success": true, "role": "admin", "user": {...}}`

## Testing

### Test OTP Flow

```bash
# 1. Request OTP
curl -X POST http://localhost:3111/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 2. Check console output for code (development mode)
# 3. Verify OTP
curl -X POST http://localhost:3111/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}' \
  -c cookies.txt

# 4. Check session
curl http://localhost:3111/api/auth/session -b cookies.txt

# 5. Logout
curl -X POST http://localhost:3111/api/auth/logout -b cookies.txt
```

### Test Centers API

```bash
# List centers (requires auth)
curl http://localhost:3111/api/centers -b cookies.txt

# Create center (admin only)
curl -X POST http://localhost:3111/api/centers \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Test Center","badgeTextColor":"#FF0000"}'

# Get center stats
curl http://localhost:3111/api/centers/1/stats -b cookies.txt
```

### Test Permission Helpers

```sql
-- Test admin access (empty center_roles = admin)
SELECT user_has_center_access('[]'::jsonb, ARRAY[1,2], 'editor');  -- TRUE

-- Test editor access to their center
SELECT user_has_center_access(
  '[{"center_id": 1, "role": "editor"}]'::jsonb, 
  ARRAY[1], 
  'editor'
);  -- TRUE

-- Test viewer cannot edit
SELECT user_has_center_access(
  '[{"center_id": 1, "role": "viewer"}]'::jsonb, 
  ARRAY[1], 
  'editor'
);  -- FALSE

-- Test access to untagged content
SELECT user_has_center_access(
  '[{"center_id": 1, "role": "viewer"}]'::jsonb, 
  NULL,  -- Untagged content
  'viewer'
);  -- TRUE (everyone can view untagged)
```

## Rollback

If you need to rollback the migration:

```sql
-- Run the rollback script
SQL> @database/rollback_multi_tenancy.sql
```

**Warning**: This will:
- Drop all centers and center assignments
- Remove email and center_roles from users
- Rename users back to singers
- Remove all OTP codes
- Lose all multi-tenancy data

After rollback, you'll need to:
1. Restore old environment variables (ADMIN_PASSWORD, etc.)
2. Restart backend with old code
3. Frontend will work with old authentication

## Architecture Changes

### Database Schema

**Before:**
```
singers (id, name, gender)
templates (id, name, slides)
named_sessions (id, session_name, slides)
```

**After:**
```
users (id, name, gender, email, center_roles)
centers (id, name, badge_text_color)
templates (id, name, slides, center_ids)
named_sessions (id, session_name, slides, center_ids)
otp_codes (id, email, code, expires_at, used)
```

### Authentication Flow

**Before:**
1. User enters password
2. Backend checks against environment variables
3. Returns role based on which password matched

**After:**
1. User enters email
2. Backend generates 6-digit OTP, stores in DB with 1-min expiration
3. Email sent via Brevo API
4. User enters OTP code
5. Backend verifies code, marks as used
6. Creates session with user data
7. Session cookie returned to client

### Permission Model

**Admin** (center_roles = `[]`):
- Access to ALL centers
- Can create/edit/delete all content
- Can manage centers and users

**Editor of Center X** (center_roles = `[{"center_id": X, "role": "editor"}]`):
- Can edit templates/sessions tagged with Center X
- Can view untagged content (available to all)
- Cannot edit untagged content (admin only)

**Viewer of Center Y** (center_roles = `[{"center_id": Y, "role": "viewer"}]`):
- Can view templates/sessions tagged with Center Y
- Can view untagged content
- Cannot edit anything

### Content Visibility

**Untagged Content** (center_ids = `NULL` or `[]`):
- Visible to ALL users (admin, editor, viewer)
- Only editable by admins
- Default for existing content after migration

**Tagged Content** (center_ids = `[1, 2]`):
- Visible to users assigned to ANY of those centers
- Editable by admins and editors assigned to those centers
- Can be tagged with multiple centers (cross-center content)

## Troubleshooting

### Email Not Sending

**Symptom**: No email received, but no errors
**Solution**: 
1. Check `BREVO_API_KEY` is set correctly
2. Verify sender email is verified in Brevo account
3. Check spam folder
4. In development, emails log to console instead

### Session Not Persisting

**Symptom**: Login works but immediately logged out
**Solution**:
1. Check `SESSION_SECRET` is set
2. Verify CORS configured with `credentials: true`
3. Check frontend sends requests with `credentials: 'include'`
4. Ensure cookie domain matches

### User Can't Log In

**Symptom**: "User not found" error
**Solution**:
1. Verify user has email set in database:
   ```sql
   SELECT id, name, email FROM users WHERE email = 'user@domain.com';
   ```
2. Email comparison is case-insensitive, check for typos
3. Ensure email is valid format

### Rate Limiting Triggered

**Symptom**: "Too many attempts" error
**Solution**:
1. Wait 15 minutes for lockout to expire
2. Check IP address isn't shared (behind proxy)
3. Restart server to clear in-memory rate limit cache

### OTP Code Expired

**Symptom**: "Code has expired" error
**Solution**:
- OTP codes expire after 1 minute
- Request a new code
- Check server time is synchronized

## Next Steps

After successful migration:

1. **Update Frontend** - Implement new OTP login UI (separate todo)
2. **Create Centers** - Add centers via admin UI
3. **Assign Users** - Update user center_roles via admin UI
4. **Tag Content** - Add center_ids to templates/sessions
5. **Test Permissions** - Verify editors can only edit their centers
6. **Monitor Emails** - Watch Brevo usage (300/day free tier)
7. **Production Deploy** - Use strong SESSION_SECRET, real Brevo key

## Support

For questions or issues:
1. Check logs in terminal for detailed error messages
2. Query `user_permissions` view to debug access issues
3. Use `cleanup_expired_otp_codes()` if OTP table grows large
4. Review Brevo dashboard for email delivery status
