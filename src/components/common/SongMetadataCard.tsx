import React from 'react';
import { Tooltip } from './index';
import { formatNormalizedPitch } from '../../utils/pitchNormalization';
import { toTitleCase } from '../../utils/textUtils';

export interface SongMetadata {
  name: string;
  externalSourceUrl?: string;
  raga?: string;
  beat?: string;
  deity?: string;
  language?: string;
  tempo?: string;
  referenceGentsPitch?: string;
  referenceLadiesPitch?: string;
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
}

/**
 * Reusable component for displaying song metadata with a darker background.
 * Used in Songs tab, Pitches tab, and Live Session tab.
 */
export const SongMetadataCard: React.FC<SongMetadataCardProps> = ({
  song,
  onNameClick,
  nameClickTitle = 'Click to preview',
  showBackground = true,
  pitchCount,
  isSelected = false,
  alwaysShowDeityLanguage = false,
  onPreviewClick,
}) => {
  const hasReferencePitches = song.referenceGentsPitch || song.referenceLadiesPitch;

  return (
    <div className={`${showBackground ? 'bg-slate-100/80 dark:bg-gray-900/60' : ''} px-1.5 md:px-2 pt-0.5 md:pt-1 pb-0.5 md:pb-1 mb-1 md:mb-1.5 ${showBackground ? 'rounded-lg' : ''}`}>
      {/* Song Name with External Link and Info Button */}
      <div className="flex items-center gap-2">
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className="text-left text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:underline flex-1 min-w-0 truncate whitespace-nowrap"
            title={nameClickTitle}
          >
            {song.name}
          </button>
        ) : (
          <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex-1 min-w-0 truncate whitespace-nowrap">
            {song.name}
          </span>
        )}
        {/* Pitch count circle - only show on mobile when there are pitches */}
        {pitchCount !== undefined && (pitchCount ?? 0) > 0 && (
          <div className="flex-shrink-0 md:hidden">
            <div className="w-6 h-6 flex items-center justify-center rounded-full bg-black dark:bg-black text-white text-xs font-semibold">
              {pitchCount}
            </div>
          </div>
        )}
        {onPreviewClick && (
          <Tooltip content="Preview song">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewClick();
              }}
              className="flex-shrink-0 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
            >
              <i className="fas fa-eye text-base"></i>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Deity, Language, and Tempo - Show on mobile when selected or alwaysShowDeityLanguage is true, always show on desktop */}
      {(song.deity || song.language || song.tempo) && (
        <div className={`${(isSelected || alwaysShowDeityLanguage) ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center text-xs text-gray-600 dark:text-gray-400`}>
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

      {/* Raga and Beat - Show on mobile when selected */}
      {(song.raga || song.beat) && (
        <div className={`${isSelected ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center text-xs text-gray-600 dark:text-gray-400`}>
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

      {/* Reference Pitches - Show on mobile when selected */}
      {hasReferencePitches && (
        <div className={`${isSelected ? 'flex md:flex' : 'hidden md:flex'} flex-wrap items-center text-xs text-gray-600 dark:text-gray-400`}>
          <span className={isSelected ? 'hidden md:inline' : ''}>Ref:</span>
          {song.referenceGentsPitch && (
            <span className={isSelected ? 'ml-0 md:ml-2' : 'ml-2'}>
              <span className={`text-blue-600 dark:text-blue-400 font-medium ${isSelected ? 'hidden md:inline' : ''}`}>Gents </span>
              <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.referenceGentsPitch)}</span>
            </span>
          )}
          {song.referenceGentsPitch && song.referenceLadiesPitch && <span className="mx-1">•</span>}
          {song.referenceLadiesPitch && (
            <span className={song.referenceGentsPitch ? (isSelected ? 'ml-0 md:ml-0' : '') : (isSelected ? 'ml-0 md:ml-2' : 'ml-2')}>
              <span className={`text-pink-600 dark:text-pink-400 font-medium ${isSelected ? 'hidden md:inline' : ''}`}>Ladies </span>
              <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.referenceLadiesPitch)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

