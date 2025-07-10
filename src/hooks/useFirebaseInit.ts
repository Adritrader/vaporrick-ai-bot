import { useState, useEffect, useCallback } from 'react';
import { firebaseInitService } from '../services/firebaseInitService';

interface UseFirebaseInitResult {
  isInitializing: boolean;
  isInitialized: boolean;
  initError: string | null;
  initStats: {
    gems: number;
    strategies: number;
    autoTrades: number;
    marketData: number;
    opportunities: number;
    isInitialized: boolean;
  } | null;
  initializeFirebase: () => Promise<void>;
  reinitializeFirebase: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

/**
 * Hook para manejar la inicialización automática de Firebase
 * con datos de ejemplo y estadísticas de estado
 */
export const useFirebaseInit = (): UseFirebaseInitResult => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initStats, setInitStats] = useState<UseFirebaseInitResult['initStats']>(null);

  // Función para obtener estadísticas de inicialización
  const refreshStats = useCallback(async () => {
    try {
      const stats = await firebaseInitService.getInitStats();
      setInitStats(stats);
      setIsInitialized(stats.isInitialized);
    } catch (error) {
      console.error('Error refreshing Firebase init stats:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  // Función para inicializar Firebase
  const initializeFirebase = useCallback(async () => {
    if (isInitializing) return;

    setIsInitializing(true);
    setInitError(null);

    try {
      console.log('🔥 Starting Firebase initialization...');
      const success = await firebaseInitService.initializeCollections();
      
      if (success) {
        console.log('✅ Firebase initialization completed');
        await refreshStats();
      } else {
        throw new Error('Firebase initialization failed');
      }
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown error');
      setIsInitialized(false);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, refreshStats]);

  // Función para re-inicializar Firebase (útil para desarrollo)
  const reinitializeFirebase = useCallback(async () => {
    if (isInitializing) return;

    setIsInitializing(true);
    setInitError(null);

    try {
      console.log('🔄 Re-initializing Firebase...');
      const success = await firebaseInitService.reinitialize();
      
      if (success) {
        console.log('✅ Firebase re-initialization completed');
        await refreshStats();
      } else {
        throw new Error('Firebase re-initialization failed');
      }
    } catch (error) {
      console.error('❌ Firebase re-initialization error:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, refreshStats]);

  // Verificar estado de inicialización al montar el componente
  useEffect(() => {
    let mounted = true;

    const checkInitialization = async () => {
      try {
        const initialized = await firebaseInitService.isInitialized();
        
        if (mounted) {
          setIsInitialized(initialized);
          
          // Si no está inicializado, inicializar automáticamente
          if (!initialized) {
            console.log('🔥 Firebase not initialized, starting auto-initialization...');
            await initializeFirebase();
          } else {
            // Si ya está inicializado, obtener estadísticas
            await refreshStats();
          }
        }
      } catch (error) {
        if (mounted) {
          console.error('Error checking Firebase initialization:', error);
          setInitError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    };

    checkInitialization();

    return () => {
      mounted = false;
    };
  }, [initializeFirebase, refreshStats]);

  return {
    isInitializing,
    isInitialized,
    initError,
    initStats,
    initializeFirebase,
    reinitializeFirebase,
    refreshStats
  };
};

export default useFirebaseInit;
