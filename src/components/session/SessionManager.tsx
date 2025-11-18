import React, { useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useNavigate } from 'react-router-dom';
import type { Song } from '../../types';
import { Modal } from '../common/Modal';
import { SongDetails } from '../admin/SongDetails';

export const SessionManager: React.FC = () => {
  const { entries, removeSong, clearSession, reorderSession } = useSession();
  const { songs } = useSongs();
  const { singers } = useSingers();
  const navigate = useNavigate();

  const [viewingSong, setViewingSong] = useState<Song | null>(null);

  const sessionItems = entries
    .map((entry) => {
      const song = songs.find((s) => s.id === entry.songId);
      if (!song) return null;
      const singer = entry.singerId ? singers.find((si) => si.id === entry.singerId) : undefined;
      return { entry, song, singer };
    })
    .filter(
      (item): item is { entry: (typeof entries)[number]; song: (typeof songs)[number]; singer?: (typeof singers)[number] } =>
        Boolean(item),
    );

  const handlePresentSession = () => {
    if (sessionItems.length === 0) return;
    navigate('/session/present');
  };

  const handlePresentSingle = (songId: string) => {
    const item = sessionItems.find(({ entry }) => entry.songId === songId);
    if (!item) {
      navigate(`/presentation/${songId}`);
      return;
    }

    const params = new URLSearchParams();
    if (item.singer?.name) {
      params.set('singerName', item.singer.name);
    }
    if (item.entry.pitch) {
      params.set('pitch', item.entry.pitch);
    }
    const query = params.toString();
    navigate(`/presentation/${songId}${query ? `?${query}` : ''}`);
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, fromIndex: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(fromIndex));
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, toIndex: number) => {
    e.preventDefault();
    const fromIndexRaw = e.dataTransfer.getData('text/plain');
    const fromIndex = parseInt(fromIndexRaw, 10);
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) {
      return;
    }

    const order = sessionItems.map(({ entry }) => entry.songId);
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    reorderSession(order);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Session</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Build a set of songs to present together. Add songs from the Songs or Pitches tabs, then
            present them as a continuous slideshow.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <button
            type="button"
            onClick={handlePresentSession}
            disabled={sessionItems.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Present Session
          </button>
          {sessionItems.length > 0 && (
            <button
              type="button"
              onClick={clearSession}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Clear Session
            </button>
          )}
        </div>
      </div>

      {sessionItems.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            No songs in the session yet. Use the <span className="font-semibold">Add to Session</span>{' '}
            buttons in the Songs or Pitches tabs to build your set list.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 py-3 w-10 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Song
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Singer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Pitch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sessionItems.map(({ entry, song, singer }, index) => (
                <tr
                  key={`${entry.songId}-${entry.singerId ?? 'none'}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <td className="px-3 py-4 w-10 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setViewingSong(song)}
                      className="text-left text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
                    >
                      {song.name}
                    </button>
                    {song.language && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {song.language}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {singer ? singer.name : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {entry.pitch ?? '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 align-top">
                    <div className="space-y-1">
                      <div>Deity: {song.deity || '—'}</div>
                      <div>Raga: {song.raga || '—'}</div>
                      <div>Tempo: {song.tempo || '—'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex flex-col items-end gap-2">
                      <button
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-move"
                        title="Drag to reorder"
                      >
                        ☰
                      </button>
                      <button
                        onClick={() => handlePresentSingle(song.id)}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-emerald-600 bg-emerald-50 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        Present
                      </button>
                      <button
                        onClick={() => removeSong(entry.songId)}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewingSong && (
        <Modal
          isOpen={!!viewingSong}
          onClose={() => setViewingSong(null)}
          title="Song Details"
        >
          <SongDetails song={viewingSong} />
        </Modal>
      )}
    </div>
  );
};


