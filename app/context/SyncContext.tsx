import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncFromRemote } from '../../src/services/dbServices';

interface SyncContextType {
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
  lastSync: number;
}

const SyncContext = createContext<SyncContextType>({
  isSyncing: false,
  triggerSync: async () => {},
  lastSync: 0,
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(Date.now());

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Check if user is paid and has sync enabled before syncing
      const paid = await AsyncStorage.getItem('isPaidCustomer');
      const syncEnabled = await AsyncStorage.getItem('syncWithCloud');

      if (paid === 'true' && syncEnabled === 'true') {
        console.log('[SYNC] Starting sync for paid user...');
        await syncFromRemote();
        console.log('[SYNC] Sync complete');
      } else {
        console.log('[SYNC] Sync skipped - user not paid or sync disabled');
      }

      setLastSync(Date.now());
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return (
    <SyncContext.Provider value={{ isSyncing, triggerSync, lastSync }}>
      {children}
    </SyncContext.Provider>
  );
};

export default SyncProvider;
