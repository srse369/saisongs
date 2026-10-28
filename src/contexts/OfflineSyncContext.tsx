import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { getPendingCount, OFFLINE_QUEUE_CHANGED_EVENT } from '../utils/offlineQueue';
import { useToast } from './ToastContext';

interface OfflineSyncContextType {
  showSyncModal: boolean;
  setShowSyncModal: (show: boolean) => void;
  pendingCount: number;
  onSyncComplete: (synced: number, failed: number) => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => getPendingCount());

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getPendingCount());
  }, []);

  const onSyncComplete = useCallback(
    (synced: number, failed: number) => {
      refreshPendingCount();
      if (synced > 0) {
        toast.success(`Synced ${synced} offline change${synced > 1 ? 's' : ''} to server`);
      }
      if (failed > 0) {
        toast.error(`Failed to sync ${failed} change${failed > 1 ? 's' : ''}. Will retry when online.`);
      }
    },
    [toast, refreshPendingCount]
  );

  useEffect(() => {
    const handleOnline = () => {
      refreshPendingCount();
      if (getPendingCount() > 0) {
        setShowSyncModal(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshPendingCount);
    // Cross-tab queue updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'saiSongs:offlineQueue') refreshPendingCount();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshPendingCount);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshPendingCount]);

  return (
    <OfflineSyncContext.Provider
      value={{
        showSyncModal,
        setShowSyncModal,
        pendingCount,
        onSyncComplete,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSyncContext = (): OfflineSyncContextType => {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    return {
      showSyncModal: false,
      setShowSyncModal: () => {},
      pendingCount: 0,
      onSyncComplete: () => {},
    };
  }
  return ctx;
};
