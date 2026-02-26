import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import songService from '../../services/SongService';
import { toTitleCase } from '../../utils/textUtils';
import { formatNormalizedPitch } from '../../utils/pitchNormalization';
import type { Song } from '../../types';

const MOBILE_BREAKPOINT = 768;
const HOVER_DELAY_MS = 750; // Wait before showing popup on hover
const LEAVE_DELAY_MS = 1000; // 1s grace period so user can move cursor to popup (e.g. to play audio)

const LYRICS_POPUP_OPEN_EVENT = 'lyricsPopup:opening';

function dispatchLyricsPopupOpening(songId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LYRICS_POPUP_OPEN_EVENT, { detail: { songId } }));
  }
}

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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const [showPopup, setShowPopup] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [audioLink, setAudioLink] = useState<string | null>(null);
  const [displaySong, setDisplaySong] = useState<Song | null>(null); // For metadata when fetched
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const isOverPopupRef = useRef(false);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const closePopup = useCallback(() => {
    setShowPopup(false);
    setLoading(false);
    setAudioLink(null);
    setDisplaySong(null);
  }, []);

  const showAtCursor = useCallback((lyricsText: string | null, link?: string | null) => {
    dispatchLyricsPopupOpening(songId);
    setLyrics(lyricsText);
    setAudioLink(link ?? initialSong?.audioLink ?? null);
    setDisplaySong(initialSong ?? null);
    setShowPopup(true);
    setPosition({ top: cursorPosRef.current.y, left: cursorPosRef.current.x });
    // No auto-dismiss: popup stays open as long as cursor is on song name or popup
  }, [songId, initialSong]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY };
    clearHoverTimer();
    if (initialSong?.lyrics) {
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null;
        showAtCursor(initialSong.lyrics ?? null, initialSong.audioLink);
        // If we don't have audioLink from initialSong, fetch full song (songs list may omit it)
        if (!initialSong.audioLink) {
          songService.getSongById(songId).then((song) => {
            if (song?.audioLink) setAudioLink(song.audioLink);
          }).catch(() => {});
        }
      }, HOVER_DELAY_MS);
    } else {
      hoverTimerRef.current = setTimeout(async () => {
        hoverTimerRef.current = null;
        dispatchLyricsPopupOpening(songId);
        setLoading(true);
        try {
          const song = await songService.getSongById(songId);
          const text = song?.lyrics ?? null;
          setLyrics(text);
          setAudioLink(initialSong?.audioLink ?? song?.audioLink ?? null);
          setDisplaySong(song ?? null);
          setShowPopup(true);
          setPosition({ top: cursorPosRef.current.y, left: cursorPosRef.current.x });
          setLoading(false);
        } catch {
          setLyrics(null);
          setAudioLink(null);
          setDisplaySong(null);
          setLoading(false);
          setShowPopup(true);
          setPosition({ top: cursorPosRef.current.y, left: cursorPosRef.current.x });
        }
      }, HOVER_DELAY_MS);
    }
  }, [songId, initialSong?.lyrics, initialSong?.audioLink, clearHoverTimer, showAtCursor, closePopup]);

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

  // When another song's popup opens, close this one (and cancel any pending show) so only one popup is visible
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ songId: string }>;
      if (ev.detail?.songId !== songId) {
        clearHoverTimer();
        closePopup();
      }
    };
    window.addEventListener(LYRICS_POPUP_OPEN_EVENT, handler);
    return () => window.removeEventListener(LYRICS_POPUP_OPEN_EVENT, handler);
  }, [songId, clearHoverTimer, closePopup]);

  useEffect(() => () => {
    clearHoverTimer();
    clearLeaveTimer();
  }, [clearHoverTimer, clearLeaveTimer]);

  // Track mobile state for resize
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (typeof document === 'undefined') {
    return <span className={className}>{children}</span>;
  }

  // On mobile: never show popup, just render children (lyrics shown inline in expanded metadata)
  if (isMobile) {
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
      {/* 1. Title + Audio player */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 flex items-center gap-2 min-w-0">
        <div className="font-semibold text-sm text-gray-900 dark:text-white truncate min-w-0 flex-shrink">{songName}</div>
        {audioLink && (
          <audio
            controls
            preload="none"
            className="flex-shrink-0 min-w-[280px] flex-1 dark:invert dark:brightness-90 dark:contrast-90 dark:hue-rotate-180"
            style={{ height: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <source src={audioLink} />
            Your browser does not support the audio element.
          </audio>
        )}
      </div>
      {/* 2. Lyrics */}
      <div className="flex-1 overflow-y-auto px-3 pt-1 pb-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap min-h-0">
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
      {/* 3. Metadata - Line 1: Deity, Language, Tempo | Line 2: Raga, Beat | Line 3: Gents/Ladies reference pitches */}
      {(() => {
        const meta = displaySong ?? initialSong;
        const hasMeta = meta && (meta.deity || meta.language || meta.tempo || meta.raga || meta.beat || meta.refGents || meta.refLadies);
        if (!hasMeta) return null;
        return (
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600 text-[10px] text-gray-600 dark:text-gray-400 flex flex-col gap-1">
            {/* Line 1: Deity, Language, Tempo */}
            {(meta!.deity || meta!.language || meta!.tempo) && (
              <div className="flex flex-wrap items-center gap-x-0">
                {meta!.deity && (
                  <>
                    <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded font-medium">{toTitleCase(meta!.deity)}</span>
                {(meta!.language || meta!.tempo) && <span className="mx-1">•</span>}
                  </>
                )}
                {meta!.language && (
                  <>
                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-medium">{toTitleCase(meta!.language)}</span>
                {meta!.tempo && <span className="mx-1">•</span>}
                  </>
                )}
                {meta!.tempo && (
                  <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded font-medium">{toTitleCase(meta!.tempo)}</span>
                )}
              </div>
            )}
            {/* Line 2: Raga, Beat */}
            {(meta!.raga || meta!.beat) && (
              <div className="flex flex-wrap items-center gap-x-0">
                {meta!.raga && (
                  <>
                    <span className="font-medium">{toTitleCase(meta!.raga)}</span>
                    {meta!.beat && <span className="mx-1">•</span>}
                  </>
                )}
                {meta!.beat && <span className="font-medium">{toTitleCase(meta!.beat)}</span>}
              </div>
            )}
            {/* Line 3: Gents reference, Ladies reference */}
            {(meta!.refGents || meta!.refLadies) && (
              <div className="flex flex-wrap items-center gap-x-0">
                {meta!.refGents && (
                  <>
                    <span>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">Gents: </span>
                      <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(meta!.refGents)}</span>
                    </span>
                    {meta!.refLadies && <span className="mx-1">•</span>}
                  </>
                )}
                {meta!.refLadies && (
                  <span>
                    <span className="text-pink-600 dark:text-pink-400 font-medium">Ladies: </span>
                    <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(meta!.refLadies)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })()}
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
