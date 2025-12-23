import React, { useState, useEffect } from 'react';
import type { Song } from '../../types';
import ApiClient from '../../services/ApiClient';

interface SongDetailsProps {
  song: Song;
}

export const SongDetails: React.FC<SongDetailsProps> = ({ song }) => {
  const [fullSong, setFullSong] = useState<Song>(song);
  const [loading, setLoading] = useState(false);

  // Fetch full song data with CLOBs if not already loaded
  useEffect(() => {
    const fetchFullSong = async () => {
      // If lyrics/meaning/tags are already present, no need to fetch
      if (song.lyrics !== null || song.meaning !== null || song.songTags !== null) {
        setFullSong(song);
        return;
      }

      setLoading(true);
      try {
        // Use songService which has proper caching
        const { songService } = await import('../../services');
        const response = await songService.getSongById(song.id);
        if (response) {
          setFullSong(response);
        } else {
          setFullSong(song);
        }
      } catch (error) {
        console.error('Error fetching full song details:', error);
        // Fall back to the original song data
        setFullSong(song);
      } finally {
        setLoading(false);
      }
    };

    fetchFullSong();
  }, [song]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading song details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Name</div>
        <div>{fullSong.name}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">External Source URL</div>
        <div className="break-all">{fullSong.externalSourceUrl}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Language</div>
          <div>{fullSong.language || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Deity</div>
          <div>{fullSong.deity || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Tempo</div>
          <div>{fullSong.tempo || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Beat</div>
          <div>{fullSong.beat || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Raga</div>
          <div>{fullSong.raga || '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Level</div>
          <div>{fullSong.level || '—'}</div>
        </div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Tags</div>
        <div>{fullSong.songTags || '—'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Audio Link</div>
        <div className="break-all">{fullSong.audioLink || '—'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Video Link</div>
        <div className="break-all">{fullSong.videoLink || '—'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Golden Voice</div>
        <div>{fullSong.goldenVoice ? 'Yes' : 'No'}</div>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Lyrics</div>
        <pre className="mt-1 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/40 p-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
          {fullSong.lyrics || '—'}
        </pre>
      </div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">Meaning / Translation</div>
        <pre className="mt-1 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/40 p-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
          {fullSong.meaning || '—'}
        </pre>
      </div>
    </div>
  );
};


