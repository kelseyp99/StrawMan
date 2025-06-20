import React, { createContext, useContext, useState, useCallback } from 'react';

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
      const { syncFromRemote } = await import('../../src/services/dbServices');
      await syncFromRemote();
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
