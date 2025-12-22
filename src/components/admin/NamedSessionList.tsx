import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Tooltip } from '../common';
import type { NamedSession } from '../../types';

interface NamedSessionListProps {
  sessions: NamedSession[];
  onEdit: (session: NamedSession) => void;
  onDelete: (id: string) => Promise<boolean>;
  onDuplicate: (id: string) => void;
  onManageItems: (session: NamedSession) => void;
  onLoadSession: (session: NamedSession) => void;
}

export const NamedSessionList: React.FC<NamedSessionListProps> = ({
  sessions,
  onEdit,
  onDelete,
  onDuplicate,
  onManageItems,
  onLoadSession,
}) => {
  const { userRole } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Editor and admin can modify sessions
  const canEdit = userRole === 'editor' || userRole === 'admin';

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete session "${name}"?`)) {
      setDeletingId(id);
      try {
        const success = await onDelete(id);
        // Only clear deleting state if successful
        // Error toast is already shown by the context
        if (success) {
          setDeletingId(null);
        } else {
          setDeletingId(null);
        }
      } catch (error) {
        setDeletingId(null);
      }
    }
  };

  const handleDuplicate = async (id: string, name: string) => {
    const newName = window.prompt(`Enter name for duplicated session:`, `${name} (Copy)`);
    if (newName && newName.trim()) {
      await onDuplicate(id);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No sessions found. Create your first session to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {session.name}
              </h3>
              {session.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {session.description}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Created: {new Date(session.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex gap-2 ml-4">
              <Tooltip content="Load this session into the live session for playback">
                <button
                  onClick={() => onLoadSession(session)}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                >
                  <i className="fas fa-arrow-right text-lg"></i>
                </button>
              </Tooltip>

              {canEdit && (
                <>
                  <Tooltip content="Add, remove, or reorder songs in this session">
                    <button
                      onClick={() => onManageItems(session)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                    >
                      <i className="fas fa-clipboard-list text-lg"></i>
                    </button>
                  </Tooltip>

                  <Tooltip content="Edit session name and description">
                    <button
                      onClick={() => onEdit(session)}
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <i className="fas fa-edit text-lg"></i>
                    </button>
                  </Tooltip>

                  <Tooltip content="Create a copy of this session with a new name">
                    <button
                      onClick={() => handleDuplicate(session.id, session.name)}
                      className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                    >
                      <i className="fas fa-copy text-lg"></i>
                    </button>
                  </Tooltip>

                  <Tooltip content="Delete this session permanently">
                    <button
                      onClick={() => handleDelete(session.id, session.name)}
                      disabled={deletingId === session.id}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                    >
                      <i className="fas fa-trash text-lg"></i>
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

