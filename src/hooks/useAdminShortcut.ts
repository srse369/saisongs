import { useState, useEffect, useCallback } from 'react';

/**
 * Return type for the useAdminShortcut hook
 */
interface UseAdminShortcutReturn {
  /** Whether the password dialog is currently open */
  isPasswordDialogOpen: boolean;
  /** Function to open the password dialog */
  openPasswordDialog: () => void;
  /** Function to close the password dialog */
  closePasswordDialog: () => void;
}

/**
 * Custom hook to manage admin keyboard shortcut and password dialog state
 * 
 * Listens for the admin keyboard shortcut (Ctrl+Shift+I on Windows/Linux
 * or Cmd+Shift+I on Mac) and manages the password dialog open/close state.
 * 
 * The keyboard shortcut is global and will trigger from anywhere in the app.
 * The default browser behavior for the shortcut is prevented.
 * 
 * @returns Object containing dialog state and control functions
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { isPasswordDialogOpen, closePasswordDialog } = useAdminShortcut();
 *   
 *   return (
 *     <PasswordDialog
 *       isOpen={isPasswordDialogOpen}
 *       onClose={closePasswordDialog}
 *       onSuccess={() => console.log('Authenticated!')}
 *     />
 *   );
 * }
 * ```
 */
export const useAdminShortcut = (): UseAdminShortcutReturn => {
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const openPasswordDialog = useCallback(() => {
    setIsPasswordDialogOpen(true);
  }, []);

  const closePasswordDialog = useCallback(() => {
    setIsPasswordDialogOpen(false);
  }, []);

  useEffect(() => {
    /**
     * Handles keyboard events to detect admin shortcut
     * 
     * Listens for Ctrl+Shift+I (Windows/Linux) or Cmd+Shift+I (Mac)
     * and opens the password dialog when detected.
     * 
     * @param event - Keyboard event
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+I (Windows/Linux) or Cmd+Shift+I (Mac)
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const isShiftPressed = event.shiftKey;
      const isIKey = event.key === 'I' || event.key === 'i';

      if (isModifierPressed && isShiftPressed && isIKey) {
        // Prevent default browser behavior (usually opens DevTools)
        event.preventDefault();
        openPasswordDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPasswordDialog]);

  return {
    isPasswordDialogOpen,
    openPasswordDialog,
    closePasswordDialog,
  };
};
