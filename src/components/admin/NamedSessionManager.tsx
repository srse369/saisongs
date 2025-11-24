import React, { useState } from 'react';
import { useNamedSessions } from '../../contexts/NamedSessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useSession } from '../../contexts/SessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { NamedSessionForm } from './NamedSessionForm';
import { NamedSessionList } from './NamedSessionList';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { SearchBar } from '../common/SearchBar';
import { ALL_PITCH_OPTIONS, formatPitchWithName } from '../../utils/pitchUtils';
import type { NamedSession, Song, Singer } from '../../types';

interface SessionItemEdit {
  songId: string;
  singerId?: string;
  pitch?: string;
}

export const NamedSessionManager: React.FC = () => {
  const {
    sessions,
    currentSession,
    loading,
    createSession,
    updateSession,
    deleteSession,
    duplicateSession,
    loadSession,
    setSessionItems,
    clearCurrentSession,
  } = useNamedSessions();

  const { songs } = useSongs();
  const { singers } = useSingers();
  const { setSessionSongs } = useSession();
  const { userRole } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSession, setEditingSession] = useState<NamedSession | null>(null);
  const [managingSession, setManagingSession] = useState<NamedSession | null>(null);
  const [sessionItems, setLocalSessionItems] = useState<SessionItemEdit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor and admin can create/modify sessions
  const canEdit = userRole === 'editor' || userRole === 'admin';

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (session.description && session.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreate = async (data: any) => {
    const result = await createSession(data);
    if (result) {
      setShowCreateModal(false);
    }
  };

  const handleUpdate = async (data: any) => {
    if (editingSession) {
      const result = await updateSession(editingSession.id, data);
      if (result) {
        setEditingSession(null);
      }
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
  };

  const handleDuplicate = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    const newName = window.prompt(`Enter name for duplicated session:`, `${session.name} (Copy)`);
    if (newName && newName.trim()) {
      await duplicateSession(id, newName);
    }
  };

  const handleManageItems = async (session: NamedSession) => {
    setManagingSession(session);
    await loadSession(session.id);
    if (currentSession && currentSession.id === session.id) {
      setLocalSessionItems(
        currentSession.items.map(item => ({
          songId: item.songId,
          singerId: item.singerId,
          pitch: item.pitch,
        }))
      );
    }
  };

  const handleLoadSession = async (session: NamedSession) => {
    await loadSession(session.id);
    if (currentSession && currentSession.id === session.id) {
      // Load into the active session context
      const sessionSongs = currentSession.items.map(item => ({
        songId: item.songId,
        singerName: item.singerName,
        pitch: item.pitch,
      }));
      setSessionSongs(sessionSongs);
      alert(`Session "${session.name}" loaded successfully!`);
    }
  };

  const handleAddSongToSession = () => {
    setLocalSessionItems([...sessionItems, { songId: '', singerId: undefined, pitch: undefined }]);
  };

  const handleRemoveSongFromSession = (index: number) => {
    setLocalSessionItems(sessionItems.filter((_, i) => i !== index));
  };

  const handleUpdateSessionItem = (index: number, field: keyof SessionItemEdit, value: any) => {
    const updated = [...sessionItems];
    updated[index] = { ...updated[index], [field]: value };
    setLocalSessionItems(updated);
  };

  const handleSaveSessionItems = async () => {
    if (!managingSession) return;

    const validItems = sessionItems.filter(item => item.songId);
    const result = await setSessionItems(managingSession.id, validItems);
    if (result) {
      setManagingSession(null);
      clearCurrentSession();
    }
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === sessionItems.length - 1)
    ) {
      return;
    }

    const newItems = [...sessionItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setLocalSessionItems(newItems);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col gap-4 mb-4 sm:mb-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-1">
              Named Sessions
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Manage saved session configurations
            </p>
          </div>

          {/* Search and buttons */}
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <div className="relative flex-1 lg:min-w-[300px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sessions..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M9.5 17a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                />
              </svg>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
              {canEdit && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && !currentSession && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {/* Sessions list */}
      {!loading && (
        <NamedSessionList
          sessions={filteredSessions}
          onEdit={setEditingSession}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onManageItems={handleManageItems}
          onLoadSession={handleLoadSession}
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Session"
      >
        <NamedSessionForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        title="Edit Session"
      >
        {editingSession && (
          <NamedSessionForm
            session={editingSession}
            onSubmit={handleUpdate}
            onCancel={() => setEditingSession(null)}
          />
        )}
      </Modal>

      {/* Manage Items Modal */}
      <Modal
        isOpen={!!managingSession}
        onClose={() => {
          setManagingSession(null);
          clearCurrentSession();
        }}
        title={`Manage Songs - ${managingSession?.name || ''}`}
        size="large"
      >
        <div className="space-y-4">
          {/* Items list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sessionItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-md">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveItem(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveItem(index, 'down')}
                    disabled={index === sessionItems.length - 1}
                    className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={item.songId}
                    onChange={(e) => handleUpdateSessionItem(index, 'songId', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select song...</option>
                    {songs.map((song) => (
                      <option key={song.id} value={song.id}>
                        {song.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={item.singerId || ''}
                    onChange={(e) =>
                      handleUpdateSessionItem(index, 'singerId', e.target.value || undefined)
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No singer</option>
                    {singers.map((singer) => (
                      <option key={singer.id} value={singer.id}>
                        {singer.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={item.pitch || ''}
                    onChange={(e) => handleUpdateSessionItem(index, 'pitch', e.target.value || undefined)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No pitch</option>
                    {ALL_PITCH_OPTIONS.map((pitch) => (
                      <option key={pitch} value={pitch}>
                        {formatPitchWithName(pitch)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleRemoveSongFromSession(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={handleAddSongToSession}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
          >
            + Add Song
          </button>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button
              onClick={() => {
                setManagingSession(null);
                clearCurrentSession();
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSessionItems}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Save Songs
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

