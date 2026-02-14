import React, { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'default' | 'large' | 'xlarge' | 'full';
  titleActions?: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'default',
  titleActions,
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        // Stop propagation so other Escape handlers don't also fire
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      // Use capture phase to handle before other handlers
      document.addEventListener('keydown', handleEscape, true);
      // Prevent layout shift when scrollbar disappears (reserve its width)
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape, true);
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Desktop max-width classes
  const maxWidthClass = {
    'default': 'sm:max-w-2xl',
    'large': 'sm:max-w-5xl',
    'xlarge': 'sm:max-w-7xl',
    'full': 'sm:max-w-[95vw]',
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl w-full ${maxWidthClass} max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with larger touch targets on mobile */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
            {titleActions && <div className="flex items-center gap-2 flex-shrink-0">{titleActions}</div>}
          </div>
          {/* Larger close button for touch */}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full sm:rounded transition-colors"
            aria-label="Close modal"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        {/* Content with safe area padding on mobile */}
        <div className="px-4 sm:px-6 py-4 pb-safe overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
