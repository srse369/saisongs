# Base Manager Pattern

This directory contains a reusable pattern for admin manager components that eliminates code duplication and provides consistent behavior across all management interfaces.

## Overview

The Base Manager pattern consists of two main components:

1. **`useBaseManager` Hook** - Provides shared state and logic
2. **`BaseManager` Component** - Provides shared UI structure

## Benefits

- **Eliminates Code Duplication**: Common mobile/responsive logic is centralized
- **Consistent UX**: All managers have the same mobile behavior, scroll handling, and keyboard shortcuts
- **Easier Maintenance**: Changes to common functionality only need to be made in one place
- **Type Safety**: Full TypeScript support with proper interfaces
- **Flexible**: Each manager can still customize behavior while inheriting common functionality

## Common Functionality Provided

### Mobile & Responsive Behavior
- Mobile detection and state management
- Fixed header positioning on mobile
- Scrollable content area with proper positioning
- Body scroll prevention when tab is active
- Mobile bottom action bar support

### User Experience
- Scroll-to-top button on mobile
- Keyboard shortcuts (Escape key handling)
- Loading states and error handling
- Smooth animations and transitions

### Data Management
- Global event bus integration for data refresh
- URL parameter handling for item navigation
- Lazy loading support with Intersection Observer

## Usage Pattern

### 1. Use the Hook

```typescript
import { useBaseManager } from '../../hooks/useBaseManager';

const baseManager = useBaseManager({
  resourceName: 'songs', // Resource name for global events
  isActive: true,       // Whether this tab is currently active
  onDataRefresh: () => fetchSongs(true), // Optional refresh callback
  onEscapeKey: () => { // Optional escape key handler
    setSearchTerm('');
    baseManager.searchInputRef.current?.focus();
  },
  preventBodyScroll: true, // Optional, defaults to true
});
```

### 2. Use the Component

```typescript
import { BaseManager } from './BaseManager';

<BaseManager
  isActive={isActive}
  isMobile={baseManager.isMobile}
  showScrollToTop={baseManager.showScrollToTop}
  listContainerStyle={baseManager.listContainerStyle}
  listContainerRef={baseManager.listContainerRef}
  headerRef={baseManager.headerRef}
  title="Song Management"
  subtitle="Create and manage your song library"
  helpHref="/help#songs"
  headerActions={headerActions} // ReactNode for search, filters, buttons
  mobileActions={mobileActions} // MobileAction[] for bottom bar
  filterCount={activeFilterCount} // Optional filter count badge
  onScrollToTop={baseManager.scrollToTop}
  loading={loading}
>
  {/* Your manager content goes here */}
  <SongList songs={displayedSongs} />
</BaseManager>
```

## Migration Guide

### Before (Duplicated Code)

Each manager had 100+ lines of duplicated code for:
- Mobile detection and viewport calculations
- Scroll handling and scroll-to-top functionality
- Body scroll prevention
- Header positioning logic
- Global event bus listeners
- Keyboard shortcuts

### After (Using Base Pattern)

```typescript
// Before: 150+ lines of boilerplate
const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
const [showScrollToTop, setShowScrollToTop] = useState(false);
const [listContainerStyle, setListContainerStyle] = useState({});
// ... 50+ more lines of mobile logic

// After: 1 line
const baseManager = useBaseManager({ resourceName: 'songs', isActive });
```

## Examples

### SongManagerRefactored.tsx
Shows a complex manager with:
- Advanced search and filtering
- Lazy loading
- URL parameter handling
- Multiple modals
- Custom header actions

### FeedbackManager.tsx
Shows a simpler manager with:
- Basic filtering
- Single modal
- Permission-based rendering
- Standard CRUD operations

## Customization Options

### Hook Configuration
- `resourceName`: For global event bus filtering
- `isActive`: Tab active state
- `onDataRefresh`: Callback for data refresh events
- `onEscapeKey`: Custom escape key handler
- `preventBodyScroll`: Disable body scroll prevention

### Component Props
- `title`, `subtitle`, `helpHref`: Header content
- `headerActions`: Desktop header content (search, filters, buttons)
- `mobileActions`: Bottom action bar buttons
- `filterCount`: Badge count for active filters
- `aboveHeader`, `belowContent`: Additional content areas

## File Structure

```
src/components/admin/
├── BaseManager.tsx              # Reusable UI component
├── README.md                    # This documentation
├── SongManagerRefactored.tsx    # Song management (uses base pattern)
├── FeedbackManager.tsx          # Feedback management (uses base pattern)
└── ...other managers...

src/hooks/
└── useBaseManager.ts            # Shared logic hook
```

## Best Practices

1. **Keep Manager-Specific Logic Separate**: Only use base pattern for truly common functionality
2. **Customize Thoughtfully**: Override base behavior only when necessary
3. **Maintain Consistency**: Use the same patterns for similar functionality across managers
4. **Test Mobile Behavior**: Ensure mobile responsiveness works correctly after migration
5. **Document Customizations**: Comment any deviations from the standard pattern

## Future Enhancements

Potential improvements to the base pattern:
- Theme integration
- Accessibility features
- Performance optimizations
- Additional mobile gestures
- Advanced filtering components
- Bulk operations support
