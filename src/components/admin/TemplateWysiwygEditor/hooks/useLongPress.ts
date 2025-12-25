import { useRef } from 'react';

/**
 * Hook for detecting long-press on mobile devices (for Konva canvas elements)
 */
export const useLongPress = (
  onLongPress: (e: any) => void,
  delay: number = 500
) => {
  const timerRef = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (e: any) => {
    // Get the native event - Konva wraps it in evt property
    const nativeEvent = e.evt;
    const touch = nativeEvent?.touches?.[0];
    
    if (touch) {
      // Prevent default iOS context menu behavior
      if (nativeEvent?.preventDefault) {
        nativeEvent.preventDefault();
      }
      
      longPressTriggered.current = false;
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      
      timerRef.current = window.setTimeout(() => {
        longPressTriggered.current = true;
        onLongPress(e);
      }, delay);
    }
  };

  const handleTouchMove = (e: any) => {
    const nativeEvent = e.evt;
    const touch = nativeEvent?.touches?.[0];
    
    if (touch && touchStartPos.current) {
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Cancel long-press if finger moved more than 10px
      if (distance > 10 && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    touchStartPos.current = null;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};

/**
 * Hook for detecting long-press on DOM elements (not Konva)
 */
export const useLongPressDOM = (
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void,
  delay: number = 500
) => {
  const timerRef = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    touchStartPos.current = { x: clientX, y: clientY };
    
    timerRef.current = window.setTimeout(() => {
      onLongPress(e);
    }, delay);
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartPos.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - touchStartPos.current.x;
    const dy = clientY - touchStartPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Cancel long-press if moved more than 10px
    if (distance > 10 && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    touchStartPos.current = null;
  };

  return {
    onTouchStart: handleStart,
    onTouchMove: handleMove,
    onTouchEnd: handleEnd,
    onMouseDown: handleStart,
    onMouseMove: handleMove,
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
  };
};
