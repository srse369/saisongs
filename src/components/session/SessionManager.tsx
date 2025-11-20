import React, { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useNamedSessions } from '../../contexts/NamedSessionContext';
import { useNavigate } from 'react-router-dom';
import type { Song } from '../../types';
import { Modal } from '../common/Modal';
import { SongDetails } from '../admin/SongDetails';
import { formatPitch } from '../../utils/pitchUtils';

export const SessionManager: React.FC = () => {
  const { entries, removeSong, clearSession, reorderSession, addSong } = useSession();
  const { songs } = useSongs();
  const { singers } = useSingers();
  const { sessions, createSession, setSessionItems, loadSession, currentSession, loadSessions, loading } = useNamedSessions();
  const navigate = useNavigate();

  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionToLoad, setSessionToLoad] = useState<string | null>(null);

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

  const handleSaveSession = async () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }

    setSaving(true);
    try {
      // Create the named session
      const newSession = await createSession({
        name: sessionName.trim(),
        description: sessionDescription.trim() || undefined,
      });

      if (!newSession) {
        return;
      }

      // Prepare session items from current session entries
      const items = sessionItems.map(({ entry, singer }) => ({
        songId: entry.songId,
        singerId: singer?.id,
        pitch: entry.pitch,
      }));

      // Save the items to the session
      await setSessionItems(newSession.id, items);

      // Reset form and close modal
      setSessionName('');
      setSessionDescription('');
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error saving session:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    setLoadingSession(true);
    setSessionToLoad(sessionId);
    try {
      await loadSession(sessionId);
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Failed to load session. Please try again.');
      setLoadingSession(false);
      setSessionToLoad(null);
    }
  };

  const handleRefreshSessions = async () => {
    try {
      await loadSessions();
    } catch (error) {
      console.error('Error refreshing sessions:', error);
    }
  };

  // Effect to handle loading session items into live session
  useEffect(() => {
    if (sessionToLoad && currentSession && currentSession.id === sessionToLoad && currentSession.items) {
      // Clear existing session first
      clearSession();
      
      // Load songs into the active session context
      currentSession.items.forEach(item => {
        const singer = singers.find(s => s.id === item.singerId);
        addSong(item.songId, singer?.id, item.pitch);
      });
      
      setShowLoadModal(false);
      setLoadingSession(false);
      setSessionToLoad(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToLoad, currentSession]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
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
          <button
            type="button"
            onClick={() => setShowLoadModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
          >
            Load Session
          </button>
          {sessionItems.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Save Session
              </button>
              <button
                type="button"
                onClick={clearSession}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Clear Session
              </button>
            </>
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
          <table className="responsive-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
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
                  <td data-label="#" className="px-3 py-4 w-10 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                    {index + 1}
                  </td>
                  <td data-label="Song" className="px-6 py-4 whitespace-nowrap">
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
                  <td data-label="Singer" className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {singer ? singer.name : '—'}
                    </div>
                  </td>
                  <td data-label="Pitch" className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {entry.pitch ? (
                        <>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{formatPitch(entry.pitch)}</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-2">({entry.pitch.replace('#', '♯')})</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                  </td>
                  <td data-label="Details" className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 align-top">
                    <div className="space-y-1">
                      <div>Deity: {song.deity || '—'}</div>
                      <div>Raga: {song.raga || '—'}</div>
                      <div>Tempo: {song.tempo || '—'}</div>
                    </div>
                  </td>
                  <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="inline-flex items-center p-2 rounded-md text-gray-500 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-move transition-colors"
                        title="Drag to reorder"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handlePresentSingle(song.id)}
                        title="Present"
                        className="inline-flex items-center p-2 rounded-md text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeSong(entry.songId)}
                        title="Remove"
                        className="inline-flex items-center p-2 rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
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

      {/* Save Session Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setSessionName('');
          setSessionDescription('');
        }}
        title="Save Session"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Save the current session ({sessionItems.length} {sessionItems.length === 1 ? 'song' : 'songs'}) 
            as a named session for easy reuse later.
          </p>

          <div>
            <label htmlFor="session-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Name *
            </label>
            <input
              id="session-name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Sunday Bhajans, Festival Songs"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={saving}
            />
          </div>

          <div>
            <label htmlFor="session-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              id="session-description"
              value={sessionDescription}
              onChange={(e) => setSessionDescription(e.target.value)}
              placeholder="Add notes about this session..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={saving}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={() => {
                setShowSaveModal(false);
                setSessionName('');
                setSessionDescription('');
              }}
              disabled={saving}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={saving || !sessionName.trim()}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Load Session Modal */}
      <Modal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        title="Load Session"
        titleActions={
          <button
            onClick={handleRefreshSessions}
            disabled={loading}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            title="Refresh sessions"
            aria-label="Refresh sessions"
          >
            <svg
              className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select a saved session to load into your current live session. This will replace any songs currently in the live session.
          </p>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No saved sessions found. Save your current session to create one.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleLoadSession(session.id)}
                  disabled={loadingSession}
                  className="w-full text-left p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {session.name}
                  </div>
                  {session.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {session.description}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Last saved: {new Date(session.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-600">
            <button
              type="button"
              onClick={() => setShowLoadModal(false)}
              disabled={loadingSession}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {loadingSession ? 'Loading...' : 'Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};


