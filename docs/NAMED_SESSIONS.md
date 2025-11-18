# Named Sessions Feature

## Overview

Named Sessions allow users to save and reuse session configurations with predefined sequences of songs, singers, and pitches. This feature enables quick setup of recurring events or themed performances.

## Database Schema

### Tables

#### `named_sessions`
Stores session metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | RAW(16) | Primary key (UUID) |
| name | VARCHAR2(255) | Unique session name |
| description | VARCHAR2(1000) | Optional description |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### `session_items`
Stores the ordered sequence of songs in each session.

| Column | Type | Description |
|--------|------|-------------|
| id | RAW(16) | Primary key (UUID) |
| session_id | RAW(16) | Foreign key to named_sessions |
| song_id | RAW(16) | Foreign key to songs |
| singer_id | RAW(16) | Optional foreign key to singers |
| pitch | VARCHAR2(50) | Optional pitch information |
| sequence_order | NUMBER(10) | Order in sequence (1-based) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Constraints

- **Unique constraint** on `named_sessions.name`
- **Unique constraint** on `(session_id, sequence_order)` in session_items
- **Foreign key cascades**:
  - Deleting a session cascades to delete all its items
  - Deleting a song cascades to remove it from sessions
  - Deleting a singer sets singer_id to NULL

## API Endpoints

### Sessions

- `GET /api/sessions` - Get all sessions
- `GET /api/sessions/:id` - Get session with items
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/duplicate` - Duplicate session

### Session Items

- `GET /api/sessions/:sessionId/items` - Get session items
- `POST /api/sessions/:sessionId/items` - Add item to session
- `PUT /api/sessions/items/:id` - Update session item
- `DELETE /api/sessions/items/:id` - Delete session item
- `PUT /api/sessions/:sessionId/reorder` - Reorder items
- `PUT /api/sessions/:sessionId/items` - Replace all items (bulk update)

## TypeScript Types

```typescript
interface NamedSession {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionItem {
  id: string;
  sessionId: string;
  songId: string;
  singerId?: string;
  pitch?: string;
  sequenceOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionItemWithDetails extends SessionItem {
  songName: string;
  singerName?: string;
}

interface NamedSessionWithItems extends NamedSession {
  items: SessionItemWithDetails[];
}
```

## Frontend Components

### NamedSessionManager
Main component for managing named sessions. Features:
- Create, edit, delete sessions
- Manage song sequences within sessions
- Duplicate sessions
- Load sessions into active session
- Search and filter sessions

### NamedSessionForm
Form component for creating/editing session metadata:
- Session name (required)
- Description (optional)

### NamedSessionList
List component displaying all sessions with actions:
- Load session into active session
- Manage songs in session
- Edit session metadata
- Duplicate session
- Delete session

## Usage

### Creating a Named Session

1. Navigate to `/admin/sessions`
2. Click "Create Session"
3. Enter session name and optional description
4. Click "Save"

### Adding Songs to a Session

1. Click "Manage Songs" icon on a session
2. Click "+ Add Song" to add items
3. Select song, singer (optional), and pitch (optional)
4. Use up/down arrows to reorder items
5. Click "Save Songs"

### Loading a Session

1. Click the "Load" (arrow) icon on a session
2. Session songs will be loaded into the active session
3. Navigate to presentation mode to present

### Duplicating a Session

1. Click the "Duplicate" icon on a session
2. Enter a new name for the duplicated session
3. Session and all its items will be copied

## Context API

### NamedSessionContext

Provides state management for named sessions:

```typescript
const {
  sessions,              // All sessions
  currentSession,        // Currently loaded session with items
  loading,              // Loading state
  error,                // Error message
  loadSessions,         // Fetch all sessions
  loadSession,          // Load specific session
  createSession,        // Create new session
  updateSession,        // Update session
  deleteSession,        // Delete session
  duplicateSession,     // Duplicate session
  setSessionItems,      // Replace all items
  reorderSessionItems,  // Reorder items
  clearCurrentSession,  // Clear current session
  clearError,           // Clear error
} = useNamedSessions();
```

## Service Layer

### NamedSessionService

Handles API communication:

```typescript
// Session operations
getAllSessions(): Promise<NamedSession[]>
getSession(id: string): Promise<NamedSessionWithItems | null>
createSession(input: CreateNamedSessionInput): Promise<NamedSession>
updateSession(id: string, input: UpdateNamedSessionInput): Promise<NamedSession>
deleteSession(id: string): Promise<void>
duplicateSession(id: string, newName: string): Promise<NamedSession>

// Item operations
getSessionItems(sessionId: string): Promise<SessionItemWithDetails[]>
addSessionItem(input: CreateSessionItemInput): Promise<SessionItem>
updateSessionItem(id: string, input: UpdateSessionItemInput): Promise<SessionItem>
deleteSessionItem(id: string): Promise<void>
reorderSessionItems(sessionId: string, itemIds: string[]): Promise<void>
setSessionItems(sessionId: string, items: Array<{...}>): Promise<SessionItemWithDetails[]>
```

## Navigation

- Desktop: "Sessions" link in top navigation
- Mobile: "Manage Sessions" in mobile menu
- Direct URL: `/admin/sessions`

## Future Enhancements

- Session templates
- Session tags/categories
- Export/import sessions
- Session statistics
- Collaborative session editing
- Session scheduling

