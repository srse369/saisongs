import React from 'react';
import { formatNormalizedPitch } from '../../utils/pitchNormalization';
import { toTitleCase } from '../../utils/textUtils';
import { LyricsHoverPopup } from './LyricsHoverPopup';
import type { Song } from '../../types';

export interface SongMetadata {
  name: string;
  externalSourceUrl?: string;
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
  /** When provided, song name shows lyrics popup on 3s hover */
  lyricsHover?: { songId: string; songName: string; song?: Song | null };
  /** When true (desktop only): show only song name; details expand on hover */
  compactInDesktop?: boolean;
  /** When true (desktop only): keep lyrics and preview icons immediately after song name */
  iconsNextToNameOnDesktop?: boolean;
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
}) => {
  const hasReferencePitches = song.refGents || song.refLadies;

  // Show background on desktop always, or on mobile when selected
  const shouldShowBackground = showBackground || isSelected;

  // When compactInDesktop: details never expand on song hover; show only on mobile when selected or via song name hover popup
  const detailsDeityLangClass = compactInDesktop
    ? `${(isSelected || alwaysShowDeityLanguage) ? 'flex' : 'hidden'} md:hidden`
    : `${(isSelected || alwaysShowDeityLanguage) ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center`;
  const detailsRagaBeatClass = compactInDesktop
    ? `${isSelected ? 'flex' : 'hidden'} md:hidden`
    : `${isSelected ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center`;
  const detailsRefPitchesClass = compactInDesktop
    ? `${isSelected ? 'flex' : 'hidden'} md:hidden`
    : `${isSelected ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center`;
  
  return (
    <div className={`md:px-2 md:pt-0 md:pb-0 md:mb-0`}>
      {/* Song Name - hover shows metadata/lyrics popup when lyricsHover provided */}
      <div className={`flex items-center min-w-0 ${iconsNextToNameOnDesktop ? 'md:flex-1' : ''}`}>
        {/* On desktop when iconsNextToNameOnDesktop: name + lyrics + preview stay together; name truncates */}
        <div className={`flex items-center gap-[5px] min-w-0 ${iconsNextToNameOnDesktop ? 'md:min-w-0 md:flex-1 md:overflow-hidden' : 'flex-1'}`}>
          {lyricsHover ? (
            <LyricsHoverPopup
              songId={lyricsHover.songId}
              songName={lyricsHover.songName}
              song={lyricsHover.song}
              className={`min-w-0 overflow-hidden ${iconsNextToNameOnDesktop ? 'md:flex-initial' : 'flex-1'}`}
            >
              {onNameClick ? (
                <button
                  type="button"
                  onClick={onNameClick}
                  className="text-left text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate whitespace-nowrap min-w-0 w-full"
                  {...(nameClickTitle ? { title: nameClickTitle } : {})}
                >
                  {song.name}
                </button>
              ) : (
                <span className="block text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate whitespace-nowrap min-w-0">
                  {song.name}
                </span>
              )}
            </LyricsHoverPopup>
          ) : (
            <>
              {onNameClick ? (
                <button
                  type="button"
                  onClick={onNameClick}
                  className={`text-left text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate whitespace-nowrap min-w-0 ${iconsNextToNameOnDesktop ? 'md:flex-initial' : 'flex-1'}`}
                  {...(nameClickTitle ? { title: nameClickTitle } : {})}
                >
                  {song.name}
                </button>
              ) : (
                <span className={`text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate whitespace-nowrap min-w-0 ${iconsNextToNameOnDesktop ? 'md:flex-initial' : 'flex-1'}`}>
                  {song.name}
                </span>
              )}
            </>
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
              <i className="fas fa-eye text-sm"></i>
            </button>
          )}
        </div>
      </div>

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
    </div>
  );
};

