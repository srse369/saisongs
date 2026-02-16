import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import songService from '../../services/SongService';
import type { Song } from '../../types';

const HOVER_DELAY_MS = 2000;
const AUTO_DISMISS_MS = 10000;
const LEAVE_DELAY_MS = 150; // Brief delay so user can move cursor to popup to read

interface LyricsHoverPopupProps {
  songId: string;
  songName: string;
  /** Pre-loaded song with lyrics (avoids fetch if provided) */
  song?: Song | null;
  children: React.ReactNode;
  className?: string;
}

export const LyricsHoverPopup: React.FC<LyricsHoverPopupProps> = ({
  songId,
  songName,
  song: initialSong,
  children,
  className = '',
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const isOverPopupRef = useRef(false);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const closePopup = useCallback(() => {
    clearDismissTimer();
    setShowPopup(false);
    setLoading(false);
  }, [clearDismissTimer]);

  const showAtCursor = useCallback((lyricsText: string | null) => {
    setLyrics(lyricsText);
    setShowPopup(true);
    setPosition({ top: cursorPosRef.current.y, left: cursorPosRef.current.x });
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(closePopup, AUTO_DISMISS_MS);
  }, [closePopup, clearDismissTimer]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY };
    clearDismissTimer();
    clearHoverTimer();
    if (initialSong?.lyrics) {
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null;
        showAtCursor(initialSong.lyrics ?? null);
      }, HOVER_DELAY_MS);
    } else {
      hoverTimerRef.current = setTimeout(async () => {
        hoverTimerRef.current = null;
        setLoading(true);
        try {
          const song = await songService.getSongById(songId);
          const text = song?.lyrics ?? null;
          setLyrics(text);
          setShowPopup(true);
          setPosition({ top: cursorPosRef.current.y, left: cursorPosRef.current.x });
          setLoading(false);
          clearDismissTimer();
          dismissTimerRef.current = setTimeout(closePopup, AUTO_DISMISS_MS);
        } catch {
          setLyrics(null);
          setLoading(false);
        }
      }, HOVER_DELAY_MS);
    }
  }, [songId, initialSong?.lyrics, clearHoverTimer, clearDismissTimer, showAtCursor, closePopup]);

  const handleTriggerMouseLeave = useCallback(() => {
    clearHoverTimer();
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      if (!isOverPopupRef.current) {
        closePopup();
      }
    }, LEAVE_DELAY_MS);
  }, [clearHoverTimer, closePopup]);

  const handlePopupMouseEnter = useCallback(() => {
    clearLeaveTimer();
    isOverPopupRef.current = true;
  }, [clearLeaveTimer]);

  const handlePopupMouseLeave = useCallback(() => {
    isOverPopupRef.current = false;
    closePopup();
  }, [closePopup]);

  useEffect(() => () => {
    clearHoverTimer();
    clearDismissTimer();
    clearLeaveTimer();
  }, [clearHoverTimer, clearDismissTimer, clearLeaveTimer]);

  if (typeof document === 'undefined') {
    return <span className={className}>{children}</span>;
  }

  const popupContent = showPopup && (
    <div
      className="fixed z-[9999] rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 max-w-md max-h-80 overflow-hidden flex flex-col"
      style={{
        top: Math.min(position.top + 12, window.innerHeight - 330),
        left: Math.max(8, Math.min(position.left + 12, window.innerWidth - 340)),
      }}
      onMouseEnter={handlePopupMouseEnter}
      onMouseLeave={handlePopupMouseLeave}
    >
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-semibold text-sm text-gray-900 dark:text-white truncate">
        {songName}
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : lyrics ? (
          lyrics
        ) : (
          <span className="text-gray-500 dark:text-gray-400">No lyrics available</span>
        )}
      </div>
    </div>
  );

  return (
    <span
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleTriggerMouseLeave}
    >
      {children}
      {popupContent && createPortal(popupContent, document.body)}
    </span>
  );
};
