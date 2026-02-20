import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import {
  getOfflineQueue,
  checkOfflineQueueConflicts,
  processOfflineQueue,
  clearOfflineQueue,
  type QueuedOperation,
  type OfflineSyncConflict,
} from '../../utils/offlineQueue';
import { fetchDeletedAndCleanCache } from '../../utils/offlineDownload';
import { useToast } from '../../contexts/ToastContext';

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: (synced: number, failed: number) => void;
}


/** Build tempId -> display name from queue (for entities created in same sync batch) */
function buildTempIdMap(queue: QueuedOperation[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const op of queue) {
    if (op.type === 'create' && op.tempId) {
      const name = (op.payload.name as string) || op.displayLabel?.replace(/^(Song|Singer|Session):\s*/, '') || op.tempId;
      map.set(op.tempId, name);
    }
  }
  return map;
}

/** Resolve ID to display name from queue tempIdMap only (sync). Cache resolution is async - use op.displayLabel when available. */
function resolveDisplayNameFromQueue(id: string, tempIdMap?: Map<string, string>): string {
  if (!id) return '—';
  if (tempIdMap?.has(id)) return tempIdMap.get(id)!;
  return id;
}

const TYPE_LABELS_LOWER: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
};

/** Format operation for display: Song/Singer/Pitch/Session with name and type. Prefers op.displayLabel (set when queuing). */
function formatOpDisplayLabel(op: QueuedOperation, queue: QueuedOperation[]): string {
  const p = op.payload;
  const typeLabel = TYPE_LABELS_LOWER[op.type] || op.type;

  if (op.entity === 'song') {
    const name = (p.name as string) || op.displayLabel?.replace(/^Song:\s*/, '') || 'Unknown song';
    return `Song: ${name} (${typeLabel})`;
  }
  if (op.entity === 'singer') {
    const name = (p.name as string) || op.displayLabel?.replace(/^Singer:\s*/, '') || 'Unknown singer';
    return `Singer: ${name} (${typeLabel})`;
  }
  if (op.entity === 'pitch') {
    // Prefer names in payload (set when queuing), else tempIdMap from queue, else placeholder
    let songName = p.songName as string | undefined;
    let singerName = p.singerName as string | undefined;
    if (!songName || !singerName) {
      const tempIdMap = buildTempIdMap(queue);
      const songId = p.songId as string;
      const singerId = p.singerId as string;
      songName = songName ?? (songId ? resolveDisplayNameFromQueue(songId, tempIdMap) : '—');
      singerName = singerName ?? (singerId ? resolveDisplayNameFromQueue(singerId, tempIdMap) : '—');
    }
    const pitch = (p.pitch as string) || '—';
    return `${songName || '—'} / ${singerName || '—'} / ${pitch} (${typeLabel})`;
  }
  if (op.entity === 'session') {
    const name = (p.name as string) || op.displayLabel?.replace(/^Session(?: items)?:\s*/, '') || 'Unknown session';
    const items = p.items as Array<unknown> | undefined;
    const count = Array.isArray(items) ? items.length : 0;
    return `${name} – ${count} song${count !== 1 ? 's' : ''} (${typeLabel})`;
  }
  return op.displayLabel || `${op.entity} (${typeLabel})`;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const toast = useToast();
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [conflicts, setConflicts] = useState<OfflineSyncConflict[]>([]);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQueue(getOfflineQueue());
      setLoadingConflicts(true);
      checkOfflineQueueConflicts()
        .then(setConflicts)
        .catch(() => setConflicts([]))
        .finally(() => setLoadingConflicts(false));
    }
  }, [isOpen]);

  const conflictOpIds = new Set(conflicts.map((c) => c.opId));

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { synced, failed } = await processOfflineQueue();
      onSyncComplete(synced, failed);
      setQueue(getOfflineQueue());
      setConflicts([]);
      if (synced > 0 || failed > 0) {
        onClose();
      }
      // Clean cache of entities deleted on server since last offline download
      fetchDeletedAndCleanCache().catch(() => {});
    } catch (err) {
      console.error('Offline sync error:', err);
      onSyncComplete(0, queue.length);
    } finally {
      setSyncing(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDropQueue = () => {
    if (!window.confirm(`Discard all ${queue.length} pending change${queue.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }
    clearOfflineQueue();
    setQueue([]);
    setConflicts([]);
    toast.success('Offline changes discarded');
    onSyncComplete(0, 0);
    onClose();
  };

  const hasConflicts = conflicts.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Sync offline changes"
      size="large"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You have {queue.length} pending change{queue.length !== 1 ? 's' : ''} from when you were offline.
          Review the summary below and confirm to sync to the server.
        </p>

        {/* Pending changes list */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
            <h3 className="font-medium text-gray-900 dark:text-white">Pending changes</h3>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-600 max-h-64 overflow-y-auto">
            {queue.map((op) => {
              const isConflict = conflictOpIds.has(op.id);
              const label = formatOpDisplayLabel(op, queue);
              return (
                <li
                  key={op.id}
                  className={`flex items-center justify-between px-4 py-2 text-sm ${
                    isConflict ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                  }`}
                >
                  <span className="text-gray-900 dark:text-gray-100 min-w-0">{label}</span>
                  {isConflict && (
                    <span className="text-amber-600 dark:text-amber-400 text-xs font-medium shrink-0 ml-2">
                      Potential conflict
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Conflicts section */}
        {loadingConflicts && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <i className="fas fa-spinner fa-spin"></i>
            Checking for conflicts...
          </div>
        )}
        {!loadingConflicts && hasConflicts && (
          <div className="border border-amber-300 dark:border-amber-600 rounded-lg overflow-hidden bg-amber-50 dark:bg-amber-900/20">
            <div className="px-4 py-2 border-b border-amber-200 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/40">
              <h3 className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i>
                Potential conflicts ({conflicts.length})
              </h3>
            </div>
            <ul className="divide-y divide-amber-200 dark:divide-amber-700 max-h-32 overflow-y-auto">
              {conflicts.map((c) => (
                <li key={c.opId} className="px-4 py-2 text-sm">
                  <span className="text-amber-900 dark:text-amber-100">{c.displayLabel}</span>
                  <span className="block text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    {c.reason === 'modified_on_server'
                      ? 'Modified on server since you made changes offline. Your changes may overwrite server data.'
                      : 'Deleted on server. Sync may fail.'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-2">
          <button
            onClick={handleDropQueue}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Discard all pending changes without syncing"
          >
            <i className="fas fa-trash-alt mr-1.5"></i>
            Discard all
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Sync later
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Syncing...
                </>
              ) : (
                <>
                  <i className="fas fa-cloud-upload-alt"></i>
                  Sync now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
