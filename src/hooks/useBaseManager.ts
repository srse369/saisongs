import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { globalEventBus } from '../utils/globalEventBus';

export interface BaseManagerConfig {
  resourceName: string;
  isActive?: boolean;
  onDataRefresh?: () => void;
  onEscapeKey?: () => void;
  preventBodyScroll?: boolean;
}

export interface BaseManagerState {
  isMobile: boolean;
  showScrollToTop: boolean;
  listContainerStyle: React.CSSProperties;
}

export interface BaseManagerRefs {
  listContainerRef: React.RefObject<HTMLDivElement>;
  headerRef: React.RefObject<HTMLDivElement>;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export interface BaseManagerActions {
  scrollToTop: () => void;
  calculateMobilePosition: () => void;
}

export const useBaseManager = (config: BaseManagerConfig) => {
  const { resourceName, isActive = true, onDataRefresh, onEscapeKey, preventBodyScroll = true } = config;
  const location = useLocation();
  const { userId } = useAuth();

  // State
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [listContainerStyle, setListContainerStyle] = useState<React.CSSProperties>({});

  // Refs
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Track mobile state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll on mobile when tab is active
  useEffect(() => {
    if (preventBodyScroll && isMobile && isActive) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isActive, preventBodyScroll]);

  // Calculate list container positioning (both mobile and desktop since header is fixed)
  const calculateMobilePosition = useCallback(() => {
    if (!isActive) {
      setListContainerStyle({});
      return;
    }

    const header = headerRef.current;
    if (!header) return;

    const headerRect = header.getBoundingClientRect();

    if (isMobile) {
      const bottomBarHeight = 96;
      const bottomBarTop = window.innerHeight - bottomBarHeight;
      const calculatedHeight = bottomBarTop - headerRect.bottom;
      const finalHeight = calculatedHeight > 0 ? calculatedHeight : 400;
      
      setListContainerStyle({
        top: `${headerRect.bottom}px`,
        left: '0%',
        width: '100%',
        height: `${finalHeight}px`,
        minHeight: `${finalHeight}px`,
        maxHeight: `${finalHeight}px`,
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-y',
      });
    } else {
      // Desktop: fixed header, so list needs top margin to clear it
      setListContainerStyle({
        marginTop: `${headerRect.height + 8}px`,
      });
    }
  }, [isMobile, isActive]);

  // Calculate position on mount and when dependencies change
  useEffect(() => {
    calculateMobilePosition();
  }, [calculateMobilePosition]);

  // Recalculate position on resize and when header content changes
  useEffect(() => {
    if (!isActive) return;

    // Calculate once after a short delay to allow DOM to settle
    const timeoutId = setTimeout(() => {
      calculateMobilePosition();
    }, 200);

    // Recalculate on resize
    const handleResize = () => {
      calculateMobilePosition();
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile, isActive, calculateMobilePosition]);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    if (!isActive || !isMobile || !listContainerRef.current) return;

    const container = listContainerRef.current;
    const handleScroll = () => {
      setShowScrollToTop(container.scrollTop > 200);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isMobile, isActive]);

  // Scroll to top functionality
  const scrollToTop = useCallback(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Global event bus listener for data refresh
  useEffect(() => {
    if (!onDataRefresh) return;

    let unsubscribe: (() => void) | undefined;

    unsubscribe = globalEventBus.on('dataRefreshNeeded', (detail) => {
      if (detail.resource === resourceName || detail.resource === 'all') {
        onDataRefresh();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [resourceName, onDataRefresh]);

  // Escape key handling
  useEffect(() => {
    if (!onEscapeKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscapeKey();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscapeKey]);

  return {
    // State
    isMobile,
    showScrollToTop,
    listContainerStyle,
    
    // Refs
    listContainerRef,
    headerRef,
    searchInputRef,
    
    // Actions
    scrollToTop,
    calculateMobilePosition,
  };
};
