import React, { useState, useRef, useEffect } from 'react';
import { useNamedSessions } from '../../contexts/NamedSessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useSession } from '../../contexts/SessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { NamedSessionForm } from './NamedSessionForm';
import { NamedSessionList } from './NamedSessionList';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { RefreshIcon, type MobileAction } from '../common';
import { ALL_PITCH_OPTIONS, formatPitchWithName } from '../../utils/pitchUtils';
import type { NamedSession, Song, Singer } from '../../types';
import { BaseManager } from './BaseManager';
import { useBaseManager } from '../../hooks/useBaseManager';

interface SessionItemEdit {
  songId: string;
  singerId?: string;
  pitch?: string;
}

interface NamedSessionManagerProps {
  isActive?: boolean;
}

export const NamedSessionManager: React.FC<NamedSessionManagerProps> = ({ isActive = true }) => {
  const {
    sessions,
    currentSession,
    loading,
    loadSessions,
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

  // Use base manager hook for common functionality
  const baseManager = useBaseManager({
    resourceName: 'sessions',
    isActive,
    onDataRefresh: () => loadSessions?.(),
    onEscapeKey: () => {
      if (!showCreateModal && !editingSession && !managingSession) {
        if (baseManager.searchInputRef.current) {
          baseManager.searchInputRef.current.focus();
        }
      }
    },
  });

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
    const success = await deleteSession(id);
    // deleteSession already shows error toast if it fails
    return success;
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

  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Refresh',
      icon: 'fas fa-sync-alt',
      onClick: () => loadSessions(),
      variant: 'secondary' as const,
      disabled: loading,
    },
    ...(canEdit ? [{
      label: 'Create',
      icon: 'fas fa-plus',
      onClick: () => setShowCreateModal(true),
      variant: 'primary' as const,
    }] : []),
  ];

  // Header actions content
  const headerActions = (
    <>
      <div className="relative flex-1 lg:min-w-[300px]">
        <input
          ref={baseManager.searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions..."
          autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <i className="fas fa-search text-base text-gray-400 absolute left-3 top-2.5"></i>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Clear search"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        )}
      </div>
      {/* Desktop action buttons - hidden on mobile */}
      <div className="hidden md:flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
        <button
          type="button"
          onClick={() => loadSessions()}
          disabled={loading}
          title="Reload sessions from the database"
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
        {canEdit && (
          <button
            onClick={() => setShowCreateModal(true)}
            title="Create a new named session to save a set of songs with singers and pitches"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-plus text-lg"></i>
            Create Session
          </button>
        )}
      </div>
    </>
  );

  return (
    <BaseManager
      isActive={isActive}
      isMobile={baseManager.isMobile}
      showScrollToTop={baseManager.showScrollToTop}
      listContainerStyle={baseManager.listContainerStyle}
      listContainerRef={baseManager.listContainerRef}
      headerRef={baseManager.headerRef}
      title="Named Sessions"
      subtitle="Manage saved session configurations"
      helpHref="/help#live"
      headerActions={headerActions}
      headerBelow={!loading && filteredSessions.length > 0 ? (
        <div className={`text-sm text-gray-600 dark:text-gray-400 ${baseManager.isMobile ? '' : 'mt-2'}`}>
          {searchQuery.trim() && filteredSessions.length !== sessions.length
            ? `Showing ${filteredSessions.length} of ${sessions.length} sessions`
            : `${filteredSessions.length} session${filteredSessions.length !== 1 ? 's' : ''}`}
        </div>
      ) : undefined}
      mobileActions={mobileActions}
      onScrollToTop={baseManager.scrollToTop}
      loading={loading}
    >
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
                    title="Move song earlier in the session"
                    className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <i className="fas fa-chevron-up text-base"></i>
                  </button>
                  <button
                    onClick={() => handleMoveItem(index, 'down')}
                    disabled={index === sessionItems.length - 1}
                    title="Move song later in the session"
                    className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <i className="fas fa-chevron-down text-base"></i>
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
                  title="Remove this song from the session"
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  <i className="fas fa-times text-lg"></i>
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
    </BaseManager>
  );
};

