import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { getPendingCount } from '../utils/offlineQueue';
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

  const onSyncComplete = useCallback(
    (synced: number, failed: number) => {
      if (synced > 0) {
        toast.success(`Synced ${synced} offline change${synced > 1 ? 's' : ''} to server`);
      }
      if (failed > 0) {
        toast.error(`Failed to sync ${failed} change${failed > 1 ? 's' : ''}. Will retry when online.`);
      }
    },
    [toast]
  );

  useEffect(() => {
    const handleOnline = () => {
      if (getPendingCount() > 0) {
        setShowSyncModal(true);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);


  return (
    <OfflineSyncContext.Provider
      value={{
        showSyncModal,
        setShowSyncModal,
        pendingCount: getPendingCount(),
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
