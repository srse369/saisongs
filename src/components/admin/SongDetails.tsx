import React from 'react';
import type { Song } from '../../types';

interface SongDetailsProps {
  song: Song;
}

export const SongDetails: React.FC<SongDetailsProps> = ({ song }) => {
  return (
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Name</div>
        <div>{song.name}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Sairhythms URL</div>
        <div className="break-all">{song.sairhythmsUrl}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Title</div>
          <div>{song.title || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Title 2</div>
          <div>{song.title2 || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Language</div>
          <div>{song.language || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Deity</div>
          <div>{song.deity || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Tempo</div>
          <div>{song.tempo || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Beat</div>
          <div>{song.beat || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Raga</div>
          <div>{song.raga || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Level</div>
          <div>{song.level || '—'}</div>
        </div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Tags</div>
        <div>{song.songTags || '—'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Audio Link</div>
        <div className="break-all">{song.audioLink || '—'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Video Link</div>
        <div className="break-all">{song.videoLink || '—'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">ULink</div>
        <div className="break-all">{song.ulink || '—'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Golden Voice</div>
        <div>{song.goldenVoice ? 'Yes' : 'No'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Lyrics</div>
        <pre className="mt-1 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/40 p-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
          {song.lyrics || '—'}
        </pre>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Meaning / Translation</div>
        <pre className="mt-1 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/40 p-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
          {song.meaning || '—'}
        </pre>
      </div>
    </div>
  );
};


