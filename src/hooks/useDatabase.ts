import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../services/ApiClient';
import { useToast } from '../contexts/ToastContext';

interface UseDatabaseReturn {
  isConnected: boolean;
  isChecking: boolean;
  connectionError: string | null;
  checkConnection: () => Promise<void>;
  resetConnection: () => Promise<void>;
}

// Cache health check result for 5 seconds to avoid excessive calls
let lastHealthCheck: { timestamp: number; result: boolean } | null = null;
const HEALTH_CHECK_CACHE_MS = 5000;

/**
 * Hook to manage API backend connection state and health checks
 */
export const useDatabase = (): UseDatabaseReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const toast = useToast();
  const hasCheckedRef = useRef(false);

  const checkConnection = useCallback(async () => {
    // Use cached result if available and recent
    if (lastHealthCheck && Date.now() - lastHealthCheck.timestamp < HEALTH_CHECK_CACHE_MS) {
      setIsConnected(lastHealthCheck.result);
      return;
    }

    setIsChecking(true);
    setConnectionError(null);
    
    try {
      await apiClient.healthCheck();
      setIsConnected(true);
      lastHealthCheck = { timestamp: Date.now(), result: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to backend API';
      setConnectionError(errorMessage);
      setIsConnected(false);
      lastHealthCheck = { timestamp: Date.now(), result: false };
      toast.error(errorMessage);
    } finally {
      setIsChecking(false);
    }
  }, [toast]);

  const resetConnection = useCallback(async () => {
    setIsChecking(true);
    setConnectionError(null);
    
    try {
      toast.info('Reconnecting to backend...');
      // Clear cache on manual reconnect
      lastHealthCheck = null;
      await checkConnection();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reconnect to backend API';
      setConnectionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsChecking(false);
    }
  }, [checkConnection, toast]);

  // Check connection on mount (but only once per component lifecycle)
  useEffect(() => {
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      checkConnection();
    }
  }, [checkConnection]);

  return {
    isConnected,
    isChecking,
    connectionError,
    checkConnection,
    resetConnection,
  };
};
