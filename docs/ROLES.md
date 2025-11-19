# User Roles and Permissions

Song Studio supports three user roles with different levels of access:

## 🔍 Viewer (Default)
- **No password required**
- **Read-only access** to all content
- Can view all songs, singers, and pitches
- Can use presentation mode
- Can add songs to live session
- **Cannot** create, edit, or delete any content

## ✏️ Editor
- **Password required** (`VITE_EDITOR_PASSWORD`)
- **Can create and edit** content
- All Viewer permissions, plus:
  - Create new songs, singers, and pitch associations
  - Edit existing songs, singers, and pitches
- **Cannot** delete content (Admin only)

## 🛡️ Admin
- **Password required** (`VITE_ADMIN_PASSWORD`)
- **Full access** to all features
- All Editor permissions, plus:
  - Delete songs, singers, and pitch associations
  - Access to all administrative features

## Login

### Keyboard Shortcut
Press `Ctrl+Shift+I` to open the login dialog from anywhere in the app.

### Via Header
Click the role indicator badge in the header (top-right):
- **Viewer** (gray badge with eye icon)
- **Editor** (blue badge with pencil icon)
- **Admin** (green badge with shield icon)

## Environment Configuration

Set passwords in your `.env.local` file:

```bash
# Admin password (full access)
VITE_ADMIN_PASSWORD=your_admin_password_here

# Editor password (can edit but not delete)
VITE_EDITOR_PASSWORD=your_editor_password_here
```

**Default Passwords** (for development only):
- Admin: `Sairam999`
- Editor: `Editor999`

⚠️ **Important**: Change these passwords in production!

## Session Duration

Login sessions last for **24 hours** and are stored in browser session storage. Sessions automatically expire after 24 hours, requiring re-authentication.

## Logout

Click the role indicator badge in the header while logged in to return to Viewer mode.

## Permission Matrix

| Feature | Viewer | Editor | Admin |
|---------|:------:|:------:|:-----:|
| View songs/singers/pitches | ✅ | ✅ | ✅ |
| Presentation mode | ✅ | ✅ | ✅ |
| Add to live session | ✅ | ✅ | ✅ |
| Create songs/singers/pitches | ❌ | ✅ | ✅ |
| Edit songs/singers/pitches | ❌ | ✅ | ✅ |
| Delete songs/singers/pitches | ❌ | ❌ | ✅ |
| Import from CSV | ❌ | ✅ | ✅ |
| Import from Sairhythms | ❌ | ❌ | ✅ |
| Named session management | ❌ | ✅ | ✅ |

## Technical Implementation

The role system is implemented using:
- **AuthContext**: Provides role state and authentication methods
- **sessionStorage**: Stores current role and expiry time
- **Conditional rendering**: UI elements show/hide based on `isEditor` and `isAdmin` flags
- **Password validation**: Server-side validation using environment variables

## Role Indicators

Each role has a distinct visual indicator in the header:

- **👁️ Viewer**: Gray badge, eye icon, "Read-only" tooltip
- **✏️ Editor**: Blue badge, pencil icon, "Can edit, cannot delete" tooltip
- **🛡️ Admin**: Green badge, shield icon, "Full access" tooltip

The indicator serves as both a status display and a logout button when authenticated.

