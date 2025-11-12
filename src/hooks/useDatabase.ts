import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../services/DatabaseService';
import { useToast } from '../contexts/ToastContext';

interface UseDatabaseReturn {
  isConnected: boolean;
  isChecking: boolean;
  connectionError: string | null;
  checkConnection: () => Promise<void>;
  resetConnection: () => Promise<void>;
}

/**
 * Hook to manage database connection state and health checks
 */
export const useDatabase = (): UseDatabaseReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const toast = useToast();

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    setConnectionError(null);
    
    try {
      const healthy = await databaseService.testConnection();
      setIsConnected(healthy);
      
      if (!healthy) {
        const error = 'Database connection is not healthy';
        setConnectionError(error);
        toast.error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check database connection';
      setConnectionError(errorMessage);
      setIsConnected(false);
      toast.error(errorMessage);
    } finally {
      setIsChecking(false);
    }
  }, [toast]);

  const resetConnection = useCallback(async () => {
    setIsChecking(true);
    setConnectionError(null);
    
    try {
      await databaseService.resetConnection();
      toast.info('Database connection reset. Reconnecting...');
      await checkConnection();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset database connection';
      setConnectionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsChecking(false);
    }
  }, [checkConnection, toast]);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    isConnected,
    isChecking,
    connectionError,
    checkConnection,
    resetConnection,
  };
};
