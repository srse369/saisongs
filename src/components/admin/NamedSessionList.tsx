import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { NamedSession } from '../../types';

interface NamedSessionListProps {
  sessions: NamedSession[];
  onEdit: (session: NamedSession) => void;
  onDelete: (id: string) => void;
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
        await onDelete(id);
      } finally {
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
              <button
                onClick={() => onLoadSession(session)}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                title="Load session"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              {canEdit && (
                <>
                  <button
                    onClick={() => onManageItems(session)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                    title="Manage songs"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>

                  <button
                    onClick={() => onEdit(session)}
                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    title="Edit session"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDuplicate(session.id, session.name)}
                    className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                    title="Duplicate session"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDelete(session.id, session.name)}
                    disabled={deletingId === session.id}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                    title="Delete session"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

