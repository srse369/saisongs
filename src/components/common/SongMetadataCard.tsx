import React from 'react';
import { Tooltip } from './Tooltip';
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
}

/**
 * Reusable component for displaying song metadata with a darker background.
 * Used in Songs tab, Pitches tab, and Live Session tab.
 */
export const SongMetadataCard: React.FC<SongMetadataCardProps> = ({
  song,
  onNameClick,
  nameClickTitle = 'Click to preview',
}) => {
  const hasRagaOrBeat = song.raga || song.beat;
  const hasBadges = song.deity || song.language || song.tempo;
  const hasReferencePitches = song.referenceGentsPitch || song.referenceLadiesPitch;

  return (
    <div className="bg-slate-100/80 dark:bg-gray-900/60 px-4 pt-1 pb-2 mb-3 rounded-lg">
      {/* Song Name with External Link */}
      <div className="flex items-center gap-2">
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className="text-left text-base sm:text-lg font-semibold text-blue-700 dark:text-blue-300 hover:underline"
            title={nameClickTitle}
          >
            {song.name}
          </button>
        ) : (
          <span className="text-base sm:text-lg font-semibold text-blue-700 dark:text-blue-300">
            {song.name}
          </span>
        )}
        {song.externalSourceUrl && (
          <Tooltip content="View song on external source (YouTube, etc.)">
            <a
              href={song.externalSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="fas fa-external-link-alt text-base"></i>
            </a>
          </Tooltip>
        )}
      </div>

      {/* Raga and Beat */}
      {hasRagaOrBeat && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {song.raga && <span>Raga: {toTitleCase(song.raga)}</span>}
          {song.raga && song.beat && <span className="mx-2">•</span>}
          {song.beat && <span>Beat: {toTitleCase(song.beat)}</span>}
        </p>
      )}

      {/* Deity, Language, and Tempo badges */}
      {hasBadges && (
        <div className="flex flex-wrap gap-2 text-xs">
          {song.deity && (
            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded font-medium">
              {toTitleCase(song.deity)}
            </span>
          )}
          {song.language && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded font-medium">
              {toTitleCase(song.language)}
            </span>
          )}
          {song.tempo && (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded font-medium">
              {toTitleCase(song.tempo)}
            </span>
          )}
        </div>
      )}

      {/* Reference Pitches */}
      {hasReferencePitches && (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <span className="text-gray-700 dark:text-gray-500">Ref: </span>
          {song.referenceGentsPitch && (
            <span>
              Gents <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.referenceGentsPitch)}</span>
            </span>
          )}
          {song.referenceGentsPitch && song.referenceLadiesPitch && <span className="mx-1">/</span>}
          {song.referenceLadiesPitch && (
            <span>
              Ladies <span className="font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.referenceLadiesPitch)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

