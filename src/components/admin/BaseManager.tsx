import React, { ReactNode, useEffect } from 'react';
import { RefreshIcon, MobileBottomActionBar, type MobileAction } from '../common';

export interface BaseManagerProps {
  isActive?: boolean;
  isMobile?: boolean;
  showScrollToTop?: boolean;
  listContainerStyle?: React.CSSProperties;
  listContainerRef?: React.RefObject<HTMLDivElement | null>;
  headerRef?: React.RefObject<HTMLDivElement | null>;

  // Header content
  title: string;
  subtitle?: string;
  helpHref?: string;

  // Header actions (desktop)
  headerActions?: ReactNode;

  // Main content
  children: ReactNode;

  // Mobile actions
  mobileActions?: MobileAction[];

  // Scroll to top
  onScrollToTop?: () => void;

  // Loading state
  loading?: boolean;

  // Optional additional content
  aboveHeader?: ReactNode;
  // Optional content rendered inside the header below the main header actions
  headerBelow?: ReactNode;
  belowContent?: ReactNode;
}

export const BaseManager: React.FC<BaseManagerProps> = ({
  isActive = true,
  isMobile = false,
  showScrollToTop = false,
  listContainerStyle = {},
  listContainerRef,
  headerRef,
  title,
  subtitle,
  helpHref,
  headerActions,
  children,
  mobileActions = [],
  onScrollToTop,
  loading = false,
  aboveHeader,
  headerBelow,
  belowContent,
}) => {
  // Trigger position calculation after DOM layout (both mobile and desktop)
  useEffect(() => {
    if (headerRef?.current) {
      // Wait for render to complete
      const timer = setTimeout(() => {
        if (headerRef?.current) {
          // Trigger a recalc in the parent hook via resize event
          window.dispatchEvent(new Event('resize'));
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [headerRef]);
  return (
    <div 
      data-base-manager="container"
      className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 animate-fade-in grid"
    >
      {/* Content above header */}
      {aboveHeader}

      {/* Fixed Header on Mobile - Pinned below Layout header */}
      <div
        data-base-manager="header-wrapper"
        ref={headerRef}
        className="fixed left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
        style={{
          top: isMobile ? '48px' : '64px', // h-12 = 48px on mobile, md:h-16 = 64px on desktop
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div 
          data-base-manager="header-inner"
          className={`max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 ${isMobile ? 'py-2' : 'py-3'}`}
        >
          <div 
            data-base-manager="header-content"
            className="flex flex-col gap-2 sm:gap-4"
          >
            <div data-base-manager="header-title-section">
              <div 
                data-base-manager="header-title-row"
                className="flex items-center gap-2 mb-2"
              >
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-0">
                  {title}
                </h1>
                {helpHref && (
                  <a
                    href={helpHref}
                    className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                    title="View help documentation for this tab"
                  >
                    <i className="fas fa-question-circle text-lg sm:text-xl"></i>
                  </a>
                )}
              </div>
              {subtitle && (
                <p className="hidden sm:block text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  {subtitle}
                </p>
              )}

              {/* Header actions (search, filters, buttons) */}
              {headerActions && (
                <div 
                  data-base-manager="header-actions"
                  className="flex flex-col lg:flex-row gap-3 w-full"
                >
                  {headerActions}
                </div>
              )}
              
              {/* Optional content to render inside header under actions (e.g., advanced search, counts) */}
              {headerBelow && (
                <div 
                  data-base-manager="header-below"
                  className=""
                >
                  {headerBelow}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* List Container - Scrollable on mobile, positioned below fixed header on desktop */}
      <div
        data-base-manager="list-container"
        ref={listContainerRef}
        className={isMobile ? 'fixed left-0 right-0' : ''}
        style={isMobile ? {
          ...listContainerStyle,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          zIndex: 20,
        } : {
          ...listContainerStyle,
          minHeight: '400px',
        }}
      >
        {children}
      </div>

      {/* Content below main content */}
      {belowContent}

      {/* Scroll to Top Button - Mobile only */}
      {isMobile && showScrollToTop && onScrollToTop && (
        <button
          onClick={onScrollToTop}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <i className="fas fa-arrow-up text-lg"></i>
        </button>
      )}

      {/* Mobile Bottom Action Bar */}
      {isMobile && mobileActions.length > 0 && (
        <MobileBottomActionBar
          actions={mobileActions}
        />
      )}
    </div>
  );
};
