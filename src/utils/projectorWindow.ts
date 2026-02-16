/**
 * Opens a presentation in a new window for projecting to a second display.
 * When the Window Management API (getScreenDetails) is available, positions
 * the window on the secondary display. Otherwise opens a standard popup
 * that the user can drag to their second monitor.
 */

const PROJECTOR_WINDOW_FEATURES = 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no';

export interface ProjectorWindowOptions {
  /** URL path (e.g. /presentation/abc123 or /session/present?projector=1) */
  path: string;
  /** Optional: pre-selected screen index when Window Management API is available (0 = primary, 1 = first secondary, etc.) */
  screenIndex?: number;
}

/**
 * Opens a new window with the given path for projection.
 * Uses Window Management API when available to open on secondary display.
 */
export async function openProjectorWindow(options: ProjectorWindowOptions): Promise<Window | null> {
  const { path, screenIndex = 1 } = options;
  const url = `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;

  // Try Window Management API when available (Chrome, Edge)
  if ('getScreenDetails' in window && typeof (window as any).getScreenDetails === 'function') {
    try {
      const screenDetails = await (window as any).getScreenDetails();
      const screens = screenDetails?.screens;
      if (screens && screens.length > 1 && screenIndex < screens.length) {
        const targetScreen = screens[screenIndex];
        const left = targetScreen.availLeft ?? targetScreen.left ?? 0;
        const top = targetScreen.availTop ?? targetScreen.top ?? 0;
        const width = targetScreen.availWidth ?? targetScreen.width ?? 1920;
        const height = targetScreen.availHeight ?? targetScreen.height ?? 1080;
        const features = `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`;
        return window.open(url, 'saisongs-projector', features);
      }
    } catch (err) {
      console.warn('Window Management API failed, falling back to default window:', err);
    }
  }

  // Fallback: open centered on current screen (user can drag to second display)
  const left = typeof window.screen?.availLeft === 'number' ? window.screen.availLeft + 50 : 50;
  const top = typeof window.screen?.availTop === 'number' ? window.screen.availTop + 50 : 50;
  const features = `left=${left},top=${top},${PROJECTOR_WINDOW_FEATURES}`;
  return window.open(url, 'saisongs-projector', features);
}

/** Check if Window Management API is available for screen selection */
export function isScreenSelectionSupported(): boolean {
  return 'getScreenDetails' in window && typeof (window as any).getScreenDetails === 'function';
}
