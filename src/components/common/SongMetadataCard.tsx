import React, { useState, useEffect } from 'react';
import { formatNormalizedPitch } from '../../utils/pitchNormalization';
import { toTitleCase } from '../../utils/textUtils';
import songService from '../../services/SongService';
import type { Song } from '../../types';

export interface SongMetadata {
  name: string;
  externalSourceUrl?: string;
  audioLink?: string;
  raga?: string;
  beat?: string;
  deity?: string;
  language?: string;
  tempo?: string;
  refGents?: string;
  refLadies?: string;
}

interface SongMetadataCardProps {
  song: SongMetadata;
  onNameClick?: () => void;
  nameClickTitle?: string;
  showBackground?: boolean;
  pitchCount?: number;
  isSelected?: boolean;
  alwaysShowDeityLanguage?: boolean;
  onPreviewClick?: () => void;
  isAuthenticated?: boolean; // Hide pitch count on mobile when not authenticated
  /** When provided, lyrics and metadata show inline when expanded (isSelected) */
  lyricsHover?: { songId: string; songName: string; song?: Song | null };
  /** When true (desktop only): show only song name; details expand on hover */
  compactInDesktop?: boolean;
  /** When true (desktop only): keep lyrics and preview icons immediately after song name */
  iconsNextToNameOnDesktop?: boolean;
  /** When false, hide song name (e.g. when showing metadata+lyrics inline in an expanded row) */
  showName?: boolean;
}

/**
 * Reusable component for displaying song metadata with a darker background.
 * Used in Songs tab, Pitches tab, and Live Session tab.
 */
export const SongMetadataCard: React.FC<SongMetadataCardProps> = ({
  song,
  onNameClick,
  nameClickTitle,
  showBackground = true,
  pitchCount,
  isSelected = false,
  alwaysShowDeityLanguage = false,
  onPreviewClick,
  isAuthenticated = true, // Default to true for backward compatibility
  lyricsHover,
  compactInDesktop = false,
  iconsNextToNameOnDesktop = false,
  showName = true,
}) => {
  const hasReferencePitches = song.refGents || song.refLadies;

  // Lyrics for mobile expanded view - fetch when isSelected and lyricsHover
  const [lyrics, setLyrics] = useState<string | null>(lyricsHover?.song?.lyrics ?? null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  useEffect(() => {
    if (!isSelected || !lyricsHover) {
      setLyrics(null);
      setLyricsLoading(false);
      return;
    }
    if (lyricsHover.song?.lyrics) {
      setLyrics(lyricsHover.song.lyrics);
      setLyricsLoading(false);
      return;
    }
    setLyrics(null);
    setLyricsLoading(true);
    songService.getSongById(lyricsHover.songId)
      .then((s) => {
        setLyrics(s?.lyrics ?? null);
      })
      .catch(() => setLyrics(null))
      .finally(() => setLyricsLoading(false));
  }, [isSelected, lyricsHover?.songId, lyricsHover?.song?.lyrics]);

  // Show background on desktop always, or on mobile when selected
  const shouldShowBackground = showBackground || isSelected;

  // When compactInDesktop: details expand on click (isSelected) - both mobile and desktop
  const detailsDeityLangClass = compactInDesktop
    ? `${(isSelected || alwaysShowDeityLanguage) ? 'flex' : 'hidden'}`
    : `${(isSelected || alwaysShowDeityLanguage) ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center`;
  const detailsRagaBeatClass = compactInDesktop
    ? `${isSelected ? 'flex' : 'hidden'}`
    : `${isSelected ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center`;
  const detailsRefPitchesClass = compactInDesktop
    ? `${isSelected ? 'flex' : 'hidden'}`
    : `${isSelected ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center`;

  // Lyrics section - when expanded (isSelected), both mobile and desktop
  const detailsLyricsClass = isSelected ? 'flex' : 'hidden';

  return (
    <div className={`md:px-2 md:pt-0 md:pb-0 md:mb-0`}>
      {/* Song Name - click to expand lyrics/metadata (hidden when showName=false) */}
      {showName && (
      <div className={`flex items-center min-w-0 ${iconsNextToNameOnDesktop ? 'md:flex-1' : ''}`}>
        {/* On desktop when iconsNextToNameOnDesktop: name + lyrics + preview stay together; name truncates */}
        <div className={`flex items-center gap-[5px] min-w-0 ${iconsNextToNameOnDesktop ? 'md:min-w-0 md:flex-1 md:overflow-hidden' : 'flex-1'}`}>
          {onNameClick ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNameClick();
              }}
              className={`text-left text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate whitespace-nowrap min-w-0 ${iconsNextToNameOnDesktop ? 'md:flex-initial' : 'flex-1'} ${!lyricsHover ? 'w-full' : ''}`}
              {...(nameClickTitle ? { title: nameClickTitle } : {})}
            >
              {song.name}
            </button>
          ) : (
            <span className={`block text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate whitespace-nowrap min-w-0 ${iconsNextToNameOnDesktop ? 'md:flex-initial' : 'flex-1'}`}>
              {song.name}
            </span>
          )}
          {/* Pitch count circle - only show on mobile when there are pitches and user is authenticated */}
          {isAuthenticated && pitchCount !== undefined && (pitchCount ?? 0) > 0 && (
            <div className="flex-shrink-0 md:hidden">
              <div className="w-5 h-5 flex items-center justify-center rounded-full bg-black dark:bg-black text-white text-[9px] font-semibold">
                {pitchCount}
              </div>
            </div>
          )}
          {onPreviewClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewClick();
              }}
              title="Preview song"
              className="flex-shrink-0 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
            >
              <i className="fas fa-eye text-sm md:text-[1.1rem]"></i>
            </button>
          )}
        </div>
      </div>
      )}

      {/* Lyrics - right below song name when expanded */}
      {lyricsHover && (
        <div className={`${detailsLyricsClass} flex-col ${showName ? 'mt-1' : 'mt-0.5'} pb-1 mb-1 border-b border-gray-100 dark:border-gray-700/50`}>
          <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-y-auto max-h-48">
            {lyricsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            ) : lyrics ? (
              lyrics
            ) : (
              <span className="text-gray-500 dark:text-gray-400">No lyrics available</span>
            )}
          </div>
        </div>
      )}

      {/* Deity, Language, and Tempo - Show on mobile when selected or alwaysShowDeityLanguage; on desktop show always unless compactInDesktop (then on hover) */}
      {(song.deity || song.language || song.tempo) && (
        <div className={`${detailsDeityLangClass} text-[10px] text-gray-600 dark:text-gray-400 mt-0`}>
          {song.deity && (
            <>
              <span>
                <span className={(isSelected || alwaysShowDeityLanguage) ? 'hidden md:inline' : ''}>Deity: </span>
                <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded font-medium">{toTitleCase(song.deity)}</span>
              </span>
              {(song.language || song.tempo) && <span className="mx-1">•</span>}
            </>
          )}
          {song.language && (
            <>
              <span>
                <span className={(isSelected || alwaysShowDeityLanguage) ? 'hidden md:inline' : ''}>Language: </span>
                <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-medium">{toTitleCase(song.language)}</span>
              </span>
              {song.tempo && <span className="mx-1">•</span>}
            </>
          )}
          {song.tempo && (
            <span>
              <span className={(isSelected || alwaysShowDeityLanguage) ? 'hidden md:inline' : ''}>Tempo: </span>
              <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded font-medium">{toTitleCase(song.tempo)}</span>
            </span>
          )}
        </div>
      )}

      {/* Raga and Beat - Show on mobile when selected; on desktop show always unless compactInDesktop (then on hover) */}
      {(song.raga || song.beat) && (
        <div className={`${detailsRagaBeatClass} text-[10px] text-gray-600 dark:text-gray-400 mt-0`}>
          {song.raga && (
            <span>
              <span className={isSelected ? 'hidden md:inline' : ''}>Raga: </span>
              {toTitleCase(song.raga)}
            </span>
          )}
          {song.raga && song.beat && <span className="mx-1">•</span>}
          {song.beat && (
            <span>
              <span className={isSelected ? 'hidden md:inline' : ''}>Beat: </span>
              {toTitleCase(song.beat)}
            </span>
          )}
        </div>
      )}

      {/* Reference Pitches - Show on mobile when selected; on desktop show always unless compactInDesktop (then on hover) */}
      {hasReferencePitches && (
        <div className={`${detailsRefPitchesClass} gap-2 text-[10px] text-gray-600 dark:text-gray-400 mt-0`}>
          {song.refGents && (
            <span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">Gents: </span>
              <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.refGents)}</span>
            </span>
          )}
          {song.refLadies && (
            <span>
              <span className="text-pink-600 dark:text-pink-400 font-medium">Ladies: </span>
              <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.refLadies)}</span>
            </span>
          )}
        </div>
      )}

      {/* Audio Player - below metadata when expanded */}
      {isSelected && (song.audioLink || lyricsHover?.song?.audioLink) && (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          <audio
            controls
            preload="none"
            className="w-full max-w-xs dark:invert dark:brightness-90 dark:contrast-90 dark:hue-rotate-180"
            style={{ height: '32px' }}
          >
            <source src={song.audioLink || lyricsHover?.song?.audioLink} />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  );
};

