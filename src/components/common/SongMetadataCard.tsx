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
  const hasReferencePitches = song.referenceGentsPitch || song.referenceLadiesPitch;
  const hasMetadataFields = song.raga || song.beat || song.deity || song.language || song.tempo;

  return (
    <div className="bg-slate-100/80 dark:bg-gray-900/60 px-2 pt-1 pb-1 mb-1.5 rounded-lg">
      {/* Song Name with External Link */}
      <div className="flex items-center gap-2">
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className="text-left text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:underline"
            title={nameClickTitle}
          >
            {song.name}
          </button>
        ) : (
          <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
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

      {/* Deity, Language, and Tempo */}
      {(song.deity || song.language || song.tempo) && (
        <div className="flex flex-wrap items-center text-xs text-gray-600 dark:text-gray-400">
          {song.deity && (
            <span>
              Deity: <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded font-medium">{toTitleCase(song.deity)}</span>
            </span>
          )}
          {song.deity && (song.language || song.tempo) && <span className="mx-2">•</span>}
          {song.language && (
            <span>
              Language: <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-medium">{toTitleCase(song.language)}</span>
            </span>
          )}
          {song.language && song.tempo && <span className="mx-2">•</span>}
          {song.tempo && (
            <span>
              Tempo: <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded font-medium">{toTitleCase(song.tempo)}</span>
            </span>
          )}
        </div>
      )}

      {/* Raga and Beat - on next line */}
      {(song.raga || song.beat) && (
        <div className="flex flex-wrap items-center text-xs text-gray-600 dark:text-gray-400">
          {song.raga && <span>Raga: {toTitleCase(song.raga)}</span>}
          {song.raga && song.beat && <span className="mx-2">•</span>}
          {song.beat && <span>Beat: {toTitleCase(song.beat)}</span>}
        </div>
      )}

      {/* Reference Pitches */}
      {hasReferencePitches && (
        <div className="flex flex-wrap items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Ref:</span>
          {song.referenceGentsPitch && (
            <span className="ml-4">
              <span className="text-blue-600 dark:text-blue-400 font-medium">Gents</span>
              <span className="ml-1 font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.referenceGentsPitch)}</span>
            </span>
          )}
          {song.referenceGentsPitch && song.referenceLadiesPitch && <span className="mx-2">•</span>}
          {song.referenceLadiesPitch && (
            <span className={song.referenceGentsPitch ? '' : 'ml-4'}>
              <span className="text-pink-600 dark:text-pink-400 font-medium">Ladies</span>
              <span className="ml-1 font-medium text-gray-800 dark:text-gray-300">{formatNormalizedPitch(song.referenceLadiesPitch)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

